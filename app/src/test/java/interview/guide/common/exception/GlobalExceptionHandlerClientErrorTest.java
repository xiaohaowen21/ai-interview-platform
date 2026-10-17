package interview.guide.common.exception;

import interview.guide.common.result.Result;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 客户端请求错误应返回 400 类业务码，而不是“系统繁忙”
 */
@DisplayName("全局异常处理：客户端错误测试")
class GlobalExceptionHandlerClientErrorTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    @DisplayName("缺少参数返回 BAD_REQUEST 并指出参数名")
    void missingParameterIsBadRequest() {
        Result<Void> result = handler.handleMissingParameter(
            new MissingServletRequestParameterException("resumeId", "Long"));

        assertEquals(ErrorCode.BAD_REQUEST.getCode(), result.getCode());
        assertTrue(result.getMessage().contains("resumeId"));
    }

    @Test
    @DisplayName("不支持的请求方法返回 BAD_REQUEST")
    void unsupportedMethodIsBadRequest() {
        Result<Void> result = handler.handleUnsupportedRequest(new HttpRequestMethodNotSupportedException("PATCH"));

        assertEquals(ErrorCode.BAD_REQUEST.getCode(), result.getCode());
    }
}
