package interview.guide.modules.app;

import interview.guide.common.security.AuthTokenFilter;
import interview.guide.common.security.RequestQuotaService;
import interview.guide.modules.auth.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * 语音服务的准入检查，供前端 nginx 的 {@code auth_request} 调用。
 *
 * <p>语音服务本身不认识登录令牌，所有 {@code /voice-api/} 请求先经这里确认：
 * 令牌有效、账号未停用、且未超出按用户的调用额度。这里必须返回真实的 HTTP 状态码，
 * nginx 只看状态码：2xx 放行，401 视为未登录，403 视为超出额度。</p>
 */
@RestController
@RequiredArgsConstructor
public class VoiceAccessController {

    private final UserAccountRepository userAccountRepository;
    private final RequestQuotaService requestQuotaService;

    @Value("${app.voice.per-minute-limit:30}")
    private long perMinuteLimit;

    @Value("${app.voice.per-hour-limit:300}")
    private long perHourLimit;

    @GetMapping("/api/voice/access-check")
    public ResponseEntity<Void> checkAccess(
        @RequestHeader(value = AuthTokenFilter.USER_ID_HEADER, required = false) String userId
    ) {
        if (!isActiveUser(userId)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        boolean allowed = requestQuotaService.tryAcquire("voice:minute:" + userId, perMinuteLimit, Duration.ofMinutes(1))
            && requestQuotaService.tryAcquire("voice:hour:" + userId, perHourLimit, Duration.ofHours(1));
        if (!allowed) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.noContent().build();
    }

    private boolean isActiveUser(String userId) {
        if (userId == null || userId.isBlank()) {
            return false;
        }
        long id;
        try {
            id = Long.parseLong(userId.trim());
        } catch (NumberFormatException exception) {
            return false;
        }
        return userAccountRepository.findById(id)
            .map(user -> !user.isDisabled())
            .orElse(false);
    }
}
