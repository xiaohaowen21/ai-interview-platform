package interview.guide.modules.auth.repository;

import interview.guide.modules.auth.model.EmailVerificationCodeEntity;
import interview.guide.modules.auth.model.EmailVerificationPurpose;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EmailVerificationCodeRepository extends JpaRepository<EmailVerificationCodeEntity, Long> {
    Optional<EmailVerificationCodeEntity> findByEmailIgnoreCaseAndPurpose(String email, EmailVerificationPurpose purpose);
}
