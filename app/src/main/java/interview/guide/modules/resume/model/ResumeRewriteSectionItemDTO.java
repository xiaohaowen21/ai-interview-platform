package interview.guide.modules.resume.model;

import java.util.List;

/**
 * 简历优化后的通用条目结构。
 */
public record ResumeRewriteSectionItemDTO(
    String title,
    String subtitle,
    String period,
    List<String> highlights
) {
}
