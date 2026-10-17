package interview.guide.modules.resume.service;

import interview.guide.infrastructure.export.PdfExportService;
import interview.guide.infrastructure.mapper.InterviewMapper;
import interview.guide.infrastructure.mapper.ResumeMapper;
import interview.guide.modules.interview.model.InterviewMode;
import interview.guide.modules.interview.service.InterviewPersistenceService;
import interview.guide.modules.resume.model.ResumeEntity;
import interview.guide.modules.resume.model.ResumeListItemDTO;
import interview.guide.modules.resume.repository.ResumeAnalysisRepository.LatestAnalysisSummary;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 简历列表只用批量查询取评分和面试次数，不再逐份简历查库
 */
@DisplayName("简历列表批量查询测试")
class ResumeHistoryServiceListTest {

    @Test
    @DisplayName("评分和面试次数来自批量查询，缺失时为空或 0")
    void listsResumesWithBatchedLookups() {
        ResumePersistenceService resumePersistence = mock(ResumePersistenceService.class);
        InterviewPersistenceService interviewPersistence = mock(InterviewPersistenceService.class);
        ResumeHistoryService service = new ResumeHistoryService(
            resumePersistence,
            interviewPersistence,
            mock(PdfExportService.class),
            new ObjectMapper(),
            mock(ResumeMapper.class),
            mock(InterviewMapper.class)
        );

        ResumeEntity analyzed = resume(1L);
        ResumeEntity fresh = resume(2L);
        LocalDateTime analyzedAt = LocalDateTime.of(2026, 10, 1, 9, 0);
        when(resumePersistence.findAllResumes("u1")).thenReturn(List.of(analyzed, fresh));
        when(resumePersistence.getLatestAnalysisSummaries(List.of(1L, 2L)))
            .thenReturn(Map.of(1L, summary(1L, 88, analyzedAt)));
        when(interviewPersistence.countSessionsByResumeIds(List.of(1L, 2L), InterviewMode.WRITTEN))
            .thenReturn(Map.of(1L, 3L));

        List<ResumeListItemDTO> items = service.getAllResumes("u1");

        assertEquals(2, items.size());
        assertEquals(88, items.get(0).latestScore());
        assertEquals(analyzedAt, items.get(0).lastAnalyzedAt());
        assertEquals(3, items.get(0).interviewCount());
        assertNull(items.get(1).latestScore());
        assertNull(items.get(1).lastAnalyzedAt());
        assertEquals(0, items.get(1).interviewCount());

        verify(resumePersistence, never()).getLatestAnalysis(anyLong());
        verify(interviewPersistence, never()).findByResumeIdAndMode(anyLong(), any());
    }

    private static ResumeEntity resume(Long id) {
        ResumeEntity resume = new ResumeEntity();
        resume.setId(id);
        resume.setOriginalFilename("resume-" + id + ".pdf");
        return resume;
    }

    private static LatestAnalysisSummary summary(Long resumeId, Integer score, LocalDateTime analyzedAt) {
        return new LatestAnalysisSummary() {
            public Long getResumeId() { return resumeId; }
            public Long getId() { return resumeId * 10; }
            public Integer getOverallScore() { return score; }
            public LocalDateTime getAnalyzedAt() { return analyzedAt; }
        };
    }
}
