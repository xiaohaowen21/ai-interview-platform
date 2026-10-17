package interview.guide.modules.interview.model;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Create interview session request payload. {@code resumeText} is ignored when creating a session:
 * the server reads the stored text of {@code resumeId}. It is kept so older clients still parse.
 */
public record CreateInterviewRequest(
    String resumeText,

    @Min(value = 1, message = "题目数量最少 1 题")
    @Max(value = 20, message = "题目数量最多 20 题")
    int questionCount,

    @NotNull(message = "简历 ID 不能为空")
    Long resumeId,

    Boolean forceCreate,

    InterviewMode mode,

    String interviewerStyle
) {
}
