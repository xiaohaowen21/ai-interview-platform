package interview.guide.modules.admin.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.infrastructure.file.FileStorageService;
import interview.guide.modules.admin.model.AdminResumeAiSettingsEntity;
import interview.guide.modules.admin.model.AdminResumeAiSettingsTestResultDTO;
import interview.guide.modules.admin.model.AdminResumeAiSettingsUpdateRequest;
import interview.guide.modules.admin.repository.AdminResumeAiSettingsRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * AI 设置的安全校验：已保存的密钥不能发往新地址，地址不能指向内网，头像不接受 SVG
 */
@DisplayName("AI 设置安全校验测试")
class AdminAiSettingsSafetyTest {

    // 测试环境可能没有 DNS，统一用公网 IP 字面量，避免域名解析
    private static final String STORED_BASE_URL = "https://8.8.8.8/compatible-mode";
    private static final String STORED_KEY = "sk-stored-production-key";
    private static final String MASKED_KEY = "sk-s********-key";

    private AdminResumeAiSettingsRepository repository;
    private FileStorageService fileStorageService;
    private AdminResumeAiSettingsService service;

    @BeforeEach
    void setUp() {
        repository = mock(AdminResumeAiSettingsRepository.class);
        fileStorageService = mock(FileStorageService.class);
        service = new AdminResumeAiSettingsService(repository, fileStorageService);

        AdminResumeAiSettingsEntity entity = new AdminResumeAiSettingsEntity();
        entity.setBaseUrl(STORED_BASE_URL);
        entity.setApiKey(STORED_KEY);
        entity.setModel("qwen-plus");
        when(repository.findAll()).thenReturn(List.of(entity));
    }

    private AdminResumeAiSettingsUpdateRequest request(String baseUrl, String apiKey) {
        return new AdminResumeAiSettingsUpdateRequest(
            baseUrl, apiKey, "qwen-plus", "https://example.com/mock",
            "", "", "", "", "", "", "", "", "", "", "", "", "", ""
        );
    }

    @Test
    @DisplayName("测试连接时，换了地址却沿用已保存的密钥会被拒绝")
    void testRejectsStoredKeyForNewBaseUrl() {
        AdminResumeAiSettingsTestResultDTO result = service.testSettings(request("https://203.0.113.10", MASKED_KEY));

        assertFalse(result.success());
        assertTrue(result.message().contains("重新填写 API Key"));

        AdminResumeAiSettingsTestResultDTO blankKey = service.testSettings(request("https://203.0.113.10", ""));
        assertFalse(blankKey.success());
        assertTrue(blankKey.message().contains("重新填写 API Key"));
    }

    @Test
    @DisplayName("保存设置时，换了地址却沿用已保存的密钥会被拒绝")
    void saveRejectsStoredKeyForNewBaseUrl() {
        BusinessException error = assertThrows(BusinessException.class,
            () -> service.updateSettings(request("https://203.0.113.10", MASKED_KEY)));

        assertTrue(error.getMessage().contains("重新填写 API Key"));
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("地址不变时可以沿用已保存的密钥")
    void saveKeepsStoredKeyForSameBaseUrl() {
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(fileStorageService.getFileUrl("")).thenReturn("http://storage/");

        service.updateSettings(request(STORED_BASE_URL + "/", MASKED_KEY));

        verify(repository).save(argThat(entity -> STORED_KEY.equals(entity.getApiKey())));
    }

    @Test
    @DisplayName("AI 服务地址不能指向本机、内网或元数据地址")
    void rejectsInternalBaseUrls() {
        assertNotNull(service.validateProviderBaseUrl("http://127.0.0.1:9000"));
        assertNotNull(service.validateProviderBaseUrl("http://localhost:6379"));
        assertNotNull(service.validateProviderBaseUrl("http://10.0.0.5"));
        assertNotNull(service.validateProviderBaseUrl("http://192.168.1.10"));
        assertNotNull(service.validateProviderBaseUrl("http://169.254.169.254/latest"));
        assertNotNull(service.validateProviderBaseUrl("http://[::1]:8080"));
        assertNotNull(service.validateProviderBaseUrl("file:///etc/passwd"));
        assertNotNull(service.validateProviderBaseUrl("http://user:pass@8.8.8.8"));

        assertNull(service.validateProviderBaseUrl("https://8.8.8.8/compatible-mode"));
    }

    @Test
    @DisplayName("显式允许后可以使用内网地址")
    void allowsInternalBaseUrlWhenConfigured() {
        ReflectionTestUtils.setField(service, "allowPrivateBaseUrl", true);

        assertNull(service.validateProviderBaseUrl("http://10.0.0.5:11434"));
    }

    @Test
    @DisplayName("面试官头像不接受 SVG")
    void rejectsSvgAvatar() {
        MockMultipartFile svg = new MockMultipartFile("file", "a.svg", "image/svg+xml",
            "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes());

        assertThrows(BusinessException.class, () -> service.uploadInterviewerAvatar("leijun", svg));
        verify(fileStorageService, never()).uploadLandingAsset(any());
    }
}
