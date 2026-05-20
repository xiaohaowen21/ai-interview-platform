package interview.guide.modules.resume.service;

import interview.guide.common.ai.AiErrorMessageHelper;
import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.modules.admin.service.AdminResumeAiSettingsService;
import interview.guide.modules.interview.model.ResumeAnalysisResponse;
import interview.guide.modules.resume.model.ResumeRewriteContentDTO;
import interview.guide.modules.resume.model.ResumeEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class ResumeRewriteAiService {

    private final AdminResumeAiSettingsService adminResumeAiSettingsService;
    private final ObjectMapper objectMapper;
    private final String systemPromptTemplate;
    private final String userPromptTemplate;
    private final double temperature;
    private final Duration connectTimeout;
    private final Duration readTimeout;

    public ResumeRewriteAiService(
        AdminResumeAiSettingsService adminResumeAiSettingsService,
        ObjectMapper objectMapper,
        @Value("${spring.ai.openai.chat.options.temperature:0.2}") double temperature,
        @Value("${app.resume-rewrite.connect-timeout-ms:15000}") long connectTimeoutMs,
        @Value("${app.resume-rewrite.read-timeout-ms:180000}") long readTimeoutMs,
        @Value("classpath:prompts/resume-rewrite-system.st") Resource systemPromptResource,
        @Value("classpath:prompts/resume-rewrite-user.st") Resource userPromptResource
    ) throws IOException {
        this.adminResumeAiSettingsService = adminResumeAiSettingsService;
        this.objectMapper = objectMapper;
        this.temperature = temperature;
        this.connectTimeout = Duration.ofMillis(Math.max(connectTimeoutMs, 1000));
        this.readTimeout = Duration.ofMillis(Math.max(readTimeoutMs, 1000));
        this.systemPromptTemplate = systemPromptResource.getContentAsString(StandardCharsets.UTF_8);
        this.userPromptTemplate = userPromptResource.getContentAsString(StandardCharsets.UTF_8);
    }

    public ResumeRewriteContentDTO generateContent(
        ResumeEntity resume,
        ResumeAnalysisResponse latestAnalysis,
        String jobDescription
    ) {
        // AI辅助生成：DeepSeek-R1, 2026-05-05
        AdminResumeAiSettingsService.ResumeAiRuntimeSettings settings = adminResumeAiSettingsService.getRuntimeSettings();
        if (settings.apiKey() == null || settings.apiKey().isBlank()) {
            throw new BusinessException(ErrorCode.AI_API_KEY_INVALID, "简历优化功能未配置可用的 AI Key");
        }

        String completionText = callChatCompletion(
            settings,
            buildSystemPrompt(),
            buildUserPrompt(resume, latestAnalysis, jobDescription)
        );

        try {
            return objectMapper.readValue(stripMarkdownFence(completionText), ResumeRewriteContentDTO.class);
        } catch (Exception exception) {
            log.error("Failed to parse resume rewrite content: {}", completionText, exception);
            throw new BusinessException(ErrorCode.RESUME_REWRITE_FAILED, "简历优化结果解析失败");
        }
    }

    private String buildSystemPrompt() {
        return systemPromptTemplate + """

请只返回 JSON 对象，不要输出 Markdown、解释或额外说明。
返回内容必须严格符合如下结构：
{
  "profile": {
    "fullName": "",
    "phone": "",
    "email": "",
    "location": "",
    "links": ""
  },
  "targetPosition": "",
  "professionalSummary": "",
  "coreSkills": [""],
  "workExperiences": [
    {
      "title": "",
      "subtitle": "",
      "period": "",
      "highlights": [""]
    }
  ],
  "projectExperiences": [
    {
      "title": "",
      "subtitle": "",
      "period": "",
      "highlights": [""]
    }
  ],
  "educationExperiences": [
    {
      "title": "",
      "subtitle": "",
      "period": "",
      "highlights": [""]
    }
  ],
  "certifications": [""],
  "additionalInformation": [""],
  "optimizationHighlights": [""]
}
""";
    }

    private String buildUserPrompt(
        ResumeEntity resume,
        ResumeAnalysisResponse latestAnalysis,
        String jobDescription
    ) {
        String analysisSummary = latestAnalysis == null ? "暂无分析结果" : safe(latestAnalysis.summary());
        String strengths = latestAnalysis == null ? "[]" : writeJson(latestAnalysis.strengths());
        String suggestions = latestAnalysis == null ? "[]" : writeJson(latestAnalysis.suggestions());
        String scoreDetail = latestAnalysis == null ? "{}" : writeJson(latestAnalysis.scoreDetail());
        String target = (jobDescription == null || jobDescription.isBlank())
            ? "未提供具体 JD，请基于现有分析结果做通用优化"
            : jobDescription.trim();

        return userPromptTemplate
            .replace("{filename}", safe(resume.getOriginalFilename()))
            .replace("{jobDescription}", safe(target))
            .replace("{analysisSummary}", safe(analysisSummary))
            .replace("{strengths}", strengths)
            .replace("{scoreDetail}", scoreDetail)
            .replace("{suggestions}", suggestions)
            .replace("{resumeText}", safe(resume.getResumeText()));
    }

    private String callChatCompletion(
        AdminResumeAiSettingsService.ResumeAiRuntimeSettings settings,
        String systemPrompt,
        String userPrompt
    ) {
        String endpoint = normalizeBaseUrl(settings.baseUrl()) + "/v1/chat/completions";
        RestClient restClient = buildRestClient(endpoint);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", settings.model());
        payload.put("temperature", temperature);
        payload.put("response_format", Map.of("type", "json_object"));
        payload.put("messages", List.of(
            Map.of("role", "system", "content", systemPrompt),
            Map.of("role", "user", "content", userPrompt)
        ));

        try {
            String responseBody = restClient.post()
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + settings.apiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(String.class);

            var root = objectMapper.readTree(responseBody);
            String content = root.path("choices").path(0).path("message").path("content").asText("");
            if (content.isBlank()) {
                throw new BusinessException(ErrorCode.RESUME_REWRITE_FAILED, "AI 未返回可用的优化内容");
            }
            return content;
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException(
                ErrorCode.AI_SERVICE_ERROR,
                AiErrorMessageHelper.toUserMessage(
                    exception.getMessage(),
                    "简历优化暂时不可用，请稍后重试；如持续失败请联系管理员。"
                )
            );
        }
    }

    private RestClient buildRestClient(String endpoint) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeout);
        requestFactory.setReadTimeout(readTimeout);
        return RestClient.builder()
            .baseUrl(endpoint)
            .requestFactory(requestFactory)
            .build();
    }

    private String normalizeBaseUrl(String baseUrl) {
        String value = (baseUrl == null || baseUrl.isBlank())
            ? "https://dashscope.aliyuncs.com/compatible-mode"
            : baseUrl.trim();
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(value);
        } catch (Exception exception) {
            return "[]";
        }
    }

    private String safe(String value) {
        return value == null ? "" : value;
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
}
