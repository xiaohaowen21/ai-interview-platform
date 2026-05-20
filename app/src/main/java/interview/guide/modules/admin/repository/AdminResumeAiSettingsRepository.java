package interview.guide.modules.admin.repository;

import interview.guide.modules.admin.model.AdminResumeAiSettingsEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminResumeAiSettingsRepository extends JpaRepository<AdminResumeAiSettingsEntity, Long> {
}
