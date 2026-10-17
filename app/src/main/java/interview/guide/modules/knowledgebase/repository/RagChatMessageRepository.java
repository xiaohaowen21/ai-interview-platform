package interview.guide.modules.knowledgebase.repository;

import interview.guide.modules.knowledgebase.model.RagChatMessageEntity;
import interview.guide.modules.knowledgebase.model.RagChatMessageEntity.MessageType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * RAG聊天消息Repository
 */
@Repository
public interface RagChatMessageRepository extends JpaRepository<RagChatMessageEntity, Long> {

    /**
     * 获取会话的所有消息（按顺序）
     */
    List<RagChatMessageEntity> findBySessionIdOrderByMessageOrderAsc(Long sessionId);

    /**
     * 获取会话的最后一条消息
     */
    Optional<RagChatMessageEntity> findTopBySessionIdOrderByMessageOrderDesc(Long sessionId);

    /**
     * 获取会话消息数量
     */
    @Query("SELECT COUNT(m) FROM RagChatMessageEntity m WHERE m.session.id = :sessionId")
    Integer countBySessionId(@Param("sessionId") Long sessionId);

    /**
     * 查找未完成的消息（流式响应中断时清理用）
     */
    List<RagChatMessageEntity> findBySessionIdAndCompletedFalse(Long sessionId);

    /**
     * 删除会话的所有消息
     */
    void deleteBySessionId(Long sessionId);

    /**
     * 统计某个用户会话中指定类型的消息数（用户消息数即总提问次数）
     */
    @Query("SELECT COUNT(m) FROM RagChatMessageEntity m WHERE m.session.userId = :userId AND m.type = :type")
    long countBySessionUserIdAndType(@Param("userId") String userId, @Param("type") MessageType type);
}
