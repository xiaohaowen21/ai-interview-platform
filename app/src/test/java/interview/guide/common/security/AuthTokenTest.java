package interview.guide.common.security;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class AuthTokenTest {

    private AuthTokenService tokenService;
    private AuthTokenFilter filter;

    @BeforeEach
    void setUp() {
        tokenService = new AuthTokenService();
        ReflectionTestUtils.setField(tokenService, "configuredSecret", "unit-test-secret");
        ReflectionTestUtils.setField(tokenService, "tokenTtlHours", 1L);
        tokenService.initialize();
        filter = new AuthTokenFilter(tokenService);
    }

    @Test
    void issuedTokenVerifiesToSameUser() {
        assertThat(tokenService.verify(tokenService.issue("42"))).contains("42");
    }

    @Test
    void tamperedExpiredOrForeignTokensAreRejected() {
        String token = tokenService.issue("42");
        String forgedPayload = java.util.Base64.getUrlEncoder().withoutPadding()
            .encodeToString(("1:" + (Instant.now().getEpochSecond() + 3600)).getBytes());

        assertThat(tokenService.verify(forgedPayload + token.substring(token.indexOf('.')))).isEmpty();
        assertThat(tokenService.verify(tokenService.issue("42", Instant.now().getEpochSecond() - 1))).isEmpty();
        assertThat(tokenService.verify("not-a-token")).isEmpty();
        assertThat(tokenService.verify(null)).isEmpty();

        AuthTokenService other = new AuthTokenService();
        ReflectionTestUtils.setField(other, "configuredSecret", "another-secret");
        ReflectionTestUtils.setField(other, "tokenTtlHours", 1L);
        other.initialize();
        assertThat(tokenService.verify(other.issue("42"))).isEmpty();
    }

    @Test
    void clientSuppliedUserIdHeaderIsDropped() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/users");
        request.addHeader("X-User-Id", "1");
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        HttpServletRequest seen = (HttpServletRequest) chain.getRequest();
        assertThat(seen.getHeader("X-User-Id")).isNull();
        assertThat(seen.getHeaders("x-user-id").hasMoreElements()).isFalse();
    }

    @Test
    void validBearerTokenOverridesSpoofedHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/users");
        request.addHeader("X-User-Id", "1");
        request.addHeader("Authorization", "Bearer " + tokenService.issue("42"));
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        HttpServletRequest seen = (HttpServletRequest) chain.getRequest();
        assertThat(seen.getHeader("X-User-Id")).isEqualTo("42");
        assertThat(seen.getAttribute("userId")).isEqualTo("42");
    }
}
