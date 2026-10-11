package interview.guide.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;

/**
 * 把经过签名校验的登录身份写入 {@code X-User-Id}。
 *
 * <p>各控制器沿用 {@code X-User-Id} 请求头读取当前用户，但这个值不再来自客户端：
 * 客户端自带的 {@code X-User-Id} 一律丢弃，只有 {@code Authorization: Bearer <token>}
 * 校验通过后，才由服务端填入对应的用户 ID。</p>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
@RequiredArgsConstructor
public class AuthTokenFilter extends OncePerRequestFilter {

    public static final String USER_ID_HEADER = "X-User-Id";
    private static final String BEARER_PREFIX = "Bearer ";

    private final AuthTokenService authTokenService;

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String verifiedUserId = resolveVerifiedUserId(request);
        if (verifiedUserId != null) {
            request.setAttribute("userId", verifiedUserId);
        }
        filterChain.doFilter(new VerifiedUserRequest(request, verifiedUserId), response);
    }

    private String resolveVerifiedUserId(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
            return null;
        }
        return authTokenService.verify(authorization.substring(BEARER_PREFIX.length()).trim()).orElse(null);
    }

    private static final class VerifiedUserRequest extends HttpServletRequestWrapper {

        private final String verifiedUserId;

        private VerifiedUserRequest(HttpServletRequest request, String verifiedUserId) {
            super(request);
            this.verifiedUserId = verifiedUserId;
        }

        @Override
        public String getHeader(String name) {
            if (USER_ID_HEADER.equalsIgnoreCase(name)) {
                return verifiedUserId;
            }
            return super.getHeader(name);
        }

        @Override
        public Enumeration<String> getHeaders(String name) {
            if (USER_ID_HEADER.equalsIgnoreCase(name)) {
                return verifiedUserId == null
                    ? Collections.emptyEnumeration()
                    : Collections.enumeration(List.of(verifiedUserId));
            }
            return super.getHeaders(name);
        }

        @Override
        public Enumeration<String> getHeaderNames() {
            List<String> names = new ArrayList<>();
            Enumeration<String> original = super.getHeaderNames();
            while (original != null && original.hasMoreElements()) {
                String name = original.nextElement();
                if (!USER_ID_HEADER.equalsIgnoreCase(name)) {
                    names.add(name);
                }
            }
            if (verifiedUserId != null) {
                names.add(USER_ID_HEADER);
            }
            return Collections.enumeration(names);
        }
    }
}
