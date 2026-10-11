package interview.guide.common.security;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

/**
 * 登录令牌的签发与校验。
 *
 * <p>令牌格式为 {@code base64url(userId:过期时间戳).base64url(HMAC-SHA256 签名)}，
 * 服务端只凭签名确认身份，不再信任客户端自己填写的用户 ID。</p>
 */
@Slf4j
@Component
public class AuthTokenService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    @Value("${app.auth.token-secret:}")
    private String configuredSecret;

    @Value("${app.auth.token-ttl-hours:168}")
    private long tokenTtlHours;

    private byte[] secret;

    @PostConstruct
    void initialize() {
        if (configuredSecret == null || configuredSecret.isBlank()) {
            byte[] generated = new byte[32];
            new SecureRandom().nextBytes(generated);
            secret = generated;
            log.warn("APP_AUTH_TOKEN_SECRET 未配置，已生成临时密钥：服务重启后所有用户需要重新登录，多实例部署时请务必配置固定密钥。");
        } else {
            secret = configuredSecret.trim().getBytes(StandardCharsets.UTF_8);
        }
        if (tokenTtlHours <= 0) {
            tokenTtlHours = 168;
        }
    }

    public String issue(String userId) {
        long expiresAt = Instant.now().getEpochSecond() + tokenTtlHours * 3600;
        return issue(userId, expiresAt);
    }

    String issue(String userId, long expiresAtEpochSecond) {
        String payload = userId + ":" + expiresAtEpochSecond;
        byte[] payloadBytes = payload.getBytes(StandardCharsets.UTF_8);
        return ENCODER.encodeToString(payloadBytes) + "." + ENCODER.encodeToString(sign(payloadBytes));
    }

    /**
     * @return 令牌有效时返回其中的用户 ID，否则为空
     */
    public Optional<String> verify(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }

        int separator = token.indexOf('.');
        if (separator <= 0 || separator == token.length() - 1) {
            return Optional.empty();
        }

        try {
            byte[] payloadBytes = DECODER.decode(token.substring(0, separator));
            byte[] signature = DECODER.decode(token.substring(separator + 1));
            if (!MessageDigest.isEqual(signature, sign(payloadBytes))) {
                return Optional.empty();
            }

            String payload = new String(payloadBytes, StandardCharsets.UTF_8);
            int colon = payload.lastIndexOf(':');
            if (colon <= 0) {
                return Optional.empty();
            }

            long expiresAt = Long.parseLong(payload.substring(colon + 1));
            if (expiresAt < Instant.now().getEpochSecond()) {
                return Optional.empty();
            }

            String userId = payload.substring(0, colon);
            return userId.isBlank() ? Optional.empty() : Optional.of(userId);
        } catch (IllegalArgumentException exception) {
            return Optional.empty();
        }
    }

    private byte[] sign(byte[] payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            return mac.doFinal(payload);
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException("无法计算登录令牌签名", exception);
        }
    }
}
