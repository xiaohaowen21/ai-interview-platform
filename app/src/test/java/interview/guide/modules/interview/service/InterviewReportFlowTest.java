package interview.guide.modules.interview.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.common.model.AsyncTaskStatus;
import interview.guide.infrastructure.redis.InterviewSessionCache;
import interview.guide.infrastructure.redis.InterviewSessionCache.CachedSession;
import interview.guide.modules.interview.listener.EvaluateStreamProducer;
import interview.guide.modules.interview.model.CreateInterviewRequest;
import interview.guide.modules.interview.model.InterviewAnswerEntity;
import interview.guide.modules.interview.model.InterviewMode;
import interview.guide.modules.interview.model.InterviewReportDTO;
import interview.guide.modules.interview.model.InterviewSessionDTO.SessionStatus;
import interview.guide.modules.interview.model.InterviewSessionEntity;
import interview.guide.modules.resume.model.ResumeEntity;
import interview.guide.modules.resume.repository.ResumeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 面试报告不重复评估、创建面试只用库里的简历
 */
@DisplayName("面试报告与创建流程测试")
class InterviewReportFlowTest {

    private static final String USER_ID = "7";
    private static final String SESSION_ID = "s1";
    private static final long RESUME_ID = 3L;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private InterviewQuestionService questionService;
    private AnswerEvaluationService evaluationService;
    private InterviewPersistenceService persistenceService;
    private ResumeRepository resumeRepository;
    private InterviewSessionCache sessionCache;
    private InterviewSessionService service;

    @BeforeEach
    void setUp() {
        questionService = mock(InterviewQuestionService.class);
        evaluationService = mock(AnswerEvaluationService.class);
        persistenceService = mock(InterviewPersistenceService.class);
        resumeRepository = mock(ResumeRepository.class);
        sessionCache = mock(InterviewSessionCache.class);
        service = new InterviewSessionService(
            questionService,
            evaluationService,
            persistenceService,
            resumeRepository,
            sessionCache,
            objectMapper,
            mock(EvaluateStreamProducer.class),
            mock(InterviewDialogueAiService.class)
        );

        ResumeEntity resume = new ResumeEntity();
        resume.setUserId(USER_ID);
        resume.setResumeText("库里的简历内容");
        when(resumeRepository.findByIdAndUserId(RESUME_ID, USER_ID)).thenReturn(Optional.of(resume));
        when(sessionCache.getSession(SESSION_ID)).thenReturn(Optional.of(new CachedSession(
            SESSION_ID, "库里的简历内容", RESUME_ID, List.of(), 0, SessionStatus.COMPLETED,
            objectMapper, InterviewMode.ORAL, null
        )));
    }

    private InterviewSessionEntity storedSession(AsyncTaskStatus evaluateStatus, boolean evaluated) {
        InterviewSessionEntity entity = new InterviewSessionEntity();
        entity.setSessionId(SESSION_ID);
        entity.setTotalQuestions(2);
        entity.setEvaluateStatus(evaluateStatus);
        if (evaluated) {
            entity.setStatus(InterviewSessionEntity.SessionStatus.EVALUATED);
            entity.setOverallScore(80);
            entity.setOverallFeedback("整体不错");
            entity.setStrengthsJson("[\"表达清楚\"]");
            entity.setImprovementsJson("[\"多举例\"]");
            entity.setReferenceAnswersJson("[]");
        } else {
            entity.setStatus(InterviewSessionEntity.SessionStatus.COMPLETED);
        }
        when(persistenceService.findBySessionIdAndUserId(SESSION_ID, USER_ID)).thenReturn(Optional.of(entity));
        return entity;
    }

    private InterviewAnswerEntity answer(int index, String category, int score) {
        InterviewAnswerEntity answer = new InterviewAnswerEntity();
        answer.setQuestionIndex(index);
        answer.setQuestion("问题" + index);
        answer.setCategory(category);
        answer.setUserAnswer("回答" + index);
        answer.setScore(score);
        answer.setFeedback("点评" + index);
        return answer;
    }

