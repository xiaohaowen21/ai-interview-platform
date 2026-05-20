package interview.guide.modules.resume.service;

import interview.guide.common.ai.AiErrorMessageHelper;
import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.common.model.AsyncTaskStatus;
import interview.guide.infrastructure.export.PdfExportService;
import interview.guide.modules.interview.model.ResumeAnalysisResponse;
import interview.guide.modules.resume.model.*;
import interview.guide.modules.resume.repository.ResumeRewriteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResumeRewriteService {

    private final ResumePersistenceService resumePersistenceService;
    private final ResumeRewriteRepository resumeRewriteRepository;
    private final ResumeRewriteAiService resumeRewriteAiService;
    private final PdfExportService pdfExportService;
    private final ObjectMapper objectMapper;

    public List<ResumeRewriteDTO> listByResume(String userId, Long resumeId) {
        ensureResumeOwner(userId, resumeId);
        return resumeRewriteRepository.findByResumeIdAndUserIdOrderByUpdatedAtDesc(resumeId, userId).stream()
            .map(this::toDto)
            .toList();
    }

    public ResumeRewriteDTO getById(String userId, Long rewriteId) {
        ResumeRewriteEntity entity = resumeRewriteRepository.findByIdAndUserId(rewriteId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_REWRITE_NOT_FOUND));
        return toDto(entity);
    }

    @Transactional(rollbackFor = Exception.class)
    public ResumeRewriteDTO generate(String userId, Long resumeId, ResumeRewriteGenerateRequest request) {
        ResumeEntity resume = resumePersistenceService.findById(resumeId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_NOT_FOUND));

        ResumeRewriteEntity entity = new ResumeRewriteEntity();
        entity.setResume(resume);
        entity.setUserId(userId);
        entity.setJobDescription(normalizeJobDescription(request == null ? null : request.jobDescription()));
        entity.setSourceResumeText(resume.getResumeText());
        entity.setStatus(AsyncTaskStatus.PROCESSING);
        entity = resumeRewriteRepository.save(entity);

        try {
            ResumeAnalysisResponse latestAnalysis = resumePersistenceService.getLatestAnalysisAsDTO(resumeId).orElse(null);
            ResumeRewriteContentDTO content = normalizeContent(
                resumeRewriteAiService.generateContent(resume, latestAnalysis, entity.getJobDescription())
            );

            entity.setRewriteJson(writeContent(content));
            entity.setStatus(AsyncTaskStatus.COMPLETED);
            entity.setErrorMessage(null);
            return toDto(resumeRewriteRepository.save(entity));
        } catch (Exception exception) {
            String message = simplifyError(exception.getMessage());
            entity.setStatus(AsyncTaskStatus.FAILED);
            entity.setErrorMessage(message);
            resumeRewriteRepository.save(entity);
            throw exception instanceof BusinessException businessException
                ? businessException
                : new BusinessException(ErrorCode.RESUME_REWRITE_FAILED, message);
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public ResumeRewriteDTO update(String userId, Long rewriteId, ResumeRewriteUpdateRequest request) {
        ResumeRewriteEntity entity = resumeRewriteRepository.findByIdAndUserId(rewriteId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_REWRITE_NOT_FOUND));

        if (request == null || request.content() == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请提供要保存的优化版简历内容");
        }

        ResumeRewriteContentDTO normalized = normalizeContent(request.content());
        entity.setJobDescription(normalizeJobDescription(request.jobDescription()));
        entity.setRewriteJson(writeContent(normalized));
        entity.setStatus(AsyncTaskStatus.COMPLETED);
        entity.setErrorMessage(null);

        return toDto(resumeRewriteRepository.save(entity));
    }

    public ExportResult exportPdf(String userId, Long rewriteId) {
        ResumeRewriteEntity entity = resumeRewriteRepository.findByIdAndUserId(rewriteId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_REWRITE_NOT_FOUND));

        ResumeRewriteContentDTO content = readContent(entity);
        byte[] pdfBytes = pdfExportService.exportResumeRewrite(
            entity.getResume().getOriginalFilename(),
            normalizeJobDescription(entity.getJobDescription()),
            content
        );
        String filename = "优化简历_" + entity.getResume().getOriginalFilename() + ".pdf";
        return new ExportResult(pdfBytes, filename);
    }

    public void deleteByResumeId(Long resumeId) {
        List<ResumeRewriteEntity> rewrites = resumeRewriteRepository.findByResumeIdOrderByUpdatedAtDesc(resumeId);
        if (!rewrites.isEmpty()) {
            resumeRewriteRepository.deleteAll(rewrites);
            log.info("Deleted {} resume rewrite records for resumeId={}", rewrites.size(), resumeId);
        }
    }

    private void ensureResumeOwner(String userId, Long resumeId) {
        resumePersistenceService.findById(resumeId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_NOT_FOUND));
    }

    private ResumeRewriteDTO toDto(ResumeRewriteEntity entity) {
        ResumeRewriteContentDTO content = readContent(entity);
        return new ResumeRewriteDTO(
            entity.getId(),
            entity.getResume().getId(),
            entity.getResume().getOriginalFilename(),
            normalizeJobDescription(entity.getJobDescription()),
            entity.getStatus(),
            entity.getErrorMessage(),
            entity.getCreatedAt(),
            entity.getUpdatedAt(),
            content
        );
    }

    private ResumeRewriteContentDTO readContent(ResumeRewriteEntity entity) {
        if (entity.getRewriteJson() == null || entity.getRewriteJson().isBlank()) {
            return normalizeContent(null);
        }
        try {
            return normalizeContent(objectMapper.readValue(entity.getRewriteJson(), ResumeRewriteContentDTO.class));
        } catch (Exception exception) {
            throw new BusinessException(ErrorCode.RESUME_REWRITE_FAILED, "读取优化版简历内容失败");
        }
    }

    private String writeContent(ResumeRewriteContentDTO content) {
        try {
            return objectMapper.writeValueAsString(content);
        } catch (Exception exception) {
            throw new BusinessException(ErrorCode.RESUME_REWRITE_FAILED, "保存优化版简历内容失败");
        }
    }

    private ResumeRewriteContentDTO normalizeContent(ResumeRewriteContentDTO content) {
        ResumeRewriteProfileDTO profile = content == null || content.profile() == null
            ? new ResumeRewriteProfileDTO("", "", "", "", "")
            : new ResumeRewriteProfileDTO(
                safe(content.profile().fullName()),
                safe(content.profile().phone()),
                safe(content.profile().email()),
                safe(content.profile().location()),
                safe(content.profile().links())
            );

        return new ResumeRewriteContentDTO(
            profile,
            content == null ? "" : safe(content.targetPosition()),
            content == null ? "" : safe(content.professionalSummary()),
            normalizeStringList(content == null ? null : content.coreSkills()),
            normalizeSectionItems(content == null ? null : content.workExperiences()),
            normalizeSectionItems(content == null ? null : content.projectExperiences()),
            normalizeSectionItems(content == null ? null : content.educationExperiences()),
            normalizeStringList(content == null ? null : content.certifications()),
            normalizeStringList(content == null ? null : content.additionalInformation()),
            normalizeStringList(content == null ? null : content.optimizationHighlights())
        );
    }

    private List<String> normalizeStringList(List<String> values) {
        if (values == null) {
            return new ArrayList<>();
        }
        return values.stream()
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(value -> !value.isEmpty())
            .toList();
    }

    private List<ResumeRewriteSectionItemDTO> normalizeSectionItems(List<ResumeRewriteSectionItemDTO> values) {
        if (values == null) {
            return new ArrayList<>();
        }
        return values.stream()
            .filter(Objects::nonNull)
            .map(item -> new ResumeRewriteSectionItemDTO(
                safe(item.title()),
                safe(item.subtitle()),
                safe(item.period()),
                normalizeStringList(item.highlights())
            ))
            .toList();
    }

    private String normalizeJobDescription(String jobDescription) {
        return jobDescription == null ? "" : jobDescription.trim();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String simplifyError(String value) {
        return AiErrorMessageHelper.toUserMessage(
            value,
            "简历优化失败，请稍后重试；如持续失败请联系管理员。"
        );
    }

    public record ExportResult(byte[] pdfBytes, String filename) {
    }
}
