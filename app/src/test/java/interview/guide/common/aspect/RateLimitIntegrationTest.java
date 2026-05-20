package interview.guide.common.aspect;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.redisson.Redisson;
import org.redisson.api.RScript;
import org.redisson.api.RedissonClient;
import org.redisson.client.codec.StringCodec;
import org.redisson.config.Config;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 限流功能集成测试
 *
 * <p>需要 Redis 服务运行。
 *
 * <p>运行方式：
 * <pre>
 * # 启动 Redis
 * docker run -d -p 6379:6379 redis:alpine
 *
 * # 取消 @Disabled 注解后运行
 * ./gradlew test --tests "RateLimitIntegrationTest"
 * </pre>
 */
@DisplayName("限流功能集成测试（需要 Redis）")
@Disabled
class RateLimitIntegrationTest {

    private static final String REDIS_ADDRESS = "redis://localhost:6379";

    private RedissonClient redissonClient;
    private String luaScript;

    @BeforeEach
    void setUp() throws Exception {
        ClassPathResource resource = new ClassPathResource("scripts/rate_limit.lua");
        luaScript = new String(resource.getContentAsByteArray(), StandardCharsets.UTF_8);

        Config config = new Config();
        config.useSingleServer()
                .setAddress(REDIS_ADDRESS)
                .setDatabase(1)
                .setConnectionPoolSize(5)
                .setConnectionMinimumIdleSize(1);

        redissonClient = Redisson.create(config);
        redissonClient.getKeys().deleteByPattern("ratelimit:test*");
    }

    @Test
    @DisplayName("验证限流：令牌充足时允许，耗尽时拒绝")
    void testRateLimit() {
        String keyPrefix = "ratelimit:test:basic";
        String valueKey = keyPrefix + ":value";
        long maxCount = 2;

        // 初始化2个令牌，使用 StringCodec 确保与 Lua 脚本兼容
        redissonClient.getBucket(valueKey, StringCodec.INSTANCE).set(String.valueOf(maxCount));

        // 前两次请求应成功
        assertEquals(1L, executeLuaScript(keyPrefix, maxCount));
        assertEquals(1L, executeLuaScript(keyPrefix, maxCount));

        // 第三次请求应被拒绝
        assertEquals(0L, executeLuaScript(keyPrefix, maxCount));
    }

    @Test
    @DisplayName("验证多维度限流：任一维度不足即拒绝")
    void testMultiDimension() {
        String key1 = "ratelimit:test:multi1";
        String key2 = "ratelimit:test:multi2";
        long maxCount = 10;

        // 维度1：充足（10个令牌）
        redissonClient.getBucket(key1 + ":value", StringCodec.INSTANCE).set("10");
        // 维度2：不足（1个令牌）
        redissonClient.getBucket(key2 + ":value", StringCodec.INSTANCE).set("1");

        // 第一次成功，第二次被维度2限制
        assertEquals(1L, executeLuaScript(List.of(key1, key2), maxCount));
        assertEquals(0L, executeLuaScript(List.of(key1, key2), maxCount));
    }

    private Object executeLuaScript(String key, long maxCount) {
        return executeLuaScript(List.of(key), maxCount);
    }

    private Object executeLuaScript(List<String> keys, long maxCount) {
        RScript script = redissonClient.getScript(StringCodec.INSTANCE);

        Object[] args = {
                String.valueOf(System.currentTimeMillis()),
                String.valueOf(1),
                String.valueOf(1000),
                String.valueOf(maxCount),
                java.util.UUID.randomUUID().toString()
        };

        List<Object> keysList = new ArrayList<>(keys);

        Object result = script.eval(
                RScript.Mode.READ_WRITE,
                luaScript,
                RScript.ReturnType.VALUE,
                keysList,
                args
        );

        if (result instanceof Number) {
            return ((Number) result).longValue();
        } else if (result instanceof String) {
            return Long.parseLong((String) result);
        }
        return result;
    }

    @AfterEach
    void tearDown() {
        if (redissonClient != null) {
            redissonClient.getKeys().deleteByPattern("ratelimit:test*");
            redissonClient.shutdown();
        }
    }
}
