package interview.guide.modules.interview;

import interview.guide.common.annotation.RateLimit;
import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.common.result.Result;
import interview.guide.common.util.UserIdUtil;
import interview.guide.modules.interview.model.*;
import interview.guide.modules.interview.service.InterviewHistoryService;
import interview.guide.modules.interview.service.InterviewPersistenceService;
import interview.guide.modules.interview.service.InterviewSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Interview controller for simulated interview workflows.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class InterviewController {

    private final InterviewSessionService sessionService;
    private final InterviewHistoryService historyService;
    private final InterviewPersistenceService persistenceService;

    /**
     * Create an interview session.
     */
    @PostMapping("/api/interview/sessions")
    @RateLimit(dimensions = {RateLimit.Dimension.GLOBAL, RateLimit.Dimension.IP}, count = 5)
    public Result<InterviewSessionDTO> createSession(
        @RequestBody CreateInterviewRequest request,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        if (request.mode() == InterviewMode.ORAL) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "语音面试请使用独立语音入口");
        }
        log.info("Create interview session, questionCount: {}", request.questionCount());
        InterviewSessionDTO session = sessionService.createSession(uid, request);
        return Result.success(session);
    }

    /**
     * Get session info.
     */
    @GetMapping("/api/interview/sessions/{sessionId}")
    public Result<InterviewSessionDTO> getSession(
        @PathVariable String sessionId,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        InterviewSessionDTO session = sessionService.getSession(uid, sessionId);
        return Result.success(session);
    }

    /**
     * Get current question.
     */
    @GetMapping("/api/interview/sessions/{sessionId}/question")
    public Result<Map<String, Object>> getCurrentQuestion(
        @PathVariable String sessionId,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        return Result.success(sessionService.getCurrentQuestionResponse(uid, sessionId));
    }

    /**
     * Submit an answer.
     */
    @PostMapping("/api/interview/sessions/{sessionId}/answers")
    @RateLimit(dimensions = {RateLimit.Dimension.GLOBAL}, count = 10)
    public Result<SubmitAnswerResponse> submitAnswer(
        @PathVariable String sessionId,
        @RequestBody Map<String, Object> body,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        Integer questionIndex = (Integer) body.get("questionIndex");
        String answer = (String) body.get("answer");
        log.info("Submit answer: session={}, questionIndex={}", sessionId, questionIndex);
        SubmitAnswerRequest request = new SubmitAnswerRequest(sessionId, questionIndex, answer);
        SubmitAnswerResponse response = sessionService.submitAnswer(uid, request);
        return Result.success(response);
    }

    /**
     * Submit an answer and stream the interviewer reply.
     */
    @PostMapping(value = "/api/interview/sessions/{sessionId}/answers/stream", produces = "application/x-ndjson")
    @RateLimit(dimensions = {RateLimit.Dimension.GLOBAL}, count = 10)
    public ResponseEntity<StreamingResponseBody> submitAnswerStream(
        @PathVariable String sessionId,
        @RequestBody Map<String, Object> body,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        Integer questionIndex = (Integer) body.get("questionIndex");
        String answer = (String) body.get("answer");
        SubmitAnswerRequest request = new SubmitAnswerRequest(sessionId, questionIndex, answer);

        StreamingResponseBody stream = outputStream -> sessionService.submitAnswerStream(uid, request, outputStream);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("application/x-ndjson"))
            .header(HttpHeaders.CACHE_CONTROL, "no-cache")
            .body(stream);
    }

    /**
     * Generate interview report.
     */
    @GetMapping("/api/interview/sessions/{sessionId}/report")
    public Result<InterviewReportDTO> getReport(
        @PathVariable String sessionId,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        log.info("Generate report: {}", sessionId);
        InterviewReportDTO report = sessionService.generateReport(uid, sessionId);
        return Result.success(report);
    }

    /**
     * Find unfinished session for a resume.
     */
    @GetMapping("/api/interview/sessions/unfinished/{resumeId}")
    public Result<InterviewSessionDTO> findUnfinishedSession(
        @PathVariable Long resumeId,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        return Result.success(sessionService.findUnfinishedSessionOrThrow(uid, resumeId));
    }

    /**
     * Save answer without moving to next question.
     */
    @PutMapping("/api/interview/sessions/{sessionId}/answers")
    public Result<Void> saveAnswer(
        @PathVariable String sessionId,
        @RequestBody Map<String, Object> body,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        Integer questionIndex = (Integer) body.get("questionIndex");
        String answer = (String) body.get("answer");
        log.info("Save answer: session={}, questionIndex={}", sessionId, questionIndex);
        SubmitAnswerRequest request = new SubmitAnswerRequest(sessionId, questionIndex, answer);
        sessionService.saveAnswer(uid, request);
        return Result.success(null);
    }

    /**
     * Complete interview early.
     */
    @PostMapping("/api/interview/sessions/{sessionId}/complete")
    public Result<Void> completeInterview(
        @PathVariable String sessionId,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        log.info("Complete interview early: {}", sessionId);
        sessionService.completeInterview(uid, sessionId);
        return Result.success(null);
    }

    /**
     * Get interview detail.
     */
    @GetMapping("/api/interview/sessions/{sessionId}/details")
    public Result<InterviewDetailDTO> getInterviewDetail(
        @PathVariable String sessionId,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        InterviewDetailDTO detail = historyService.getInterviewDetail(uid, sessionId);
        return Result.success(detail);
    }

    /**
     * Export interview report PDF.
     */
    @GetMapping("/api/interview/sessions/{sessionId}/export")
    public ResponseEntity<byte[]> exportInterviewPdf(
        @PathVariable String sessionId,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        try {
            byte[] pdfBytes = historyService.exportInterviewPdf(uid, sessionId);
            String filename = URLEncoder.encode("interview_report_" + sessionId + ".pdf",
                StandardCharsets.UTF_8);

            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + filename)
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
        } catch (Exception e) {
            log.error("PDF export failed", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Delete an interview session.
     */
    @DeleteMapping("/api/interview/sessions/{sessionId}")
    public Result<Void> deleteInterview(
        @PathVariable String sessionId,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        log.info("Delete interview session: {}", sessionId);
        persistenceService.deleteSessionBySessionId(sessionId, uid);
        return Result.success(null);
    }
}
