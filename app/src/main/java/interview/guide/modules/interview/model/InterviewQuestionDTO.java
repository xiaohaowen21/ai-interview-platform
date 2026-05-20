package interview.guide.modules.interview.model;

import java.util.List;

/**
 * Interview question DTO.
 */
public record InterviewQuestionDTO(
    int questionIndex,
    String question,
    QuestionType type,
    String category,
    String userAnswer,
    Integer score,
    String feedback,
    boolean isFollowUp,
    Integer parentQuestionIndex,
    List<String> followUpCandidates
) {
    public enum QuestionType {
        PROJECT,
        ROLE_KNOWLEDGE,
        PROFESSIONAL_BASICS,
        SCENARIO_ANALYSIS,
        PROBLEM_SOLVING,
        COMMUNICATION,
        JAVA_BASIC,
        JAVA_COLLECTION,
        JAVA_CONCURRENT,
        MYSQL,
        REDIS,
        SPRING,
        SPRING_BOOT
    }

    public static InterviewQuestionDTO create(
        int index,
        String question,
        QuestionType type,
        String category
    ) {
        return new InterviewQuestionDTO(index, question, type, category, null, null, null, false, null, List.of());
    }

    public static InterviewQuestionDTO create(
        int index,
        String question,
        QuestionType type,
        String category,
        List<String> followUpCandidates
    ) {
        return new InterviewQuestionDTO(
            index,
            question,
            type,
            category,
            null,
            null,
            null,
            false,
            null,
            followUpCandidates == null ? List.of() : followUpCandidates
        );
    }

    public static InterviewQuestionDTO create(
        int index,
        String question,
        QuestionType type,
        String category,
        boolean isFollowUp,
        Integer parentQuestionIndex
    ) {
        return new InterviewQuestionDTO(index, question, type, category, null, null, null, isFollowUp, parentQuestionIndex, List.of());
    }

    public InterviewQuestionDTO withAnswer(String answer) {
        return new InterviewQuestionDTO(
            questionIndex,
            question,
            type,
            category,
            answer,
            score,
            feedback,
            isFollowUp,
            parentQuestionIndex,
            followUpCandidates
        );
    }

    public InterviewQuestionDTO withEvaluation(int score, String feedback) {
        return new InterviewQuestionDTO(
            questionIndex,
            question,
            type,
            category,
            userAnswer,
            score,
            feedback,
            isFollowUp,
            parentQuestionIndex,
            followUpCandidates
        );
    }

    public InterviewQuestionDTO withFollowUpCandidates(List<String> nextCandidates) {
        return new InterviewQuestionDTO(
            questionIndex,
            question,
            type,
            category,
            userAnswer,
            score,
            feedback,
            isFollowUp,
            parentQuestionIndex,
            nextCandidates == null ? List.of() : nextCandidates
        );
    }
}
