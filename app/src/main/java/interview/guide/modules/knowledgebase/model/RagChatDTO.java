package interview.guide.modules.knowledgebase.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.time.LocalDateTime;
import java.util.List;

/**
 * RAG聊天相关DTO
 */
public class RagChatDTO {

    // ========== 请求 DTO ==========

    /**
     * 创建会话请求
     */
    public record CreateSessionRequest(
        @NotEmpty(message = "至少选择一个知识库")
        List<Long> knowledgeBaseIds,

        String title  // 可选，为空则自动生成
    ) {}

    /**
     * 发送消息请求
     */
    public record SendMessageRequest(
        @NotBlank(message = "问题不能为空")
        String question
    ) {}

    /**
     * 更新标题请求
     */
    public record UpdateTitleRequest(
        @NotBlank(message = "标题不能为空")
        String title
    ) {}

    /**
     * 更新知识库请求
     */
    public record UpdateKnowledgeBasesRequest(
        @NotEmpty(message = "至少选择一个知识库")
        List<Long> knowledgeBaseIds
    ) {}

    // ========== 响应 DTO ==========

    /**
     * 会话基础信息
     */
    public record SessionDTO(
        Long id,
        String title,
        List<Long> knowledgeBaseIds,
        LocalDateTime createdAt
    ) {}

    /**
     * 会话列表项
     */
    public record SessionListItemDTO(
        Long id,
        String title,
        Integer messageCount,
        List<String> knowledgeBaseNames,
        LocalDateTime updatedAt,
        Boolean isPinned
    ) {}

    /**
     * 会话详情（含消息）
     */
    public record SessionDetailDTO(
        Long id,
        String title,
        List<KnowledgeBaseListItemDTO> knowledgeBases,
        List<MessageDTO> messages,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
    ) {}

    /**
     * 消息 DTO
     */
    public record MessageDTO(
        Long id,
        String type,  // "user" | "assistant"
        String content,
        LocalDateTime createdAt
    ) {}
}
