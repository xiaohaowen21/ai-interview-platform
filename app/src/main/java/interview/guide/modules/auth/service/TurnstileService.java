package interview.guide.modules.auth.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;

@Service
public class TurnstileService {

    private final RestClient restClient;

    @Value("${app.turnstile.enabled:false}")
    private boolean enabled;

    @Value("${app.turnstile.secret-key:}")
    private String secretKey;

    public TurnstileService() {
        this.restClient = RestClient.builder()
            .baseUrl("https://challenges.cloudflare.com")
            .build();
    }

    public void verify(String token) {
        if (!enabled) {
            return;
        }

        if (token == null || token.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请先完成安全验证");
        }

        if (secretKey == null || secretKey.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Turnstile 服务未配置");
        }

        MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
        formData.add("secret", secretKey.trim());
        formData.add("response", token.trim());

        try {
            TurnstileVerifyResponse response = restClient.post()
                .uri("/turnstile/v0/siteverify")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(formData)
                .retrieve()
                .body(TurnstileVerifyResponse.class);

            if (response == null || !response.success()) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "安全验证未通过，请重试");
            }
        } catch (RestClientException exception) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "安全验证服务异常，请稍后重试");
        }
    }

    private record TurnstileVerifyResponse(
        boolean success,
        List<String> errorCodes
    ) {}
}
