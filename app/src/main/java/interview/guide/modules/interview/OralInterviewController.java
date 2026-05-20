package interview.guide.modules.interview;

import interview.guide.common.annotation.RateLimit;
import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.common.result.Result;
import interview.guide.common.util.UserIdUtil;
import interview.guide.modules.interview.model.CreateInterviewRequest;
import interview.guide.modules.interview.model.InterviewMode;
import interview.guide.modules.interview.model.InterviewReportDTO;
import interview.guide.modules.interview.model.InterviewSessionDTO;
import interview.guide.modules.interview.model.SubmitAnswerRequest;
import interview.guide.modules.interview.model.SubmitAnswerResponse;
import interview.guide.modules.interview.service.InterviewSessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.util.Map;

/**
 * Dedicated oral interview endpoints.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class OralInterviewController {

    private static final int DEFAULT_ORAL_QUESTION_COUNT = 8;

    private final InterviewSessionService sessionService;

    @PostMapping("/api/oral/sessions")
    @RateLimit(dimensions = {RateLimit.Dimension.GLOBAL, RateLimit.Dimension.IP}, count = 5)
    public Result<InterviewSessionDTO> createSession(
        @RequestBody CreateInterviewRequest request,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);

        CreateInterviewRequest normalizedRequest = new CreateInterviewRequest(
            request.resumeText(),
            request.questionCount() <= 0 ? DEFAULT_ORAL_QUESTION_COUNT : request.questionCount(),
            request.resumeId(),
            request.forceCreate(),
            InterviewMode.ORAL,
            request.interviewerStyle()
        );

        InterviewSessionDTO session = sessionService.createSession(uid, normalizedRequest);
        ensureOralSession(session);
        return Result.success(session);
    }

    @GetMapping("/api/oral/sessions/{sessionId}")
    public Result<InterviewSessionDTO> getSession(
        @PathVariable String sessionId,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        InterviewSessionDTO session = sessionService.getSession(uid, sessionId);
        ensureOralSession(session);
        return Result.success(session);
    }

    @PostMapping("/api/oral/sessions/{sessionId}/answers")
    @RateLimit(dimensions = {RateLimit.Dimension.GLOBAL}, count = 10)
    public Result<SubmitAnswerResponse> submitAnswer(
        @PathVariable String sessionId,
        @RequestBody Map<String, Object> body,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        ensureOralSession(sessionService.getSession(uid, sessionId));

        Integer questionIndex = (Integer) body.get("questionIndex");
        String answer = (String) body.get("answer");
        SubmitAnswerRequest request = new SubmitAnswerRequest(sessionId, questionIndex, answer);
        return Result.success(sessionService.submitAnswer(uid, request));
    }

    @PostMapping(value = "/api/oral/sessions/{sessionId}/answers/stream", produces = "application/x-ndjson")
    @RateLimit(dimensions = {RateLimit.Dimension.GLOBAL}, count = 10)
    public ResponseEntity<StreamingResponseBody> submitAnswerStream(
        @PathVariable String sessionId,
        @RequestBody Map<String, Object> body,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        ensureOralSession(sessionService.getSession(uid, sessionId));

        Integer questionIndex = (Integer) body.get("questionIndex");
        String answer = (String) body.get("answer");
        SubmitAnswerRequest request = new SubmitAnswerRequest(sessionId, questionIndex, answer);

        StreamingResponseBody stream = outputStream -> sessionService.submitAnswerStream(uid, request, outputStream);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("application/x-ndjson"))
            .header(HttpHeaders.CACHE_CONTROL, "no-cache")
            .body(stream);
    }

    @PostMapping("/api/oral/sessions/{sessionId}/complete")
    public Result<Void> completeInterview(
        @PathVariable String sessionId,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        ensureOralSession(sessionService.getSession(uid, sessionId));
        sessionService.completeInterview(uid, sessionId);
        return Result.success(null);
    }

    @GetMapping("/api/oral/sessions/{sessionId}/report")
    public Result<InterviewReportDTO> getReport(
        @PathVariable String sessionId,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        InterviewSessionDTO session = sessionService.getSession(uid, sessionId);
        ensureOralSession(session);
        return Result.success(sessionService.generateReport(uid, sessionId));
    }

    @PostMapping("/api/oral/sessions/{sessionId}/follow-up")
    public Result<Map<String, String>> answerFollowUp(
        @PathVariable String sessionId,
        @RequestBody Map<String, Object> body,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        InterviewSessionDTO session = sessionService.getSession(uid, sessionId);
        ensureOralSession(session);

        String question = body.get("question") instanceof String value ? value : "";
        String answer = sessionService.answerOralFollowUp(uid, sessionId, question);
        return Result.success(Map.of("answer", answer));
    }

    private void ensureOralSession(InterviewSessionDTO session) {
        InterviewMode mode = session.mode() == null ? InterviewMode.WRITTEN : session.mode();
        if (mode != InterviewMode.ORAL) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "该会话不是语音面试会话");
        }
    }
}
