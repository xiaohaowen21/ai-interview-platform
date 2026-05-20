package interview.guide.modules.admin.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.modules.admin.model.AdminUserItemDTO;
import interview.guide.modules.auth.model.UserAccountEntity;
import interview.guide.modules.auth.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserAccountRepository userAccountRepository;
    private final PasswordEncoder passwordEncoder;

    public List<AdminUserItemDTO> listUsers() {
        return userAccountRepository.findAll().stream()
            .sorted(Comparator.comparing(UserAccountEntity::getCreatedAt).reversed())
            .map(this::toItem)
            .toList();
    }

    public AdminUserItemDTO updateUserRole(Long currentUserId, Long userId, String roleText) {
        UserAccountEntity entity = getUser(userId);
        UserAccountEntity.UserRole nextRole;
        try {
            nextRole = UserAccountEntity.UserRole.valueOf(roleText.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "角色只能是 ADMIN 或 USER");
        }

        if (entity.getRole() == UserAccountEntity.UserRole.ADMIN && nextRole != UserAccountEntity.UserRole.ADMIN) {
            ensureLastEnabledAdmin(entity, "至少保留一个启用中的管理员账号");
        }

        if (entity.getId().equals(currentUserId) && nextRole != UserAccountEntity.UserRole.ADMIN) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "不能取消当前管理员自己的管理员权限");
        }

        entity.setRole(nextRole);
        return toItem(userAccountRepository.save(entity));
    }

    public AdminUserItemDTO resetPassword(Long userId, String newPassword) {
        UserAccountEntity entity = getUser(userId);
        entity.setPasswordHash(passwordEncoder.encode(newPassword));
        return toItem(userAccountRepository.save(entity));
    }

    public AdminUserItemDTO updateUserStatus(Long currentUserId, Long userId, boolean enabled) {
        UserAccountEntity entity = getUser(userId);
        if (entity.isDisabled() == !enabled) {
            return toItem(entity);
        }

        if (!enabled) {
            if (entity.getId().equals(currentUserId)) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "不能停用当前登录的管理员账号");
            }
            if (entity.getRole() == UserAccountEntity.UserRole.ADMIN) {
                ensureLastEnabledAdmin(entity, "至少保留一个启用中的管理员账号");
            }
        }

        entity.setDisabled(!enabled);
        return toItem(userAccountRepository.save(entity));
    }

    public void deleteUser(Long currentUserId, Long userId) {
        UserAccountEntity entity = getUser(userId);

        if (entity.getId().equals(currentUserId)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "不能删除当前登录的管理员账号");
        }

        if (entity.getRole() == UserAccountEntity.UserRole.ADMIN && !entity.isDisabled()) {
            ensureLastEnabledAdmin(entity, "至少保留一个启用中的管理员账号");
        }

        userAccountRepository.delete(entity);
    }

    public void changeOwnPassword(Long currentUserId, String currentPassword, String newPassword) {
        UserAccountEntity entity = getUser(currentUserId);
        if (!passwordEncoder.matches(currentPassword, entity.getPasswordHash())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "当前密码不正确");
        }

        entity.setPasswordHash(passwordEncoder.encode(newPassword));
        userAccountRepository.save(entity);
    }

    private UserAccountEntity getUser(Long userId) {
        return userAccountRepository.findById(userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "用户不存在"));
    }

    private void ensureLastEnabledAdmin(UserAccountEntity entity, String message) {
        if (entity.getRole() != UserAccountEntity.UserRole.ADMIN || entity.isDisabled()) {
            return;
        }

        long enabledAdminCount = userAccountRepository.countByRoleAndDisabledFalse(UserAccountEntity.UserRole.ADMIN);
        if (enabledAdminCount <= 1) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, message);
        }
    }

    private AdminUserItemDTO toItem(UserAccountEntity entity) {
        return new AdminUserItemDTO(
            entity.getId(),
            entity.getUsername(),
            entity.getEmail(),
            entity.getRole().name(),
            !entity.isDisabled(),
            entity.getEmail() != null && !entity.getEmail().isBlank(),
            entity.getCreatedAt(),
            entity.getUpdatedAt()
        );
    }
}
