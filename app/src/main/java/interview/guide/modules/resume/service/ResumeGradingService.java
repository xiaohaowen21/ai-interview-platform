package interview.guide.modules.resume.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import interview.guide.common.ai.AiErrorMessageHelper;
import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.modules.admin.service.AdminResumeAiSettingsService;
import interview.guide.modules.interview.model.ResumeAnalysisResponse;
import interview.guide.modules.interview.model.ResumeAnalysisResponse.ScoreDetail;
import interview.guide.modules.interview.model.ResumeAnalysisResponse.Suggestion;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class ResumeGradingService {

    private final AdminResumeAiSettingsService adminResumeAiSettingsService;
    private final ObjectMapper objectMapper;
    private final String systemPromptTemplate;
    private final String userPromptTemplate;
    private final double temperature;
    private final Duration connectTimeout;
    private final Duration readTimeout;

    public ResumeGradingService(
        AdminResumeAiSettingsService adminResumeAiSettingsService,
        ObjectMapper objectMapper,
        @Value("${spring.ai.openai.chat.options.temperature:0.2}") double temperature,
        @Value("${app.resume-scoring.connect-timeout-ms:15000}") long connectTimeoutMs,
        @Value("${app.resume-scoring.read-timeout-ms:90000}") long readTimeoutMs,
        @Value("classpath:prompts/resume-analysis-system.st") Resource systemPromptResource,
        @Value("classpath:prompts/resume-analysis-user.st") Resource userPromptResource
    ) throws IOException {
        this.adminResumeAiSettingsService = adminResumeAiSettingsService;
        this.objectMapper = objectMapper;
        this.temperature = temperature;
        this.connectTimeout = Duration.ofMillis(Math.max(connectTimeoutMs, 1000));
        this.readTimeout = Duration.ofMillis(Math.max(readTimeoutMs, 1000));
        this.systemPromptTemplate = systemPromptResource.getContentAsString(StandardCharsets.UTF_8);
        this.userPromptTemplate = userPromptResource.getContentAsString(StandardCharsets.UTF_8);
    }

    public ResumeAnalysisResponse analyzeResume(String resumeText) {
        // AI辅助生成：DeepSeek-R1, 2026-05-05
        log.info("Start resume analysis, length: {}", resumeText.length());
        try {
            AdminResumeAiSettingsService.ResumeAiRuntimeSettings settings = adminResumeAiSettingsService.getRuntimeSettings();
            log.info("Resume scoring runtime settings: baseUrl={}, model={}",
                normalizeBaseUrl(settings.baseUrl()), settings.model());
            String completionText = callChatCompletion(settings, buildSystemPrompt(), buildUserPrompt(resumeText));
            ResumeAnalysisResponse response = parseAnalysisResponse(completionText, resumeText);
            log.info("Resume analysis finished. Score: {}", response.overallScore());
            return response;
        } catch (Exception exception) {
            log.error("Resume analysis failed: {}", exception.getMessage(), exception);
            return createErrorResponse(resumeText, exception.getMessage());
        }
    }

    private String buildSystemPrompt() {
        return systemPromptTemplate + """

Return JSON only. Do not wrap in markdown or add extra explanation.
Output must strictly follow this schema:
{
  "overallScore": 0,
  "scoreDetail": {
    "contentScore": 0,
    "structureScore": 0,
    "skillMatchScore": 0,
    "expressionScore": 0,
    "projectScore": 0
  },
  "summary": "",
  "strengths": [""],
  "suggestions": [
    {
      "category": "",
      "priority": "",
      "issue": "",
      "recommendation": ""
    }
  ]
}
""";
    }

    private String buildUserPrompt(String resumeText) {
        return userPromptTemplate.replace("{resumeText}", resumeText);
    }

    private String callChatCompletion(
        AdminResumeAiSettingsService.ResumeAiRuntimeSettings settings,
        String systemPrompt,
        String userPrompt
    ) {
        if (settings.apiKey() == null || settings.apiKey().isBlank()) {
            throw new BusinessException(ErrorCode.AI_API_KEY_INVALID, "Resume scoring API key is not configured.");
        }

        String endpoint = normalizeBaseUrl(settings.baseUrl()) + "/v1/chat/completions";
        RestClient restClient = buildRestClient(endpoint);

        Map<String, Object> payload = new HashMap<>();
        payload.put("model", settings.model());
        payload.put("temperature", temperature);
        payload.put("response_format", Map.of("type", "json_object"));
        payload.put("messages", List.of(
            Map.of("role", "system", "content", systemPrompt),
            Map.of("role", "user", "content", userPrompt)
        ));

        String responseBody;
        try {
            responseBody = restClient.post()
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + settings.apiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(String.class);
        } catch (Exception exception) {
            throw new BusinessException(
                ErrorCode.AI_SERVICE_ERROR,
                AiErrorMessageHelper.toUserMessage(
                    exception.getMessage(),
                    "简历分析暂时不可用，请稍后重试；如持续失败请联系管理员。"
                )
            );
        }

        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
            if (contentNode.isMissingNode() || contentNode.asText().isBlank()) {
                throw new BusinessException(ErrorCode.RESUME_ANALYSIS_FAILED, "No valid content returned by the scoring API.");
            }
            return contentNode.asText();
        } catch (IOException exception) {
            throw new BusinessException(ErrorCode.RESUME_ANALYSIS_FAILED, "Unable to parse scoring response.");
        }
    }

    private ResumeAnalysisResponse parseAnalysisResponse(String jsonText, String originalText) {
        try {
            JsonNode root = objectMapper.readTree(jsonText);
            JsonNode detailNode = root.path("scoreDetail");

            ScoreDetail scoreDetail = new ScoreDetail(
                detailNode.path("contentScore").asInt(0),
                detailNode.path("structureScore").asInt(0),
                detailNode.path("skillMatchScore").asInt(0),
                detailNode.path("expressionScore").asInt(0),
                detailNode.path("projectScore").asInt(0)
            );

            List<String> strengths = root.path("strengths").isArray()
                ? objectMapper.readerForListOf(String.class).readValue(root.path("strengths"))
                : List.of();

            List<Suggestion> suggestions = new ArrayList<>();
            JsonNode suggestionsNode = root.path("suggestions");
            if (suggestionsNode.isArray()) {
                for (JsonNode item : suggestionsNode) {
                    suggestions.add(new Suggestion(
                        item.path("category").asText("General"),
                        item.path("priority").asText("Medium"),
                        item.path("issue").asText("Needs improvement"),
                        item.path("recommendation").asText("Please add more role-relevant details.")
                    ));
                }
            }

            return new ResumeAnalysisResponse(
                root.path("overallScore").asInt(0),
                scoreDetail,
                root.path("summary").asText("No summary"),
                strengths,
                suggestions,
                originalText
            );
        } catch (Exception exception) {
            throw new BusinessException(ErrorCode.RESUME_ANALYSIS_FAILED, "Unable to parse scoring result: " + exception.getMessage());
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

    private ResumeAnalysisResponse createErrorResponse(String originalText, String errorMessage) {
        String userMessage = AiErrorMessageHelper.toUserMessage(
            errorMessage,
            "简历分析暂时不可用，请稍后重试；如持续失败请联系管理员。"
        );
        return new ResumeAnalysisResponse(
            0,
            new ScoreDetail(0, 0, 0, 0, 0),
            userMessage,
            List.of(),
            List.of(new Suggestion(
                "System",
                "High",
                "当前无法完成简历分析",
                "请稍后重试；如持续失败请联系管理员检查 AI 服务配置和额度。"
            )),
            originalText
        );
    }
}
