package interview.guide.modules.resume.service;

import interview.guide.common.config.AppConfigProperties;
import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.common.model.AsyncTaskStatus;
import interview.guide.infrastructure.file.FileStorageService;
import interview.guide.infrastructure.file.FileValidationService;
import interview.guide.modules.resume.listener.AnalyzeStreamProducer;
import interview.guide.modules.resume.model.ResumeEntity;
import interview.guide.modules.resume.repository.ResumeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * Resume upload service.
 * Handles upload, parsing, and analysis dispatch.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeUploadService {

    private final ResumeParseService parseService;
    private final FileStorageService storageService;
    private final ResumePersistenceService persistenceService;
    private final AppConfigProperties appConfig;
    private final FileValidationService fileValidationService;
    private final AnalyzeStreamProducer analyzeStreamProducer;
    private final ResumeRepository resumeRepository;

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    /**
     * Upload and analyze a resume asynchronously.
     */
    public Map<String, Object> uploadAndAnalyze(org.springframework.web.multipart.MultipartFile file, String userId) {
        // 1) Validate file size and name.
        fileValidationService.validateFile(file, MAX_FILE_SIZE, "resume");

        String fileName = file.getOriginalFilename();
        log.info("Resume upload request: {}, size: {} bytes", fileName, file.getSize());

        // 2) Validate file type.
        String contentType = parseService.detectContentType(file);
        validateContentType(contentType);

        // 3) Parse resume text.
        String resumeText = parseService.parseResume(file);
        if (resumeText == null || resumeText.trim().isEmpty()) {
            throw new BusinessException(ErrorCode.RESUME_PARSE_FAILED,
                "Failed to extract text from the resume. If it is a scanned PDF, please upload a text-based file.");
        }

        // 4) Save file to object storage.
        String fileKey = storageService.uploadResume(file);
        String fileUrl = storageService.getFileUrl(fileKey);
        log.info("Resume stored in object storage: {}", fileKey);

        // 5) Save resume record with PENDING status.
        ResumeEntity savedResume = persistenceService.saveResume(file, resumeText, fileKey, fileUrl, userId);

        // 6) Send analysis task to Redis Stream.
        analyzeStreamProducer.sendAnalyzeTask(savedResume.getId(), resumeText);

        log.info("Resume upload completed. Analysis task queued: {}, resumeId={}", fileName, savedResume.getId());

        // 7) Return result with PENDING status.
        return Map.of(
            "resume", Map.of(
                "id", savedResume.getId(),
                "filename", savedResume.getOriginalFilename(),
                "analyzeStatus", AsyncTaskStatus.PENDING.name()
            ),
            "storage", Map.of(
                "fileKey", fileKey,
                "fileUrl", fileUrl,
                "resumeId", savedResume.getId()
            ),
            "duplicate", false
        );
    }

    /**
     * Validate supported content types.
     */
    private void validateContentType(String contentType) {
        fileValidationService.validateContentTypeByList(
            contentType,
            appConfig.getAllowedTypes(),
            "Unsupported content type: " + contentType
        );
    }

    /**
     * Reanalyze a resume by fetching cached text or re-parsing if needed.
     */
    @Transactional
    public void reanalyze(String userId, Long resumeId) {
        ResumeEntity resume = resumeRepository.findByIdAndUserId(resumeId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_NOT_FOUND, "Resume not found"));

        log.info("Reanalyze resume: resumeId={}, filename={}, userId={}",
            resumeId, resume.getOriginalFilename(), userId);

        String resumeText = resume.getResumeText();
        if (resumeText == null || resumeText.trim().isEmpty()) {
            resumeText = parseService.downloadAndParseContent(resume.getStorageKey(), resume.getOriginalFilename());
            if (resumeText == null || resumeText.trim().isEmpty()) {
                throw new BusinessException(ErrorCode.RESUME_PARSE_FAILED,
                    "Failed to load resume text for reanalysis.");
            }
            resume.setResumeText(resumeText);
        }

        resume.setAnalyzeStatus(AsyncTaskStatus.PENDING);
        resume.setAnalyzeError(null);
        resumeRepository.save(resume);

        analyzeStreamProducer.sendAnalyzeTask(resumeId, resumeText);

        log.info("Reanalysis task queued: resumeId={}", resumeId);
    }
}
