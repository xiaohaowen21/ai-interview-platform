package interview.guide.modules.interview.service;

import interview.guide.common.ai.AiErrorMessageHelper;
import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.modules.admin.service.AdminResumeAiSettingsService;
import interview.guide.modules.interview.model.InterviewQuestionDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Consumer;

/**
 * Handles follow-up decision and streaming interviewer replies with the current OpenAI-compatible API.
 */
@Slf4j
@Service
public class InterviewDialogueAiService {

    private static final Map<String, String> PERSONA_STYLE_HINTS = Map.of(
        "dongmingzhu", "董明珠风格：目标导向、节奏直接、关注执行与结果，追问时强调落地和抗压。",
        "leijun", "雷军风格：温和务实、逻辑清晰、重视方法论与复盘，语气克制且鼓励表达。",
        "musk", "马斯克风格：第一性原理、聚焦技术本质与创新假设，追问底层推导与决策依据。",
        "trump", "特朗普风格：高压挑战、节奏偏快、强调竞争与成果，追问临场应对与说服力。"
    );

    private final AdminResumeAiSettingsService adminResumeAiSettingsService;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String followUpSystemPrompt;
    private final String followUpUserPrompt;
    private final String turnSystemPrompt;
    private final String turnUserPrompt;
    private final String postReviewSystemPrompt;
    private final String postReviewUserPrompt;
    private final double followUpTemperature;
    private final double turnTemperature;
    private final double postReviewTemperature;

