package interview.guide.modules.interview.service;

import interview.guide.common.ai.AdminRuntimeAiInvoker;
import interview.guide.common.exception.ErrorCode;
import interview.guide.modules.interview.model.InterviewQuestionDTO;
import interview.guide.modules.interview.model.InterviewQuestionDTO.QuestionType;
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
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Generates the interview blueprint: main questions plus optional follow-up candidates.
 */
@Service
public class InterviewQuestionService {

    private static final Logger log = LoggerFactory.getLogger(InterviewQuestionService.class);
    private static final int MAX_FOLLOW_UP_COUNT = 2;
    private static final double QUESTION_SIMILARITY_THRESHOLD = 0.82;
    private static final int MIN_CONTAINMENT_LENGTH = 10;

    private final AdminRuntimeAiInvoker adminRuntimeAiInvoker;
    private final PromptTemplate systemPromptTemplate;
    private final PromptTemplate userPromptTemplate;
    private final BeanOutputConverter<QuestionListDTO> outputConverter;
    private final int followUpCount;

    private record QuestionListDTO(List<QuestionDTO> questions) {
    }

    private record QuestionDTO(
        String question,
        String type,
        String category,
        List<String> followUps
    ) {
    }

    public InterviewQuestionService(
        AdminRuntimeAiInvoker adminRuntimeAiInvoker,
        @Value("classpath:prompts/interview-question-system.st") Resource systemPromptResource,
        @Value("classpath:prompts/interview-question-user.st") Resource userPromptResource,
        @Value("${app.interview.follow-up-count:1}") int followUpCount
    ) throws IOException {
        this.adminRuntimeAiInvoker = adminRuntimeAiInvoker;
        this.systemPromptTemplate = new PromptTemplate(systemPromptResource.getContentAsString(StandardCharsets.UTF_8));
        this.userPromptTemplate = new PromptTemplate(userPromptResource.getContentAsString(StandardCharsets.UTF_8));
        this.outputConverter = new BeanOutputConverter<>(QuestionListDTO.class);
        this.followUpCount = Math.max(0, Math.min(followUpCount, MAX_FOLLOW_UP_COUNT));
    }

    public List<InterviewQuestionDTO> generateQuestions(String resumeText, int questionCount, List<String> historicalQuestions) {
        // AI辅助生成：DeepSeek-R1, 2026-05-05
        log.info(
            "Generating interview questions, resumeLength={}, questionCount={}, historyCount={}",
            resumeText.length(),
            questionCount,
            historicalQuestions == null ? 0 : historicalQuestions.size()
        );

        try {
            String systemPrompt = systemPromptTemplate.render();

            Map<String, Object> variables = new HashMap<>();
            variables.put("questionCount", questionCount);
            variables.put("mainQuestionCount", questionCount);
            variables.put("followUpCount", followUpCount);
            variables.put("resumeText", resumeText);
            variables.put(
                "historicalQuestions",
                historicalQuestions != null && !historicalQuestions.isEmpty()
                    ? String.join("\n", historicalQuestions)
                    : "暂无历史提问"
            );

            String userPrompt = userPromptTemplate.render(variables);
            String systemPromptWithFormat = systemPrompt + "\n\n" + outputConverter.getFormat();

            QuestionListDTO dto = adminRuntimeAiInvoker.invokeStructured(
                systemPromptWithFormat,
                userPrompt,
                0.2,
                QuestionListDTO.class,
                ErrorCode.INTERVIEW_QUESTION_GENERATION_FAILED,
                "面试问题生成失败：",
                "面试问题生成",
                log
            );

            List<InterviewQuestionDTO> questions = convertToQuestions(dto, historicalQuestions);
            List<InterviewQuestionDTO> normalizedQuestions = normalizeQuestionCount(questions, questionCount);
            log.info("Generated {} interview questions", normalizedQuestions.size());
            return normalizedQuestions;
        } catch (Exception exception) {
            log.error("Failed to generate interview questions", exception);
            return normalizeQuestionCount(generateDefaultQuestions(questionCount), questionCount);
        }
    }

    public List<InterviewQuestionDTO> generateQuestions(String resumeText, int questionCount) {
        return generateQuestions(resumeText, questionCount, null);
    }

