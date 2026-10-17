package interview.guide.modules.resume.repository;

import interview.guide.modules.resume.model.ResumeAnalysisEntity;
import interview.guide.modules.resume.model.ResumeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/**
 * 简历评测Repository
 */
@Repository
public interface ResumeAnalysisRepository extends JpaRepository<ResumeAnalysisEntity, Long> {
    
    /**
     * 根据简历查找所有评测记录
     */
    List<ResumeAnalysisEntity> findByResumeOrderByAnalyzedAtDesc(ResumeEntity resume);
    
    /**
     * 根据简历ID查找最新评测记录
     */
    ResumeAnalysisEntity findFirstByResumeIdOrderByAnalyzedAtDesc(Long resumeId);
    
    /**
     * 根据简历ID查找所有评测记录
     */
    List<ResumeAnalysisEntity> findByResumeIdOrderByAnalyzedAtDesc(Long resumeId);

    /**
     * 批量查询每份简历最新一次评测的分数和时间（一条 SQL，避免列表页 N+1）。
     * 同一时间戳有多条记录时会返回多行，由调用方取 ID 最大的一条。
     */
    @Query("""
        SELECT a.resume.id AS resumeId, a.id AS id, a.overallScore AS overallScore, a.analyzedAt AS analyzedAt
        FROM ResumeAnalysisEntity a
        WHERE a.resume.id IN :resumeIds
          AND a.analyzedAt = (
              SELECT MAX(b.analyzedAt) FROM ResumeAnalysisEntity b WHERE b.resume.id = a.resume.id
          )
        """)
    List<LatestAnalysisSummary> findLatestSummariesByResumeIds(@Param("resumeIds") Collection<Long> resumeIds);

    interface LatestAnalysisSummary {
        Long getResumeId();

        Long getId();

        Integer getOverallScore();

        LocalDateTime getAnalyzedAt();
    }
}
