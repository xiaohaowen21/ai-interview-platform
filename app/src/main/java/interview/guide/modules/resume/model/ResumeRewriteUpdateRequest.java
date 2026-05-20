package interview.guide.modules.resume.model;

/**
 * 保存编辑后的优化版简历请求。
 */
public record ResumeRewriteUpdateRequest(
    String jobDescription,
    ResumeRewriteContentDTO content
) {
}
