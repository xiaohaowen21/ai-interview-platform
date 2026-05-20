package interview.guide.common.ai;

import java.util.Locale;

public final class AiErrorMessageHelper {

    private AiErrorMessageHelper() {
    }

    public static String toUserMessage(String rawMessage, String fallbackMessage) {
        String normalized = normalize(rawMessage);
        if (normalized.isEmpty()) {
            return fallbackMessage;
        }

        if (containsAny(normalized,
            "allocationquota.freetieronly",
            "free tier of the model has been exhausted",
            "use free tier only",
            "free tier only"
        )) {
            return "AI 服务额度已用尽，请联系管理员检查模型配额或关闭免费额度限制后重试。";
        }

        if (containsAny(normalized,
            "invalid api key",
            "incorrect api key",
            "authentication failed",
            "unauthorized",
            "401",
            "api key"
        )) {
            return "AI 服务认证失败，请联系管理员检查 API Key 配置。";
        }

        if (containsAny(normalized,
            "timed out",
            "timeout",
            "connectexception",
            "connection refused",
            "connection reset",
            "no route to host",
            "failed to connect"
        )) {
            return "AI 服务连接超时或不可达，请稍后重试；如持续失败请联系管理员。";
        }

        if (containsAny(normalized,
            "429",
            "rate limit",
            "too many requests",
            "quota exceeded"
        )) {
            return "AI 服务请求过于频繁或额度不足，请稍后重试；如持续失败请联系管理员。";
        }

        if (containsAny(normalized,
            "no valid content",
            "解析 ai 响应失败",
            "parse",
            "json",
            "response format"
        )) {
            return "AI 服务返回结果异常，请稍后重试；如持续失败请联系管理员。";
        }

        return fallbackMessage;
    }

    private static String normalize(String rawMessage) {
        if (rawMessage == null || rawMessage.isBlank()) {
            return "";
        }
        return rawMessage
            .replace('\n', ' ')
            .replace('\r', ' ')
            .replaceAll("\\s+", " ")
            .trim()
            .toLowerCase(Locale.ROOT);
    }

    private static boolean containsAny(String value, String... candidates) {
        for (String candidate : candidates) {
            if (value.contains(candidate)) {
                return true;
            }
        }
        return false;
    }
}
