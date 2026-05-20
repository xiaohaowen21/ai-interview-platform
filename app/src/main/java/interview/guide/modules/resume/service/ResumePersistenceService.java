package interview.guide.modules.resume.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.infrastructure.file.FileHashService;
import interview.guide.infrastructure.mapper.ResumeMapper;
import interview.guide.modules.interview.model.ResumeAnalysisResponse;
import interview.guide.modules.resume.model.ResumeAnalysisEntity;
import interview.guide.modules.resume.model.ResumeEntity;
import interview.guide.modules.resume.model.ResumeRewriteEntity;
import interview.guide.modules.resume.repository.ResumeAnalysisRepository;
import interview.guide.modules.resume.repository.ResumeRepository;
import interview.guide.modules.resume.repository.ResumeRewriteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Optional;

/**
 * Handles resume persistence, analysis history, and cascading cleanup.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResumePersistenceService {

    private final ResumeRepository resumeRepository;
    private final ResumeAnalysisRepository analysisRepository;
    private final ResumeRewriteRepository resumeRewriteRepository;
    private final ObjectMapper objectMapper;
    private final ResumeMapper resumeMapper;
    private final FileHashService fileHashService;

    @Transactional(rollbackFor = Exception.class)
    public ResumeEntity saveResume(
        MultipartFile file,
        String resumeText,
        String storageKey,
        String storageUrl,
        String userId
    ) {
        try {
            String fileHash = fileHashService.calculateHash(file);

            ResumeEntity resume = new ResumeEntity();
            resume.setUserId(userId);
            resume.setFileHash(fileHash);
            resume.setOriginalFilename(file.getOriginalFilename());
            resume.setFileSize(file.getSize());
            resume.setContentType(file.getContentType());
            resume.setStorageKey(storageKey);
            resume.setStorageUrl(storageUrl);
            resume.setResumeText(resumeText);

            ResumeEntity saved = resumeRepository.save(resume);
            log.info("Resume saved: id={}, hash={}", saved.getId(), fileHash);
            return saved;
        } catch (Exception exception) {
            log.error("Failed to save resume", exception);
            throw new BusinessException(ErrorCode.RESUME_UPLOAD_FAILED, "保存简历失败");
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public ResumeAnalysisEntity saveAnalysis(ResumeEntity resume, ResumeAnalysisResponse analysis) {
        try {
            ResumeAnalysisEntity entity = resumeMapper.toAnalysisEntity(analysis);
            entity.setResume(resume);
            entity.setStrengthsJson(objectMapper.writeValueAsString(analysis.strengths()));
            entity.setSuggestionsJson(objectMapper.writeValueAsString(analysis.suggestions()));

            ResumeAnalysisEntity saved = analysisRepository.save(entity);
            log.info(
                "Resume analysis saved: analysisId={}, resumeId={}, score={}",
                saved.getId(),
                resume.getId(),
                analysis.overallScore()
            );
            return saved;
        } catch (JacksonException exception) {
            log.error("Failed to serialize analysis result", exception);
            throw new BusinessException(ErrorCode.RESUME_ANALYSIS_FAILED, "保存简历分析结果失败");
        }
    }

    public Optional<ResumeAnalysisEntity> getLatestAnalysis(Long resumeId) {
        return Optional.ofNullable(analysisRepository.findFirstByResumeIdOrderByAnalyzedAtDesc(resumeId));
    }

    public Optional<ResumeAnalysisResponse> getLatestAnalysisAsDTO(Long resumeId) {
        return getLatestAnalysis(resumeId).map(this::entityToDTO);
    }

    public List<ResumeEntity> findAllResumes(String userId) {
        return resumeRepository.findByUserIdOrderByUploadedAtDesc(userId);
    }

    public List<ResumeAnalysisEntity> findAnalysesByResumeId(Long resumeId) {
        return analysisRepository.findByResumeIdOrderByAnalyzedAtDesc(resumeId);
    }

    public ResumeAnalysisResponse entityToDTO(ResumeAnalysisEntity entity) {
        try {
            List<String> strengths = objectMapper.readValue(
                entity.getStrengthsJson() != null ? entity.getStrengthsJson() : "[]",
                new TypeReference<>() {
                }
            );

            List<ResumeAnalysisResponse.Suggestion> suggestions = objectMapper.readValue(
                entity.getSuggestionsJson() != null ? entity.getSuggestionsJson() : "[]",
                new TypeReference<>() {
                }
            );

            return new ResumeAnalysisResponse(
                entity.getOverallScore(),
                resumeMapper.toScoreDetail(entity),
                entity.getSummary(),
                strengths,
                suggestions,
                entity.getResume().getResumeText()
            );
        } catch (JacksonException exception) {
            log.error("Failed to deserialize analysis result", exception);
            throw new BusinessException(ErrorCode.RESUME_ANALYSIS_FAILED, "获取简历分析结果失败");
        }
    }

    public Optional<ResumeEntity> findById(Long id, String userId) {
        return resumeRepository.findByIdAndUserId(id, userId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteResume(Long id, String userId) {
        ResumeEntity resume = resumeRepository.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_NOT_FOUND));

        List<ResumeAnalysisEntity> analyses = analysisRepository.findByResumeIdOrderByAnalyzedAtDesc(id);
        if (!analyses.isEmpty()) {
            analysisRepository.deleteAll(analyses);
            log.info("Deleted {} analysis records for resumeId={}", analyses.size(), id);
        }

        List<ResumeRewriteEntity> rewrites = resumeRewriteRepository.findByResumeIdOrderByUpdatedAtDesc(id);
        if (!rewrites.isEmpty()) {
            resumeRewriteRepository.deleteAll(rewrites);
            log.info("Deleted {} rewrite records for resumeId={}", rewrites.size(), id);
        }

        resumeRepository.delete(resume);
        log.info("Resume deleted: id={}, filename={}", id, resume.getOriginalFilename());
    }
}
