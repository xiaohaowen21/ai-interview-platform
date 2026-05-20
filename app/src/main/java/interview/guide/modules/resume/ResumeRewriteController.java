package interview.guide.modules.resume;

import interview.guide.common.result.Result;
import interview.guide.common.util.UserIdUtil;
import interview.guide.modules.resume.model.ResumeRewriteDTO;
import interview.guide.modules.resume.model.ResumeRewriteGenerateRequest;
import interview.guide.modules.resume.model.ResumeRewriteUpdateRequest;
import interview.guide.modules.resume.service.ResumeRewriteService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * 简历优化控制器。
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class ResumeRewriteController {

    private final ResumeRewriteService resumeRewriteService;

    @GetMapping("/api/resumes/{resumeId}/rewrites")
    public Result<List<ResumeRewriteDTO>> listByResume(
        @PathVariable Long resumeId,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        return Result.success(resumeRewriteService.listByResume(uid, resumeId));
    }

    @PostMapping("/api/resumes/{resumeId}/rewrites")
    public Result<ResumeRewriteDTO> generate(
        @PathVariable Long resumeId,
        @RequestBody(required = false) ResumeRewriteGenerateRequest request,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        return Result.success(resumeRewriteService.generate(uid, resumeId, request));
    }

    @GetMapping("/api/resume-rewrites/{rewriteId}")
    public Result<ResumeRewriteDTO> getById(
        @PathVariable Long rewriteId,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        return Result.success(resumeRewriteService.getById(uid, rewriteId));
    }

    @PutMapping("/api/resume-rewrites/{rewriteId}")
    public Result<ResumeRewriteDTO> update(
        @PathVariable Long rewriteId,
        @RequestBody ResumeRewriteUpdateRequest request,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        return Result.success(resumeRewriteService.update(uid, rewriteId, request));
    }

    @GetMapping("/api/resume-rewrites/{rewriteId}/export")
    public ResponseEntity<byte[]> exportPdf(
        @PathVariable Long rewriteId,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        try {
            ResumeRewriteService.ExportResult result = resumeRewriteService.exportPdf(uid, rewriteId);
            String filename = URLEncoder.encode(result.filename(), StandardCharsets.UTF_8).replace("+", "%20");
            return ResponseEntity.ok()
                .header(
                    HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename=\"resume-rewrite.pdf\"; filename*=UTF-8''" + filename
                )
                .contentType(MediaType.APPLICATION_PDF)
                .body(result.pdfBytes());
        } catch (Exception exception) {
            log.error("Export rewritten resume PDF failed: rewriteId={}", rewriteId, exception);
            return ResponseEntity.internalServerError().build();
        }
    }
}
