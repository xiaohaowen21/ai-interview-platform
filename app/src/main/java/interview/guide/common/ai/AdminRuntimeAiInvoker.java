package interview.guide.common.ai;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.modules.admin.service.AdminResumeAiSettingsService;
import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class AdminRuntimeAiInvoker {

    private static final String STRICT_JSON_INSTRUCTION = """
请仅返回可被 JSON 解析器直接解析的 JSON 对象，并严格满足字段结构要求：
1) 不要输出 Markdown 代码块（如 ```json）。
2) 不要输出任何解释文字、前后缀、注释。
3) 所有字符串内引号必须正确转义。
""";

    private final AdminResumeAiSettingsService adminResumeAiSettingsService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final int maxAttempts;
    private final boolean includeLastErrorInRetryPrompt;
    private final long readTimeoutMs;

    public AdminRuntimeAiInvoker(
        AdminResumeAiSettingsService adminResumeAiSettingsService,
        ObjectMapper objectMapper,
        @Value("${app.ai.structured-max-attempts:2}") int maxAttempts,
        @Value("${app.ai.structured-include-last-error:true}") boolean includeLastErrorInRetryPrompt,
        @Value("${app.interview.dialogue.connect-timeout-ms:10000}") long connectTimeoutMs,
        @Value("${app.interview.dialogue.read-timeout-ms:120000}") long readTimeoutMs
    ) {
        this.adminResumeAiSettingsService = adminResumeAiSettingsService;
        this.objectMapper = objectMapper;
        this.maxAttempts = Math.max(1, maxAttempts);
        this.includeLastErrorInRetryPrompt = includeLastErrorInRetryPrompt;
        this.readTimeoutMs = Math.max(1000, readTimeoutMs);
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(Math.max(connectTimeoutMs, 1000)))
            .build();
    }

    public <T> T invokeStructured(
        String systemPromptWithFormat,
        String userPrompt,
        double temperature,
        Class<T> responseType,
        ErrorCode errorCode,
        String errorPrefix,
        String logContext,
        Logger log
    ) {
        // AI辅助生成：DeepSeek-R1, 2026-05-05
        Exception lastError = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            String attemptSystemPrompt = attempt == 1
                ? systemPromptWithFormat
                : buildRetrySystemPrompt(systemPromptWithFormat, lastError);
            try {
                String content = callJsonChatCompletion(attemptSystemPrompt, userPrompt, temperature);
                return objectMapper.readValue(stripMarkdownFence(content), responseType);
            } catch (Exception exception) {
                lastError = exception;
                log.warn("{}结构化解析失败，准备重试: attempt={}, error={}", logContext, attempt, exception.getMessage());
            }
        }

        throw new BusinessException(
            errorCode,
            errorPrefix + (lastError != null ? sanitizeErrorMessage(lastError.getMessage()) : "unknown")
        );
    }

    private String callJsonChatCompletion(String systemPrompt, String userPrompt, double temperature) {
        AdminResumeAiSettingsService.ResumeAiRuntimeSettings settings = requireRuntimeSettings();

        Map<String, Object> payload = new HashMap<>();
        payload.put("model", settings.model());
        payload.put("temperature", temperature);
        payload.put("response_format", Map.of("type", "json_object"));
        payload.put("messages", List.of(
            Map.of("role", "system", "content", systemPrompt),
            Map.of("role", "user", "content", userPrompt)
        ));

        HttpRequest request = buildRequest(settings, payload);
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() == 401) {
                throw new BusinessException(ErrorCode.AI_API_KEY_INVALID, "AI Key 无效，请在管理员后台更新后重试");
            }
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new BusinessException(ErrorCode.AI_SERVICE_ERROR, simplifyError(response.body()));
            }
            return extractMessageContent(response.body());
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException(ErrorCode.AI_SERVICE_ERROR, "AI 调用失败：" + sanitizeErrorMessage(exception.getMessage()));
        }
    }

    private HttpRequest buildRequest(AdminResumeAiSettingsService.ResumeAiRuntimeSettings settings, Map<String, Object> payload) {
        try {
            return HttpRequest.newBuilder()
                .uri(URI.create(normalizeBaseUrl(settings.baseUrl()) + "/v1/chat/completions"))
                .timeout(Duration.ofMillis(readTimeoutMs))
                .header("Authorization", "Bearer " + settings.apiKey())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload), StandardCharsets.UTF_8))
                .build();
        } catch (Exception exception) {
            throw new BusinessException(ErrorCode.AI_SERVICE_ERROR, "构建 AI 请求失败");
        }
    }

    private String extractMessageContent(String responseBody) {
        try {
            var root = objectMapper.readTree(responseBody);
            String content = root.path("choices").path(0).path("message").path("content").asText("");
            if (content == null || content.isBlank()) {
                throw new BusinessException(ErrorCode.AI_SERVICE_ERROR, "AI 未返回可用内容");
            }
            return content;
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException(ErrorCode.AI_SERVICE_ERROR, "解析 AI 响应失败");
        }
    }

    private AdminResumeAiSettingsService.ResumeAiRuntimeSettings requireRuntimeSettings() {
        AdminResumeAiSettingsService.ResumeAiRuntimeSettings settings = adminResumeAiSettingsService.getRuntimeSettings();
        if (settings.apiKey() == null || settings.apiKey().isBlank()) {
            throw new BusinessException(ErrorCode.AI_API_KEY_INVALID, "当前未配置可用的 AI Key");
        }
        return settings;
    }

    private String buildRetrySystemPrompt(String systemPromptWithFormat, Exception lastError) {
        StringBuilder prompt = new StringBuilder(systemPromptWithFormat)
            .append("\n\n")
            .append(STRICT_JSON_INSTRUCTION)
            .append("\n上次输出解析失败，请仅返回合法 JSON。");

        if (includeLastErrorInRetryPrompt && lastError != null && lastError.getMessage() != null) {
            prompt.append("\n上次失败原因：").append(sanitizeErrorMessage(lastError.getMessage()));
        }
        return prompt.toString();
    }

    private String stripMarkdownFence(String text) {
        String normalized = text == null ? "" : text.trim();
        if (normalized.startsWith("```")) {
            int firstLineBreak = normalized.indexOf('\n');
            int lastFence = normalized.lastIndexOf("```");
            if (firstLineBreak >= 0 && lastFence > firstLineBreak) {
                return normalized.substring(firstLineBreak + 1, lastFence).trim();
            }
        }
        return normalized;
    }

    private String normalizeBaseUrl(String baseUrl) {
        String value = baseUrl == null ? "" : baseUrl.trim();
        if (value.isBlank()) {
            return "https://dashscope.aliyuncs.com/compatible-mode";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private String simplifyError(String raw) {
        return AiErrorMessageHelper.toUserMessage(
            raw,
            "AI 服务暂时不可用，请稍后重试；如持续失败请联系管理员。"
        );
    }

    private String sanitizeErrorMessage(String message) {
        if (message == null || message.isBlank()) {
            return "unknown";
        }
        String oneLine = message.replace('\n', ' ').replace('\r', ' ').trim();
        if (oneLine.length() > 200) {
            return oneLine.substring(0, 200) + "...";
        }
        return oneLine;
    }
}
