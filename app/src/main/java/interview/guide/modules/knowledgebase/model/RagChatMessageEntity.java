package interview.guide.modules.knowledgebase.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * RAG 聊天消息实体
 * 存储用户问题和 AI 回答
 */
@Entity
@Table(name = "rag_chat_messages", indexes = {
    @Index(name = "idx_rag_message_session", columnList = "session_id"),
    @Index(name = "idx_rag_message_order", columnList = "session_id, messageOrder")
})
@Getter
@Setter
@NoArgsConstructor
public class RagChatMessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 关联的会话
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private RagChatSessionEntity session;

    /**
     * 消息类型：USER 或 ASSISTANT
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MessageType type;

    /**
     * 消息内容
     */
    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    /**
     * 消息顺序（用于排序）
     */
    @Column(nullable = false)
    private Integer messageOrder;

    /**
     * 创建时间
     */
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * 更新时间（用于流式响应更新）
     */
    private LocalDateTime updatedAt;

    /**
     * 是否完成（流式响应时使用）
     */
    private Boolean completed = true;

    public enum MessageType {
        USER,      // 用户消息
        ASSISTANT  // AI 回答
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /**
     * 获取类型字符串（小写，用于前端）
     */
    public String getTypeString() {
        return type.name().toLowerCase();
    }
}
