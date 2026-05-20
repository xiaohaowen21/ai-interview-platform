package interview.guide.modules.interview.model;

import java.util.List;

/**
 * Interview session response DTO.
 */
public record InterviewSessionDTO(
    String sessionId,
    String resumeText,
    int totalQuestions,
    int currentQuestionIndex,
    List<InterviewQuestionDTO> questions,
    SessionStatus status,
    InterviewMode mode,
    String interviewerStyle
) {
    public enum SessionStatus {
        CREATED,
        IN_PROGRESS,
        COMPLETED,
        EVALUATED
    }
}
