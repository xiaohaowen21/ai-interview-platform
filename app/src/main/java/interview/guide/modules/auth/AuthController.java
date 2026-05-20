package interview.guide.modules.auth;

import interview.guide.common.annotation.RateLimit;
import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.common.result.Result;
import interview.guide.modules.auth.model.AuthResponse;
import interview.guide.modules.auth.model.ForgotPasswordResetRequest;
import interview.guide.modules.auth.model.LoginRequest;
import interview.guide.modules.auth.model.RegisterRequest;
import interview.guide.modules.auth.model.SendEmailCodeRequest;
import interview.guide.modules.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/api/auth/register")
    @RateLimit(dimensions = {RateLimit.Dimension.GLOBAL, RateLimit.Dimension.IP}, count = 10)
    public Result<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return Result.success(authService.register(request));
    }

    @PostMapping(value = "/api/auth/login", consumes = MediaType.APPLICATION_JSON_VALUE)
    @RateLimit(dimensions = {RateLimit.Dimension.GLOBAL, RateLimit.Dimension.IP}, count = 20)
    public Result<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return Result.success(authService.login(request));
    }

    @PostMapping(value = "/api/auth/login", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    @RateLimit(dimensions = {RateLimit.Dimension.GLOBAL, RateLimit.Dimension.IP}, count = 20)
    public Result<AuthResponse> loginByForm(
        @RequestParam(value = "username", required = false) String username,
        @RequestParam(value = "password", required = false) String password
    ) {
        return Result.success(authService.login(validateLegacyLoginRequest(username, password)));
    }

    @PostMapping("/api/auth/forgot-password/send-code")
    @RateLimit(dimensions = {RateLimit.Dimension.GLOBAL, RateLimit.Dimension.IP}, count = 10)
    public Result<Void> sendEmailCode(@Valid @RequestBody SendEmailCodeRequest request) {
        authService.sendEmailCode(request.email(), request.purpose(), request.turnstileToken());
        return Result.success();
    }

    @PostMapping("/api/auth/forgot-password/reset")
    @RateLimit(dimensions = {RateLimit.Dimension.GLOBAL, RateLimit.Dimension.IP}, count = 10)
    public Result<Void> resetPassword(@Valid @RequestBody ForgotPasswordResetRequest request) {
        authService.resetPasswordByEmail(request);
        return Result.success();
    }

    private LoginRequest validateLegacyLoginRequest(String username, String password) {
        String normalizedUsername = username == null ? "" : username.trim();
        String normalizedPassword = password == null ? "" : password.trim();

        if (normalizedUsername.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请输入用户名");
        }
        if (normalizedUsername.length() < 3 || normalizedUsername.length() > 32) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "用户名长度需为 3 到 32 位");
        }
        if (normalizedPassword.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请输入密码");
        }
        if (normalizedPassword.length() < 6 || normalizedPassword.length() > 64) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "密码长度需为 6 到 64 位");
        }
        return new LoginRequest(normalizedUsername, normalizedPassword);
    }
}
