package interview.guide.modules.auth.service;

import interview.guide.modules.auth.model.UserAccountEntity;
import interview.guide.modules.auth.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * 管理员账号初始化：不再使用公开默认密码，也不在每次启动时覆盖管理员自己改过的密码
 */
@DisplayName("管理员账号初始化测试")
class AdminAccountInitializerTest {

    private static final String STRONG_PASSWORD = "S3cure-admin-password";

    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);
    private UserAccountRepository repository;
    private AdminAccountInitializer initializer;

    @BeforeEach
    void setUp() {
        repository = mock(UserAccountRepository.class);
        initializer = new AdminAccountInitializer(repository, passwordEncoder, mock(JdbcTemplate.class));
        ReflectionTestUtils.setField(initializer, "adminUsername", "admin");
    }

    private void configurePassword(String password) {
        ReflectionTestUtils.setField(initializer, "adminPassword", password);
    }

    private UserAccountEntity existingAdmin(String password) {
        UserAccountEntity admin = new UserAccountEntity();
        admin.setUsername("admin");
        admin.setRole(UserAccountEntity.UserRole.ADMIN);
        admin.setPasswordHash(passwordEncoder.encode(password));
        when(repository.findByUsername("admin")).thenReturn(Optional.of(admin));
        return admin;
    }

    private UserAccountEntity createdAdmin() {
        when(repository.findByUsername("admin")).thenReturn(Optional.empty());
        initializer.initialize();
        ArgumentCaptor<UserAccountEntity> captor = ArgumentCaptor.forClass(UserAccountEntity.class);
        verify(repository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("未配置密码时创建的管理员不使用默认密码")
    void createsAdminWithRandomPasswordWhenUnset() {
        configurePassword("");

        UserAccountEntity admin = createdAdmin();

        assertEquals(UserAccountEntity.UserRole.ADMIN, admin.getRole());
        assertFalse(passwordEncoder.matches(AdminAccountInitializer.DEFAULT_PASSWORD, admin.getPasswordHash()));
    }

    @Test
    @DisplayName(".env.example 的示例密码视同未配置")
    void treatsExamplePasswordAsUnset() {
        configurePassword("change_me_admin_password");

        UserAccountEntity admin = createdAdmin();

        assertFalse(passwordEncoder.matches("change_me_admin_password", admin.getPasswordHash()));
    }

    @Test
    @DisplayName("配置了强密码时用它创建管理员")
    void createsAdminWithConfiguredPassword() {
        configurePassword(STRONG_PASSWORD);

        UserAccountEntity admin = createdAdmin();

        assertTrue(passwordEncoder.matches(STRONG_PASSWORD, admin.getPasswordHash()));
    }

    @Test
    @DisplayName("重启时不覆盖管理员自己修改过的密码")
    void keepsPasswordChangedByAdmin() {
        configurePassword(STRONG_PASSWORD);
        existingAdmin("changed-in-ui-password");

        initializer.initialize();

        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("开启找回选项时把密码重置为配置值")
    void resetsPasswordWhenExplicitlyRequested() {
        configurePassword(STRONG_PASSWORD);
        ReflectionTestUtils.setField(initializer, "resetPasswordOnStartup", true);
        UserAccountEntity admin = existingAdmin("forgotten-password");

        initializer.initialize();

        assertTrue(passwordEncoder.matches(STRONG_PASSWORD, admin.getPasswordHash()));
        verify(repository).save(admin);
    }

    @Test
    @DisplayName("仍在使用旧默认密码的管理员会被换成新密码")
    void replacesLegacyDefaultPassword() {
        configurePassword("");
        UserAccountEntity admin = existingAdmin(AdminAccountInitializer.DEFAULT_PASSWORD);

        initializer.initialize();

        assertFalse(passwordEncoder.matches(AdminAccountInitializer.DEFAULT_PASSWORD, admin.getPasswordHash()));
        verify(repository).save(admin);
    }
}
