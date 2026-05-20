package interview.guide.modules.resume.model;

import interview.guide.common.model.AsyncTaskStatus;
import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * 简历优化结果实体。
 */
@Entity
@Table(name = "resume_rewrites", indexes = {
    @Index(name = "idx_resume_rewrite_resume_updated", columnList = "resume_id,updatedAt"),
    @Index(name = "idx_resume_rewrite_user_updated", columnList = "userId,updatedAt")
})
public class ResumeRewriteEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resume_id", nullable = false)
    private ResumeEntity resume;

    @Column(nullable = false, length = 100)
    private String userId;

    @Column(columnDefinition = "TEXT")
    private String jobDescription;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AsyncTaskStatus status = AsyncTaskStatus.PENDING;

    @Column(length = 500)
    private String errorMessage;

    @Column(columnDefinition = "TEXT")
    private String rewriteJson;

    @Column(columnDefinition = "TEXT")
    private String sourceResumeText;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public ResumeEntity getResume() {
        return resume;
    }

    public void setResume(ResumeEntity resume) {
        this.resume = resume;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getJobDescription() {
        return jobDescription;
    }

    public void setJobDescription(String jobDescription) {
        this.jobDescription = jobDescription;
    }

    public AsyncTaskStatus getStatus() {
        return status;
    }

    public void setStatus(AsyncTaskStatus status) {
        this.status = status;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public String getRewriteJson() {
        return rewriteJson;
    }

    public void setRewriteJson(String rewriteJson) {
        this.rewriteJson = rewriteJson;
    }

    public String getSourceResumeText() {
        return sourceResumeText;
    }

    public void setSourceResumeText(String sourceResumeText) {
        this.sourceResumeText = sourceResumeText;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
