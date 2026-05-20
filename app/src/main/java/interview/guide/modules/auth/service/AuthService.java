package interview.guide.modules.auth.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.modules.auth.model.AuthResponse;
import interview.guide.modules.auth.model.EmailVerificationCodeEntity;
import interview.guide.modules.auth.model.EmailVerificationPurpose;
import interview.guide.modules.auth.model.ForgotPasswordResetRequest;
import interview.guide.modules.auth.model.LoginRequest;
import interview.guide.modules.auth.model.RegisterRequest;
import interview.guide.modules.auth.model.UserAccountEntity;
import interview.guide.modules.auth.repository.EmailVerificationCodeRepository;
import interview.guide.modules.auth.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.MailException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final int RESET_CODE_EXPIRE_MINUTES = 10;

    private final UserAccountRepository userAccountRepository;
    private final EmailVerificationCodeRepository emailVerificationCodeRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthEmailService authEmailService;
    private final TurnstileService turnstileService;

    public AuthResponse register(RegisterRequest request) {
        String username = normalizeUsername(request.username());
        String email = normalizeEmail(request.email());

        if ("admin".equalsIgnoreCase(username)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "用户名 admin 为系统保留，请更换其他用户名");
        }
        if (userAccountRepository.existsByUsername(username)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "用户名已存在");
        }
        if (email.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请输入邮箱");
        }
        if (userAccountRepository.existsByEmailIgnoreCase(email)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该邮箱已被绑定");
        }

        EmailVerificationCodeEntity verificationCode = getVerificationCode(email, EmailVerificationPurpose.REGISTER);
        validateVerificationCode(verificationCode, request.verificationCode());

        UserAccountEntity entity = new UserAccountEntity();
        entity.setUsername(username);
        entity.setPasswordHash(passwordEncoder.encode(request.password()));
        entity.setEmail(email);
        entity.setRole(UserAccountEntity.UserRole.USER);

        UserAccountEntity saved = userAccountRepository.save(entity);
        emailVerificationCodeRepository.delete(verificationCode);
        return toAuthResponse(saved);
    }

    public AuthResponse login(LoginRequest request) {
        String username = normalizeUsername(request.username());
        UserAccountEntity entity = userAccountRepository.findByUsername(username)
            .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "用户名或密码错误"));

        if (entity.isDisabled()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "该账号已被停用");
        }

        if (!passwordEncoder.matches(request.password(), entity.getPasswordHash())) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "用户名或密码错误");
        }

        return toAuthResponse(entity);
    }

    public void sendEmailCode(String emailInput, EmailVerificationPurpose purpose, String turnstileToken) {
        turnstileService.verify(turnstileToken);

        String email = normalizeEmail(emailInput);
        if (purpose == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码用途无效");
        }

        if (!authEmailService.isReady()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "邮箱服务未配置，请联系管理员");
        }

        UserAccountEntity entity = null;
        if (purpose == EmailVerificationPurpose.REGISTER) {
            if (userAccountRepository.existsByEmailIgnoreCase(email)) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "该邮箱已被绑定");
            }
        } else if (purpose == EmailVerificationPurpose.RESET_PASSWORD) {
            entity = userAccountRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "该邮箱未绑定账号"));
        }

        String verificationCode = generateVerificationCode();
        EmailVerificationCodeEntity codeEntity = emailVerificationCodeRepository
            .findByEmailIgnoreCaseAndPurpose(email, purpose)
            .orElseGet(EmailVerificationCodeEntity::new);
        codeEntity.setEmail(email);
        codeEntity.setPurpose(purpose);
        codeEntity.setCodeHash(passwordEncoder.encode(verificationCode));
        codeEntity.setExpiresAt(LocalDateTime.now().plusMinutes(RESET_CODE_EXPIRE_MINUTES));

        try {
            String username = entity != null ? entity.getUsername() : email;
            authEmailService.sendPasswordResetCode(email, username, verificationCode);
        } catch (MailException exception) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码发送失败，请稍后重试");
        }

        emailVerificationCodeRepository.save(codeEntity);
    }

    public void resetPasswordByEmail(ForgotPasswordResetRequest request) {
        UserAccountEntity entity = userAccountRepository.findByEmailIgnoreCase(normalizeEmail(request.email()))
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "该邮箱未绑定账号"));

        EmailVerificationCodeEntity verificationCode = getVerificationCode(normalizeEmail(request.email()), EmailVerificationPurpose.RESET_PASSWORD);
        validateVerificationCode(verificationCode, request.verificationCode());

        entity.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userAccountRepository.save(entity);
        emailVerificationCodeRepository.delete(verificationCode);
    }

    private EmailVerificationCodeEntity getVerificationCode(String email, EmailVerificationPurpose purpose) {
        return emailVerificationCodeRepository.findByEmailIgnoreCaseAndPurpose(email, purpose)
            .orElseThrow(() -> new BusinessException(ErrorCode.BAD_REQUEST, "请先获取邮箱验证码"));
    }

    private void validateVerificationCode(EmailVerificationCodeEntity verificationCode, String rawCode) {
        if (verificationCode.getExpiresAt().isBefore(LocalDateTime.now())) {
            emailVerificationCodeRepository.delete(verificationCode);
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码已过期，请重新获取");
        }

        if (!passwordEncoder.matches(rawCode, verificationCode.getCodeHash())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码错误");
        }
    }

    private String generateVerificationCode() {
        return String.valueOf(ThreadLocalRandom.current().nextInt(100000, 1000000));
    }

    private String normalizeUsername(String username) {
        return username == null ? "" : username.trim();
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private AuthResponse toAuthResponse(UserAccountEntity entity) {
        return new AuthResponse(
            entity.getId().toString(),
            entity.getUsername(),
            entity.getRole().name(),
            entity.getEmail() != null && !entity.getEmail().isBlank()
        );
    }
}
