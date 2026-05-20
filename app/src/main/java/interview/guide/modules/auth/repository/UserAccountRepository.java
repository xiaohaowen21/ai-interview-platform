package interview.guide.modules.auth.repository;

import interview.guide.modules.auth.model.UserAccountEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccountEntity, Long> {
    boolean existsByUsername(String username);

    boolean existsByEmailIgnoreCase(String email);

    Optional<UserAccountEntity> findByUsername(String username);

    Optional<UserAccountEntity> findByEmailIgnoreCase(String email);

    long countByRole(UserAccountEntity.UserRole role);

    long countByRoleAndDisabledFalse(UserAccountEntity.UserRole role);
}
