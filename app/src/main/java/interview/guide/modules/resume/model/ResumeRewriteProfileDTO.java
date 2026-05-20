package interview.guide.modules.resume.model;

/**
 * 简历优化后的头部信息。
 */
public record ResumeRewriteProfileDTO(
    String fullName,
    String phone,
    String email,
    String location,
    String links
) {
}
