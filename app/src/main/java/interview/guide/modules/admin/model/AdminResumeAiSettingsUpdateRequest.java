package interview.guide.modules.admin.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminResumeAiSettingsUpdateRequest(
    @NotBlank(message = "API base URL is required")
    @Size(max = 255, message = "API base URL must be 255 characters or fewer")
    String baseUrl,

    @NotBlank(message = "API key is required")
    @Size(max = 255, message = "API key must be 255 characters or fewer")
    String apiKey,

    @NotBlank(message = "Model name is required")
    @Size(max = 100, message = "Model name must be 100 characters or fewer")
    String model,

    @NotBlank(message = "Mock interview URL is required")
    @Size(max = 500, message = "Mock interview URL must be 500 characters or fewer")
    String mockInterviewUrl,

    @Size(max = 1200, message = "Resume analysis image URL must be 1200 characters or fewer")
    String resumeAnalysisImageUrl,

    @Size(max = 1200, message = "Mock written exam image URL must be 1200 characters or fewer")
    String mockWrittenExamImageUrl,

    @Size(max = 1200, message = "Formal interview image URL must be 1200 characters or fewer")
    String formalInterviewImageUrl,

    @Size(max = 1200, message = "Knowledge base QA image URL must be 1200 characters or fewer")
    String knowledgeBaseQaImageUrl,

    @Size(max = 1200, message = "Career guide image URL must be 1200 characters or fewer")
    String careerGuideImageUrl,

    @Size(max = 1200, message = "Resume analysis card media URL must be 1200 characters or fewer")
    String resumeAnalysisCardMediaUrl,

    @Size(max = 1200, message = "Mock written exam card media URL must be 1200 characters or fewer")
    String mockWrittenExamCardMediaUrl,

    @Size(max = 1200, message = "Formal interview card media URL must be 1200 characters or fewer")
    String formalInterviewCardMediaUrl,

    @Size(max = 1200, message = "Knowledge base QA card media URL must be 1200 characters or fewer")
    String knowledgeBaseQaCardMediaUrl,

    @Size(max = 1200, message = "Career guide card media URL must be 1200 characters or fewer")
    String careerGuideCardMediaUrl,

    @Size(max = 1200, message = "Dongmingzhu avatar URL must be 1200 characters or fewer")
    String dongmingzhuAvatarUrl,

    @Size(max = 1200, message = "Leijun avatar URL must be 1200 characters or fewer")
    String leijunAvatarUrl,

    @Size(max = 1200, message = "Musk avatar URL must be 1200 characters or fewer")
    String muskAvatarUrl,

    @Size(max = 1200, message = "Trump avatar URL must be 1200 characters or fewer")
    String trumpAvatarUrl
) {}
