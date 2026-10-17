package interview.guide.modules.knowledgebase.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.infrastructure.file.FileStorageService;
import interview.guide.infrastructure.mapper.KnowledgeBaseMapper;
import interview.guide.infrastructure.mapper.RagChatMapper;
import interview.guide.modules.knowledgebase.model.KnowledgeBaseEntity;
import interview.guide.modules.knowledgebase.model.RagChatDTO.CreateSessionRequest;
import interview.guide.modules.knowledgebase.model.RagChatSessionEntity;
import interview.guide.modules.knowledgebase.repository.KnowledgeBaseRepository;
import interview.guide.modules.knowledgebase.repository.RagChatMessageRepository;
import interview.guide.modules.knowledgebase.repository.RagChatSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * 知识库与 RAG 会话的归属校验：用户只能访问自己的数据
 */
@DisplayName("知识库归属校验测试")
class KnowledgeBaseOwnershipTest {

    private static final String OWNER = "1";
    private static final String OTHER = "2";

    private KnowledgeBaseRepository knowledgeBaseRepository;
    private RagChatSessionRepository sessionRepository;
    private KnowledgeBaseListService listService;
    private RagChatSessionService sessionService;

    @BeforeEach
    void setUp() {
        knowledgeBaseRepository = mock(KnowledgeBaseRepository.class);
        sessionRepository = mock(RagChatSessionRepository.class);
        listService = new KnowledgeBaseListService(
            knowledgeBaseRepository,
            mock(RagChatMessageRepository.class),
            mock(KnowledgeBaseMapper.class),
            mock(FileStorageService.class)
        );
        sessionService = new RagChatSessionService(
            sessionRepository,
            mock(RagChatMessageRepository.class),
            listService,
            mock(KnowledgeBaseQueryService.class),
            mock(RagChatMapper.class),
            mock(KnowledgeBaseMapper.class)
        );
    }

    private static KnowledgeBaseEntity kb(long id, String userId) {
        KnowledgeBaseEntity entity = new KnowledgeBaseEntity();
        entity.setId(id);
        entity.setUserId(userId);
        entity.setName("kb-" + id);
        return entity;
    }

    @Test
    @DisplayName("访问他人的知识库视为不存在")
    void requireOwnedKnowledgeBaseRejectsOtherUser() {
        when(knowledgeBaseRepository.findByIdAndUserId(10L, OTHER)).thenReturn(Optional.empty());

        assertThrows(BusinessException.class, () -> listService.requireOwnedKnowledgeBase(OTHER, 10L));
    }

    @Test
    @DisplayName("请求的知识库中只要有一个不属于当前用户就拒绝")
    void requireOwnedKnowledgeBasesRejectsMixedIds() {
        when(knowledgeBaseRepository.findByIdInAndUserId(anyCollection(), eq(OWNER)))
            .thenReturn(List.of(kb(10L, OWNER)));

        assertThrows(BusinessException.class,
            () -> listService.requireOwnedKnowledgeBases(OWNER, List.of(10L, 20L)));
    }

    @Test
    @DisplayName("重复的知识库ID不会被误判为越权")
    void requireOwnedKnowledgeBasesIgnoresDuplicates() {
        when(knowledgeBaseRepository.findByIdInAndUserId(anyCollection(), eq(OWNER)))
            .thenReturn(List.of(kb(10L, OWNER)));

        assertEquals(1, listService.requireOwnedKnowledgeBases(OWNER, List.of(10L, 10L)).size());
    }

    @Test
    @DisplayName("新建会话记录创建者")
    void createSessionStoresOwner() {
        when(knowledgeBaseRepository.findByIdInAndUserId(anyCollection(), eq(OWNER)))
            .thenReturn(List.of(kb(10L, OWNER)));
        when(sessionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        sessionService.createSession(OWNER, new CreateSessionRequest(List.of(10L), null));

        ArgumentCaptor<RagChatSessionEntity> saved = ArgumentCaptor.forClass(RagChatSessionEntity.class);
        verify(sessionRepository).save(saved.capture());
        assertEquals(OWNER, saved.getValue().getUserId());
    }

    @Test
    @DisplayName("不能用他人的知识库创建会话")
    void createSessionRejectsOtherUsersKnowledgeBase() {
        when(knowledgeBaseRepository.findByIdInAndUserId(anyCollection(), eq(OTHER))).thenReturn(List.of());

        assertThrows(BusinessException.class,
            () -> sessionService.createSession(OTHER, new CreateSessionRequest(List.of(10L), null)));
        verify(sessionRepository, never()).save(any());
    }

    @Test
    @DisplayName("不能读取或删除他人的会话")
    void otherUsersSessionIsNotFound() {
        when(sessionRepository.findByIdAndUserIdWithKnowledgeBases(5L, OTHER)).thenReturn(Optional.empty());
        when(sessionRepository.findByIdAndUserId(5L, OTHER)).thenReturn(Optional.empty());

        assertThrows(BusinessException.class, () -> sessionService.getSessionDetail(OTHER, 5L));
        assertThrows(BusinessException.class, () -> sessionService.prepareStreamMessage(OTHER, 5L, "q"));
        assertThrows(BusinessException.class, () -> sessionService.deleteSession(OTHER, 5L));
        verify(sessionRepository, never()).delete(any());
    }
}
