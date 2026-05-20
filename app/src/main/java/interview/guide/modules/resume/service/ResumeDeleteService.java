package interview.guide.modules.resume.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.infrastructure.file.FileStorageService;
import interview.guide.modules.interview.service.InterviewPersistenceService;
import interview.guide.modules.resume.model.ResumeEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Resume delete service.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeDeleteService {

    private final ResumePersistenceService persistenceService;
    private final InterviewPersistenceService interviewPersistenceService;
    private final FileStorageService storageService;

    /**
     * Delete a resume by id and user id.
     */
    public void deleteResume(String userId, Long id) {
        log.info("Resume delete requested: id={}, userId={}", id, userId);

        // Load resume for storage cleanup.
        ResumeEntity resume = persistenceService.findById(id, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_NOT_FOUND));

        // 1) Delete storage object (best-effort).
        try {
            storageService.deleteResume(resume.getStorageKey());
        } catch (Exception e) {
            log.warn("Failed to delete storage object. Continuing DB cleanup: {}", e.getMessage());
        }

        // 2) Delete interview sessions.
        interviewPersistenceService.deleteSessionsByResumeId(id);

        // 3) Delete resume record.
        persistenceService.deleteResume(id, userId);

        log.info("Resume deleted: id={}, userId={}", id, userId);
    }
}