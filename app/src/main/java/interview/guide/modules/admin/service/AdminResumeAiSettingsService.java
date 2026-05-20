package interview.guide.modules.admin.service;

import interview.guide.common.ai.AiErrorMessageHelper;
import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.infrastructure.file.FileStorageService;
import interview.guide.modules.admin.model.AdminResumeAiSettingsDTO;
import interview.guide.modules.admin.model.AdminResumeAiSettingsEntity;
import interview.guide.modules.admin.model.AdminResumeAiSettingsTestResultDTO;
import interview.guide.modules.admin.model.AdminResumeAiSettingsUpdateRequest;
import interview.guide.modules.admin.repository.AdminResumeAiSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminResumeAiSettingsService {

    private static final long LANDING_VIDEO_MAX_BYTES = 200L * 1024L * 1024L;
    private static final long LANDING_IMAGE_MAX_BYTES = 10L * 1024L * 1024L;

    private final AdminResumeAiSettingsRepository repository;
    private final FileStorageService fileStorageService;

    private static final Set<String> ALLOWED_LANDING_MEDIA_TYPES = Set.of(
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "image/gif",
        "video/mp4",
        "video/quicktime",
        "video/x-m4v",
        "video/webm",
        "video/ogg"
    );

    @Value("${spring.ai.openai.base-url:https://dashscope.aliyuncs.com/compatible-mode}")
    private String defaultBaseUrl;

    @Value("${AI_BAILIAN_API_KEY:}")
    private String defaultApiKey;

    @Value("${AI_MODEL:qwen-plus}")
    private String defaultModel;

    @Value("${app.mock-interview.url:https://mianbaojob.xyz/mock-interview}")
    private String defaultMockInterviewUrl;

    @Value("${app.landing.resume-analysis-image-url:https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=1200&h=800&auto=format&fit=crop&q=60}")
    private String defaultResumeAnalysisImageUrl;

    @Value("${app.landing.mock-written-exam-image-url:https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=800&auto=format&fit=crop&q=60}")
    private String defaultMockWrittenExamImageUrl;

    @Value("${app.landing.formal-interview-image-url:https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&h=800&auto=format&fit=crop&q=60}")
    private String defaultFormalInterviewImageUrl;

    @Value("${app.landing.knowledgebase-qa-image-url:https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&h=800&auto=format&fit=crop&q=60}")
    private String defaultKnowledgeBaseQaImageUrl;

    @Value("${app.landing.career-guide-image-url:}")
    private String defaultCareerGuideImageUrl;

    @Value("${app.landing.resume-analysis-card-media-url:}")
    private String defaultResumeAnalysisCardMediaUrl;

    @Value("${app.landing.mock-written-exam-card-media-url:}")
    private String defaultMockWrittenExamCardMediaUrl;

    @Value("${app.landing.formal-interview-card-media-url:}")
    private String defaultFormalInterviewCardMediaUrl;

    @Value("${app.landing.knowledgebase-qa-card-media-url:}")
    private String defaultKnowledgeBaseQaCardMediaUrl;

    @Value("${app.landing.career-guide-card-media-url:}")
    private String defaultCareerGuideCardMediaUrl;

    @Value("${app.interviewer-avatar.dongmingzhu-url:/interviewers/dongmingzhu.jpg}")
    private String defaultDongmingzhuAvatarUrl;

    @Value("${app.interviewer-avatar.leijun-url:/interviewers/leijun.jpg}")
    private String defaultLeijunAvatarUrl;

    @Value("${app.interviewer-avatar.musk-url:/interviewers/elonmusk.jpg}")
    private String defaultMuskAvatarUrl;

    @Value("${app.interviewer-avatar.trump-url:/interviewers/trump.jpg}")
    private String defaultTrumpAvatarUrl;

    @Value("${app.admin.resume-ai-test.connect-timeout-ms:10000}")
    private long testConnectTimeoutMs;

    @Value("${app.admin.resume-ai-test.read-timeout-ms:25000}")
    private long testReadTimeoutMs;

    public AdminResumeAiSettingsDTO getSettings() {
        AdminResumeAiSettingsEntity entity = repository.findAll().stream().findFirst().orElse(null);
        if (entity == null) {
            return defaultSettingsDto();
        }
        return toDto(entity);
    }

    public ResumeAiRuntimeSettings getRuntimeSettings() {
        AdminResumeAiSettingsEntity entity = repository.findAll().stream().findFirst().orElse(null);
        if (entity == null) {
            return new ResumeAiRuntimeSettings(defaultBaseUrl, defaultApiKey, defaultModel);
        }
        return new ResumeAiRuntimeSettings(entity.getBaseUrl(), entity.getApiKey(), entity.getModel());
    }

    public AdminResumeAiSettingsDTO updateSettings(AdminResumeAiSettingsUpdateRequest request) {
        AdminResumeAiSettingsEntity entity = repository.findAll().stream().findFirst().orElseGet(AdminResumeAiSettingsEntity::new);
        entity.setBaseUrl(request.baseUrl().trim());
        entity.setApiKey(resolveApiKeyForPersist(request.apiKey()));
        entity.setModel(request.model().trim());
        entity.setMockInterviewUrl(request.mockInterviewUrl().trim());
        entity.setResumeAnalysisImageUrl(normalizeOptionalUrl(request.resumeAnalysisImageUrl()));
        entity.setMockWrittenExamImageUrl(normalizeOptionalUrl(request.mockWrittenExamImageUrl()));
        entity.setFormalInterviewImageUrl(normalizeOptionalUrl(request.formalInterviewImageUrl()));
        entity.setKnowledgeBaseQaImageUrl(normalizeOptionalUrl(request.knowledgeBaseQaImageUrl()));
        entity.setCareerGuideImageUrl(normalizeOptionalUrl(request.careerGuideImageUrl()));
        entity.setResumeAnalysisCardMediaUrl(normalizeOptionalUrl(request.resumeAnalysisCardMediaUrl()));
        entity.setMockWrittenExamCardMediaUrl(normalizeOptionalUrl(request.mockWrittenExamCardMediaUrl()));
        entity.setFormalInterviewCardMediaUrl(normalizeOptionalUrl(request.formalInterviewCardMediaUrl()));
        entity.setKnowledgeBaseQaCardMediaUrl(normalizeOptionalUrl(request.knowledgeBaseQaCardMediaUrl()));
        entity.setCareerGuideCardMediaUrl(normalizeOptionalUrl(request.careerGuideCardMediaUrl()));
        entity.setDongmingzhuAvatarUrl(normalizeOptionalUrl(request.dongmingzhuAvatarUrl()));
        entity.setLeijunAvatarUrl(normalizeOptionalUrl(request.leijunAvatarUrl()));
        entity.setMuskAvatarUrl(normalizeOptionalUrl(request.muskAvatarUrl()));
        entity.setTrumpAvatarUrl(normalizeOptionalUrl(request.trumpAvatarUrl()));
        AdminResumeAiSettingsEntity saved = repository.save(entity);
        return toDto(saved);
    }

    public String getMockInterviewUrl() {
        AdminResumeAiSettingsEntity entity = repository.findAll().stream().findFirst().orElse(null);
        if (entity == null) {
            return defaultMockInterviewUrl;
        }
        return resolveMockInterviewUrl(entity.getMockInterviewUrl());
    }

    public LandingModuleImages getLandingModuleImages() {
        AdminResumeAiSettingsEntity entity = repository.findAll().stream().findFirst().orElse(null);
        if (entity == null) {
            return defaultLandingModuleImages();
        }
        return new LandingModuleImages(
            resolveLandingImageUrl(entity.getResumeAnalysisImageUrl(), defaultResumeAnalysisImageUrl),
            resolveLandingImageUrl(entity.getMockWrittenExamImageUrl(), defaultMockWrittenExamImageUrl),
            resolveLandingImageUrl(entity.getFormalInterviewImageUrl(), defaultFormalInterviewImageUrl),
            resolveLandingImageUrl(entity.getKnowledgeBaseQaImageUrl(), defaultKnowledgeBaseQaImageUrl),
            resolveLandingImageUrl(entity.getCareerGuideImageUrl(), resolveCardFallback(defaultCareerGuideImageUrl, defaultKnowledgeBaseQaImageUrl))
        );
    }

    public LandingCardMedia getLandingCardMedia() {
        AdminResumeAiSettingsEntity entity = repository.findAll().stream().findFirst().orElse(null);
        if (entity == null) {
            return defaultLandingCardMedia();
        }
        return new LandingCardMedia(
            resolveLandingImageUrl(entity.getResumeAnalysisCardMediaUrl(), resolveLandingImageUrl(entity.getResumeAnalysisImageUrl(), resolveCardFallback(defaultResumeAnalysisCardMediaUrl, defaultResumeAnalysisImageUrl))),
            resolveLandingImageUrl(entity.getMockWrittenExamCardMediaUrl(), resolveLandingImageUrl(entity.getMockWrittenExamImageUrl(), resolveCardFallback(defaultMockWrittenExamCardMediaUrl, defaultMockWrittenExamImageUrl))),
            resolveLandingImageUrl(entity.getFormalInterviewCardMediaUrl(), resolveLandingImageUrl(entity.getFormalInterviewImageUrl(), resolveCardFallback(defaultFormalInterviewCardMediaUrl, defaultFormalInterviewImageUrl))),
            resolveLandingImageUrl(entity.getKnowledgeBaseQaCardMediaUrl(), resolveLandingImageUrl(entity.getKnowledgeBaseQaImageUrl(), resolveCardFallback(defaultKnowledgeBaseQaCardMediaUrl, defaultKnowledgeBaseQaImageUrl))),
            resolveLandingImageUrl(entity.getCareerGuideCardMediaUrl(), resolveLandingImageUrl(entity.getCareerGuideImageUrl(), resolveCardFallback(defaultCareerGuideCardMediaUrl, resolveCardFallback(defaultCareerGuideImageUrl, defaultKnowledgeBaseQaImageUrl))))
        );
    }

    public InterviewerAvatarUrls getInterviewerAvatarUrls() {
        AdminResumeAiSettingsEntity entity = repository.findAll().stream().findFirst().orElse(null);
        if (entity == null) {
            return defaultInterviewerAvatarUrls();
        }
        return new InterviewerAvatarUrls(
            resolveLandingImageUrl(entity.getDongmingzhuAvatarUrl(), defaultDongmingzhuAvatarUrl),
            resolveLandingImageUrl(entity.getLeijunAvatarUrl(), defaultLeijunAvatarUrl),
            resolveLandingImageUrl(entity.getMuskAvatarUrl(), defaultMuskAvatarUrl),
            resolveLandingImageUrl(entity.getTrumpAvatarUrl(), defaultTrumpAvatarUrl)
        );
    }

    public AdminResumeAiSettingsDTO uploadLandingImage(String moduleKey, MultipartFile file) {
        validateLandingMediaFile(file);
        LandingImageModule module = LandingImageModule.from(moduleKey);
        String key = fileStorageService.uploadLandingAsset(file);
        String url = fileStorageService.getPublicAssetUrl(key);

        AdminResumeAiSettingsEntity entity = repository.findAll().stream().findFirst().orElseGet(AdminResumeAiSettingsEntity::new);
        ensureRequiredFields(entity);
        module.assign(entity, url);
        AdminResumeAiSettingsEntity saved = repository.save(entity);
        return toDto(saved);
    }

    public AdminResumeAiSettingsDTO uploadInterviewerAvatar(String personaKey, MultipartFile file) {
        validateImageFile(file);
        InterviewerAvatarModule module = InterviewerAvatarModule.from(personaKey);
        String key = fileStorageService.uploadLandingAsset(file);
        String url = fileStorageService.getPublicAssetUrl(key);

        AdminResumeAiSettingsEntity entity = repository.findAll().stream().findFirst().orElseGet(AdminResumeAiSettingsEntity::new);
        ensureRequiredFields(entity);
        module.assign(entity, url);
        AdminResumeAiSettingsEntity saved = repository.save(entity);
        return toDto(saved);
    }

    public AdminResumeAiSettingsTestResultDTO testSettings(AdminResumeAiSettingsUpdateRequest request) {
        String baseUrl = normalizeBaseUrl(request.baseUrl());
        String apiKey = resolveApiKeyForTest(request.apiKey());
        String model = request.model() == null ? "" : request.model().trim();

        if (baseUrl.isBlank() || apiKey.isBlank() || model.isBlank()) {
            return new AdminResumeAiSettingsTestResultDTO(false, "请填写完整的 API 地址、API Key 和模型名", null, 0);
        }

        String endpoint = baseUrl + "/v1/chat/completions";
        long start = System.currentTimeMillis();

        try {
            RestClient restClient = buildTestClient(endpoint);
            Map<String, Object> payload = Map.of(
                "model", model,
                "temperature", 0,
                "max_tokens", 16,
                "messages", List.of(Map.of("role", "user", "content", "ping"))
            );

            restClient.post()
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(String.class);

            long latency = System.currentTimeMillis() - start;
            return new AdminResumeAiSettingsTestResultDTO(true, "连接成功，配置可用", 200, latency);
        } catch (RestClientResponseException exception) {
            long latency = System.currentTimeMillis() - start;
            String message = "测试失败，HTTP " + exception.getStatusCode().value() + "：" + simplifyErrorMessage(exception.getResponseBodyAsString());
            return new AdminResumeAiSettingsTestResultDTO(false, message, exception.getStatusCode().value(), latency);
        } catch (Exception exception) {
            long latency = System.currentTimeMillis() - start;
            return new AdminResumeAiSettingsTestResultDTO(false, "测试失败：" + simplifyErrorMessage(exception.getMessage()), null, latency);
        }
    }

    private String maskApiKey(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        if (value.length() <= 8) {
            return "****";
        }
        return value.substring(0, 4) + "********" + value.substring(value.length() - 4);
    }

    private String normalizeBaseUrl(String baseUrl) {
        String value = baseUrl == null ? "" : baseUrl.trim();
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private String normalizeOptionalUrl(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isBlank()) {
            return "";
        }
        return normalized.length() > 1200 ? normalized.substring(0, 1200) : normalized;
    }

    private String resolveMockInterviewUrl(String mockInterviewUrl) {
        String value = mockInterviewUrl == null ? "" : mockInterviewUrl.trim();
        return value.isBlank() ? defaultMockInterviewUrl : value;
    }

    private String resolveLandingImageUrl(String value, String fallback) {
        String normalized = value == null ? "" : value.trim();
        if (!normalized.isBlank()) {
            String storagePrefix = fileStorageService.getFileUrl("");
            if (normalized.startsWith(storagePrefix)) {
                String fileKey = normalized.substring(storagePrefix.length());
                return fileStorageService.getPublicAssetUrl(fileKey);
            }
            return normalized;
        }
        return fallback;
    }

    private String resolveCardFallback(String candidate, String moduleFallback) {
        String value = candidate == null ? "" : candidate.trim();
        return value.isBlank() ? moduleFallback : value;
    }

    private AdminResumeAiSettingsDTO defaultSettingsDto() {
        return new AdminResumeAiSettingsDTO(
            defaultBaseUrl,
            maskApiKey(defaultApiKey),
            defaultModel,
            defaultMockInterviewUrl,
            defaultResumeAnalysisImageUrl,
            defaultMockWrittenExamImageUrl,
            defaultFormalInterviewImageUrl,
            defaultKnowledgeBaseQaImageUrl,
            resolveCardFallback(defaultCareerGuideImageUrl, defaultKnowledgeBaseQaImageUrl),
            resolveCardFallback(defaultResumeAnalysisCardMediaUrl, defaultResumeAnalysisImageUrl),
            resolveCardFallback(defaultMockWrittenExamCardMediaUrl, defaultMockWrittenExamImageUrl),
            resolveCardFallback(defaultFormalInterviewCardMediaUrl, defaultFormalInterviewImageUrl),
            resolveCardFallback(defaultKnowledgeBaseQaCardMediaUrl, defaultKnowledgeBaseQaImageUrl),
            resolveCardFallback(defaultCareerGuideCardMediaUrl, resolveCardFallback(defaultCareerGuideImageUrl, defaultKnowledgeBaseQaImageUrl)),
            defaultDongmingzhuAvatarUrl,
            defaultLeijunAvatarUrl,
            defaultMuskAvatarUrl,
            defaultTrumpAvatarUrl,
            null
        );
    }

    private AdminResumeAiSettingsDTO toDto(AdminResumeAiSettingsEntity entity) {
        return new AdminResumeAiSettingsDTO(
            resolveBaseUrl(entity),
            maskApiKey(resolveApiKey(entity)),
            resolveModel(entity),
            resolveMockInterviewUrl(entity.getMockInterviewUrl()),
            resolveLandingImageUrl(entity.getResumeAnalysisImageUrl(), defaultResumeAnalysisImageUrl),
            resolveLandingImageUrl(entity.getMockWrittenExamImageUrl(), defaultMockWrittenExamImageUrl),
            resolveLandingImageUrl(entity.getFormalInterviewImageUrl(), defaultFormalInterviewImageUrl),
            resolveLandingImageUrl(entity.getKnowledgeBaseQaImageUrl(), defaultKnowledgeBaseQaImageUrl),
            resolveLandingImageUrl(entity.getCareerGuideImageUrl(), resolveCardFallback(defaultCareerGuideImageUrl, defaultKnowledgeBaseQaImageUrl)),
            resolveLandingImageUrl(entity.getResumeAnalysisCardMediaUrl(), resolveLandingImageUrl(entity.getResumeAnalysisImageUrl(), resolveCardFallback(defaultResumeAnalysisCardMediaUrl, defaultResumeAnalysisImageUrl))),
            resolveLandingImageUrl(entity.getMockWrittenExamCardMediaUrl(), resolveLandingImageUrl(entity.getMockWrittenExamImageUrl(), resolveCardFallback(defaultMockWrittenExamCardMediaUrl, defaultMockWrittenExamImageUrl))),
            resolveLandingImageUrl(entity.getFormalInterviewCardMediaUrl(), resolveLandingImageUrl(entity.getFormalInterviewImageUrl(), resolveCardFallback(defaultFormalInterviewCardMediaUrl, defaultFormalInterviewImageUrl))),
            resolveLandingImageUrl(entity.getKnowledgeBaseQaCardMediaUrl(), resolveLandingImageUrl(entity.getKnowledgeBaseQaImageUrl(), resolveCardFallback(defaultKnowledgeBaseQaCardMediaUrl, defaultKnowledgeBaseQaImageUrl))),
            resolveLandingImageUrl(entity.getCareerGuideCardMediaUrl(), resolveLandingImageUrl(entity.getCareerGuideImageUrl(), resolveCardFallback(defaultCareerGuideCardMediaUrl, resolveCardFallback(defaultCareerGuideImageUrl, defaultKnowledgeBaseQaImageUrl)))),
            resolveLandingImageUrl(entity.getDongmingzhuAvatarUrl(), defaultDongmingzhuAvatarUrl),
            resolveLandingImageUrl(entity.getLeijunAvatarUrl(), defaultLeijunAvatarUrl),
            resolveLandingImageUrl(entity.getMuskAvatarUrl(), defaultMuskAvatarUrl),
            resolveLandingImageUrl(entity.getTrumpAvatarUrl(), defaultTrumpAvatarUrl),
            entity.getUpdatedAt()
        );
    }

    private LandingModuleImages defaultLandingModuleImages() {
        return new LandingModuleImages(
            defaultResumeAnalysisImageUrl,
            defaultMockWrittenExamImageUrl,
            defaultFormalInterviewImageUrl,
            defaultKnowledgeBaseQaImageUrl,
            resolveCardFallback(defaultCareerGuideImageUrl, defaultKnowledgeBaseQaImageUrl)
        );
    }

    private LandingCardMedia defaultLandingCardMedia() {
        return new LandingCardMedia(
            resolveCardFallback(defaultResumeAnalysisCardMediaUrl, defaultResumeAnalysisImageUrl),
            resolveCardFallback(defaultMockWrittenExamCardMediaUrl, defaultMockWrittenExamImageUrl),
            resolveCardFallback(defaultFormalInterviewCardMediaUrl, defaultFormalInterviewImageUrl),
            resolveCardFallback(defaultKnowledgeBaseQaCardMediaUrl, defaultKnowledgeBaseQaImageUrl),
            resolveCardFallback(defaultCareerGuideCardMediaUrl, resolveCardFallback(defaultCareerGuideImageUrl, defaultKnowledgeBaseQaImageUrl))
        );
    }

    private InterviewerAvatarUrls defaultInterviewerAvatarUrls() {
        return new InterviewerAvatarUrls(
            defaultDongmingzhuAvatarUrl,
            defaultLeijunAvatarUrl,
            defaultMuskAvatarUrl,
            defaultTrumpAvatarUrl
        );
    }

    private String resolveBaseUrl(AdminResumeAiSettingsEntity entity) {
        String value = entity.getBaseUrl() == null ? "" : entity.getBaseUrl().trim();
        return value.isBlank() ? defaultBaseUrl : value;
    }

    private String resolveApiKey(AdminResumeAiSettingsEntity entity) {
        String value = entity.getApiKey() == null ? "" : entity.getApiKey().trim();
        return value.isBlank() ? defaultApiKey : value;
    }

    private String resolveModel(AdminResumeAiSettingsEntity entity) {
        String value = entity.getModel() == null ? "" : entity.getModel().trim();
        return value.isBlank() ? defaultModel : value;
    }

    private void ensureRequiredFields(AdminResumeAiSettingsEntity entity) {
        if (entity.getBaseUrl() == null || entity.getBaseUrl().isBlank()) {
            entity.setBaseUrl(defaultBaseUrl);
        }
        if (entity.getApiKey() == null || entity.getApiKey().isBlank()) {
            entity.setApiKey(defaultApiKey);
        }
        if (entity.getModel() == null || entity.getModel().isBlank()) {
            entity.setModel(defaultModel);
        }
        if (entity.getMockInterviewUrl() == null || entity.getMockInterviewUrl().isBlank()) {
            entity.setMockInterviewUrl(defaultMockInterviewUrl);
        }
        if (entity.getDongmingzhuAvatarUrl() == null || entity.getDongmingzhuAvatarUrl().isBlank()) {
            entity.setDongmingzhuAvatarUrl(defaultDongmingzhuAvatarUrl);
        }
        if (entity.getLeijunAvatarUrl() == null || entity.getLeijunAvatarUrl().isBlank()) {
            entity.setLeijunAvatarUrl(defaultLeijunAvatarUrl);
        }
        if (entity.getMuskAvatarUrl() == null || entity.getMuskAvatarUrl().isBlank()) {
            entity.setMuskAvatarUrl(defaultMuskAvatarUrl);
        }
        if (entity.getTrumpAvatarUrl() == null || entity.getTrumpAvatarUrl().isBlank()) {
            entity.setTrumpAvatarUrl(defaultTrumpAvatarUrl);
        }
    }

    private void validateLandingMediaFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请选择要上传的展示媒体");
        }

        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!ALLOWED_LANDING_MEDIA_TYPES.contains(contentType)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "仅支持 PNG/JPG/JPEG/WEBP/GIF/MP4/MOV/M4V/WEBM/OGG");
        }

        long maxBytes = contentType.startsWith("video/") ? LANDING_VIDEO_MAX_BYTES : LANDING_IMAGE_MAX_BYTES;
        if (file.getSize() > maxBytes) {
            String limitText = contentType.startsWith("video/") ? "200MB" : "10MB";
            throw new BusinessException(ErrorCode.BAD_REQUEST, "展示媒体大小不能超过 " + limitText);
        }
    }

    private void validateImageFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请选择要上传的图片");
        }

        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!contentType.startsWith("image/")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "仅支持 PNG/JPG/WEBP/GIF 图片");
        }

        if (file.getSize() > LANDING_IMAGE_MAX_BYTES) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "图片大小不能超过 10MB");
        }
    }

    private RestClient buildTestClient(String endpoint) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(Math.max(testConnectTimeoutMs, 1000)));
        requestFactory.setReadTimeout(Duration.ofMillis(Math.max(testReadTimeoutMs, 1000)));
        return RestClient.builder()
            .baseUrl(endpoint)
            .requestFactory(requestFactory)
            .build();
    }

    private String simplifyErrorMessage(String raw) {
        return AiErrorMessageHelper.toUserMessage(
            raw,
            "AI 服务暂时不可用，请稍后重试；如持续失败请联系管理员。"
        );
    }

    private String resolveApiKeyForTest(String rawApiKey) {
        String candidate = rawApiKey == null ? "" : rawApiKey.trim();
        if (candidate.isBlank()) {
            return getRuntimeSettings().apiKey();
        }
        if (candidate.contains("********")) {
            return getRuntimeSettings().apiKey();
        }
        return candidate;
    }

    private String resolveApiKeyForPersist(String rawApiKey) {
        String candidate = rawApiKey == null ? "" : rawApiKey.trim();
        if (candidate.contains("********")) {
            return getRuntimeSettings().apiKey();
        }
        return candidate;
    }

    public record ResumeAiRuntimeSettings(String baseUrl, String apiKey, String model) {
    }

    public record LandingModuleImages(
        String resumeAnalysisImageUrl,
        String mockWrittenExamImageUrl,
        String formalInterviewImageUrl,
        String knowledgeBaseQaImageUrl,
        String careerGuideImageUrl
    ) {
    }

    public record LandingCardMedia(
        String resumeAnalysisCardMediaUrl,
        String mockWrittenExamCardMediaUrl,
        String formalInterviewCardMediaUrl,
        String knowledgeBaseQaCardMediaUrl,
        String careerGuideCardMediaUrl
    ) {
    }

    public record InterviewerAvatarUrls(
        String dongmingzhuAvatarUrl,
        String leijunAvatarUrl,
        String muskAvatarUrl,
        String trumpAvatarUrl
    ) {
    }

    private enum InterviewerAvatarModule {
        DONGMINGZHU("dongmingzhu") {
            @Override
            void assign(AdminResumeAiSettingsEntity entity, String url) {
                entity.setDongmingzhuAvatarUrl(url);
            }
        },
        LEIJUN("leijun") {
            @Override
            void assign(AdminResumeAiSettingsEntity entity, String url) {
                entity.setLeijunAvatarUrl(url);
            }
        },
        MUSK("musk") {
            @Override
            void assign(AdminResumeAiSettingsEntity entity, String url) {
                entity.setMuskAvatarUrl(url);
            }
        },
        TRUMP("trump") {
            @Override
            void assign(AdminResumeAiSettingsEntity entity, String url) {
                entity.setTrumpAvatarUrl(url);
            }
        };

        private final String key;

        InterviewerAvatarModule(String key) {
            this.key = key;
        }

        abstract void assign(AdminResumeAiSettingsEntity entity, String url);

        static InterviewerAvatarModule from(String raw) {
            String key = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
            for (InterviewerAvatarModule value : values()) {
                if (value.key.equals(key)) {
                    return value;
                }
            }
            throw new BusinessException(
                ErrorCode.BAD_REQUEST,
                "不支持的面试官，可选值：dongmingzhu、leijun、musk、trump"
            );
        }
    }

    private enum LandingImageModule {
        RESUME_ANALYSIS("resume-analysis") {
            @Override
            void assign(AdminResumeAiSettingsEntity entity, String url) {
                entity.setResumeAnalysisImageUrl(url);
            }
        },
        MOCK_WRITTEN_EXAM("mock-written-exam") {
            @Override
            void assign(AdminResumeAiSettingsEntity entity, String url) {
                entity.setMockWrittenExamImageUrl(url);
            }
        },
        FORMAL_INTERVIEW("formal-interview") {
            @Override
            void assign(AdminResumeAiSettingsEntity entity, String url) {
                entity.setFormalInterviewImageUrl(url);
            }
        },
        KNOWLEDGE_BASE_QA("knowledge-base-qa") {
            @Override
            void assign(AdminResumeAiSettingsEntity entity, String url) {
                entity.setKnowledgeBaseQaImageUrl(url);
            }
        },
        CAREER_GUIDE("career-guide") {
            @Override
            void assign(AdminResumeAiSettingsEntity entity, String url) {
                entity.setCareerGuideImageUrl(url);
            }
        },
        RESUME_ANALYSIS_CARD("resume-analysis-card") {
            @Override
            void assign(AdminResumeAiSettingsEntity entity, String url) {
                entity.setResumeAnalysisCardMediaUrl(url);
            }
        },
        MOCK_WRITTEN_EXAM_CARD("mock-written-exam-card") {
            @Override
            void assign(AdminResumeAiSettingsEntity entity, String url) {
                entity.setMockWrittenExamCardMediaUrl(url);
            }
        },
        FORMAL_INTERVIEW_CARD("formal-interview-card") {
            @Override
            void assign(AdminResumeAiSettingsEntity entity, String url) {
                entity.setFormalInterviewCardMediaUrl(url);
            }
        },
        KNOWLEDGE_BASE_QA_CARD("knowledge-base-qa-card") {
            @Override
            void assign(AdminResumeAiSettingsEntity entity, String url) {
                entity.setKnowledgeBaseQaCardMediaUrl(url);
            }
        },
        CAREER_GUIDE_CARD("career-guide-card") {
            @Override
            void assign(AdminResumeAiSettingsEntity entity, String url) {
                entity.setCareerGuideCardMediaUrl(url);
            }
        };

        private final String key;

        LandingImageModule(String key) {
            this.key = key;
        }

        abstract void assign(AdminResumeAiSettingsEntity entity, String url);

        static LandingImageModule from(String raw) {
            String key = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
            for (LandingImageModule value : values()) {
                if (value.key.equals(key)) {
                    return value;
                }
            }
            throw new BusinessException(
                ErrorCode.BAD_REQUEST,
                "不支持的模块类型，可选值：resume-analysis、mock-written-exam、formal-interview、knowledge-base-qa、career-guide、resume-analysis-card、mock-written-exam-card、formal-interview-card、knowledge-base-qa-card、career-guide-card"
            );
        }
    }
}