    public InterviewDialogueAiService(
        AdminResumeAiSettingsService adminResumeAiSettingsService,
        ObjectMapper objectMapper,
        @Value("${app.interview.dialogue.connect-timeout-ms:10000}") long connectTimeoutMs,
        @Value("${app.interview.dialogue.read-timeout-ms:120000}") long readTimeoutMs,
        @Value("${app.interview.dialogue.follow-up-temperature:0.1}") double followUpTemperature,
        @Value("${app.interview.dialogue.turn-temperature:0.55}") double turnTemperature,
        @Value("${app.interview.dialogue.post-review-temperature:0.45}") double postReviewTemperature,
        @Value("classpath:prompts/interview-follow-up-system.st") Resource followUpSystemPromptResource,
        @Value("classpath:prompts/interview-follow-up-user.st") Resource followUpUserPromptResource,
        @Value("classpath:prompts/interview-turn-system.st") Resource turnSystemPromptResource,
        @Value("classpath:prompts/interview-turn-user.st") Resource turnUserPromptResource,
        @Value("classpath:prompts/interview-post-review-system.st") Resource postReviewSystemPromptResource,
        @Value("classpath:prompts/interview-post-review-user.st") Resource postReviewUserPromptResource
    ) throws IOException {
        this.adminResumeAiSettingsService = adminResumeAiSettingsService;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(Math.max(connectTimeoutMs, 1000)))
            .build();
        this.followUpSystemPrompt = followUpSystemPromptResource.getContentAsString(StandardCharsets.UTF_8);
        this.followUpUserPrompt = followUpUserPromptResource.getContentAsString(StandardCharsets.UTF_8);
        this.turnSystemPrompt = turnSystemPromptResource.getContentAsString(StandardCharsets.UTF_8);
        this.turnUserPrompt = turnUserPromptResource.getContentAsString(StandardCharsets.UTF_8);
        this.postReviewSystemPrompt = postReviewSystemPromptResource.getContentAsString(StandardCharsets.UTF_8);
        this.postReviewUserPrompt = postReviewUserPromptResource.getContentAsString(StandardCharsets.UTF_8);
        this.followUpTemperature = followUpTemperature;
        this.turnTemperature = turnTemperature;
        this.postReviewTemperature = postReviewTemperature;
    }

    public FollowUpDecision decideFollowUp(
        String resumeText,
        InterviewQuestionDTO currentQuestion,
        String answer,
        List<String> followUpCandidates,
        List<InterviewQuestionDTO> history
    ) {
        // AI辅助生成：DeepSeek-R1, 2026-05-05
        if (currentQuestion == null || followUpCandidates == null || followUpCandidates.isEmpty()) {
            return FollowUpDecision.skip("No follow-up candidates");
        }

        if (answer == null || answer.isBlank()) {
            return FollowUpDecision.skip("Answer is empty");
        }

        if (looksLikeGiveUp(answer)) {
            return FollowUpDecision.skip("Candidate gave up");
        }

        try {
            String userPrompt = renderTemplate(followUpUserPrompt, Map.of(
                "currentQuestion", safe(currentQuestion.question()),
                "answer", safe(answer),
                "followUpCandidates", formatList(followUpCandidates),
                "history", buildHistory(history)
            ));

            FollowUpDecision decision = callJsonChatCompletion(
                followUpSystemPrompt,
                userPrompt,
                followUpTemperature,
                FollowUpDecision.class
            );

            if (!decision.askFollowUp()) {
                return FollowUpDecision.skip(safe(decision.reason()));
            }

            String selected = safe(decision.selectedFollowUp());
            boolean matched = followUpCandidates.stream().filter(Objects::nonNull).anyMatch(selected::equals);
            if (!matched) {
                return FollowUpDecision.skip("Selected follow-up is not in candidate list");
            }
            return decision;
        } catch (Exception exception) {
            log.warn("Follow-up decision failed, fallback to skipping follow-up: {}", exception.getMessage());
            return FollowUpDecision.skip("Fallback");
        }
    }

    public String streamInterviewerTurn(InterviewerTurnInput input, Consumer<String> chunkConsumer) {
        // AI辅助生成：DeepSeek-R1, 2026-05-05
        String nextQuestion = input.nextQuestion() == null ? "" : safe(input.nextQuestion().question());
        String resumeSummary = summarizeResume(input.resumeText());
        String resolvedStyle = resolveInterviewerStyle(input.interviewerStyle());
        String styleHint = resolvedStyle.isBlank()
            ? ""
            : ("面试官风格偏好：" + resolvedStyle + "\n");
        String userPrompt = renderTemplate(turnUserPrompt, Map.of(
            "resumeSummary", styleHint + resumeSummary,
            "currentQuestion", input.currentQuestion() == null ? "无" : safe(input.currentQuestion().question()),
            "answer", safe(input.answer()),
            "nextQuestion", nextQuestion.isBlank() ? "无" : nextQuestion,
            "isFollowUp", input.nextQuestion() != null && input.nextQuestion().isFollowUp() ? "是" : "否"
        ));

        try {
            return streamChatCompletion(turnSystemPrompt, userPrompt, turnTemperature, chunkConsumer);
        } catch (Exception exception) {
            log.warn("Streaming interviewer turn failed, using fallback text: {}", exception.getMessage());
            String fallback = buildFallbackTurn(input);
            emitFallbackChunks(fallback, chunkConsumer);
            return fallback;
        }
    }

    public String answerPostInterviewQuestion(PostInterviewQuestionInput input) {
        String resolvedStyle = resolveInterviewerStyle(input.interviewerStyle());
        String userPrompt = renderTemplate(postReviewUserPrompt, Map.of(
            "resumeSummary", summarizeResume(input.resumeText()),
            "overallScore", String.valueOf(Math.max(input.overallScore(), 0)),
            "overallFeedback", safe(input.overallFeedback()),
            "strengths", formatInlineList(input.strengths()),
            "improvements", formatInlineList(input.improvements()),
            "candidateQuestion", safe(input.candidateQuestion()),
            "interviewerStyle", resolvedStyle.isBlank() ? "默认真实面试官风格" : resolvedStyle
        ));

        try {
            return callTextChatCompletion(postReviewSystemPrompt, userPrompt, postReviewTemperature);
        } catch (Exception exception) {
            log.warn("Post interview follow-up failed, using fallback text: {}", exception.getMessage());
            return "你的这个问题很关键。结合这轮表现来看，建议你优先把回答结构和重点证据补齐，这样下次表达会更稳。";
        }
    }

    private String buildFallbackTurn(InterviewerTurnInput input) {
        if (input.nextQuestion() == null) {
            return randomClosingLine();
        }
        if (input.nextQuestion().isFollowUp()) {
            return randomFollowUpLead() + input.nextQuestion().question();
        }
        return randomNextQuestionLead() + input.nextQuestion().question();
    }

    private void emitFallbackChunks(String text, Consumer<String> chunkConsumer) {
        int step = 12;
        for (int start = 0; start < text.length(); start += step) {
            int end = Math.min(start + step, text.length());
            chunkConsumer.accept(text.substring(start, end));
        }
    }

    private <T> T callJsonChatCompletion(
        String systemPrompt,
        String userPrompt,
        double temperature,
        Class<T> responseType
    ) {
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
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new BusinessException(ErrorCode.AI_SERVICE_ERROR, simplifyError(response.body()));
            }

            String content = extractMessageContent(response.body());
            return objectMapper.readValue(stripMarkdownFence(content), responseType);
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException(ErrorCode.AI_SERVICE_ERROR, "AI 调用失败：" + simplifyError(exception.getMessage()));
        }
    }

    private String callTextChatCompletion(String systemPrompt, String userPrompt, double temperature) {
        AdminResumeAiSettingsService.ResumeAiRuntimeSettings settings = requireRuntimeSettings();

        Map<String, Object> payload = new HashMap<>();
        payload.put("model", settings.model());
        payload.put("temperature", temperature);
        payload.put("messages", List.of(
            Map.of("role", "system", "content", systemPrompt),
            Map.of("role", "user", "content", userPrompt)
        ));

        HttpRequest request = buildRequest(settings, payload);
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new BusinessException(ErrorCode.AI_SERVICE_ERROR, simplifyError(response.body()));
            }
            return stripMarkdownFence(extractMessageContent(response.body()));
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException(ErrorCode.AI_SERVICE_ERROR, "AI 调用失败：" + simplifyError(exception.getMessage()));
        }
    }

    private String streamChatCompletion(
        String systemPrompt,
        String userPrompt,
        double temperature,
        Consumer<String> chunkConsumer
    ) throws IOException, InterruptedException {
        AdminResumeAiSettingsService.ResumeAiRuntimeSettings settings = requireRuntimeSettings();

        Map<String, Object> payload = new HashMap<>();
        payload.put("model", settings.model());
        payload.put("temperature", temperature);
        payload.put("stream", true);
        payload.put("messages", List.of(
            Map.of("role", "system", "content", systemPrompt),
            Map.of("role", "user", "content", userPrompt)
        ));

        HttpRequest request = buildRequest(settings, payload);
        HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String body = new String(response.body().readAllBytes(), StandardCharsets.UTF_8);
            throw new BusinessException(ErrorCode.AI_SERVICE_ERROR, simplifyError(body));
        }

        StringBuilder content = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String normalized = line.trim();
                if (normalized.isEmpty() || !normalized.startsWith("data:")) {
                    continue;
                }

                String data = normalized.substring(5).trim();
                if ("[DONE]".equals(data)) {
                    break;
                }

                String chunk = extractDeltaContent(data);
                if (chunk == null || chunk.isEmpty()) {
                    continue;
                }
                content.append(chunk);
                chunkConsumer.accept(chunk);
            }
        }

        if (content.isEmpty()) {
            Map<String, Object> fallbackPayload = new HashMap<>();
            fallbackPayload.put("model", settings.model());
            fallbackPayload.put("temperature", temperature);
            fallbackPayload.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt)
            ));
            HttpResponse<String> fallbackResponse = httpClient.send(
                buildRequest(settings, fallbackPayload),
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
            );
            String message = extractMessageContent(fallbackResponse.body());
            String normalized = stripMarkdownFence(message);
            chunkConsumer.accept(normalized);
            return normalized;
        }

        return content.toString();
    }

    private HttpRequest buildRequest(AdminResumeAiSettingsService.ResumeAiRuntimeSettings settings, Map<String, Object> payload) {
        try {
            return HttpRequest.newBuilder()
                .uri(URI.create(normalizeBaseUrl(settings.baseUrl()) + "/v1/chat/completions"))
                .timeout(Duration.ofSeconds(120))
                .header("Authorization", "Bearer " + settings.apiKey())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload), StandardCharsets.UTF_8))
                .build();
        } catch (Exception exception) {
            throw new BusinessException(ErrorCode.AI_SERVICE_ERROR, "构建 AI 请求失败");
        }
    }

    private AdminResumeAiSettingsService.ResumeAiRuntimeSettings requireRuntimeSettings() {
        AdminResumeAiSettingsService.ResumeAiRuntimeSettings settings = adminResumeAiSettingsService.getRuntimeSettings();
        if (settings.apiKey() == null || settings.apiKey().isBlank()) {
            throw new BusinessException(ErrorCode.AI_API_KEY_INVALID, "当前未配置可用的 AI Key");
        }
        return settings;
    }

    private String extractMessageContent(String responseBody) throws IOException {
        var root = objectMapper.readTree(responseBody);
        String content = root.path("choices").path(0).path("message").path("content").asText("");
        if (content == null || content.isBlank()) {
            throw new BusinessException(ErrorCode.AI_SERVICE_ERROR, "AI 未返回可用内容");
        }
        return content;
    }

    private String extractDeltaContent(String data) throws IOException {
        var root = objectMapper.readTree(data);
        return root.path("choices").path(0).path("delta").path("content").asText("");
    }

    private String renderTemplate(String template, Map<String, String> variables) {
        String rendered = template;
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            rendered = rendered.replace("{" + entry.getKey() + "}", safe(entry.getValue()));
        }
        return rendered;
    }

    private String buildHistory(List<InterviewQuestionDTO> history) {
        if (history == null || history.isEmpty()) {
            return "无";
        }
        return history.stream()
            .filter(Objects::nonNull)
            .limit(6)
            .map(item -> "问题：" + safe(item.question()) + "\n回答：" + safe(item.userAnswer()))
            .reduce((left, right) -> left + "\n\n" + right)
            .orElse("无");
    }

    private String formatList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "无";
        }
        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < values.size(); index++) {
            builder.append(index + 1).append(". ").append(values.get(index)).append('\n');
        }
        return builder.toString().trim();
    }

    private String formatInlineList(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "无";
        }
        return values.stream()
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(item -> !item.isEmpty())
            .limit(4)
            .reduce((left, right) -> left + "；" + right)
            .orElse("无");
    }

    private String summarizeResume(String resumeText) {
        String normalized = safe(resumeText).replaceAll("\\s+", " ").trim();
        if (normalized.length() <= 800) {
            return normalized;
        }
        return normalized.substring(0, 800);
    }

    private boolean looksLikeGiveUp(String answer) {
        String normalized = safe(answer).toLowerCase().replaceAll("[\\p{Punct}\\p{IsPunctuation}\\s]+", "");
        if (normalized.isBlank()) {
            return true;
        }
        return normalized.contains("不知道")
            || normalized.contains("不清楚")
            || normalized.contains("不会")
            || normalized.contains("没学过")
            || normalized.contains("noidea")
            || normalized.contains("idk")
            || normalized.contains("skip");
    }

    private String normalizeBaseUrl(String baseUrl) {
        String value = safe(baseUrl);
        if (value.isBlank()) {
            return "https://dashscope.aliyuncs.com/compatible-mode";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private String stripMarkdownFence(String text) {
        String normalized = safe(text).trim();
        if (normalized.startsWith("```")) {
            int firstLineBreak = normalized.indexOf('\n');
            int lastFence = normalized.lastIndexOf("```");
            if (firstLineBreak >= 0 && lastFence > firstLineBreak) {
                return normalized.substring(firstLineBreak + 1, lastFence).trim();
            }
        }
        return normalized;
    }

    private String simplifyError(String raw) {
        return AiErrorMessageHelper.toUserMessage(
            raw,
            "AI 服务暂时不可用，请稍后重试；如持续失败请联系管理员。"
        );
    }

    private String resolveInterviewerStyle(String style) {
        String normalized = safe(style).trim();
        if (normalized.isEmpty()) {
            return "";
        }

        String key = normalized.toLowerCase();
        if (key.startsWith("persona:")) {
            key = key.substring("persona:".length()).trim();
        }

        String preset = PERSONA_STYLE_HINTS.get(key);
        return preset == null ? normalized : preset;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String randomFollowUpLead() {
        List<String> leads = List.of(
            "你这个点很关键，我再追问一句：",
            "我想沿着你刚才的回答再深挖一下：",
            "这个信息很有价值，我继续问你一个细节："
        );
        return leads.get(ThreadLocalRandom.current().nextInt(leads.size()));
    }

    private String randomNextQuestionLead() {
        List<String> leads = List.of(
            "明白了，我们继续下一个问题：",
            "收到，接下来这个问题请你聊一聊：",
            "好，我们往下推进，下一题是："
        );
        return leads.get(ThreadLocalRandom.current().nextInt(leads.size()));
    }

    private String randomClosingLine() {
        List<String> closing = List.of(
            "谢谢你的回答，这轮面试先到这里。系统正在整理分析结果，稍后即可查看。",
            "好的，本轮对话面试结束。系统会马上生成你的分析结果，请稍等。",
            "辛苦了，这轮交流先收尾。系统正在生成评估结论，稍后为你展示。"
        );
        return closing.get(ThreadLocalRandom.current().nextInt(closing.size()));
    }

    public record FollowUpDecision(boolean askFollowUp, String selectedFollowUp, String reason) {
        public static FollowUpDecision skip(String reason) {
            return new FollowUpDecision(false, "", reason == null ? "" : reason);
        }
    }

    public record InterviewerTurnInput(
        String resumeText,
        InterviewQuestionDTO currentQuestion,
        InterviewQuestionDTO nextQuestion,
        String answer,
        String interviewerStyle
    ) {
    }

    public record PostInterviewQuestionInput(
        String resumeText,
        int overallScore,
        String overallFeedback,
        List<String> strengths,
        List<String> improvements,
        String candidateQuestion,
        String interviewerStyle
    ) {
    }
}