    private List<InterviewQuestionDTO> convertToQuestions(QuestionListDTO dto, List<String> historicalQuestions) {
        List<InterviewQuestionDTO> questions = new ArrayList<>();
        if (dto == null || dto.questions() == null) {
            return questions;
        }

        List<String> seenQuestions = new ArrayList<>();
        if (historicalQuestions != null) {
            historicalQuestions.stream()
                .filter(item -> item != null && !item.isBlank())
                .map(String::trim)
                .forEach(seenQuestions::add);
        }

        int index = 0;
        for (QuestionDTO questionDTO : dto.questions()) {
            if (questionDTO == null) {
                continue;
            }

            String mainQuestion = sanitizeQuestion(questionDTO.question());
            if (mainQuestion == null || isDuplicateQuestion(mainQuestion, seenQuestions)) {
                continue;
            }

            QuestionType type = parseQuestionType(questionDTO.type());
            String category = sanitizeCategory(questionDTO.category());
            List<String> followUps = sanitizeFollowUps(questionDTO.followUps(), mainQuestion);

            questions.add(InterviewQuestionDTO.create(index++, mainQuestion, type, category, followUps));
            seenQuestions.add(mainQuestion);
        }

        return questions;
    }

    private QuestionType parseQuestionType(String typeStr) {
        if (typeStr == null || typeStr.isBlank()) {
            return QuestionType.PROJECT;
        }
        try {
            return QuestionType.valueOf(typeStr.trim().toUpperCase(Locale.ROOT));
        } catch (Exception exception) {
            return QuestionType.PROJECT;
        }
    }

    private String sanitizeCategory(String category) {
        if (category == null || category.isBlank()) {
            return "岗位相关";
        }
        return category.trim();
    }

    private String sanitizeQuestion(String question) {
        if (question == null || question.isBlank()) {
            return null;
        }
        return question.trim().replaceAll("\\s+", " ");
    }

    private List<String> sanitizeFollowUps(List<String> followUps, String mainQuestion) {
        if (followUpCount == 0 || followUps == null || followUps.isEmpty()) {
            return List.of();
        }

        List<String> sanitized = new ArrayList<>();
        for (String followUp : followUps) {
            String normalized = sanitizeQuestion(followUp);
            if (normalized == null || isQuestionSimilar(normalized, mainQuestion)) {
                continue;
            }
            boolean duplicate = sanitized.stream().anyMatch(existing -> isQuestionSimilar(existing, normalized));
            if (duplicate) {
                continue;
            }
            sanitized.add(normalized);
            if (sanitized.size() >= followUpCount) {
                break;
            }
        }
        return sanitized;
    }

    private boolean isDuplicateQuestion(String question, List<String> existingQuestions) {
        return existingQuestions.stream().anyMatch(existing -> isQuestionSimilar(question, existing));
    }

    private boolean isQuestionSimilar(String left, String right) {
        String normalizedLeft = normalizeQuestion(left);
        String normalizedRight = normalizeQuestion(right);
        if (normalizedLeft.isBlank() || normalizedRight.isBlank()) {
            return false;
        }
        if (normalizedLeft.equals(normalizedRight)) {
            return true;
        }
        if (normalizedLeft.length() >= MIN_CONTAINMENT_LENGTH
            && normalizedRight.length() >= MIN_CONTAINMENT_LENGTH
            && (normalizedLeft.contains(normalizedRight) || normalizedRight.contains(normalizedLeft))) {
            return true;
        }
        return calculateDiceCoefficient(normalizedLeft, normalizedRight) >= QUESTION_SIMILARITY_THRESHOLD;
    }

    private String normalizeQuestion(String question) {
        return question == null
            ? ""
            : question.toLowerCase(Locale.ROOT).replaceAll("[\\p{Punct}\\p{IsPunctuation}\\s]+", "");
    }

    private double calculateDiceCoefficient(String left, String right) {
        Set<String> leftBigrams = extractBigrams(left);
        Set<String> rightBigrams = extractBigrams(right);
        if (leftBigrams.isEmpty() || rightBigrams.isEmpty()) {
            return 0;
        }

        long intersection = leftBigrams.stream().filter(rightBigrams::contains).count();
        return (2.0 * intersection) / (leftBigrams.size() + rightBigrams.size());
    }

    private Set<String> extractBigrams(String text) {
        if (text == null || text.isBlank()) {
            return Set.of();
        }
        if (text.length() == 1) {
            return Set.of(text);
        }

        Set<String> bigrams = new LinkedHashSet<>();
        for (int index = 0; index < text.length() - 1; index++) {
            bigrams.add(text.substring(index, index + 2));
        }
        return bigrams;
    }

