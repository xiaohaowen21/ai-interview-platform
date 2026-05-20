package interview.guide.modules.resume.model;

import interview.guide.common.model.AsyncTaskStatus;

import java.time.LocalDateTime;

/**
 * 简历优化结果 DTO。
 */
public record ResumeRewriteDTO(
    Long id,
    Long resumeId,
    String filename,
    String jobDescription,
    AsyncTaskStatus status,
    String errorMessage,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    ResumeRewriteContentDTO content
) {
}
