package interview.guide.modules.interview.service;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.lang.reflect.Method;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class AnswerEvaluationServiceCompatibilityTest {

    @Test
    void shouldReadLegacyQuestionDetailsIntoQuestionEvaluations() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        Class<?> dtoClass = Class.forName(
            "interview.guide.modules.interview.service.AnswerEvaluationService$EvaluationReportDTO"
        );

        String json = """
            {
              "overallScore": 82,
              "overallFeedback": "整体回答较完整",
              "strengths": ["表达清楚"],
              "improvements": ["补充细节"],
              "questionDetails": [
                {
                  "questionIndex": 0,
                  "question": "请介绍一个项目",
                  "category": "项目经历",
                  "userAnswer": "我负责了核心模块",
                  "score": 82,
                  "feedback": "回答抓住了重点"
                }
              ],
              "referenceAnswers": [
                {
                  "questionIndex": 0,
                  "referenceAnswer": "可以按背景、目标、行动、结果展开",
                  "keyPoints": ["背景", "行动", "结果"]
                }
              ]
            }
            """;

        Object report = objectMapper.readValue(json, dtoClass);
        Method questionEvaluationsMethod = dtoClass.getDeclaredMethod("questionEvaluations");
        questionEvaluationsMethod.setAccessible(true);

        List<?> questionEvaluations = (List<?>) questionEvaluationsMethod.invoke(report);
        assertFalse(questionEvaluations.isEmpty());

        Object firstEvaluation = questionEvaluations.get(0);
        Method scoreMethod = firstEvaluation.getClass().getDeclaredMethod("score");
        scoreMethod.setAccessible(true);
        assertEquals(82, scoreMethod.invoke(firstEvaluation));
    }
}
