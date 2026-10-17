package interview.guide.common.async;

import interview.guide.common.constant.AsyncTaskStreamConstants;
import interview.guide.infrastructure.redis.RedisService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.redisson.api.stream.StreamMessageId;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 消费者中途退出后，遗留在待确认列表里的消息必须被重新调度，否则任务会永远停在“处理中”
 */
@DisplayName("Stream 消费者重试与中断恢复测试")
class AbstractStreamConsumerTest {

    private static final String STREAM = "test:stream";
    private static final String GROUP = "test-group";

    private RedisService redisService;
    private TestConsumer consumer;

    @BeforeEach
    void setUp() {
        redisService = mock(RedisService.class);
        consumer = new TestConsumer(redisService);
    }

    @Test
    @DisplayName("认领到中断的消息时以 retryCount+1 重新入队并确认旧消息")
    @SuppressWarnings("unchecked")
    void requeuesStalledMessage() {
        StreamMessageId id = new StreamMessageId(1, 0);
        claim(Map.of(id, Map.of("jobId", "42", AsyncTaskStreamConstants.FIELD_RETRY_COUNT, "1")), List.of());

        consumer.reclaimStalledMessages();

        ArgumentCaptor<Map<String, String>> message = ArgumentCaptor.forClass(Map.class);
        verify(redisService).streamAdd(eq(STREAM), message.capture(), eq(AsyncTaskStreamConstants.STREAM_MAX_LEN));
        assertEquals("42", message.getValue().get("jobId"));
        assertEquals("2", message.getValue().get(AsyncTaskStreamConstants.FIELD_RETRY_COUNT));
        verify(redisService).streamAck(STREAM, GROUP, id);
        assertTrue(consumer.failed.isEmpty());
    }

    @Test
    @DisplayName("重试次数已用完的中断消息直接标记失败")
    void failsStalledMessageAfterMaxRetries() {
        StreamMessageId id = new StreamMessageId(2, 0);
        String maxRetries = String.valueOf(AsyncTaskStreamConstants.MAX_RETRY_COUNT);
        claim(Map.of(id, Map.of("jobId", "7", AsyncTaskStreamConstants.FIELD_RETRY_COUNT, maxRetries)), List.of());

        consumer.reclaimStalledMessages();

        verify(redisService, never()).streamAdd(anyString(), anyMap(), anyInt());
        verify(redisService).streamAck(STREAM, GROUP, id);
        assertEquals(List.of("7"), consumer.failed);
    }

    @Test
    @DisplayName("格式错误的中断消息只确认、不重试")
    void acksMalformedStalledMessage() {
        StreamMessageId id = new StreamMessageId(3, 0);
        claim(Map.of(id, Map.of("__bootstrap__", "1")), List.of());

        consumer.reclaimStalledMessages();

        verify(redisService, never()).streamAdd(anyString(), anyMap(), anyInt());
        verify(redisService).streamAck(STREAM, GROUP, id);
    }

    @Test
    @DisplayName("没有中断消息时不做任何操作")
    void noopWhenNothingStalled() {
        claim(Map.of(), List.of(new StreamMessageId(4, 0)));

        consumer.reclaimStalledMessages();

        verify(redisService, never()).streamAdd(anyString(), anyMap(), anyInt());
        verify(redisService, never()).streamAck(anyString(), anyString(), any(StreamMessageId[].class));
    }

    @Test
    @DisplayName("只认领空闲超过阈值的消息")
    void claimsOnlyLongIdleMessages() {
        claim(Map.of(), List.of());

        consumer.reclaimStalledMessages();

        verify(redisService).streamClaimIdle(eq(STREAM), eq(GROUP), any(),
            eq(AsyncTaskStreamConstants.STALLED_MESSAGE_IDLE_MS), anyInt());
    }

    @Test
    @DisplayName("重试入队失败时标记任务失败")
    void marksFailedWhenRequeueFails() {
        when(redisService.streamAdd(anyString(), anyMap(), anyInt())).thenThrow(new RuntimeException("redis down"));

        consumer.retryMessage("9", 1);

        assertEquals(List.of("9"), consumer.failed);
    }

    private void claim(Map<StreamMessageId, Map<String, String>> messages, List<StreamMessageId> deleted) {
        when(redisService.streamClaimIdle(anyString(), anyString(), any(), anyLong(), anyInt()))
            .thenReturn(new RedisService.StreamClaimResult(messages, deleted));
    }

    private static class TestConsumer extends AbstractStreamConsumer<String> {

        final List<String> failed = new ArrayList<>();

        TestConsumer(RedisService redisService) {
            super(redisService);
        }

        @Override
        protected String taskDisplayName() {
            return "测试";
        }

        @Override
        protected String streamKey() {
            return STREAM;
        }

        @Override
        protected String groupName() {
            return GROUP;
        }

        @Override
        protected String consumerPrefix() {
            return "test-";
        }

        @Override
        protected String threadName() {
            return "test-consumer";
        }

        @Override
        protected String parsePayload(StreamMessageId messageId, Map<String, String> data) {
            return data.get("jobId");
        }

        @Override
        protected Map<String, String> buildMessage(String payload) {
            return Map.of("jobId", payload);
        }

        @Override
        protected String payloadIdentifier(String payload) {
            return "jobId=" + payload;
        }

        @Override
        protected void markProcessing(String payload) {
        }

        @Override
        protected void processBusiness(String payload) {
        }

        @Override
        protected void markCompleted(String payload) {
        }

        @Override
        protected void markFailed(String payload, String error) {
            failed.add(payload);
        }
    }
}
