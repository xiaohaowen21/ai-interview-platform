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

@Slf4j
@Component
@RequiredArgsConstructor
public class AdminAccountInitializer {

    private final UserAccountRepository userAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    @Value("${app.admin.username:admin}")
    private String adminUsername;

    @Value("${app.admin.password:admin123456}")
    private String adminPassword;

    @PostConstruct
    public void initialize() {
        ensureDisabledColumn();

        String normalizedUsername = normalizeAdminUsername();
        String normalizedPassword = normalizeAdminPassword();

        userAccountRepository.findByUsername(normalizedUsername).ifPresentOrElse(user -> {
            boolean changed = false;

            if (user.getRole() != UserAccountEntity.UserRole.ADMIN) {
                user.setRole(UserAccountEntity.UserRole.ADMIN);
                changed = true;
            }

            if (!passwordEncoder.matches(normalizedPassword, user.getPasswordHash())) {
                user.setPasswordHash(passwordEncoder.encode(normalizedPassword));
                changed = true;
            }

            if (changed) {
                userAccountRepository.save(user);
            }
        }, () -> {
            UserAccountEntity admin = new UserAccountEntity();
            admin.setUsername(normalizedUsername);
            admin.setPasswordHash(passwordEncoder.encode(normalizedPassword));
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

    private String normalizeAdminPassword() {
        if (adminPassword == null || adminPassword.isBlank()) {
            return "admin123456";
        }
        return adminPassword;
    }
}
