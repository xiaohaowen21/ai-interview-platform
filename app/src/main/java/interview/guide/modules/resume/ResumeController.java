package interview.guide.modules.resume;

import interview.guide.common.annotation.RateLimit;
import interview.guide.common.result.Result;
import interview.guide.common.util.UserIdUtil;
import interview.guide.modules.resume.model.ResumeDetailDTO;
import interview.guide.modules.resume.model.ResumeListItemDTO;
import interview.guide.modules.resume.service.ResumeDeleteService;
import interview.guide.modules.resume.service.ResumeHistoryService;
import interview.guide.modules.resume.service.ResumeUploadService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * Resume controller for upload, history, and analysis.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
public class ResumeController {

    private final ResumeUploadService uploadService;
    private final ResumeDeleteService deleteService;
    private final ResumeHistoryService historyService;

    /**
     * Upload resume and return analysis.
     */
    @PostMapping(value = "/api/resumes/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @RateLimit(dimensions = {RateLimit.Dimension.GLOBAL, RateLimit.Dimension.IP}, count = 5)
    public Result<Map<String, Object>> uploadAndAnalyze(
        @RequestParam("file") MultipartFile file,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        return Result.success(uploadService.uploadAndAnalyze(file, uid));
    }

    /**
     * List all resumes for the current user.
     */
    @GetMapping("/api/resumes")
    public Result<List<ResumeListItemDTO>> getAllResumes(
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        List<ResumeListItemDTO> resumes = historyService.getAllResumes(uid);
        return Result.success(resumes);
    }

    /**
     * Get resume detail with analysis history.
     */
    @GetMapping("/api/resumes/{id}/detail")
    public Result<ResumeDetailDTO> getResumeDetail(
        @PathVariable Long id,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        ResumeDetailDTO detail = historyService.getResumeDetail(uid, id);
        return Result.success(detail);
    }

    /**
     * Export analysis report as PDF.
     */
    @GetMapping("/api/resumes/{id}/export")
    public ResponseEntity<byte[]> exportAnalysisPdf(
        @PathVariable Long id,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        try {
            var result = historyService.exportAnalysisPdf(uid, id);
            String filename = URLEncoder.encode(result.filename(), StandardCharsets.UTF_8);

            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + filename)
                .contentType(MediaType.APPLICATION_PDF)
                .body(result.pdfBytes());
        } catch (Exception e) {
            log.error("PDF export failed: resumeId={}", id, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Delete a resume.
     */
    @DeleteMapping("/api/resumes/{id}")
    public Result<Void> deleteResume(
        @PathVariable Long id,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        deleteService.deleteResume(uid, id);
        return Result.success(null);
    }

    /**
     * Reanalyze a resume.
     */
    @PostMapping("/api/resumes/{id}/reanalyze")
    @RateLimit(dimensions = {RateLimit.Dimension.GLOBAL, RateLimit.Dimension.IP}, count = 2)
    public Result<Void> reanalyze(
        @PathVariable Long id,
        @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        String uid = UserIdUtil.requireUserId(userId);
        uploadService.reanalyze(uid, id);
        return Result.success(null);
    }

    /**
     * Health check.
     */
    @GetMapping("/api/resumes/health")
    public Result<Map<String, String>> health() {
        return Result.success(Map.of(
            "status", "UP",
            "service", "AI Interview Platform - Resume Service"
        ));
    }

}
