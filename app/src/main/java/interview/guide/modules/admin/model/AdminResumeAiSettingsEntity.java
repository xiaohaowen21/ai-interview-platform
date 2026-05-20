package interview.guide.modules.admin.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "admin_resume_ai_settings")
public class AdminResumeAiSettingsEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String baseUrl;

    @Column(nullable = false, length = 255)
    private String apiKey;

    @Column(nullable = false, length = 100)
    private String model;

    @Column(length = 500)
    private String mockInterviewUrl;

    @Column(length = 1200)
    private String resumeAnalysisImageUrl;

    @Column(length = 1200)
    private String mockWrittenExamImageUrl;

    @Column(length = 1200)
    private String formalInterviewImageUrl;

    @Column(length = 1200)
    private String knowledgeBaseQaImageUrl;

    @Column(length = 1200)
    private String careerGuideImageUrl;

    @Column(length = 1200)
    private String resumeAnalysisCardMediaUrl;

    @Column(length = 1200)
    private String mockWrittenExamCardMediaUrl;

    @Column(length = 1200)
    private String formalInterviewCardMediaUrl;

    @Column(length = 1200)
    private String knowledgeBaseQaCardMediaUrl;

    @Column(length = 1200)
    private String careerGuideCardMediaUrl;

    @Column(length = 1200)
    private String dongmingzhuAvatarUrl;

    @Column(length = 1200)
    private String leijunAvatarUrl;

    @Column(length = 1200)
    private String muskAvatarUrl;

    @Column(length = 1200)
    private String trumpAvatarUrl;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onSave() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getMockInterviewUrl() {
        return mockInterviewUrl;
    }

    public void setMockInterviewUrl(String mockInterviewUrl) {
        this.mockInterviewUrl = mockInterviewUrl;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getResumeAnalysisImageUrl() {
        return resumeAnalysisImageUrl;
    }

    public void setResumeAnalysisImageUrl(String resumeAnalysisImageUrl) {
        this.resumeAnalysisImageUrl = resumeAnalysisImageUrl;
    }

    public String getMockWrittenExamImageUrl() {
        return mockWrittenExamImageUrl;
    }

    public void setMockWrittenExamImageUrl(String mockWrittenExamImageUrl) {
        this.mockWrittenExamImageUrl = mockWrittenExamImageUrl;
    }

    public String getFormalInterviewImageUrl() {
        return formalInterviewImageUrl;
    }

    public void setFormalInterviewImageUrl(String formalInterviewImageUrl) {
        this.formalInterviewImageUrl = formalInterviewImageUrl;
    }

    public String getKnowledgeBaseQaImageUrl() {
        return knowledgeBaseQaImageUrl;
    }

    public void setKnowledgeBaseQaImageUrl(String knowledgeBaseQaImageUrl) {
        this.knowledgeBaseQaImageUrl = knowledgeBaseQaImageUrl;
    }

    public String getCareerGuideImageUrl() {
        return careerGuideImageUrl;
    }

    public void setCareerGuideImageUrl(String careerGuideImageUrl) {
        this.careerGuideImageUrl = careerGuideImageUrl;
    }

    public String getDongmingzhuAvatarUrl() {
        return dongmingzhuAvatarUrl;
    }

    public String getResumeAnalysisCardMediaUrl() {
        return resumeAnalysisCardMediaUrl;
    }

    public void setResumeAnalysisCardMediaUrl(String resumeAnalysisCardMediaUrl) {
        this.resumeAnalysisCardMediaUrl = resumeAnalysisCardMediaUrl;
    }

    public String getMockWrittenExamCardMediaUrl() {
        return mockWrittenExamCardMediaUrl;
    }

    public void setMockWrittenExamCardMediaUrl(String mockWrittenExamCardMediaUrl) {
        this.mockWrittenExamCardMediaUrl = mockWrittenExamCardMediaUrl;
    }

    public String getFormalInterviewCardMediaUrl() {
        return formalInterviewCardMediaUrl;
    }

    public void setFormalInterviewCardMediaUrl(String formalInterviewCardMediaUrl) {
        this.formalInterviewCardMediaUrl = formalInterviewCardMediaUrl;
    }

    public String getKnowledgeBaseQaCardMediaUrl() {
        return knowledgeBaseQaCardMediaUrl;
    }

    public void setKnowledgeBaseQaCardMediaUrl(String knowledgeBaseQaCardMediaUrl) {
        this.knowledgeBaseQaCardMediaUrl = knowledgeBaseQaCardMediaUrl;
    }

    public String getCareerGuideCardMediaUrl() {
        return careerGuideCardMediaUrl;
    }

    public void setCareerGuideCardMediaUrl(String careerGuideCardMediaUrl) {
        this.careerGuideCardMediaUrl = careerGuideCardMediaUrl;
    }

    public void setDongmingzhuAvatarUrl(String dongmingzhuAvatarUrl) {
        this.dongmingzhuAvatarUrl = dongmingzhuAvatarUrl;
    }

    public String getLeijunAvatarUrl() {
        return leijunAvatarUrl;
    }

    public void setLeijunAvatarUrl(String leijunAvatarUrl) {
        this.leijunAvatarUrl = leijunAvatarUrl;
    }

    public String getMuskAvatarUrl() {
        return muskAvatarUrl;
    }

    public void setMuskAvatarUrl(String muskAvatarUrl) {
        this.muskAvatarUrl = muskAvatarUrl;
    }

    public String getTrumpAvatarUrl() {
        return trumpAvatarUrl;
    }

    public void setTrumpAvatarUrl(String trumpAvatarUrl) {
        this.trumpAvatarUrl = trumpAvatarUrl;
    }
}
