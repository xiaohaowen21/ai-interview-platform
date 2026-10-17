package interview.guide.modules.auth.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.security.AuthTokenService;
import interview.guide.common.security.RequestQuotaService;
import interview.guide.modules.auth.model.EmailVerificationCodeEntity;
import interview.guide.modules.auth.model.EmailVerificationPurpose;
import interview.guide.modules.auth.model.ForgotPasswordResetRequest;
import interview.guide.modules.auth.model.UserAccountEntity;
import interview.guide.modules.auth.repository.EmailVerificationCodeRepository;
import interview.guide.modules.auth.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 邮箱验证码防暴力破解：输错次数上限、按邮箱的发送限额
 */
@DisplayName("验证码防暴力破解测试")
class AuthBruteForceProtectionTest {

    private static final String EMAIL = "user@example.com";
    private static final String CODE = "123456";

    private EmailVerificationCodeRepository codeRepository;
    private UserAccountRepository userAccountRepository;
    private PasswordEncoder passwordEncoder;
    private AuthEmailService authEmailService;
    private RequestQuotaService requestQuotaService;
    private AuthService authService;
    private EmailVerificationCodeEntity storedCode;

    @BeforeEach
    void setUp() {
        codeRepository = mock(EmailVerificationCodeRepository.class);
        userAccountRepository = mock(UserAccountRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        authEmailService = mock(AuthEmailService.class);
        requestQuotaService = mock(RequestQuotaService.class);
        authService = new AuthService(
            mock(AuthTokenService.class),
            userAccountRepository,
            codeRepository,
            passwordEncoder,
            authEmailService,
            mock(TurnstileService.class),
            requestQuotaService
        );

        UserAccountEntity user = new UserAccountEntity();
        user.setId(1L);
        user.setUsername("user");
        user.setEmail(EMAIL);
        when(userAccountRepository.findByEmailIgnoreCase(EMAIL)).thenReturn(Optional.of(user));

        storedCode = new EmailVerificationCodeEntity();
        storedCode.setEmail(EMAIL);
        storedCode.setPurpose(EmailVerificationPurpose.RESET_PASSWORD);
        storedCode.setCodeHash("hash");
        storedCode.setExpiresAt(LocalDateTime.now().plusMinutes(10));
        when(codeRepository.findByEmailIgnoreCaseAndPurpose(EMAIL, EmailVerificationPurpose.RESET_PASSWORD))
            .thenReturn(Optional.of(storedCode));
        when(passwordEncoder.matches(eq(CODE), eq("hash"))).thenReturn(true);
        when(passwordEncoder.encode(anyString())).thenReturn("encoded");
    }

    private ForgotPasswordResetRequest resetWith(String code) {
        return new ForgotPasswordResetRequest(EMAIL, code, "newPassword1");
    }

    @Test
    @DisplayName("输错验证码会累计次数，达到上限后验证码作废")
    void wrongCodesInvalidateCodeAfterLimit() {
        for (int i = 1; i < AuthService.MAX_CODE_FAILED_ATTEMPTS; i++) {
            BusinessException error = assertThrows(BusinessException.class, () -> authService.resetPasswordByEmail(resetWith("000000")));
            assertEquals("验证码错误", error.getMessage());
            assertEquals(i, storedCode.getFailedAttempts());
        }
        verify(codeRepository, never()).delete(any());

        BusinessException last = assertThrows(BusinessException.class, () -> authService.resetPasswordByEmail(resetWith("000000")));
        assertEquals("验证码错误次数过多，请重新获取", last.getMessage());
        verify(codeRepository).delete(storedCode);
    }

    @Test
    @DisplayName("达到输错上限后，即使输入正确的验证码也不能重置密码")
    void correctCodeRejectedOnceLimitReached() {
        storedCode.setFailedAttempts(AuthService.MAX_CODE_FAILED_ATTEMPTS);

        assertThrows(BusinessException.class, () -> authService.resetPasswordByEmail(resetWith(CODE)));
        verify(userAccountRepository, never()).save(any());
    }

    @Test
    @DisplayName("正确的验证码可以重置密码")
    void correctCodeResetsPassword() {
        storedCode.setFailedAttempts(2);

        authService.resetPasswordByEmail(resetWith(CODE));

        verify(userAccountRepository).save(any(UserAccountEntity.class));
        verify(codeRepository).delete(storedCode);
    }

    @Test
    @DisplayName("同一邮箱发送验证码超过限额时拒绝发送")
    void sendCodeRejectedWhenEmailQuotaExceeded() {
        when(authEmailService.isReady()).thenReturn(true);
        when(requestQuotaService.tryAcquire(anyString(), anyLong(), any())).thenReturn(false);

        BusinessException error = assertThrows(BusinessException.class,
            () -> authService.sendEmailCode(EMAIL, EmailVerificationPurpose.RESET_PASSWORD, null));

        assertTrue(error.getMessage().contains("过于频繁"));
        verify(authEmailService, never()).sendPasswordResetCode(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("重新发送验证码会清零输错次数")
    void newCodeResetsFailedAttempts() {
        when(authEmailService.isReady()).thenReturn(true);
        when(requestQuotaService.tryAcquire(anyString(), anyLong(), any())).thenReturn(true);
        storedCode.setFailedAttempts(3);

        authService.sendEmailCode(EMAIL, EmailVerificationPurpose.RESET_PASSWORD, null);

        assertEquals(0, storedCode.getFailedAttempts());
        verify(codeRepository).save(storedCode);
    }
}
