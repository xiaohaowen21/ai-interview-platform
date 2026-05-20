package interview.guide.infrastructure.export;

import com.itextpdf.io.font.PdfEncodings;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.font.PdfFontFactory.EmbeddingStrategy;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.itextpdf.layout.properties.VerticalAlignment;
import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.modules.interview.model.InterviewAnswerEntity;
import interview.guide.modules.interview.model.InterviewSessionEntity;
import interview.guide.modules.interview.model.ResumeAnalysisResponse;
import interview.guide.modules.resume.model.ResumeEntity;
import interview.guide.modules.resume.model.ResumeRewriteContentDTO;
import interview.guide.modules.resume.model.ResumeRewriteProfileDTO;
import interview.guide.modules.resume.model.ResumeRewriteSectionItemDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.io.ByteArrayOutputStream;
import java.text.Normalizer;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * PDF导出服务
 * PDF Export Service for resume analysis and interview reports
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PdfExportService {
    
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DeviceRgb HEADER_COLOR = new DeviceRgb(41, 128, 185);
    private static final DeviceRgb SECTION_COLOR = new DeviceRgb(52, 73, 94);
    private static final DeviceRgb RESUME_THEME_BLUE = new DeviceRgb(79, 114, 133);
    private static final DeviceRgb RESUME_THEME_GOLD = new DeviceRgb(186, 147, 80);
    private static final DeviceRgb RESUME_LINE = new DeviceRgb(152, 172, 184);
    private static final DeviceRgb RESUME_SOFT_BG = new DeviceRgb(243, 248, 252);
    
    private final ObjectMapper objectMapper;
    
    /**
     * 创建支持中文的字体
     */
    private PdfFont createChineseFont() {
        try {
            // 使用项目内嵌字体（保证跨平台一致性）
            var fontStream = getClass().getClassLoader().getResourceAsStream("fonts/ZhuqueFangsong-Regular.ttf");
            if (fontStream != null) {
                byte[] fontBytes = fontStream.readAllBytes();
                fontStream.close();
                log.debug("使用项目内嵌字体: fonts/ZhuqueFangsong-Regular.ttf");
                return PdfFontFactory.createFont(fontBytes, PdfEncodings.IDENTITY_H, EmbeddingStrategy.FORCE_EMBEDDED);
            }
            
            // 如果字体文件不存在，抛出异常
            log.error("未找到字体文件: fonts/ZhuqueFangsong-Regular.ttf");
            throw new BusinessException(ErrorCode.EXPORT_PDF_FAILED, "字体文件缺失，请联系管理员");
            
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("创建中文字体失败: {}", e.getMessage(), e);
            throw new BusinessException(ErrorCode.EXPORT_PDF_FAILED, "创建字体失败: " + e.getMessage());
        }
    }
    
    /**
     * 清理文本中可能导致字体问题的字符
     */
    private String sanitizeText(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String normalized = Normalizer.normalize(text, Normalizer.Form.NFKC)
            .replace('\u00A0', ' ')
            .replace('\u2007', ' ')
            .replace('\u202F', ' ')
            .replace('\u3000', ' ')
            .replace('\u2013', '-')
            .replace('\u2014', '-')
            .replace('\u2015', '-')
            .replace('\u2212', '-')
            .replace('\u2018', '\'')
            .replace('\u2019', '\'')
            .replace('\u201C', '"')
            .replace('\u201D', '"')
            .replace('\u2026', '.')
            .replace('\u2022', '-')
            .replace('\u25CF', '-')
            .replace('\u25E6', '-')
            .replace('\u25A0', '-')
            .replace('\uFF5C', '|')
            .replace('\u2502', '|')
            .replace("\r\n", "\n")
            .replace('\r', '\n');

        normalized = normalized.replaceAll("[\\p{Cntrl}&&[^\n\t]]", "");
        normalized = normalized.replaceAll("[\\p{So}\\p{Cs}]", "");

        return normalized.lines()
            .map(String::stripTrailing)
            .collect(Collectors.joining("\n"))
            .trim();
    }

    private String sanitizeText(String text, PdfFont font) {
        String normalized = sanitizeText(text);
        if (normalized.isBlank() || font == null) {
            return normalized;
        }

        StringBuilder builder = new StringBuilder(normalized.length());
        normalized.codePoints().forEach(codePoint -> appendSupportedGlyph(builder, codePoint, font));
        return builder.toString().trim();
    }

    private void appendSupportedGlyph(StringBuilder builder, int codePoint, PdfFont font) {
        if (codePoint == '\n' || codePoint == '\t') {
            builder.appendCodePoint(codePoint);
            return;
        }
        if (Character.isWhitespace(codePoint)) {
            builder.append(' ');
            return;
        }
        if (font.containsGlyph(codePoint)) {
            builder.appendCodePoint(codePoint);
            return;
        }

        String replacement = fallbackGlyph(codePoint);
        if (replacement != null && !replacement.isEmpty()) {
            builder.append(replacement);
        }
    }

    private String fallbackGlyph(int codePoint) {
        return switch (codePoint) {
            case 0xFF5C, 0x2502, 0x2223, 0x23D0, 0xFFE8 -> "|";
            case 0x2013, 0x2014, 0x2015, 0x2212 -> "-";
            case 0x2018, 0x2019 -> "'";
            case 0x201C, 0x201D -> "\"";
            case 0x2022, 0x25CF, 0x25E6, 0x25A0 -> "-";
            case 0x2192, 0x27A1, 0x279C, 0x2794 -> "->";
            case 0xFFFD -> "";
            default -> null;
        };
    }
    
    /**
     * 导出简历分析报告为PDF
     */
    public byte[] exportResumeAnalysis(ResumeEntity resume, ResumeAnalysisResponse analysis) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdfDoc = new PdfDocument(writer);
        Document document = new Document(pdfDoc);
        
        // 使用支持中文的字体
        PdfFont font = createChineseFont();
        document.setFont(font);
        
        // 标题
        Paragraph title = new Paragraph("简历分析报告")
            .setFontSize(24)
            .setBold()
            .setTextAlignment(TextAlignment.CENTER)
            .setFontColor(HEADER_COLOR);
        document.add(title);
        
        // 基本信息
        document.add(new Paragraph("\n"));
        document.add(createSectionTitle("基本信息"));
        document.add(new Paragraph("文件名: " + resume.getOriginalFilename()));
        document.add(new Paragraph("上传时间: " + 
            (resume.getUploadedAt() != null ? DATE_FORMAT.format(resume.getUploadedAt()) : "未知")));
        
        // 总分
        document.add(new Paragraph("\n"));
        document.add(createSectionTitle("综合评分"));
        Paragraph scoreP = new Paragraph("总分: " + analysis.overallScore() + " / 100")
            .setFontSize(18)
            .setBold()
            .setFontColor(getScoreColor(analysis.overallScore()));
        document.add(scoreP);
        
        // 各维度评分
        if (analysis.scoreDetail() != null) {
            document.add(new Paragraph("\n"));
            document.add(createSectionTitle("各维度评分"));
            
            Table scoreTable = new Table(UnitValue.createPercentArray(new float[]{2, 1}))
                .useAllAvailableWidth();
            addScoreRow(scoreTable, "项目经验", analysis.scoreDetail().projectScore(), 40);
            addScoreRow(scoreTable, "技能匹配度", analysis.scoreDetail().skillMatchScore(), 20);
            addScoreRow(scoreTable, "内容完整性", analysis.scoreDetail().contentScore(), 15);
            addScoreRow(scoreTable, "结构清晰度", analysis.scoreDetail().structureScore(), 15);
            addScoreRow(scoreTable, "表达专业性", analysis.scoreDetail().expressionScore(), 10);
            document.add(scoreTable);
        }
        
        // 简历摘要
        if (analysis.summary() != null) {
            document.add(new Paragraph("\n"));
            document.add(createSectionTitle("简历摘要"));
            document.add(new Paragraph(sanitizeText(analysis.summary(), font)));
        }
        
        // 优势亮点
        if (analysis.strengths() != null && !analysis.strengths().isEmpty()) {
            document.add(new Paragraph("\n"));
            document.add(createSectionTitle("优势亮点"));
            for (String strength : analysis.strengths()) {
                document.add(new Paragraph("- " + sanitizeText(strength, font)));
            }
        }
        
        // 改进建议
        if (analysis.suggestions() != null && !analysis.suggestions().isEmpty()) {
            document.add(new Paragraph("\n"));
            document.add(createSectionTitle("改进建议"));
            for (ResumeAnalysisResponse.Suggestion suggestion : analysis.suggestions()) {
                document.add(new Paragraph("【" + suggestion.priority() + "】" + sanitizeText(suggestion.category(), font))
                    .setBold());
                document.add(new Paragraph("问题: " + sanitizeText(suggestion.issue(), font)));
                document.add(new Paragraph("建议: " + sanitizeText(suggestion.recommendation(), font)));
                document.add(new Paragraph("\n"));
            }
        }
        
        document.close();
        return baos.toByteArray();
    }
    
    /**
     * 导出面试报告为PDF
     */
    public byte[] exportInterviewReport(InterviewSessionEntity session) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdfDoc = new PdfDocument(writer);
        Document document = new Document(pdfDoc);
        
        // 使用支持中文的字体
        PdfFont font = createChineseFont();
        document.setFont(font);
        
        // 标题
        Paragraph title = new Paragraph("模拟面试报告")
            .setFontSize(24)
            .setBold()
            .setTextAlignment(TextAlignment.CENTER)
            .setFontColor(HEADER_COLOR);
        document.add(title);
        
        // 基本信息
        document.add(new Paragraph("\n"));
        document.add(createSectionTitle("面试信息"));
        document.add(new Paragraph("会话ID: " + session.getSessionId()));
        document.add(new Paragraph("题目数量: " + session.getTotalQuestions()));
        document.add(new Paragraph("面试状态: " + getStatusText(session.getStatus())));
        document.add(new Paragraph("开始时间: " + 
            (session.getCreatedAt() != null ? DATE_FORMAT.format(session.getCreatedAt()) : "未知")));
        if (session.getCompletedAt() != null) {
            document.add(new Paragraph("完成时间: " + DATE_FORMAT.format(session.getCompletedAt())));
        }
        
        // 总分
        if (session.getOverallScore() != null) {
            document.add(new Paragraph("\n"));
            document.add(createSectionTitle("综合评分"));
            Paragraph scoreP = new Paragraph("总分: " + session.getOverallScore() + " / 100")
                .setFontSize(18)
                .setBold()
                .setFontColor(getScoreColor(session.getOverallScore()));
            document.add(scoreP);
        }
        
        // 总体评价
        if (session.getOverallFeedback() != null) {
            document.add(new Paragraph("\n"));
            document.add(createSectionTitle("总体评价"));
            document.add(new Paragraph(sanitizeText(session.getOverallFeedback(), font)));
        }
        
        // 优势
        if (session.getStrengthsJson() != null) {
            try {
                List<String> strengths = objectMapper.readValue(session.getStrengthsJson(),
                        new TypeReference<>() {
                        });
                if (!strengths.isEmpty()) {
                    document.add(new Paragraph("\n"));
                    document.add(createSectionTitle("表现优势"));
                    for (String s : strengths) {
                        document.add(new Paragraph("- " + sanitizeText(s, font)));
                    }
                }
            } catch (Exception e) {
                log.error("解析优势JSON失败", e);
            }
        }
        
        // 改进建议
        if (session.getImprovementsJson() != null) {
            try {
                List<String> improvements = objectMapper.readValue(session.getImprovementsJson(),
                        new TypeReference<>() {
                        });
                if (!improvements.isEmpty()) {
                    document.add(new Paragraph("\n"));
                    document.add(createSectionTitle("改进建议"));
                    for (String s : improvements) {
                        document.add(new Paragraph("- " + sanitizeText(s, font)));
                    }
                }
            } catch (Exception e) {
                log.error("解析改进建议JSON失败", e);
            }
        }
        
        // 问答详情
        List<InterviewAnswerEntity> answers = session.getAnswers();
        if (answers != null && !answers.isEmpty()) {
            document.add(new Paragraph("\n"));
            document.add(createSectionTitle("问答详情"));
            
            for (InterviewAnswerEntity answer : answers) {
                document.add(new Paragraph("\n"));
                document.add(new Paragraph("问题 " + (answer.getQuestionIndex() + 1) + 
                    " [" + (answer.getCategory() != null ? answer.getCategory() : "综合") + "]")
                    .setBold()
                    .setFontSize(12));
                document.add(new Paragraph("Q: " + sanitizeText(answer.getQuestion(), font)));
                document.add(new Paragraph("A: " + sanitizeText(answer.getUserAnswer() != null ? answer.getUserAnswer() : "未回答", font)));
                document.add(new Paragraph("得分: " + answer.getScore() + "/100")
                    .setFontColor(getScoreColor(answer.getScore())));
                if (answer.getFeedback() != null) {
                    document.add(new Paragraph("评价: " + sanitizeText(answer.getFeedback(), font))
                        .setItalic());
                }
                if (answer.getReferenceAnswer() != null) {
                    document.add(new Paragraph("参考答案: " + sanitizeText(answer.getReferenceAnswer(), font))
                        .setFontColor(new DeviceRgb(39, 174, 96)));
                }
            }
        }
        
        document.close();
        return baos.toByteArray();
    }

    /**
     * 导出优化版简历为 PDF。
     */
    public byte[] exportResumeRewrite(
        String sourceFilename,
        String jobDescription,
        ResumeRewriteContentDTO content
    ) {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PdfWriter writer = new PdfWriter(baos);
        PdfDocument pdfDoc = new PdfDocument(writer);
        Document document = new Document(pdfDoc);

        PdfFont font = createChineseFont();
        document.setFont(font);
        document.setMargins(26, 30, 26, 30);

        ResumeRewriteContentDTO normalized = content == null
            ? new ResumeRewriteContentDTO(
            new ResumeRewriteProfileDTO("", "", "", "", ""),
            "",
            "",
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of()
        ) : content;

        ResumeRewriteProfileDTO profile = normalized.profile() == null
            ? new ResumeRewriteProfileDTO("", "", "", "", "")
            : normalized.profile();

        addResumeTemplateHeader(document, font, profile);
        addResumeBasicInfo(document, font, profile, sourceFilename, jobDescription, normalized);
        addResumeTimelineSection(document, font, "教育背景", normalized.educationExperiences());
        addResumeTimelineSection(document, font, "实习经历", normalized.workExperiences());
        addResumeTimelineSection(document, font, "校园经历", normalized.projectExperiences());
        addResumeSkillsSection(document, font, normalized);
        addResumeSelfEvaluationSection(document, font, normalized.professionalSummary(), normalized.optimizationHighlights());

        document.close();
        return baos.toByteArray();
    }

    private void addResumeTemplateHeader(Document document, PdfFont font, ResumeRewriteProfileDTO profile) {
        String displayName = isNotBlank(profile.fullName())
            ? sanitizeText(profile.fullName(), font)
            : "个人简历";

        Table titleTable = new Table(UnitValue.createPercentArray(new float[]{80, 20}))
            .useAllAvailableWidth()
            .setBorder(Border.NO_BORDER)
            .setMarginBottom(6);

        Cell left = new Cell()
            .setBorder(Border.NO_BORDER)
            .setPadding(0)
            .setVerticalAlignment(VerticalAlignment.MIDDLE);
        left.add(
            new Paragraph(displayName)
                .setFontSize(44)
                .setBold()
                .setFontColor(RESUME_THEME_BLUE)
                .setMargin(0)
                .setMultipliedLeading(1.0f)
        );
        left.add(
            new Paragraph("Personal Resume")
                .setFontSize(23)
                .setBold()
                .setFontColor(RESUME_THEME_BLUE)
                .setMarginTop(2)
                .setMarginBottom(0)
        );
        titleTable.addCell(left);

        Cell right = new Cell()
            .setBorder(Border.NO_BORDER)
            .setPadding(0)
            .setPaddingTop(12)
            .setTextAlignment(TextAlignment.RIGHT);
        titleTable.addCell(right);
        document.add(titleTable);

        Table colorBar = new Table(UnitValue.createPercentArray(new float[]{62, 38}))
            .useAllAvailableWidth()
            .setBorder(Border.NO_BORDER)
            .setMarginBottom(10);
        colorBar.addCell(new Cell().setBackgroundColor(RESUME_THEME_BLUE).setHeight(7).setBorder(Border.NO_BORDER));
        colorBar.addCell(new Cell().setBackgroundColor(RESUME_THEME_GOLD).setHeight(7).setBorder(Border.NO_BORDER));
        document.add(colorBar);
    }

    private void addResumeSectionHeader(Document document, String title) {
        Table header = new Table(UnitValue.createPercentArray(new float[]{18, 82}))
            .useAllAvailableWidth()
            .setBorder(Border.NO_BORDER)
            .setMarginTop(6)
            .setMarginBottom(4);

        Cell label = new Cell()
            .setBorder(Border.NO_BORDER)
            .setBackgroundColor(RESUME_THEME_BLUE)
            .setPadding(4)
            .setPaddingLeft(10)
            .setVerticalAlignment(VerticalAlignment.MIDDLE);
        label.add(new Paragraph(title).setFontSize(12).setBold().setFontColor(new DeviceRgb(255, 255, 255)).setMargin(0));

        Cell line = new Cell()
            .setBorder(Border.NO_BORDER)
            .setBorderBottom(new SolidBorder(RESUME_LINE, 1f));

        header.addCell(label);
        header.addCell(line);
        document.add(header);
    }

    private void addResumeBasicInfo(
        Document document,
        PdfFont font,
        ResumeRewriteProfileDTO profile,
        String sourceFilename,
        String jobDescription,
        ResumeRewriteContentDTO content
    ) {
        addResumeSectionHeader(document, "基本信息");

        String educationHint = firstNonBlank(
            content.educationExperiences() == null || content.educationExperiences().isEmpty()
                ? ""
                : content.educationExperiences().get(0).title(),
            content.educationExperiences() == null || content.educationExperiences().isEmpty()
                ? ""
                : content.educationExperiences().get(0).subtitle()
        );

        Table baseInfo = new Table(UnitValue.createPercentArray(new float[]{36, 36, 28}))
            .useAllAvailableWidth()
            .setBorder(new SolidBorder(RESUME_LINE, 0.8f))
            .setMarginBottom(4);

        Cell leftColumn = new Cell()
            .setBorder(Border.NO_BORDER)
            .setBorderRight(new SolidBorder(RESUME_LINE, 0.8f))
            .setPadding(8)
            .setBackgroundColor(RESUME_SOFT_BG);
        addLabelValueLine(leftColumn, font, "姓  名", profile.fullName());
        addLabelValueLine(leftColumn, font, "电  话", profile.phone());
        addLabelValueLine(leftColumn, font, "邮  箱", profile.email());
        addLabelValueLine(leftColumn, font, "住  址", profile.location());
        addLabelValueLine(leftColumn, font, "链  接", profile.links());
        baseInfo.addCell(leftColumn);

        Cell rightColumn = new Cell()
            .setBorder(Border.NO_BORDER)
            .setBorderRight(new SolidBorder(RESUME_LINE, 0.8f))
            .setPadding(8)
            .setBackgroundColor(RESUME_SOFT_BG);
        addLabelValueLine(rightColumn, font, "求职方向", content.targetPosition());
        addLabelValueLine(rightColumn, font, "优化方向", jobDescription);
        addLabelValueLine(rightColumn, font, "原始文件", sourceFilename);
        addLabelValueLine(rightColumn, font, "毕业院校", educationHint);
        baseInfo.addCell(rightColumn);

        Cell avatar = new Cell()
            .setBorder(Border.NO_BORDER)
            .setPadding(8)
            .setTextAlignment(TextAlignment.CENTER)
            .setVerticalAlignment(VerticalAlignment.MIDDLE);
        avatar.add(
            new Paragraph("PHOTO")
                .setFontSize(12)
                .setBold()
                .setFontColor(RESUME_THEME_BLUE)
                .setMarginBottom(4)
        );
        avatar.add(
            new Paragraph("建议上传正式证件照")
                .setFontSize(9)
                .setFontColor(new DeviceRgb(120, 136, 145))
                .setTextAlignment(TextAlignment.CENTER)
        );
        baseInfo.addCell(avatar);

        document.add(baseInfo);
    }

    private void addLabelValueLine(Cell cell, PdfFont font, String label, String value) {
        String safeLabel = sanitizeText(label, font);
        String safeValue = sanitizeText(valueOrPlaceholder(value), font);
        Paragraph paragraph = new Paragraph(safeLabel + "：" + safeValue)
            .setMargin(0)
            .setMarginBottom(4)
            .setFontSize(10.5f)
            .setMultipliedLeading(1.1f);
        cell.add(paragraph);
    }

    private void addResumeTimelineSection(
        Document document,
        PdfFont font,
        String sectionTitle,
        List<ResumeRewriteSectionItemDTO> items
    ) {
        List<ResumeRewriteSectionItemDTO> safeItems = items == null ? Collections.emptyList() : items;
        if (safeItems.isEmpty()) {
            return;
        }

        addResumeSectionHeader(document, sectionTitle);

        for (ResumeRewriteSectionItemDTO item : safeItems) {
            if (item == null) {
                continue;
            }

            String period = sanitizeText(valueOrPlaceholder(item.period()), font);
            String title = sanitizeText(valueOrPlaceholder(item.title()), font);
            String subtitle = sanitizeText(valueOrPlaceholder(item.subtitle()), font);

            Table rowHeader = new Table(UnitValue.createPercentArray(new float[]{24, 44, 32}))
                .useAllAvailableWidth()
                .setBorder(Border.NO_BORDER)
                .setMarginTop(2)
                .setMarginBottom(1);

            rowHeader.addCell(
                new Cell()
                    .setBorder(Border.NO_BORDER)
                    .setPadding(0)
                    .add(new Paragraph(period).setFontSize(10.5f).setBold().setFontColor(RESUME_THEME_BLUE).setMargin(0))
            );
            rowHeader.addCell(
                new Cell()
                    .setBorder(Border.NO_BORDER)
                    .setPadding(0)
                    .setTextAlignment(TextAlignment.CENTER)
                    .add(new Paragraph(title).setFontSize(11f).setBold().setMargin(0))
            );
            rowHeader.addCell(
                new Cell()
                    .setBorder(Border.NO_BORDER)
                    .setPadding(0)
                    .setTextAlignment(TextAlignment.RIGHT)
                    .add(new Paragraph(subtitle).setFontSize(10.5f).setBold().setMargin(0))
            );
            document.add(rowHeader);

            if (item.highlights() != null) {
                for (String highlight : item.highlights()) {
                    if (!isNotBlank(highlight)) {
                        continue;
                    }
                    document.add(
                        new Paragraph("- " + sanitizeText(highlight, font))
                            .setFontSize(10f)
                            .setMargin(0)
                            .setMarginLeft(8)
                            .setMarginBottom(2)
                            .setMultipliedLeading(1.25f)
                    );
                }
            }
            document.add(new Paragraph("\n").setMargin(0).setFontSize(2));
        }
    }

    private void addResumeSkillsSection(Document document, PdfFont font, ResumeRewriteContentDTO content) {
        List<String> merged = new ArrayList<>();
        merged.addAll(safeList(content.coreSkills()));
        merged.addAll(safeList(content.certifications()));
        merged.addAll(safeList(content.additionalInformation()));
        if (merged.isEmpty()) {
            return;
        }

        addResumeSectionHeader(document, "技能证书");
        for (String line : merged) {
            if (!isNotBlank(line)) {
                continue;
            }
            document.add(
                new Paragraph(sanitizeText(line, font))
                    .setFontSize(10.2f)
                    .setMargin(0)
                    .setMarginLeft(8)
                    .setMarginBottom(2)
                    .setMultipliedLeading(1.25f)
            );
        }
    }

    private void addResumeSelfEvaluationSection(
        Document document,
        PdfFont font,
        String professionalSummary,
        List<String> optimizationHighlights
    ) {
        String summary = sanitizeText(professionalSummary, font);
        if (!isNotBlank(summary) && optimizationHighlights != null && !optimizationHighlights.isEmpty()) {
            summary = optimizationHighlights.stream()
                .filter(this::isNotBlank)
                .map(item -> sanitizeText(item, font))
                .collect(Collectors.joining("；"));
        }

        if (!isNotBlank(summary)) {
            return;
        }

        addResumeSectionHeader(document, "自我评价");
        document.add(
            new Paragraph(summary)
                .setFontSize(10.4f)
                .setMargin(0)
                .setMarginLeft(8)
                .setMultipliedLeading(1.35f)
        );
    }

    private List<String> safeList(List<String> values) {
        return values == null ? Collections.emptyList() : values;
    }

    private String valueOrPlaceholder(String value) {
        return isNotBlank(value) ? value : "—";
    }

    private String firstNonBlank(String first, String second) {
        if (isNotBlank(first)) {
            return first;
        }
        if (isNotBlank(second)) {
            return second;
        }
        return "—";
    }

    private boolean isNotBlank(String value) {
        return value != null && !value.isBlank();
    }
    
    private Paragraph createSectionTitle(String title) {
        return new Paragraph(title)
            .setFontSize(14)
            .setBold()
            .setFontColor(SECTION_COLOR)
            .setMarginTop(10);
    }
    
    private void addScoreRow(Table table, String dimension, int score, int maxScore) {
        table.addCell(new Cell().add(new Paragraph(dimension)));
        table.addCell(new Cell().add(new Paragraph(score + " / " + maxScore)
            .setFontColor(getScoreColor(score * 100 / maxScore))));
    }
    
    private DeviceRgb getScoreColor(int score) {
        if (score >= 80) return new DeviceRgb(39, 174, 96);   // 绿色
        if (score >= 60) return new DeviceRgb(241, 196, 15);  // 黄色
        return new DeviceRgb(231, 76, 60);                    // 红色
    }
    
    private String getStatusText(InterviewSessionEntity.SessionStatus status) {
        return switch (status) {
            case CREATED -> "已创建";
            case IN_PROGRESS -> "进行中";
            case COMPLETED -> "已完成";
            case EVALUATED -> "已评估";
        };
    }
}
