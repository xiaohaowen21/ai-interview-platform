package interview.guide.infrastructure.export;

import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor;
import interview.guide.modules.resume.model.ResumeRewriteContentDTO;
import interview.guide.modules.resume.model.ResumeRewriteProfileDTO;
import interview.guide.modules.resume.model.ResumeRewriteSectionItemDTO;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.io.ByteArrayInputStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("PDF 导出服务测试")
class PdfExportServiceTest {

    @Test
    @DisplayName("优化简历导出应保留中文并清理异常字符")
    void exportResumeRewriteShouldKeepChineseReadable() throws Exception {
        PdfExportService service = new PdfExportService(new ObjectMapper());
        ResumeRewriteContentDTO content = new ResumeRewriteContentDTO(
            new ResumeRewriteProfileDTO(
                "张三",
                "13800138000",
                "zhangsan@example.com",
                "上海",
                "作品集｜GitHub"
            ),
            "高级产品经理——增长方向",
            "8 年产品经验——负责“增长”方向🚀，熟悉 A/B 测试、数据分析与跨团队协作。",
            List.of("增长策略 • 数据分析", "跨部门协同"),
            List.of(new ResumeRewriteSectionItemDTO(
                "产品负责人",
                "某科技公司",
                "2021.01——至今",
                List.of("负责核心功能改版，带动转化率提升 18%🚀", "推动埋点体系重构")
            )),
            List.of(new ResumeRewriteSectionItemDTO(
                "用户增长平台",
                "增长中台",
                "2023.03——2024.12",
                List.of("主导需求梳理、方案设计与上线复盘")
            )),
            List.of(new ResumeRewriteSectionItemDTO(
                "复旦大学",
                "信息管理",
                "2014.09——2018.06",
                List.of("主修数据分析、管理信息系统")
            )),
            List.of("PMP 认证"),
            List.of("英语六级"),
            List.of("强化数据驱动表达")
        );

        byte[] pdfBytes = service.exportResumeRewrite(
            "张三_产品经理简历（终版）.docx",
            "高级产品经理——增长方向",
            content
        );

        assertTrue(pdfBytes.length > 0);

        String pdfText = extractText(pdfBytes);
        assertTrue(pdfText.contains("Personal Resume"));
        assertTrue(pdfText.contains("张三"));
        assertTrue(pdfText.contains("高级产品经理"));
        assertTrue(pdfText.contains("增长方向"));
        assertTrue(pdfText.contains("负责核心功能改版"));
        assertFalse(pdfText.contains("🚀"));
    }

    @Test
    @DisplayName("工作经历标题分隔符应避免导出为缺字方块")
    void exportResumeRewriteShouldUseSafeSeparatorForHeading() throws Exception {
        PdfExportService service = new PdfExportService(new ObjectMapper());
        ResumeRewriteContentDTO content = new ResumeRewriteContentDTO(
            new ResumeRewriteProfileDTO("小风", "", "", "", ""),
            "短视频内容制作与数据优化工程师",
            "",
            List.of(),
            List.of(new ResumeRewriteSectionItemDTO(
                "短视频内容制作与数据优化工程师",
                "Freelance | 知识类垂类账号全栈支持",
                "2024.03 – 至今",
                List.of("主导B站知识区账号剪辑标准化建设")
            )),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of()
        );

        byte[] pdfBytes = service.exportResumeRewrite("sample.docx", "", content);
        String pdfText = extractText(pdfBytes);

        assertTrue(pdfText.contains("短视频内容制作与数据优化工程师"));
        assertTrue(pdfText.contains("Freelance | 知识类垂类账号全栈支持"));
        assertFalse(pdfText.contains("｜"));
    }

    private String extractText(byte[] pdfBytes) throws Exception {
        try (
            ByteArrayInputStream inputStream = new ByteArrayInputStream(pdfBytes);
            PdfReader reader = new PdfReader(inputStream);
            PdfDocument pdfDocument = new PdfDocument(reader)
        ) {
            StringBuilder builder = new StringBuilder();
            for (int page = 1; page <= pdfDocument.getNumberOfPages(); page += 1) {
                builder.append(PdfTextExtractor.getTextFromPage(pdfDocument.getPage(page)));
            }
            return builder.toString();
        }
    }
}
