package interview.guide.modules.resume.model;

import java.util.List;

/**
 * 简历优化后的结构化内容。
 */
public record ResumeRewriteContentDTO(
    ResumeRewriteProfileDTO profile,
    String targetPosition,
    String professionalSummary,
    List<String> coreSkills,
    List<ResumeRewriteSectionItemDTO> workExperiences,
    List<ResumeRewriteSectionItemDTO> projectExperiences,
    List<ResumeRewriteSectionItemDTO> educationExperiences,
    List<String> certifications,
    List<String> additionalInformation,
    List<String> optimizationHighlights
) {
}