    private List<InterviewQuestionDTO> generateDefaultQuestions(int count) {
        List<InterviewQuestionDTO> questions = new ArrayList<>();
        List<DefaultQuestion> defaults = List.of(
            new DefaultQuestion(
                "请挑选简历里与你目标岗位最相关的一段经历，说明背景、目标、你的职责和最终结果。",
                QuestionType.PROJECT,
                "项目经历",
                List.of("这个项目里哪一个关键决策最能体现你的判断力？", "如果再做一次，你最想优化哪一部分？")
            ),
            new DefaultQuestion(
                "在这段经历中，最能体现岗位核心能力的一次判断是什么？你为什么这样做？",
                QuestionType.ROLE_KNOWLEDGE,
                "岗位知识",
                List.of("当时有哪些可选方案，你为什么没有选其他方案？", "这个判断最终带来了什么结果？")
            ),
            new DefaultQuestion(
                "你通常如何判断一个方案是否真正有效？会优先关注哪些指标或结果？",
                QuestionType.PROFESSIONAL_BASICS,
                "专业基础",
                List.of("如果关键指标没有达到预期，你会如何排查原因？")
            ),
            new DefaultQuestion(
                "当业务目标、时间和资源出现冲突时，你会如何拆解优先级并推进落地？",
                QuestionType.SCENARIO_ANALYSIS,
                "场景分析",
                List.of("请结合一次真实经历说明你的取舍过程。")
            ),
            new DefaultQuestion(
                "请复盘一次你亲自处理过的复杂问题或异常：你如何定位、验证并解决？",
                QuestionType.PROBLEM_SOLVING,
                "问题解决",
                List.of("你当时是如何缩小问题范围的？", "事后你做了哪些预防措施？")
            ),
            new DefaultQuestion(
                "当你与同事、上级或上下游对方案存在分歧时，你通常如何沟通并推动达成一致？",
                QuestionType.COMMUNICATION,
                "沟通协作",
                List.of("有没有一次沟通失败后被你扭转的经历？")
            ),
            new DefaultQuestion(
                "如果让你重新做一次简历里最有代表性的项目，你最想优化的部分是什么？为什么？",
                QuestionType.PROJECT,
                "项目复盘",
                List.of("你会优先优化流程、结果还是协作方式？为什么？")
            ),
            new DefaultQuestion(
                "面对不熟悉的新任务时，你通常如何在较短时间内补齐知识并交付结果？",
                QuestionType.PROFESSIONAL_BASICS,
                "学习适应",
                List.of("请举一个你快速补齐短板的真实例子。")
            ),
            new DefaultQuestion(
                "你如何证明自己的工作对业务、客户或团队产生了实际价值？",
                QuestionType.ROLE_KNOWLEDGE,
                "业务价值",
                List.of("如果没有直接数据，你会如何侧面证明价值？")
            ),
            new DefaultQuestion(
                "如果现场出现突发变化或目标调整，你会怎样快速重排计划并控制风险？",
                QuestionType.SCENARIO_ANALYSIS,
                "变化应对",
                List.of("你如何在不确定条件下向团队同步和稳定预期？")
            )
        );

        int limit = Math.min(count, defaults.size());
        for (int index = 0; index < limit; index++) {
            DefaultQuestion question = defaults.get(index);
            questions.add(InterviewQuestionDTO.create(
                index,
                question.question(),
                question.type(),
                question.category(),
                question.followUps().stream().limit(followUpCount).toList()
            ));
        }
        return questions;
    }

    private List<InterviewQuestionDTO> normalizeQuestionCount(List<InterviewQuestionDTO> source, int expectedCount) {
        if (expectedCount <= 0) {
            return List.of();
        }

        List<InterviewQuestionDTO> normalized = new ArrayList<>();
        if (source != null) {
            for (InterviewQuestionDTO question : source) {
                if (question == null || question.question() == null || question.question().isBlank()) {
                    continue;
                }
                boolean duplicate = normalized.stream()
                    .anyMatch(existing -> isQuestionSimilar(existing.question(), question.question()));
                if (!duplicate) {
                    normalized.add(question);
                }
                if (normalized.size() >= expectedCount) {
                    break;
                }
            }
        }

        if (normalized.size() < expectedCount) {
            List<InterviewQuestionDTO> fallback = generateDefaultQuestions(expectedCount);
            for (InterviewQuestionDTO candidate : fallback) {
                if (normalized.size() >= expectedCount) {
                    break;
                }
                boolean duplicate = normalized.stream()
                    .anyMatch(existing -> isQuestionSimilar(existing.question(), candidate.question()));
                if (!duplicate) {
                    normalized.add(candidate);
                }
            }
        }

        List<InterviewQuestionDTO> reIndexed = new ArrayList<>(normalized.size());
        for (int index = 0; index < normalized.size(); index++) {
            InterviewQuestionDTO question = normalized.get(index);
            reIndexed.add(new InterviewQuestionDTO(
                index,
                question.question(),
                question.type(),
                question.category(),
                question.userAnswer(),
                question.score(),
                question.feedback(),
                false,
                null,
                question.followUpCandidates() == null ? List.of() : question.followUpCandidates()
            ));
        }
        return reIndexed;
    }

    private record DefaultQuestion(
        String question,
        QuestionType type,
        String category,
        List<String> followUps
    ) {
    }
}
