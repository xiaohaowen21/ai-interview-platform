package interview.guide.modules.interview.service;

import interview.guide.common.ai.AdminRuntimeAiInvoker;
import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.modules.interview.model.InterviewQuestionDTO;
import interview.guide.modules.interview.model.InterviewReportDTO;
import interview.guide.modules.interview.model.InterviewReportDTO.CategoryScore;
import interview.guide.modules.interview.model.InterviewReportDTO.QuestionEvaluation;
import interview.guide.modules.interview.model.InterviewReportDTO.ReferenceAnswer;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 答案评估服务
 * 评估用户回答并生成面试报告
 */
@Service
public class AnswerEvaluationService {
    
    private static final Logger log = LoggerFactory.getLogger(AnswerEvaluationService.class);
    private static final Set<String> GIVE_UP_ANSWER_TOKENS = Set.of(
        "不知道", "不清楚", "不太清楚", "不会", "没学过", "忘了", "忘记了", "不太会",
        "不太懂", "不会做", "答不上来", "答不出来", "没思路", "跳过", "不了解",
        "不熟", "无", "none", "no idea", "i don't know", "idk", "skip"
    );
    
    private final AdminRuntimeAiInvoker adminRuntimeAiInvoker;
    private final PromptTemplate systemPromptTemplate;
    private final PromptTemplate userPromptTemplate;
    private final BeanOutputConverter<EvaluationReportDTO> outputConverter;
    private final PromptTemplate summarySystemPromptTemplate;
    private final PromptTemplate summaryUserPromptTemplate;
    private final BeanOutputConverter<FinalSummaryDTO> summaryOutputConverter;
    private final int evaluationBatchSize;
    
    // 中间DTO用于接收AI响应
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record EvaluationReportDTO(
        int overallScore,
        String overallFeedback,
        List<String> strengths,
        List<String> improvements,
        @JsonAlias("questionDetails") List<QuestionEvaluationDTO> questionEvaluations,
        List<ReferenceAnswerDTO> referenceAnswers
    ) {}
    
