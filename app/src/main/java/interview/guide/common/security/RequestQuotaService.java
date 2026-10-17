package interview.guide.common.security;

import lombok.RequiredArgsConstructor;
import org.redisson.api.RAtomicLong;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * 基于 Redis 的固定窗口计数，用于按用户、按邮箱等业务维度限额。
 *
 * <p>{@code @RateLimit} 注解只能按 IP / 全局 / 用户统一配置一个窗口，且超限时由全局异常处理返回 HTTP 200，
 * 不适合需要按业务键限额、或需要真实 HTTP 状态码（例如 nginx auth_request）的场景。</p>
 */
@Component
@RequiredArgsConstructor
public class RequestQuotaService {

    private static final String KEY_PREFIX = "quota:";

    private final RedissonClient redissonClient;

    /**
     * 在当前窗口内记一次请求。
     *
     * @return 记完之后仍未超过 {@code limit} 时返回 true
     */
    public boolean tryAcquire(String key, long limit, Duration window) {
        long windowMillis = Math.max(window.toMillis(), 1000L);
        long bucket = System.currentTimeMillis() / windowMillis;
        RAtomicLong counter = redissonClient.getAtomicLong(KEY_PREFIX + key + ":" + bucket);
        long count = counter.incrementAndGet();
        if (count == 1) {
            counter.expire(Duration.ofMillis(windowMillis * 2));
        }
        return count <= limit;
    }
}
