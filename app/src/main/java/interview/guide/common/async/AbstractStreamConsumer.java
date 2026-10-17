package interview.guide.common.async;

import interview.guide.common.constant.AsyncTaskStreamConstants;
import interview.guide.infrastructure.redis.RedisService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.stream.StreamMessageId;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Redis Stream 消费者模板基类。
 * <p>
 * 将消费循环、ACK、重试与生命周期管理收敛到统一模板，子类仅关注业务处理逻辑。
 * <p>
 * 处理中途进程退出时，消息会留在消费者组的待确认列表（PEL）里。消费循环会定期认领
 * 空闲过久的待确认消息，按一次失败尝试重新入队，避免任务永远停在“处理中”。
 */
@Slf4j
public abstract class AbstractStreamConsumer<T> {

    private final RedisService redisService;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private ExecutorService executorService;
    private String consumerName;
    private long lastNoGroupWarnAt = 0L;
    private long lastReclaimAt = 0L;

    protected AbstractStreamConsumer(RedisService redisService) {
        this.redisService = redisService;
    }

    @PostConstruct
    public void init() {
        this.consumerName = consumerPrefix() + UUID.randomUUID().toString().substring(0, 8);

        try {
            redisService.createStreamGroup(streamKey(), groupName());
            log.info("Redis Stream 消费者组已创建或已存在: {}", groupName());
        } catch (Exception e) {
            log.warn("创建消费者组时发生异常（可能已存在）: {}", e.getMessage());
        }

        this.executorService = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, threadName());
            t.setDaemon(true);
            return t;
        });

        running.set(true);
        executorService.submit(this::consumeLoop);
        log.info("{}消费者已启动: consumerName={}", taskDisplayName(), consumerName);
    }

    @PreDestroy
    public void shutdown() {
        running.set(false);
        if (executorService != null) {
            executorService.shutdown();
        }
        log.info("{}消费者已关闭: consumerName={}", taskDisplayName(), consumerName);
    }

    private void consumeLoop() {
        while (running.get()) {
            try {
                maybeReclaimStalledMessages();
                redisService.streamConsumeMessages(
                    streamKey(),
                    groupName(),
                    consumerName,
                    AsyncTaskStreamConstants.BATCH_SIZE,
                    AsyncTaskStreamConstants.POLL_INTERVAL_MS,
                    this::processMessage
                );
            } catch (Exception e) {
                if (Thread.currentThread().isInterrupted()) {
                    log.info("消费者线程被中断");
                    break;
                }
                if (isNoGroupError(e)) {
                    recoverConsumerGroup(e);
                    continue;
                }
                log.error("消费消息时发生错误: {}", e.getMessage(), e);
            }
        }
    }

    private void maybeReclaimStalledMessages() {
        long now = System.currentTimeMillis();
        if (now - lastReclaimAt < AsyncTaskStreamConstants.RECLAIM_INTERVAL_MS) {
            return;
        }
        lastReclaimAt = now;
        reclaimStalledMessages();
    }

    /**
     * 认领空闲超过 {@link AsyncTaskStreamConstants#STALLED_MESSAGE_IDLE_MS} 的待确认消息。
     * 这些消息的处理者大概率已经退出，视为一次失败尝试：重新入队或标记失败，然后确认旧消息。
     */
    protected void reclaimStalledMessages() {
        RedisService.StreamClaimResult claimed = redisService.streamClaimIdle(
            streamKey(),
            groupName(),
            consumerName,
            AsyncTaskStreamConstants.STALLED_MESSAGE_IDLE_MS,
            AsyncTaskStreamConstants.BATCH_SIZE
        );

        if (!claimed.deletedIds().isEmpty()) {
            log.warn("{}任务的待确认消息已被 Stream 裁剪，无法恢复，对应记录需手动重试: ids={}",
                taskDisplayName(), claimed.deletedIds());
        }

        claimed.messages().forEach((messageId, data) -> {
            T payload = parsePayload(messageId, data);
            if (payload == null) {
                ackMessage(messageId);
                return;
            }
            int retryCount = parseRetryCount(data);
            log.warn("{}任务处理中断，重新调度: {}, messageId={}, retryCount={}",
                taskDisplayName(), payloadIdentifier(payload), messageId, retryCount);
            scheduleRetryOrFail(payload, retryCount, "处理中断（服务重启或超时）");
            ackMessage(messageId);
        });
    }

    private void recoverConsumerGroup(Exception e) {
        long now = System.currentTimeMillis();
        if (now - lastNoGroupWarnAt > 30_000) {
            log.warn("检测到消费者组缺失，准备自动重建: task={}, stream={}, group={}, error={}",
                taskDisplayName(), streamKey(), groupName(), e.getMessage());
            lastNoGroupWarnAt = now;
        }
        try {
            redisService.createStreamGroup(streamKey(), groupName());
            Thread.sleep(300);
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
        } catch (Exception createException) {
            log.warn("自动重建消费者组失败: task={}, stream={}, group={}, error={}",
                taskDisplayName(), streamKey(), groupName(), createException.getMessage());
        }
    }

    private boolean isNoGroupError(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            String message = current.getMessage();
            if (message != null && message.contains("NOGROUP")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private void processMessage(StreamMessageId messageId, Map<String, String> data) {
        T payload = parsePayload(messageId, data);
        if (payload == null) {
            ackMessage(messageId);
            return;
        }

        int retryCount = parseRetryCount(data);
        log.info("开始处理{}任务: {}, messageId={}, retryCount={}",
            taskDisplayName(), payloadIdentifier(payload), messageId, retryCount);

        try {
            markProcessing(payload);
            processBusiness(payload);
            markCompleted(payload);
            ackMessage(messageId);
            log.info("{}任务完成: {}", taskDisplayName(), payloadIdentifier(payload));
        } catch (Exception e) {
            log.error("{}任务失败: {}, error={}", taskDisplayName(), payloadIdentifier(payload), e.getMessage(), e);
            scheduleRetryOrFail(payload, retryCount, e.getMessage());
            ackMessage(messageId);
        }
    }

    private void scheduleRetryOrFail(T payload, int retryCount, String reason) {
        if (retryCount < AsyncTaskStreamConstants.MAX_RETRY_COUNT) {
            retryMessage(payload, retryCount + 1);
        } else {
            markFailed(payload, truncateError(
                taskDisplayName() + "失败(已重试" + retryCount + "次): " + reason
            ));
        }
    }

    /**
     * 以新的重试次数重新入队；入队失败时直接标记任务失败。
     */
    protected void retryMessage(T payload, int retryCount) {
        try {
            Map<String, String> message = new HashMap<>(buildMessage(payload));
            message.put(AsyncTaskStreamConstants.FIELD_RETRY_COUNT, String.valueOf(retryCount));
            redisService.streamAdd(streamKey(), message, AsyncTaskStreamConstants.STREAM_MAX_LEN);
            log.info("{}任务已重新入队: {}, retryCount={}", taskDisplayName(), payloadIdentifier(payload), retryCount);
        } catch (Exception e) {
            log.error("{}任务重试入队失败: {}, error={}",
                taskDisplayName(), payloadIdentifier(payload), e.getMessage(), e);
            markFailed(payload, truncateError("重试入队失败: " + e.getMessage()));
        }
    }

    protected int parseRetryCount(Map<String, String> data) {
        try {
            return Integer.parseInt(data.getOrDefault(AsyncTaskStreamConstants.FIELD_RETRY_COUNT, "0"));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    protected String truncateError(String error) {
        if (error == null) {
            return null;
        }
        return error.length() > 500 ? error.substring(0, 500) : error;
    }

    private void ackMessage(StreamMessageId messageId) {
        try {
            redisService.streamAck(streamKey(), groupName(), messageId);
        } catch (Exception e) {
            log.error("确认消息失败: messageId={}, error={}", messageId, e.getMessage(), e);
        }
    }

    protected RedisService redisService() {
        return redisService;
    }

    protected abstract String taskDisplayName();

    protected abstract String streamKey();

    protected abstract String groupName();

    protected abstract String consumerPrefix();

    protected abstract String threadName();

    protected abstract T parsePayload(StreamMessageId messageId, Map<String, String> data);

    /**
     * 构造任务消息的业务字段（不含重试次数），用于重新入队。
     */
    protected abstract Map<String, String> buildMessage(T payload);

    protected abstract String payloadIdentifier(T payload);

    protected abstract void markProcessing(T payload);

    protected abstract void processBusiness(T payload);

    protected abstract void markCompleted(T payload);

    protected abstract void markFailed(T payload, String error);
}