    @JsonIgnoreProperties(ignoreUnknown = true)
    private record QuestionEvaluationDTO(
        int questionIndex,
        int score,
        String feedback,
        String referenceAnswer,
        List<String> keyPoints
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ReferenceAnswerDTO(
        int questionIndex,
        String referenceAnswer,
        List<String> keyPoints
    ) {}

    private record BatchEvaluationResult(
        int startIndex,
        int endIndex,
        EvaluationReportDTO report
    ) {}

    private record FinalSummaryDTO(
        String overallFeedback,
        List<String> strengths,
        List<String> improvements
    ) {}
    
    public AnswerEvaluationService(
            AdminRuntimeAiInvoker adminRuntimeAiInvoker,
            @Value("classpath:prompts/interview-evaluation-system.st") Resource systemPromptResource,
            @Value("classpath:prompts/interview-evaluation-user.st") Resource userPromptResource,
            @Value("classpath:prompts/interview-evaluation-summary-system.st") Resource summarySystemPromptResource,
            @Value("classpath:prompts/interview-evaluation-summary-user.st") Resource summaryUserPromptResource,
            @Value("${app.interview.evaluation.batch-size:8}") int evaluationBatchSize) throws IOException {
        this.adminRuntimeAiInvoker = adminRuntimeAiInvoker;
        this.systemPromptTemplate = new PromptTemplate(systemPromptResource.getContentAsString(StandardCharsets.UTF_8));
        this.userPromptTemplate = new PromptTemplate(userPromptResource.getContentAsString(StandardCharsets.UTF_8));
        this.outputConverter = new BeanOutputConverter<>(EvaluationReportDTO.class);
        this.summarySystemPromptTemplate = new PromptTemplate(summarySystemPromptResource.getContentAsString(StandardCharsets.UTF_8));
        this.summaryUserPromptTemplate = new PromptTemplate(summaryUserPromptResource.getContentAsString(StandardCharsets.UTF_8));
        this.summaryOutputConverter = new BeanOutputConverter<>(FinalSummaryDTO.class);
        this.evaluationBatchSize = Math.max(1, evaluationBatchSize);
    }
    
    /**
     * 评估完整面试并生成报告
     */
    public InterviewReportDTO evaluateInterview(String sessionId, String resumeText,
                                                 List<InterviewQuestionDTO> questions) {
        // AI辅助生成：DeepSeek-R1, 2026-05-05
        log.info("开始评估面试: {}, 共{}题", sessionId, questions.size());
        
        try {
            // 简历摘要（限制长度）
            String resumeSummary = resumeText.length() > 500 
                ? resumeText.substring(0, 500) + "..." 
                : resumeText;

            // 分批评估，避免单次上下文过大导致 token 超限
            List<BatchEvaluationResult> batchResults = evaluateInBatches(sessionId, resumeSummary, questions);

            List<QuestionEvaluationDTO> mergedEvaluations = mergeQuestionEvaluations(batchResults);
            String fallbackOverallFeedback = mergeOverallFeedback(batchResults);
            List<String> fallbackStrengths = mergeListItems(batchResults, true);
            List<String> fallbackImprovements = mergeListItems(batchResults, false);
            FinalSummaryDTO finalSummary = summarizeBatchResults(
                sessionId,
                resumeSummary,
                questions,
                mergedEvaluations,
                fallbackOverallFeedback,
                fallbackStrengths,
                fallbackImprovements
            );

            // 转换为业务对象
            return convertToReport(
                sessionId,
                mergedEvaluations,
                questions,
                finalSummary.overallFeedback(),
                finalSummary.strengths(),
                finalSummary.improvements()
            );
            
        } catch (BusinessException e) {
            // 重新抛出业务异常
            throw e;
        } catch (Exception e) {
            log.error("面试评估失败: {}", e.getMessage(), e);
            throw new BusinessException(ErrorCode.INTERVIEW_EVALUATION_FAILED, 
                "面试评估失败：" + e.getMessage());
        }
    }
    
    /**
     * 构建问答记录字符串
     */
    private String buildQARecords(List<InterviewQuestionDTO> questions) {
        StringBuilder sb = new StringBuilder();
        for (InterviewQuestionDTO q : questions) {
            sb.append(String.format("问题%d [%s]: %s\n", 
                q.questionIndex() + 1, q.category(), q.question()));
            sb.append(String.format("回答: %s\n\n", 
                q.userAnswer() != null ? q.userAnswer() : "(未回答)"));
        }
        return sb.toString();
    }

    private List<BatchEvaluationResult> evaluateInBatches(
        String sessionId,
        String resumeSummary,
        List<InterviewQuestionDTO> questions
    ) {
        List<BatchEvaluationResult> results = new ArrayList<>();
        for (int start = 0; start < questions.size(); start += evaluationBatchSize) {
            int end = Math.min(start + evaluationBatchSize, questions.size());
            List<InterviewQuestionDTO> batchQuestions = questions.subList(start, end);
            EvaluationReportDTO report = evaluateBatch(sessionId, resumeSummary, batchQuestions, start, end);
            results.add(new BatchEvaluationResult(start, end, report));
        }
        return results;
    }

    private EvaluationReportDTO evaluateBatch(
        String sessionId,
        String resumeSummary,
        List<InterviewQuestionDTO> batchQuestions,
        int start,
        int end
    ) {
        String qaRecords = buildQARecords(batchQuestions);
        String systemPrompt = systemPromptTemplate.render();

        Map<String, Object> variables = new HashMap<>();
        variables.put("resumeText", resumeSummary);
        variables.put("qaRecords", qaRecords);
        String userPrompt = userPromptTemplate.render(variables);

        String systemPromptWithFormat = systemPrompt + "\n\n" + outputConverter.getFormat();
        try {
            EvaluationReportDTO dto = adminRuntimeAiInvoker.invokeStructured(
                systemPromptWithFormat,
                userPrompt,
                0.2,
                EvaluationReportDTO.class,
                ErrorCode.INTERVIEW_EVALUATION_FAILED,
                "面试评估失败：",
                "批次评估",
                log
            );
            log.debug("批次评估完成: sessionId={}, range=[{}, {}), batchSize={}",
                sessionId, start, end, batchQuestions.size());
            return dto;
        } catch (Exception e) {
            log.error("批次评估失败: sessionId={}, range=[{}, {}), error={}",
                sessionId, start, end, e.getMessage(), e);
            throw new BusinessException(ErrorCode.INTERVIEW_EVALUATION_FAILED, "面试评估失败：" + e.getMessage());
        }
    }

    private List<QuestionEvaluationDTO> mergeQuestionEvaluations(List<BatchEvaluationResult> batchResults) {
        List<QuestionEvaluationDTO> merged = new ArrayList<>();
        for (BatchEvaluationResult result : batchResults) {
            int expectedSize = result.endIndex() - result.startIndex();
            List<QuestionEvaluationDTO> current =
                result.report() != null && result.report().questionEvaluations() != null
                    ? result.report().questionEvaluations()
                    : List.of();
            Map<Integer, ReferenceAnswerDTO> legacyReferenceAnswers = buildReferenceAnswerMap(result.report());
            for (int i = 0; i < expectedSize; i++) {
                if (i < current.size() && current.get(i) != null) {
                    merged.add(mergeLegacyReferenceAnswer(
                        result.startIndex() + i,
                        current.get(i),
                        legacyReferenceAnswers
                    ));
                } else {
                    merged.add(new QuestionEvaluationDTO(
                        result.startIndex() + i,
                        0,
                        "该题未成功生成评估结果，系统按 0 分处理。",
                        "",
                        List.of()
                    ));
                }
            }
        }
        return merged;
    }

    private Map<Integer, ReferenceAnswerDTO> buildReferenceAnswerMap(EvaluationReportDTO report) {
        if (report == null || report.referenceAnswers() == null || report.referenceAnswers().isEmpty()) {
            return Map.of();
        }
        return report.referenceAnswers().stream()
            .filter(item -> item != null)
            .collect(Collectors.toMap(
                ReferenceAnswerDTO::questionIndex,
                item -> item,
                (left, right) -> left
            ));
    }

    private QuestionEvaluationDTO mergeLegacyReferenceAnswer(
        int fallbackQuestionIndex,
        QuestionEvaluationDTO evaluation,
        Map<Integer, ReferenceAnswerDTO> legacyReferenceAnswers
    ) {
        if (evaluation == null || legacyReferenceAnswers.isEmpty()) {
            return evaluation;
        }
        if ((evaluation.referenceAnswer() != null && !evaluation.referenceAnswer().isBlank())
            || (evaluation.keyPoints() != null && !evaluation.keyPoints().isEmpty())) {
            return evaluation;
        }

        ReferenceAnswerDTO referenceAnswer = legacyReferenceAnswers.get(evaluation.questionIndex());
        if (referenceAnswer == null) {
            referenceAnswer = legacyReferenceAnswers.get(fallbackQuestionIndex);
        }
        if (referenceAnswer == null) {
            return evaluation;
        }

        return new QuestionEvaluationDTO(
            evaluation.questionIndex(),
            evaluation.score(),
            evaluation.feedback(),
            referenceAnswer.referenceAnswer(),
            referenceAnswer.keyPoints()
        );
    }

    private String mergeOverallFeedback(List<BatchEvaluationResult> batchResults) {
        String feedback = batchResults.stream()
            .map(BatchEvaluationResult::report)
            .filter(r -> r != null && r.overallFeedback() != null && !r.overallFeedback().isBlank())
            .map(EvaluationReportDTO::overallFeedback)
            .collect(Collectors.joining("\n\n"));
        if (!feedback.isBlank()) {
            return feedback;
        }
        return "本次面试已完成分批评估，但未生成有效综合评语。";
    }

    private List<String> mergeListItems(List<BatchEvaluationResult> batchResults, boolean strengthsMode) {
        Set<String> merged = new LinkedHashSet<>();
        for (BatchEvaluationResult result : batchResults) {
            EvaluationReportDTO report = result.report();
            if (report == null) {
                continue;
            }
            List<String> items = strengthsMode ? report.strengths() : report.improvements();
            if (items == null) {
                continue;
            }
            items.stream()
                .filter(item -> item != null && !item.isBlank())
                .map(String::trim)
                .forEach(merged::add);
        }
        return merged.stream().limit(8).toList();
    }

    private FinalSummaryDTO summarizeBatchResults(
        String sessionId,
        String resumeSummary,
        List<InterviewQuestionDTO> questions,
        List<QuestionEvaluationDTO> evaluations,
        String fallbackOverallFeedback,
        List<String> fallbackStrengths,
        List<String> fallbackImprovements
    ) {
        try {
            String summarySystemPrompt = summarySystemPromptTemplate.render();
            Map<String, Object> variables = new HashMap<>();
            variables.put("resumeText", resumeSummary);
            variables.put("categorySummary", buildCategorySummary(questions, evaluations));
            variables.put("questionHighlights", buildQuestionHighlights(questions, evaluations));
            variables.put("fallbackOverallFeedback", fallbackOverallFeedback);
            variables.put("fallbackStrengths", String.join("\n", fallbackStrengths));
            variables.put("fallbackImprovements", String.join("\n", fallbackImprovements));
            String summaryUserPrompt = summaryUserPromptTemplate.render(variables);

            String systemPromptWithFormat = summarySystemPrompt + "\n\n" + summaryOutputConverter.getFormat();
            FinalSummaryDTO dto = adminRuntimeAiInvoker.invokeStructured(
                systemPromptWithFormat,
                summaryUserPrompt,
                0.2,
                FinalSummaryDTO.class,
                ErrorCode.INTERVIEW_EVALUATION_FAILED,
                "面试总结失败：",
                "总结评估",
                log
            );

            String overallFeedback = dto != null && dto.overallFeedback() != null && !dto.overallFeedback().isBlank()
                ? dto.overallFeedback()
                : fallbackOverallFeedback;
            List<String> strengths = sanitizeSummaryItems(
                dto != null ? dto.strengths() : null,
                fallbackStrengths
            );
            List<String> improvements = sanitizeSummaryItems(
                dto != null ? dto.improvements() : null,
                fallbackImprovements
            );

            log.debug("二次汇总评估完成: sessionId={}", sessionId);
            return new FinalSummaryDTO(overallFeedback, strengths, improvements);
        } catch (Exception e) {
            log.warn("二次汇总评估失败，降级到批次聚合结果: sessionId={}, error={}", sessionId, e.getMessage());
            return new FinalSummaryDTO(
                fallbackOverallFeedback,
                fallbackStrengths,
                fallbackImprovements
            );
        }
    }

    private List<String> sanitizeSummaryItems(List<String> primary, List<String> fallback) {
        List<String> source = (primary != null && !primary.isEmpty()) ? primary : fallback;
        if (source == null || source.isEmpty()) {
            return List.of();
        }
        return source.stream()
            .filter(item -> item != null && !item.isBlank())
            .map(String::trim)
            .distinct()
            .limit(8)
            .toList();
    }

    private String buildCategorySummary(List<InterviewQuestionDTO> questions, List<QuestionEvaluationDTO> evaluations) {
        Map<String, List<Integer>> categoryScores = new HashMap<>();
        for (int i = 0; i < questions.size(); i++) {
            InterviewQuestionDTO q = questions.get(i);
            QuestionEvaluationDTO eval = i < evaluations.size() ? evaluations.get(i) : null;
            int score = resolveQuestionScore(q, eval);
            categoryScores.computeIfAbsent(q.category(), k -> new ArrayList<>()).add(score);
        }

        return categoryScores.entrySet().stream()
            .map(entry -> {
                int count = entry.getValue().size();
                int avg = (int) entry.getValue().stream().mapToInt(Integer::intValue).average().orElse(0);
                return String.format("- %s: 平均分 %d, 题数 %d", entry.getKey(), avg, count);
            })
            .sorted()
            .collect(Collectors.joining("\n"));
    }

    private String buildQuestionHighlights(List<InterviewQuestionDTO> questions, List<QuestionEvaluationDTO> evaluations) {
        List<String> highlights = new ArrayList<>();
        for (int i = 0; i < questions.size(); i++) {
            InterviewQuestionDTO q = questions.get(i);
            QuestionEvaluationDTO eval = i < evaluations.size() ? evaluations.get(i) : null;
            int score = resolveQuestionScore(q, eval);
            String feedback = eval != null && eval.feedback() != null ? eval.feedback() : "";
            String questionText = q.question() != null ? q.question() : "";
            String shortQuestion = questionText.length() > 50 ? questionText.substring(0, 50) + "..." : questionText;
            String shortFeedback = feedback.length() > 80 ? feedback.substring(0, 80) + "..." : feedback;
            highlights.add(String.format("- Q%d | %s | 分数:%d | 反馈:%s",
                q.questionIndex() + 1, shortQuestion, score, shortFeedback));
        }
        return highlights.stream().limit(20).collect(Collectors.joining("\n"));
    }
    
    /**
     * 转换DTO为业务对象
     */
    private InterviewReportDTO convertToReport(
        String sessionId,
        List<QuestionEvaluationDTO> evaluations,
        List<InterviewQuestionDTO> questions,
        String overallFeedback,
        List<String> strengths,
        List<String> improvements
    ) {
        List<QuestionEvaluation> questionDetails = new ArrayList<>();
        List<ReferenceAnswer> referenceAnswers = new ArrayList<>();
        Map<String, List<Integer>> categoryScoresMap = new HashMap<>();

        // 统计实际回答的问题数量
        long answeredCount = questions.stream()
            .filter(q -> q.userAnswer() != null && !q.userAnswer().isBlank())
            .count();

        // 处理问题评估（防御性编程：AI 响应解析后可能为 null）
        int evaluationsSize = evaluations != null ? evaluations.size() : 0;
        if (evaluations == null || evaluations.isEmpty()) {
            log.warn("面试评估结果解析异常：问题评估列表为空，sessionId={}", sessionId);
        }
        for (int i = 0; i < questions.size(); i++) {
            QuestionEvaluationDTO eval = i < evaluationsSize ? evaluations.get(i) : null;
            InterviewQuestionDTO q = questions.get(i);
            int qIndex = q.questionIndex();
            String feedback = eval != null && eval.feedback() != null
                ? eval.feedback()
                : "该题未成功生成评估反馈。";
            String referenceAnswer = eval != null && eval.referenceAnswer() != null
                ? eval.referenceAnswer()
                : "";
            List<String> keyPoints = eval != null && eval.keyPoints() != null
                ? eval.keyPoints()
                : List.of();

            boolean giveUpAnswer = isGiveUpAnswer(q.userAnswer());
            int score = resolveQuestionScore(q, eval);
            if (giveUpAnswer) {
                feedback = "候选人明确表示不会或不清楚，该题按 0 分处理。";
            }

            questionDetails.add(new QuestionEvaluation(
                qIndex, q.question(), q.category(),
                q.userAnswer(), score, feedback
            ));

            referenceAnswers.add(new ReferenceAnswer(
                qIndex, q.question(),
                referenceAnswer,
                keyPoints
            ));

            // 收集类别分数
            categoryScoresMap
                .computeIfAbsent(q.category(), k -> new ArrayList<>())
                .add(score);
        }

        // 计算各类别平均分
        List<CategoryScore> categoryScores = categoryScoresMap.entrySet().stream()
            .map(e -> new CategoryScore(
                e.getKey(),
                (int) e.getValue().stream().mapToInt(Integer::intValue).average().orElse(0),
                e.getValue().size()
            ))
            .collect(Collectors.toList());

        // 计算总分：基于实际得分，而非 AI 返回值
        // 如果所有问题都未回答，总分为 0
        int overallScore;
        if (answeredCount == 0) {
            overallScore = 0;
        } else {
            // 使用问题详情中的分数计算平均值
            overallScore = (int) questionDetails.stream()
                .mapToInt(QuestionEvaluation::score)
                .average()
                .orElse(0);
        }

        return new InterviewReportDTO(
            sessionId,
            questions.size(),
            overallScore,
            categoryScores,
            questionDetails,
            overallFeedback,
            strengths != null ? strengths : List.of(),
            improvements != null ? improvements : List.of(),
            referenceAnswers
        );
    }

    private int resolveQuestionScore(InterviewQuestionDTO question, QuestionEvaluationDTO evaluation) {
        if (question == null) {
            return 0;
        }

        String userAnswer = question.userAnswer();
        if (userAnswer == null || userAnswer.isBlank() || isGiveUpAnswer(userAnswer) || evaluation == null) {
            return 0;
        }

        return normalizeScore(evaluation.score());
    }

    private int normalizeScore(int score) {
        return Math.max(0, Math.min(100, score));
    }

    private boolean isGiveUpAnswer(String answer) {
        if (answer == null) {
            return false;
        }

        String normalized = answer
            .trim()
            .toLowerCase()
            .replaceAll("[\\p{Punct}\\p{IsPunctuation}\\s]+", "");

        if (normalized.isBlank()) {
            return false;
        }

        return GIVE_UP_ANSWER_TOKENS.stream()
            .map(token -> token.toLowerCase().replaceAll("[\\p{Punct}\\p{IsPunctuation}\\s]+", ""))
            .anyMatch(normalized::contains);
    }
}
