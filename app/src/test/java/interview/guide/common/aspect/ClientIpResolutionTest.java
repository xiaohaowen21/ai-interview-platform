package interview.guide.common.aspect;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * 限流用的客户端 IP 不能由客户端自己决定
 */
@DisplayName("限流客户端 IP 解析测试")
class ClientIpResolutionTest {

    private MockHttpServletRequest request(String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    @Test
    @DisplayName("忽略客户端伪造的 X-Forwarded-For")
    void ignoresSpoofedForwardedFor() {
        MockHttpServletRequest request = request("172.18.0.5");
        request.addHeader("X-Forwarded-For", "1.2.3.4, 203.0.113.9");
        request.addHeader("X-Real-IP", "203.0.113.9");

        assertEquals("203.0.113.9", RateLimitAspect.resolveClientIp(request));
    }

    @Test
    @DisplayName("请求不是来自内网代理时，不采信 X-Real-IP")
    void ignoresRealIpFromUntrustedPeer() {
        MockHttpServletRequest request = request("198.51.100.7");
        request.addHeader("X-Real-IP", "1.2.3.4");

        assertEquals("198.51.100.7", RateLimitAspect.resolveClientIp(request));
    }

    @Test
    @DisplayName("没有代理头时使用连接地址")
    void fallsBackToRemoteAddr() {
        assertEquals("127.0.0.1", RateLimitAspect.resolveClientIp(request("127.0.0.1")));
    }
}
