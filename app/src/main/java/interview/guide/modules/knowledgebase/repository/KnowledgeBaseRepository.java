package interview.guide.modules.knowledgebase.repository;

import interview.guide.modules.knowledgebase.model.KnowledgeBaseEntity;
import interview.guide.modules.knowledgebase.model.VectorStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * 知识库Repository
 */
@Repository
public interface KnowledgeBaseRepository extends JpaRepository<KnowledgeBaseEntity, Long> {

    /**
     * 查找当前用户上传过的同一文件（用于去重）
     */
    Optional<KnowledgeBaseEntity> findFirstByUserIdAndFileHash(String userId, String fileHash);

    /**
     * 按ID查找当前用户的知识库
     */
    Optional<KnowledgeBaseEntity> findByIdAndUserId(Long id, String userId);

    /**
     * 按ID列表查找当前用户的知识库
     */
    List<KnowledgeBaseEntity> findByIdInAndUserId(Collection<Long> ids, String userId);

    /**
     * 按上传时间倒序查找当前用户的知识库
     */
    List<KnowledgeBaseEntity> findByUserIdOrderByUploadedAtDesc(String userId);

    /**
     * 获取当前用户的所有不同分类
     */
    @Query("SELECT DISTINCT k.category FROM KnowledgeBaseEntity k WHERE k.userId = :userId AND k.category IS NOT NULL ORDER BY k.category")
    List<String> findAllCategories(@Param("userId") String userId);

    /**
     * 根据分类查找当前用户的知识库
     */
    List<KnowledgeBaseEntity> findByUserIdAndCategoryOrderByUploadedAtDesc(String userId, String category);

    /**
     * 查找当前用户未分类的知识库
     */
    List<KnowledgeBaseEntity> findByUserIdAndCategoryIsNullOrderByUploadedAtDesc(String userId);

    /**
     * 在当前用户的知识库中按名称或文件名模糊搜索（不区分大小写）
     */
    @Query("SELECT k FROM KnowledgeBaseEntity k WHERE k.userId = :userId AND (LOWER(k.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(k.originalFilename) LIKE LOWER(CONCAT('%', :keyword, '%'))) ORDER BY k.uploadedAt DESC")
    List<KnowledgeBaseEntity> searchByKeyword(@Param("userId") String userId, @Param("keyword") String keyword);

    // ==================== 批量更新 ====================

    /**
     * 批量增加知识库提问计数
     * @param ids 知识库ID列表
     * @return 更新的行数
     */
    @Modifying
    @Query("UPDATE KnowledgeBaseEntity k SET k.questionCount = k.questionCount + 1 WHERE k.id IN :ids")
    int incrementQuestionCountBatch(@Param("ids") List<Long> ids);

    // ==================== 统计查询 ====================

    /**
     * 统计总提问次数
     */
    @Query("SELECT COALESCE(SUM(k.questionCount), 0) FROM KnowledgeBaseEntity k WHERE k.userId = :userId")
    long sumQuestionCount(@Param("userId") String userId);

    /**
     * 统计总访问次数
     */
    @Query("SELECT COALESCE(SUM(k.accessCount), 0) FROM KnowledgeBaseEntity k WHERE k.userId = :userId")
    long sumAccessCount(@Param("userId") String userId);

    /**
     * 统计当前用户的知识库数量
     */
    long countByUserId(String userId);

    /**
     * 按向量化状态统计当前用户的知识库数量
     */
    long countByUserIdAndVectorStatus(String userId, VectorStatus vectorStatus);

    /**
     * 按向量化状态查找当前用户的知识库（按上传时间倒序）
     */
    List<KnowledgeBaseEntity> findByUserIdAndVectorStatusOrderByUploadedAtDesc(String userId, VectorStatus vectorStatus);
}

