package interview.guide.modules.interview.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.common.util.JsonParseUtils;
import interview.guide.infrastructure.export.PdfExportService;
import interview.guide.infrastructure.mapper.InterviewMapper;
import interview.guide.modules.interview.model.InterviewAnswerEntity;
import interview.guide.modules.interview.model.InterviewDetailDTO;
import interview.guide.modules.interview.model.InterviewQuestionDTO;
import interview.guide.modules.interview.model.InterviewSessionEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Optional;

/**
 * Interview history service for session details and PDF export.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InterviewHistoryService {

    private final InterviewPersistenceService interviewPersistenceService;
    private final PdfExportService pdfExportService;
    private final ObjectMapper objectMapper;
    private final InterviewMapper interviewMapper;

    /**
     * Get interview session detail.
     */
    public InterviewDetailDTO getInterviewDetail(String userId, String sessionId) {
        Optional<InterviewSessionEntity> sessionOpt = interviewPersistenceService.findBySessionIdAndUserId(sessionId, userId);
        if (sessionOpt.isEmpty()) {
            throw new BusinessException(ErrorCode.INTERVIEW_SESSION_NOT_FOUND);
        }

        InterviewSessionEntity session = sessionOpt.get();

        List<Object> questions = JsonParseUtils.parseOrDefault(
            objectMapper,
            session.getQuestionsJson(),
            new TypeReference<>() {
            },
            null,
            log,
            "Failed to parse questions JSON"
        );
        List<String> strengths = JsonParseUtils.parseOrDefault(
            objectMapper,
            session.getStrengthsJson(),
            new TypeReference<>() {
            },
            null,
            log,
            "Failed to parse strengths JSON"
        );
        List<String> improvements = JsonParseUtils.parseOrDefault(
            objectMapper,
            session.getImprovementsJson(),
            new TypeReference<>() {
            },
            null,
            log,
            "Failed to parse improvements JSON"
        );
        List<Object> referenceAnswers = JsonParseUtils.parseOrDefault(
            objectMapper,
            session.getReferenceAnswersJson(),
            new TypeReference<>() {
            },
            null,
            log,
            "Failed to parse reference answers JSON"
        );

        List<InterviewQuestionDTO> allQuestions = JsonParseUtils.parseOrDefault(
            objectMapper,
            session.getQuestionsJson(),
            new TypeReference<>() {
            },
            List.of(),
            log,
            "Failed to parse question DTO JSON"
        );

        List<InterviewDetailDTO.AnswerDetailDTO> answerList = buildAnswerDetailList(
            allQuestions,
            session.getAnswers()
        );

        return interviewMapper.toDetailDTO(
            session,
            questions,
            strengths,
            improvements,
            referenceAnswers,
            answerList
        );
    }

    /**
     * Build answer detail list, including unanswered questions.
     */
    private List<InterviewDetailDTO.AnswerDetailDTO> buildAnswerDetailList(
        List<InterviewQuestionDTO> allQuestions,
        List<InterviewAnswerEntity> answers
    ) {
        if (allQuestions == null || allQuestions.isEmpty()) {
            return interviewMapper.toAnswerDetailDTOList(answers, this::extractKeyPoints);
        }

        java.util.Map<Integer, InterviewAnswerEntity> answerMap = answers.stream()
            .collect(java.util.stream.Collectors.toMap(
                InterviewAnswerEntity::getQuestionIndex,
                a -> a,
                (a1, a2) -> a1
            ));

        return allQuestions.stream()
            .map(question -> {
                InterviewAnswerEntity answer = answerMap.get(question.questionIndex());
                if (answer != null) {
                    return interviewMapper.toAnswerDetailDTO(answer, extractKeyPoints(answer));
                } else {
                    return new InterviewDetailDTO.AnswerDetailDTO(
                        question.questionIndex(),
                        question.question(),
                        question.category(),
                        null,
                        question.score() != null ? question.score() : 0,
                        question.feedback(),
                        null,
                        null,
                        null
                    );
                }
            })
            .toList();
    }

    /**
     * Extract key points from JSON.
     */
    private List<String> extractKeyPoints(InterviewAnswerEntity answer) {
        return JsonParseUtils.parseOrDefault(
            objectMapper,
            answer.getKeyPointsJson(),
            new TypeReference<>() {
            },
            null,
            log,
            "Failed to parse keyPoints JSON"
        );
    }

    /**
     * Export interview report as PDF.
     */
    public byte[] exportInterviewPdf(String userId, String sessionId) {
        Optional<InterviewSessionEntity> sessionOpt = interviewPersistenceService.findBySessionIdAndUserId(sessionId, userId);
        if (sessionOpt.isEmpty()) {
            throw new BusinessException(ErrorCode.INTERVIEW_SESSION_NOT_FOUND);
        }

        InterviewSessionEntity session = sessionOpt.get();
        try {
            return pdfExportService.exportInterviewReport(session);
        } catch (Exception e) {
            log.error("PDF export failed: sessionId={}", sessionId, e);
            throw new BusinessException(ErrorCode.EXPORT_PDF_FAILED, "PDF export failed: " + e.getMessage());
        }
    }
}
