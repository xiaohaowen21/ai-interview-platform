package interview.guide.modules.resume.repository;

import interview.guide.modules.resume.model.ResumeRewriteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 简历优化结果 Repository。
 */
@Repository
public interface ResumeRewriteRepository extends JpaRepository<ResumeRewriteEntity, Long> {

    List<ResumeRewriteEntity> findByResumeIdAndUserIdOrderByUpdatedAtDesc(Long resumeId, String userId);

    Optional<ResumeRewriteEntity> findByIdAndUserId(Long id, String userId);

    List<ResumeRewriteEntity> findByResumeIdOrderByUpdatedAtDesc(Long resumeId);
}