    @Test
    @DisplayName("已评估的面试直接返回保存的报告，不再调用 AI")
    void returnsStoredReportWithoutReEvaluating() {
        storedSession(AsyncTaskStatus.COMPLETED, true);
        when(persistenceService.findAnswersBySessionId(SESSION_ID))
            .thenReturn(List.of(answer(0, "项目", 70), answer(1, "项目", 90)));

        InterviewReportDTO report = service.generateReport(USER_ID, SESSION_ID);

        assertEquals(80, report.overallScore());
        assertEquals("整体不错", report.overallFeedback());
        assertEquals(List.of("表达清楚"), report.strengths());
        assertEquals(2, report.questionDetails().size());
        assertEquals(1, report.categoryScores().size());
        assertEquals(80, report.categoryScores().get(0).score());
        verifyNoInteractions(evaluationService);
    }

    @Test
    @DisplayName("后台评估还在进行时提示稍候，不再同步评估")
    void tellsCallerToWaitWhileEvaluationRuns() {
        storedSession(AsyncTaskStatus.PROCESSING, false);

        BusinessException exception = assertThrows(
            BusinessException.class,
            () -> service.generateReport(USER_ID, SESSION_ID)
        );

        assertEquals(ErrorCode.INTERVIEW_EVALUATION_IN_PROGRESS.getCode(), exception.getCode());
        verifyNoInteractions(evaluationService);
    }

    @Test
    @DisplayName("后台评估失败时同步重新评估")
    void evaluatesAgainWhenBackgroundEvaluationFailed() {
        storedSession(AsyncTaskStatus.FAILED, false);
        InterviewReportDTO fresh = new InterviewReportDTO(
            SESSION_ID, 0, 66, List.of(), List.of(), "重评", List.of(), List.of(), List.of()
        );
        when(evaluationService.evaluateInterview(eq(SESSION_ID), anyString(), anyList())).thenReturn(fresh);

        InterviewReportDTO report = service.generateReport(USER_ID, SESSION_ID);

        assertEquals(66, report.overallScore());
        verify(persistenceService).saveReport(SESSION_ID, fresh);
        verify(persistenceService).updateEvaluateStatus(SESSION_ID, AsyncTaskStatus.COMPLETED, null);
    }

    @Test
    @DisplayName("创建面试用库里的简历出题，忽略前端传来的文本")
    void createSessionUsesStoredResumeText() {
        when(sessionCache.findUnfinishedSessionId(anyLong(), any())).thenReturn(Optional.empty());
        when(persistenceService.findUnfinishedSession(anyLong(), any())).thenReturn(Optional.empty());
        when(questionService.generateQuestions(anyString(), anyInt(), any())).thenReturn(List.of());

        service.createSession(USER_ID, new CreateInterviewRequest(
            "前端随便传的文本", 5, RESUME_ID, false, InterviewMode.WRITTEN, null
        ));

        verify(questionService).generateQuestions(eq("库里的简历内容"), eq(5), any());
    }

    @Test
    @DisplayName("创建面试必须带简历且题目数在 1 到 20 之间")
    void createSessionValidatesRequest() {
        assertThrows(BusinessException.class, () -> service.createSession(USER_ID, new CreateInterviewRequest(
            "文本", 5, null, false, InterviewMode.WRITTEN, null
        )));
        assertThrows(BusinessException.class, () -> service.createSession(USER_ID, new CreateInterviewRequest(
            null, 500, RESUME_ID, false, InterviewMode.WRITTEN, null
        )));
        assertThrows(BusinessException.class, () -> service.createSession("someone-else", new CreateInterviewRequest(
            null, 5, RESUME_ID, false, InterviewMode.WRITTEN, null
        )));
        verifyNoInteractions(questionService);
    }
}
