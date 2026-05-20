package interview.guide.modules.interview.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.common.model.AsyncTaskStatus;
import interview.guide.common.util.JsonParseUtils;
import interview.guide.infrastructure.redis.InterviewSessionCache;
import interview.guide.infrastructure.redis.InterviewSessionCache.CachedSession;
import interview.guide.modules.interview.listener.EvaluateStreamProducer;
import interview.guide.modules.interview.model.CreateInterviewRequest;
import interview.guide.modules.interview.model.InterviewAnswerEntity;
import interview.guide.modules.interview.model.InterviewMode;
import interview.guide.modules.interview.model.InterviewQuestionDTO;
import interview.guide.modules.interview.model.InterviewReportDTO;
import interview.guide.modules.interview.model.InterviewSessionDTO;
import interview.guide.modules.interview.model.InterviewSessionDTO.SessionStatus;
import interview.guide.modules.interview.model.InterviewSessionEntity;
import interview.guide.modules.interview.model.SubmitAnswerRequest;
import interview.guide.modules.interview.model.SubmitAnswerResponse;
import interview.guide.modules.resume.repository.ResumeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Interview session lifecycle service.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InterviewSessionService {

    private static final int DEFAULT_ORAL_QUESTION_COUNT = 8;
    private static final Set<String> GIVE_UP_ANSWER_TOKENS = Set.of(
        "不知道", "不清楚", "不太清楚", "不会", "没学过", "忘了", "忘记了", "不太会",
        "不太懂", "不会做", "答不上来", "答不出来", "没思路", "跳过", "不了解",
        "不熟", "none", "noidea", "idk", "skip"
    );

    private final InterviewQuestionService questionService;
    private final AnswerEvaluationService evaluationService;
    private final InterviewPersistenceService persistenceService;
    private final ResumeRepository resumeRepository;
    private final InterviewSessionCache sessionCache;
    private final ObjectMapper objectMapper;
    private final EvaluateStreamProducer evaluateStreamProducer;
    private final InterviewDialogueAiService dialogueAiService;

    public InterviewSessionDTO createSession(String userId, CreateInterviewRequest request) {
        if (request.resumeId() != null) {
            requireResumeOwner(userId, request.resumeId());
        }

        InterviewMode mode = resolveMode(request.mode());
        String interviewerStyle = sanitizeStyle(request.interviewerStyle());

        if (request.resumeId() != null && !Boolean.TRUE.equals(request.forceCreate())) {
            Optional<InterviewSessionDTO> unfinishedOpt = findUnfinishedSession(userId, request.resumeId(), mode);
            if (unfinishedOpt.isPresent()) {
                log.info(
                    "Returning unfinished interview session: resumeId={}, mode={}, sessionId={}",
                    request.resumeId(),
                    mode,
                    unfinishedOpt.get().sessionId()
                );
                return unfinishedOpt.get();
            }
        }

        String sessionId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        int questionCount = mode == InterviewMode.ORAL && request.questionCount() <= 0
            ? DEFAULT_ORAL_QUESTION_COUNT
            : request.questionCount();

        List<String> historicalQuestions = (request.resumeId() == null || mode == InterviewMode.ORAL)
            ? null
            : persistenceService.getHistoricalQuestionsByResumeId(request.resumeId());

        List<InterviewQuestionDTO> questions = questionService.generateQuestions(
            request.resumeText(),
            questionCount,
            historicalQuestions
        );

        sessionCache.saveSession(
            sessionId,
            request.resumeText(),
            request.resumeId(),
            questions,
            0,
            SessionStatus.CREATED,
            mode,
            interviewerStyle
        );

        if (request.resumeId() != null) {
            try {
                persistenceService.saveSession(
                    sessionId,
                    request.resumeId(),
                    questions.size(),
                    questions,
                    mode,
                    interviewerStyle
                );
            } catch (Exception exception) {
                log.warn("Failed to persist interview session: {}", exception.getMessage());
            }
        }

        return new InterviewSessionDTO(
            sessionId,
            request.resumeText(),
            questions.size(),
            0,
            questions,
            SessionStatus.CREATED,
            mode,
            interviewerStyle
        );
    }

    public InterviewSessionDTO getSession(String userId, String sessionId) {
        Optional<CachedSession> cachedOpt = sessionCache.getSession(sessionId);
        if (cachedOpt.isPresent()) {
            CachedSession cached = cachedOpt.get();
            if (cached.getResumeId() != null) {
                requireResumeOwner(userId, cached.getResumeId());
            }
            return toDTO(cached);
        }

        CachedSession restoredSession = restoreSessionFromDatabase(userId, sessionId);
        if (restoredSession == null) {
            throw new BusinessException(ErrorCode.INTERVIEW_SESSION_NOT_FOUND);
        }
        return toDTO(restoredSession);
    }

    public Optional<InterviewSessionDTO> findUnfinishedSession(String userId, Long resumeId) {
        return findUnfinishedSession(userId, resumeId, InterviewMode.WRITTEN);
    }

    public Optional<InterviewSessionDTO> findUnfinishedSession(String userId, Long resumeId, InterviewMode mode) {
        requireResumeOwner(userId, resumeId);
        InterviewMode resolvedMode = resolveMode(mode);
        try {
            Optional<String> cachedSessionIdOpt = sessionCache.findUnfinishedSessionId(resumeId, resolvedMode);
            if (cachedSessionIdOpt.isPresent()) {
                String sessionId = cachedSessionIdOpt.get();
                Optional<CachedSession> cachedOpt = sessionCache.getSession(sessionId);
                if (cachedOpt.isPresent()) {
                    return Optional.of(toDTO(cachedOpt.get()));
                }
            }

            Optional<InterviewSessionEntity> entityOpt = persistenceService.findUnfinishedSession(resumeId, resolvedMode);
            if (entityOpt.isEmpty()) {
                return Optional.empty();
            }

            CachedSession restoredSession = restoreSessionFromEntity(entityOpt.get());
            return restoredSession == null ? Optional.empty() : Optional.of(toDTO(restoredSession));
        } catch (Exception exception) {
            log.error("Failed to restore unfinished interview session", exception);
            return Optional.empty();
        }
    }

    public InterviewSessionDTO findUnfinishedSessionOrThrow(String userId, Long resumeId) {
        return findUnfinishedSession(userId, resumeId, InterviewMode.WRITTEN)
            .orElseThrow(() -> new BusinessException(ErrorCode.INTERVIEW_SESSION_NOT_FOUND, "未找到未完成的面试"));
    }

    public Map<String, Object> getCurrentQuestionResponse(String userId, String sessionId) {
        InterviewQuestionDTO question = getCurrentQuestion(userId, sessionId);
        if (question == null) {
            return Map.of("completed", true, "message", "所有问题都已完成");
        }
        return Map.of("completed", false, "question", question);
    }

    public InterviewQuestionDTO getCurrentQuestion(String userId, String sessionId) {
        CachedSession session = getOrRestoreSession(userId, sessionId);
        List<InterviewQuestionDTO> questions = session.getQuestions(objectMapper);

        if (session.getCurrentIndex() >= questions.size()) {
            return null;
        }

        if (session.getStatus() == SessionStatus.CREATED) {
            session.setStatus(SessionStatus.IN_PROGRESS);
            sessionCache.updateSessionStatus(sessionId, SessionStatus.IN_PROGRESS);
            try {
                persistenceService.updateSessionStatus(sessionId, InterviewSessionEntity.SessionStatus.IN_PROGRESS);
            } catch (Exception exception) {
                log.warn("Failed to update session status: {}", exception.getMessage());
            }
        }

        return questions.get(session.getCurrentIndex());
    }

    public SubmitAnswerResponse submitAnswer(String userId, SubmitAnswerRequest request) {
        AdvanceSessionResult result = advanceSession(userId, request);
        return new SubmitAnswerResponse(
            result.hasNextQuestion(),
            result.nextQuestion(),
            result.currentIndex(),
            result.totalQuestions()
        );
    }

    public void submitAnswerStream(String userId, SubmitAnswerRequest request, OutputStream outputStream) throws IOException {
        AdvanceSessionResult result = advanceSession(userId, request);

        writeEvent(outputStream, Map.of(
            "type", "meta",
            "hasNextQuestion", result.hasNextQuestion(),
            "currentIndex", result.currentIndex(),
            "totalQuestions", result.totalQuestions(),
            "nextQuestion", result.nextQuestion()
        ));

        String fullMessage;
        try {
            fullMessage = dialogueAiService.streamInterviewerTurn(
                new InterviewDialogueAiService.InterviewerTurnInput(
                    result.resumeText(),
                    result.currentQuestion(),
                    result.nextQuestion(),
                    request.answer(),
                    result.interviewerStyle()
                ),
                chunk -> {
                    try {
                        writeEvent(outputStream, Map.of("type", "chunk", "content", chunk));
                    } catch (IOException exception) {
                        throw new UncheckedIOException(exception);
                    }
                }
            );
        } catch (UncheckedIOException exception) {
            throw exception.getCause();
        }

        writeEvent(outputStream, Map.of(
            "type", "done",
            "message", fullMessage,
            "hasNextQuestion", result.hasNextQuestion(),
            "currentIndex", result.currentIndex(),
            "totalQuestions", result.totalQuestions(),
            "nextQuestion", result.nextQuestion()
        ));
    }

    public void saveAnswer(String userId, SubmitAnswerRequest request) {
        CachedSession session = getOrRestoreSession(userId, request.sessionId());
        List<InterviewQuestionDTO> questions = new ArrayList<>(session.getQuestions(objectMapper));

        int index = request.questionIndex();
        validateQuestionIndex(index, questions.size());

        InterviewQuestionDTO question = questions.get(index).withAnswer(request.answer());
        questions.set(index, question);

        sessionCache.updateQuestions(request.sessionId(), questions);
        if (session.getStatus() == SessionStatus.CREATED) {
            sessionCache.updateSessionStatus(request.sessionId(), SessionStatus.IN_PROGRESS);
        }

        try {
            persistenceService.saveAnswer(
                request.sessionId(),
                index,
                question.question(),
                question.category(),
                request.answer(),
                0,
                null
            );
            persistenceService.updateQuestions(request.sessionId(), questions);
            persistenceService.updateSessionStatus(request.sessionId(), InterviewSessionEntity.SessionStatus.IN_PROGRESS);
        } catch (Exception exception) {
            log.warn("Failed to save answer draft: {}", exception.getMessage());
        }
    }

    public void completeInterview(String userId, String sessionId) {
        CachedSession session = getOrRestoreSession(userId, sessionId);

        if (session.getStatus() == SessionStatus.COMPLETED || session.getStatus() == SessionStatus.EVALUATED) {
            throw new BusinessException(ErrorCode.INTERVIEW_ALREADY_COMPLETED);
        }

        sessionCache.updateSessionStatus(sessionId, SessionStatus.COMPLETED);
        try {
            persistenceService.updateCurrentQuestionIndex(sessionId, session.getQuestions(objectMapper).size());
            persistenceService.updateSessionStatus(sessionId, InterviewSessionEntity.SessionStatus.COMPLETED);
            persistenceService.updateEvaluateStatus(sessionId, AsyncTaskStatus.PENDING, null);
        } catch (Exception exception) {
            log.warn("Failed to complete interview early: {}", exception.getMessage());
        }

        evaluateStreamProducer.sendEvaluateTask(sessionId);
        log.info("Interview session completed early: {}", sessionId);
    }

    public InterviewReportDTO generateReport(String userId, String sessionId) {
        CachedSession session = getOrRestoreSession(userId, sessionId);

        if (session.getStatus() != SessionStatus.COMPLETED && session.getStatus() != SessionStatus.EVALUATED) {
            throw new BusinessException(ErrorCode.INTERVIEW_NOT_COMPLETED, "面试尚未完成");
        }

        List<InterviewQuestionDTO> questions = session.getQuestions(objectMapper);
        InterviewReportDTO report = evaluationService.evaluateInterview(sessionId, session.getResumeText(), questions);

        sessionCache.updateSessionStatus(sessionId, SessionStatus.EVALUATED);
        try {
            persistenceService.saveReport(sessionId, report);
        } catch (Exception exception) {
            log.warn("Failed to save interview report: {}", exception.getMessage());
        }
        return report;
    }

    public String answerOralFollowUp(String userId, String sessionId, String question) {
        String normalizedQuestion = question == null ? "" : question.trim();
        if (normalizedQuestion.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请输入追问内容");
        }

        CachedSession session = getOrRestoreSession(userId, sessionId);
        if (session.getStatus() != SessionStatus.COMPLETED && session.getStatus() != SessionStatus.EVALUATED) {
            throw new BusinessException(ErrorCode.INTERVIEW_NOT_COMPLETED, "面试尚未结束，暂时不能进入收尾答疑");
        }

        InterviewSessionEntity entity = persistenceService.findBySessionIdAndUserId(sessionId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.INTERVIEW_SESSION_NOT_FOUND));

        if (entity.getOverallFeedback() == null || entity.getOverallFeedback().isBlank()) {
            generateReport(userId, sessionId);
            entity = persistenceService.findBySessionIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.INTERVIEW_SESSION_NOT_FOUND));
        }

        List<String> strengths = JsonParseUtils.parseOrDefault(
            objectMapper,
            entity.getStrengthsJson(),
            new TypeReference<>() {
            },
            List.of(),
            log,
            "Failed to parse interview strengths JSON"
        );
        List<String> improvements = JsonParseUtils.parseOrDefault(
            objectMapper,
            entity.getImprovementsJson(),
            new TypeReference<>() {
            },
            List.of(),
            log,
            "Failed to parse interview improvements JSON"
        );

        return dialogueAiService.answerPostInterviewQuestion(
            new InterviewDialogueAiService.PostInterviewQuestionInput(
                session.getResumeText(),
                entity.getOverallScore() == null ? 0 : entity.getOverallScore(),
                entity.getOverallFeedback(),
                strengths,
                improvements,
                normalizedQuestion,
                session.getInterviewerStyle()
            )
        );
    }

    private AdvanceSessionResult advanceSession(String userId, SubmitAnswerRequest request) {
        CachedSession session = getOrRestoreSession(userId, request.sessionId());
        List<InterviewQuestionDTO> questions = new ArrayList<>(session.getQuestions(objectMapper));

        int index = request.questionIndex();
        validateQuestionIndex(index, questions.size());

        InterviewQuestionDTO currentQuestion = questions.get(index);
        InterviewQuestionDTO answeredQuestion = currentQuestion.withAnswer(request.answer());
        questions.set(index, answeredQuestion);

        questions = maybeInsertFollowUp(
            session.getResumeText(),
            questions,
            index,
            answeredQuestion,
            session.getMode() == null ? InterviewMode.WRITTEN : session.getMode()
        );

        int newIndex = index + 1;
        boolean hasNextQuestion = newIndex < questions.size();
        InterviewQuestionDTO nextQuestion = hasNextQuestion ? questions.get(newIndex) : null;
        SessionStatus newStatus = hasNextQuestion ? SessionStatus.IN_PROGRESS : SessionStatus.COMPLETED;

        sessionCache.updateQuestions(request.sessionId(), questions);
        sessionCache.updateCurrentIndex(request.sessionId(), newIndex);
        sessionCache.updateSessionStatus(request.sessionId(), newStatus);

        try {
            persistenceService.saveAnswer(
                request.sessionId(),
                index,
                currentQuestion.question(),
                currentQuestion.category(),
                request.answer(),
                0,
                null
            );
            persistenceService.updateQuestions(request.sessionId(), questions);
            persistenceService.updateCurrentQuestionIndex(request.sessionId(), newIndex);
            persistenceService.updateSessionStatus(
                request.sessionId(),
                hasNextQuestion
                    ? InterviewSessionEntity.SessionStatus.IN_PROGRESS
                    : InterviewSessionEntity.SessionStatus.COMPLETED
            );

            if (!hasNextQuestion) {
                persistenceService.updateEvaluateStatus(request.sessionId(), AsyncTaskStatus.PENDING, null);
                evaluateStreamProducer.sendEvaluateTask(request.sessionId());
                log.info("Interview session completed, evaluation queued: {}", request.sessionId());
            }
        } catch (Exception exception) {
            log.warn("Failed to persist interview progress: {}", exception.getMessage());
        }

        return new AdvanceSessionResult(
            request.sessionId(),
            session.getResumeText(),
            answeredQuestion,
            nextQuestion,
            hasNextQuestion,
            newIndex,
            questions.size(),
            session.getMode() == null ? InterviewMode.WRITTEN : session.getMode(),
            session.getInterviewerStyle()
        );
    }

    private List<InterviewQuestionDTO> maybeInsertFollowUp(
        String resumeText,
        List<InterviewQuestionDTO> questions,
        int currentIndex,
        InterviewQuestionDTO currentQuestion,
        InterviewMode mode
    ) {
        if (currentQuestion == null || currentQuestion.isFollowUp()) {
            return reindexQuestions(questions);
        }

        List<String> followUpCandidates = currentQuestion.followUpCandidates() == null
            ? List.of()
            : currentQuestion.followUpCandidates().stream().filter(item -> item != null && !item.isBlank()).toList();
        if (followUpCandidates.isEmpty()) {
            return reindexQuestions(questions);
        }

        if (currentIndex >= questions.size() - 1) {
            return reindexQuestions(questions);
        }

        if (mode == InterviewMode.ORAL) {
            return maybeInsertOralFollowUpQuickly(questions, currentIndex, currentQuestion, followUpCandidates);
        }

        List<InterviewQuestionDTO> history = extractAnsweredHistory(questions, currentIndex);
        InterviewDialogueAiService.FollowUpDecision decision = dialogueAiService.decideFollowUp(
            resumeText,
            currentQuestion,
            currentQuestion.userAnswer(),
            followUpCandidates,
            history
        );

        if (!decision.askFollowUp()) {
            return reindexQuestions(questions);
        }

        List<InterviewQuestionDTO> updated = new ArrayList<>(questions);
        updated.set(currentIndex, currentQuestion.withFollowUpCandidates(List.of()));
        updated.add(
            currentIndex + 1,
            InterviewQuestionDTO.create(
                currentIndex + 1,
                decision.selectedFollowUp(),
                currentQuestion.type(),
                buildFollowUpCategory(currentQuestion.category()),
                true,
                currentIndex
            )
        );
        updated.remove(updated.size() - 1);

        return reindexQuestions(updated);
    }

    private List<InterviewQuestionDTO> maybeInsertOralFollowUpQuickly(
        List<InterviewQuestionDTO> questions,
        int currentIndex,
        InterviewQuestionDTO currentQuestion,
        List<String> followUpCandidates
    ) {
        if (!shouldAskOralFollowUp(currentQuestion.userAnswer(), currentQuestion.category())) {
            return reindexQuestions(questions);
        }

        List<InterviewQuestionDTO> updated = new ArrayList<>(questions);
        updated.set(currentIndex, currentQuestion.withFollowUpCandidates(List.of()));
        updated.add(
            currentIndex + 1,
            InterviewQuestionDTO.create(
                currentIndex + 1,
                followUpCandidates.get(0),
                currentQuestion.type(),
                buildFollowUpCategory(currentQuestion.category()),
                true,
                currentIndex
            )
        );
        updated.remove(updated.size() - 1);

        return reindexQuestions(updated);
    }

    private boolean shouldAskOralFollowUp(String answer, String category) {
        String normalized = normalizeAnswer(answer);
        if (normalized.isBlank()) {
            return false;
        }

        boolean looksLikeGiveUp = GIVE_UP_ANSWER_TOKENS.stream()
            .map(this::normalizeAnswer)
            .anyMatch(normalized::contains);
        if (looksLikeGiveUp) {
            return true;
        }

        int answerLength = normalized.length();
        if (answerLength < 26) {
            return true;
        }

        String normalizedCategory = category == null ? "" : category.toLowerCase(Locale.ROOT);
        boolean deepDiveCategory = normalizedCategory.contains("项目")
            || normalizedCategory.contains("场景")
            || normalizedCategory.contains("问题")
            || normalizedCategory.contains("复盘");
        return deepDiveCategory && answerLength < 48;
    }

    private String normalizeAnswer(String answer) {
        if (answer == null) {
            return "";
        }

        return answer.trim()
            .toLowerCase(Locale.ROOT)
            .replaceAll("[\\p{Punct}\\p{IsPunctuation}\\s]+", "");
    }

    private List<InterviewQuestionDTO> extractAnsweredHistory(List<InterviewQuestionDTO> questions, int currentIndex) {
        List<InterviewQuestionDTO> history = new ArrayList<>();
        int start = Math.max(0, currentIndex - 3);
        for (int index = start; index <= currentIndex; index++) {
            InterviewQuestionDTO item = questions.get(index);
            if (item.userAnswer() != null && !item.userAnswer().isBlank()) {
                history.add(item);
            }
        }
        return history;
    }

    private List<InterviewQuestionDTO> reindexQuestions(List<InterviewQuestionDTO> questions) {
        List<InterviewQuestionDTO> normalized = new ArrayList<>(questions.size());
        Map<Integer, Integer> indexMap = new LinkedHashMap<>();

        for (int index = 0; index < questions.size(); index++) {
            indexMap.put(questions.get(index).questionIndex(), index);
        }

        for (int index = 0; index < questions.size(); index++) {
            InterviewQuestionDTO question = questions.get(index);
            Integer parentIndex = question.parentQuestionIndex() == null
                ? null
                : indexMap.get(question.parentQuestionIndex());
            normalized.add(new InterviewQuestionDTO(
                index,
                question.question(),
                question.type(),
                question.category(),
                question.userAnswer(),
                question.score(),
                question.feedback(),
                question.isFollowUp(),
                parentIndex,
                question.followUpCandidates() == null ? List.of() : question.followUpCandidates()
            ));
        }

        return normalized;
    }

    private String buildFollowUpCategory(String category) {
        String base = category == null || category.isBlank() ? "追问" : category;
        return base + "（追问）";
    }

    private CachedSession restoreSessionFromDatabase(String userId, String sessionId) {
        try {
            Optional<InterviewSessionEntity> entityOpt = persistenceService.findBySessionIdAndUserId(sessionId, userId);
            return entityOpt.map(this::restoreSessionFromEntity).orElse(null);
        } catch (Exception exception) {
            log.error("Failed to restore session from database", exception);
            return null;
        }
    }

    private CachedSession restoreSessionFromEntity(InterviewSessionEntity entity) {
        try {
            List<InterviewQuestionDTO> questions = objectMapper.readValue(
                entity.getQuestionsJson(),
                new TypeReference<>() {
                }
            );

            List<InterviewAnswerEntity> answers = persistenceService.findAnswersBySessionId(entity.getSessionId());
            for (InterviewAnswerEntity answer : answers) {
                int index = answer.getQuestionIndex();
                if (index >= 0 && index < questions.size()) {
                    InterviewQuestionDTO question = questions.get(index);
                    questions.set(index, question.withAnswer(answer.getUserAnswer()));
                }
            }

            SessionStatus status = switch (entity.getStatus()) {
                case CREATED -> SessionStatus.CREATED;
                case IN_PROGRESS -> SessionStatus.IN_PROGRESS;
                case COMPLETED -> SessionStatus.COMPLETED;
                case EVALUATED -> SessionStatus.EVALUATED;
            };

            sessionCache.saveSession(
                entity.getSessionId(),
                entity.getResume().getResumeText(),
                entity.getResume().getId(),
                questions,
                entity.getCurrentQuestionIndex(),
                status,
                entity.getMode(),
                entity.getInterviewerStyle()
            );

            return sessionCache.getSession(entity.getSessionId()).orElse(null);
        } catch (Exception exception) {
            log.error("Failed to restore session entity", exception);
            return null;
        }
    }

    private CachedSession getOrRestoreSession(String userId, String sessionId) {
        Optional<CachedSession> cachedOpt = sessionCache.getSession(sessionId);
        if (cachedOpt.isPresent()) {
            CachedSession cached = cachedOpt.get();
            if (cached.getResumeId() != null) {
                requireResumeOwner(userId, cached.getResumeId());
            }
            sessionCache.refreshSessionTTL(sessionId);
            return cached;
        }

        CachedSession restoredSession = restoreSessionFromDatabase(userId, sessionId);
        if (restoredSession == null) {
            throw new BusinessException(ErrorCode.INTERVIEW_SESSION_NOT_FOUND);
        }
        return restoredSession;
    }

    private void requireResumeOwner(String userId, Long resumeId) {
        if (resumeId == null) {
            return;
        }
        if (resumeRepository.findByIdAndUserId(resumeId, userId).isEmpty()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "无权访问该简历");
        }
    }

    private InterviewSessionDTO toDTO(CachedSession session) {
        List<InterviewQuestionDTO> questions = session.getQuestions(objectMapper);
        return new InterviewSessionDTO(
            session.getSessionId(),
            session.getResumeText(),
            questions.size(),
            session.getCurrentIndex(),
            questions,
            session.getStatus(),
            session.getMode() == null ? InterviewMode.WRITTEN : session.getMode(),
            session.getInterviewerStyle()
        );
    }

    private InterviewMode resolveMode(InterviewMode mode) {
        return mode == null ? InterviewMode.WRITTEN : mode;
    }

    private String sanitizeStyle(String style) {
        if (style == null) {
            return null;
        }
        String value = style.trim();
        if (value.isEmpty()) {
            return null;
        }
        return value.length() > 40 ? value.substring(0, 40) : value;
    }

    private void writeEvent(OutputStream outputStream, Object payload) throws IOException {
        outputStream.write(objectMapper.writeValueAsBytes(payload));
        outputStream.write('\n');
        outputStream.flush();
    }

    private void validateQuestionIndex(int index, int upperBound) {
        if (index < 0 || index >= upperBound) {
            throw new BusinessException(ErrorCode.INTERVIEW_QUESTION_NOT_FOUND, "题目索引无效");
        }
    }

    private record AdvanceSessionResult(
        String sessionId,
        String resumeText,
        InterviewQuestionDTO currentQuestion,
        InterviewQuestionDTO nextQuestion,
        boolean hasNextQuestion,
        int currentIndex,
        int totalQuestions,
        InterviewMode mode,
        String interviewerStyle
    ) {
    }
}
