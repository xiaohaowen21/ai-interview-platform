package interview.guide.modules.auth.service;

import interview.guide.modules.auth.model.UserAccountEntity;
import interview.guide.modules.auth.repository.UserAccountRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdminAccountInitializer {

    static final String DEFAULT_PASSWORD = "admin123456";
    private static final Set<String> PUBLIC_PLACEHOLDERS = Set.of(DEFAULT_PASSWORD, "change_me_admin_password");
    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserAccountRepository userAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    @Value("${app.admin.username:admin}")
    private String adminUsername;

    @Value("${app.admin.password:}")
    private String adminPassword;

    /** 为 true 时每次启动都把管理员密码改回配置值，仅用于忘记密码时临时找回 */
    @Value("${app.admin.reset-password-on-startup:false}")
    private boolean resetPasswordOnStartup;

    @PostConstruct
    public void initialize() {
        ensureDisabledColumn();

        String normalizedUsername = normalizeAdminUsername();
        String configuredPassword = resolveConfiguredPassword();

        userAccountRepository.findByUsername(normalizedUsername).ifPresentOrElse(user -> {
            boolean changed = false;

            if (user.getRole() != UserAccountEntity.UserRole.ADMIN) {
                user.setRole(UserAccountEntity.UserRole.ADMIN);
                changed = true;
            }

            if (passwordEncoder.matches(DEFAULT_PASSWORD, user.getPasswordHash())) {
                // 旧版本留下的公开默认密码，无论如何都要换掉
                String newPassword = configuredPassword != null ? configuredPassword : generatePassword(normalizedUsername);
                user.setPasswordHash(passwordEncoder.encode(newPassword));
                changed = true;
            } else if (resetPasswordOnStartup && configuredPassword != null
                && !passwordEncoder.matches(configuredPassword, user.getPasswordHash())) {
                log.warn("APP_ADMIN_RESET_PASSWORD_ON_STARTUP=true，已将管理员密码重置为 APP_ADMIN_PASSWORD，找回后请关闭该选项。");
                user.setPasswordHash(passwordEncoder.encode(configuredPassword));
                changed = true;
            }

            if (changed) {
                userAccountRepository.save(user);
            }
        }, () -> {
            String password = configuredPassword != null ? configuredPassword : generatePassword(normalizedUsername);
            UserAccountEntity admin = new UserAccountEntity();
            admin.setUsername(normalizedUsername);
            admin.setPasswordHash(passwordEncoder.encode(password));
            admin.setRole(UserAccountEntity.UserRole.ADMIN);
            userAccountRepository.save(admin);
        });
    }

    private void ensureDisabledColumn() {
        try {
            jdbcTemplate.execute("ALTER TABLE IF EXISTS user_accounts ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE");
            jdbcTemplate.execute("UPDATE user_accounts SET disabled = FALSE WHERE disabled IS NULL");
            jdbcTemplate.execute("ALTER TABLE IF EXISTS user_accounts ALTER COLUMN disabled SET DEFAULT FALSE");
            jdbcTemplate.execute("ALTER TABLE IF EXISTS user_accounts ALTER COLUMN disabled SET NOT NULL");
        } catch (Exception exception) {
            log.warn("Failed to ensure disabled column on user_accounts: {}", exception.getMessage());
        }
    }

    private String normalizeAdminUsername() {
        if (adminUsername == null || adminUsername.isBlank()) {
            return "admin";
        }
        return adminUsername.trim();
    }

    /**
     * @return 可用的配置密码；未配置或仍是公开示例值时返回 null
     */
    private String resolveConfiguredPassword() {
        String value = adminPassword == null ? "" : adminPassword.trim();
        if (value.isEmpty() || PUBLIC_PLACEHOLDERS.contains(value)) {
            return null;
        }
        if (value.length() < MIN_PASSWORD_LENGTH) {
            log.warn("APP_ADMIN_PASSWORD 少于 {} 个字符，建议更换为更长的随机密码。", MIN_PASSWORD_LENGTH);
        }
        return value;
    }

    private String generatePassword(String username) {
        byte[] bytes = new byte[12];
        SECURE_RANDOM.nextBytes(bytes);
        String password = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        log.warn("未设置 APP_ADMIN_PASSWORD（或仍为示例值），已为管理员 {} 生成随机密码：{} 。请登录后修改，或在 .env 中设置 APP_ADMIN_PASSWORD。",
            username, password);
        return password;
    }
}
