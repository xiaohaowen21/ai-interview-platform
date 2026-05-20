package interview.guide.common.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 限流异常单元测试
 */
@DisplayName("限流异常单元测试")
class RateLimitExceededExceptionTest {

    private static final int EXPECTED_CODE = 8001;

    @Test
    @DisplayName("验证默认构造函数")
    void testDefaultConstructor() {
        RateLimitExceededException ex = new RateLimitExceededException();
        assertEquals(EXPECTED_CODE, ex.getCode());
        assertEquals(ErrorCode.RATE_LIMIT_EXCEEDED.getMessage(), ex.getMessage());
    }

    @Test
    @DisplayName("验证自定义消息构造函数")
    void testMessageConstructor() {
        String msg = "请求过于频繁";
        RateLimitExceededException ex = new RateLimitExceededException(msg);
        assertEquals(EXPECTED_CODE, ex.getCode());
        assertEquals(msg, ex.getMessage());
    }

    @Test
    @DisplayName("验证带原因的构造函数")
    void testMessageWithCauseConstructor() {
        Throwable cause = new RuntimeException("Redis error");
        RateLimitExceededException ex = new RateLimitExceededException("限流", cause);
        assertEquals(EXPECTED_CODE, ex.getCode());
        assertEquals("限流", ex.getMessage());
        assertEquals(cause, ex.getCause());
    }

    @Test
    @DisplayName("验证异常继承关系")
    void testInheritance() {
        RateLimitExceededException ex = new RateLimitExceededException();
        assertTrue(ex instanceof BusinessException);
        assertTrue(ex instanceof RuntimeException);
    }

    @Test
    @DisplayName("验证错误码配置")
    void testErrorCode() {
        assertEquals(EXPECTED_CODE, ErrorCode.RATE_LIMIT_EXCEEDED.getCode());
        assertEquals("请求过于频繁，请稍后再试", ErrorCode.RATE_LIMIT_EXCEEDED.getMessage());
    }
}
