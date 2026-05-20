package interview.guide.modules.app;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.common.result.Result;
import interview.guide.modules.admin.service.AdminResumeAiSettingsService;
import interview.guide.modules.app.model.InternalVoiceRuntimeAiConfigDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class InternalVoiceConfigController {

    private final AdminResumeAiSettingsService adminResumeAiSettingsService;

    @Value("${app.internal.voice-token:}")
    private String internalVoiceToken;

    @GetMapping("/api/internal/voice/runtime-ai-config")
    public Result<InternalVoiceRuntimeAiConfigDTO> getVoiceRuntimeAiConfig(
        @RequestHeader(value = "X-Internal-Token", required = false) String token
    ) {
        if (internalVoiceToken == null || internalVoiceToken.isBlank()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "内部语音配置未启用");
        }
        if (token == null || !internalVoiceToken.equals(token)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "无权访问内部语音配置");
        }

        AdminResumeAiSettingsService.ResumeAiRuntimeSettings settings = adminResumeAiSettingsService.getRuntimeSettings();
        return Result.success(new InternalVoiceRuntimeAiConfigDTO(settings.apiKey()));
    }
}
