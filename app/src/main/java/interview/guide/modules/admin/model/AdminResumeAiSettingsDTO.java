package interview.guide.modules.admin.model;

import java.time.LocalDateTime;

public record AdminResumeAiSettingsDTO(
    String baseUrl,
    String apiKey,
    String model,
    String mockInterviewUrl,
    String resumeAnalysisImageUrl,
    String mockWrittenExamImageUrl,
    String formalInterviewImageUrl,
    String knowledgeBaseQaImageUrl,
    String careerGuideImageUrl,
    String resumeAnalysisCardMediaUrl,
    String mockWrittenExamCardMediaUrl,
    String formalInterviewCardMediaUrl,
    String knowledgeBaseQaCardMediaUrl,
    String careerGuideCardMediaUrl,
    String dongmingzhuAvatarUrl,
    String leijunAvatarUrl,
    String muskAvatarUrl,
    String trumpAvatarUrl,
    LocalDateTime updatedAt
) {}
