package interview.guide.infrastructure.redis;

import interview.guide.modules.interview.model.InterviewMode;
import interview.guide.modules.interview.model.InterviewQuestionDTO;
import interview.guide.modules.interview.model.InterviewSessionDTO.SessionStatus;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.io.Serializable;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

/**
 * Redis cache for interview sessions.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InterviewSessionCache {

    private final RedisService redisService;
    private final ObjectMapper objectMapper;

    private static final String SESSION_KEY_PREFIX = "interview:session:";
    private static final String RESUME_SESSION_KEY_PREFIX = "interview:resume:";
    private static final Duration SESSION_TTL = Duration.ofHours(24);

    @Data
    public static class CachedSession implements Serializable {
        private String sessionId;
        private String resumeText;
        private Long resumeId;
        private String questionsJson;
        private int currentIndex;
        private SessionStatus status;
        private InterviewMode mode = InterviewMode.WRITTEN;
        private String interviewerStyle;

        public CachedSession() {
        }

        public CachedSession(String sessionId,
                             String resumeText,
                             Long resumeId,
                             List<InterviewQuestionDTO> questions,
                             int currentIndex,
                             SessionStatus status,
                             ObjectMapper objectMapper,
                             InterviewMode mode,
                             String interviewerStyle) {
            this.sessionId = sessionId;
            this.resumeText = resumeText;
            this.resumeId = resumeId;
            this.currentIndex = currentIndex;
            this.status = status;
            this.mode = mode == null ? InterviewMode.WRITTEN : mode;
            this.interviewerStyle = interviewerStyle;
            try {
                this.questionsJson = objectMapper.writeValueAsString(questions);
            } catch (JacksonException exception) {
                throw new RuntimeException("Failed to serialize interview questions", exception);
            }
        }

        public List<InterviewQuestionDTO> getQuestions(ObjectMapper objectMapper) {
            try {
                return objectMapper.readValue(questionsJson, new TypeReference<>() {
                });
            } catch (JacksonException exception) {
                throw new RuntimeException("Failed to deserialize interview questions", exception);
            }
        }
    }

    public void saveSession(String sessionId,
                            String resumeText,
                            Long resumeId,
                            List<InterviewQuestionDTO> questions,
                            int currentIndex,
                            SessionStatus status) {
        saveSession(
            sessionId,
            resumeText,
            resumeId,
            questions,
            currentIndex,
            status,
            InterviewMode.WRITTEN,
            null
        );
    }

    public void saveSession(String sessionId,
                            String resumeText,
                            Long resumeId,
                            List<InterviewQuestionDTO> questions,
                            int currentIndex,
                            SessionStatus status,
                            InterviewMode mode,
                            String interviewerStyle) {
        String key = buildSessionKey(sessionId);
        InterviewMode resolvedMode = mode == null ? InterviewMode.WRITTEN : mode;

        CachedSession cachedSession = new CachedSession(
            sessionId,
            resumeText,
            resumeId,
            questions,
            currentIndex,
            status,
            objectMapper,
            resolvedMode,
            interviewerStyle
        );

        redisService.set(key, cachedSession, SESSION_TTL);

        if (resumeId != null && isUnfinishedStatus(status)) {
            saveResumeSessionMapping(resumeId, sessionId, resolvedMode);
        }
    }

    public Optional<CachedSession> getSession(String sessionId) {
        String key = buildSessionKey(sessionId);
        CachedSession session = redisService.get(key);
        return Optional.ofNullable(session);
    }

    public void updateSessionStatus(String sessionId, SessionStatus status) {
        getSession(sessionId).ifPresent(session -> {
            session.setStatus(status);
            String key = buildSessionKey(sessionId);
            redisService.set(key, session, SESSION_TTL);

            if (!isUnfinishedStatus(status) && session.getResumeId() != null) {
                removeResumeSessionMapping(
                    session.getResumeId(),
                    sessionId,
                    session.getMode() == null ? InterviewMode.WRITTEN : session.getMode()
                );
            }
        });
    }

    public void updateCurrentIndex(String sessionId, int currentIndex) {
        getSession(sessionId).ifPresent(session -> {
            session.setCurrentIndex(currentIndex);
            String key = buildSessionKey(sessionId);
            redisService.set(key, session, SESSION_TTL);
        });
    }

    public void updateQuestions(String sessionId, List<InterviewQuestionDTO> questions) {
        getSession(sessionId).ifPresent(session -> {
            try {
                session.setQuestionsJson(objectMapper.writeValueAsString(questions));
                String key = buildSessionKey(sessionId);
                redisService.set(key, session, SESSION_TTL);
            } catch (JacksonException exception) {
                log.error("Failed to serialize interview questions", exception);
            }
        });
    }

    public void deleteSession(String sessionId) {
        getSession(sessionId).ifPresent(session -> {
            if (session.getResumeId() != null) {
                removeResumeSessionMapping(
                    session.getResumeId(),
                    sessionId,
                    session.getMode() == null ? InterviewMode.WRITTEN : session.getMode()
                );
            }
        });

        redisService.delete(buildSessionKey(sessionId));
    }

    public Optional<String> findUnfinishedSessionId(Long resumeId) {
        return findUnfinishedSessionId(resumeId, InterviewMode.WRITTEN);
    }

    public Optional<String> findUnfinishedSessionId(Long resumeId, InterviewMode mode) {
        String key = buildResumeSessionKey(resumeId, mode);
        String sessionId = redisService.get(key);
        if (sessionId == null) {
            return Optional.empty();
        }

        Optional<CachedSession> sessionOpt = getSession(sessionId);
        if (sessionOpt.isPresent() && isUnfinishedStatus(sessionOpt.get().getStatus())) {
            return Optional.of(sessionId);
        }

        redisService.delete(key);
        return Optional.empty();
    }

    public void refreshSessionTTL(String sessionId) {
        redisService.expire(buildSessionKey(sessionId), SESSION_TTL);
    }

    public boolean exists(String sessionId) {
        return redisService.exists(buildSessionKey(sessionId));
    }

    private String buildSessionKey(String sessionId) {
        return SESSION_KEY_PREFIX + sessionId;
    }

    private String buildResumeSessionKey(Long resumeId, InterviewMode mode) {
        InterviewMode resolved = mode == null ? InterviewMode.WRITTEN : mode;
        return RESUME_SESSION_KEY_PREFIX + resumeId + ":" + resolved.name();
    }

    private void saveResumeSessionMapping(Long resumeId, String sessionId, InterviewMode mode) {
        redisService.set(buildResumeSessionKey(resumeId, mode), sessionId, SESSION_TTL);
    }

    private void removeResumeSessionMapping(Long resumeId, String sessionId, InterviewMode mode) {
        String key = buildResumeSessionKey(resumeId, mode);
        String currentSessionId = redisService.get(key);
        if (sessionId.equals(currentSessionId)) {
            redisService.delete(key);
        }
    }

    private boolean isUnfinishedStatus(SessionStatus status) {
        return status == SessionStatus.CREATED || status == SessionStatus.IN_PROGRESS;
    }
}
