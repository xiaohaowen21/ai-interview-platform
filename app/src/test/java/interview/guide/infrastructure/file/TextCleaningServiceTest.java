package interview.guide.infrastructure.file;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

/**
 * TextCleaningService 单元测试
 */
@DisplayName("文本清理服务测试")
class TextCleaningServiceTest {

    private TextCleaningService textCleaningService;

    @BeforeEach
    void setUp() {
        textCleaningService = new TextCleaningService();
    }

    @Nested
    @DisplayName("cleanText() 测试")
    class CleanTextTests {

        @ParameterizedTest
        @NullAndEmptySource
        @ValueSource(strings = {"   ", "\n", "\t", "  \n  \t  "})
        @DisplayName("空白内容应返回空字符串")
        void testBlankContent(String input) {
            String result = textCleaningService.cleanText(input);
            assertEquals("", result);
        }

        @Test
        @DisplayName("清理图片文件名行")
        void testRemoveImageFilenameLines() {
            String input = """
                简历内容
                image001.png
                image123.jpg
                image99.jpeg
                image1.gif
                更多内容
                """;

            String result = textCleaningService.cleanText(input);

            assertFalse(result.contains("image001.png"));
            assertFalse(result.contains("image123.jpg"));
            assertFalse(result.contains("image99.jpeg"));
            assertFalse(result.contains("image1.gif"));
            assertTrue(result.contains("简历内容"));
            assertTrue(result.contains("更多内容"));
        }

        @Test
        @DisplayName("不应清理正文中的图片文件名字符串")
        void testPreserveImageFilenameInText() {
            String input = "请查看 image001.png 文件";

            String result = textCleaningService.cleanText(input);

            assertTrue(result.contains("image001.png"));
        }

        @Test
        @DisplayName("清理图片 URL")
        void testRemoveImageUrls() {
            String input = """
                个人介绍
                https://example.com/avatar.png
                http://cdn.example.com/photo.jpg?size=large
                https://images.example.com/pic.JPEG
                技能清单
                """;

            String result = textCleaningService.cleanText(input);

            assertFalse(result.contains("https://example.com/avatar.png"));
            assertFalse(result.contains("http://cdn.example.com/photo.jpg"));
            assertFalse(result.contains("https://images.example.com/pic.JPEG"));
            assertTrue(result.contains("个人介绍"));
            assertTrue(result.contains("技能清单"));
        }

        @Test
        @DisplayName("清理文件协议路径")
        void testRemoveFileUrls() {
            String input = """
                内容开始
                file:///tmp/tika-temp-123.html
                file://C:/Users/temp/doc.pdf
                内容结束
                """;

            String result = textCleaningService.cleanText(input);

            assertFalse(result.contains("file:///tmp/tika-temp"));
            assertFalse(result.contains("file://C:/Users"));
            assertTrue(result.contains("内容开始"));
            assertTrue(result.contains("内容结束"));
        }

        @Test
        @DisplayName("清理分隔线")
        void testRemoveSeparatorLines() {
            String input = """
                标题
                ============
                内容1
                --------
                内容2
                ___________
                内容3
                ***********
                结尾
                """;

            String result = textCleaningService.cleanText(input);

            assertFalse(result.contains("============"));
            assertFalse(result.contains("--------"));
            assertFalse(result.contains("___________"));
            assertFalse(result.contains("***********"));
            assertTrue(result.contains("标题"));
            assertTrue(result.contains("内容1"));
            assertTrue(result.contains("内容2"));
            assertTrue(result.contains("内容3"));
            assertTrue(result.contains("结尾"));
        }

        @Test
        @DisplayName("清理控制字符")
        void testRemoveControlCharacters() {
            String input = "正常文本\u0000\u0001\u0002隐藏字符\u001F结束";

            String result = textCleaningService.cleanText(input);

            assertEquals("正常文本隐藏字符结束", result);
        }

        @Test
        @DisplayName("保留换行符和制表符")
        void testPreserveNewlineAndTab() {
            String input = "第一行\n第二行\t缩进";

            String result = textCleaningService.cleanText(input);

            assertTrue(result.contains("\n"));
            assertTrue(result.contains("\t"));
        }

        @Test
        @DisplayName("统一换行符")
        void testNormalizeLineEndings() {
            String input = "Windows\r\n换行\rMac换行\nUnix换行";

            String result = textCleaningService.cleanText(input);

            assertFalse(result.contains("\r"));
            assertTrue(result.contains("\n"));
        }

        @Test
        @DisplayName("压缩连续空行")
        void testCompressMultipleBlankLines() {
            String input = "段落1\n\n\n\n\n段落2";

            String result = textCleaningService.cleanText(input);

            assertFalse(result.contains("\n\n\n"));
            assertTrue(result.contains("段落1"));
            assertTrue(result.contains("段落2"));
        }

        @Test
        @DisplayName("去除行尾空格")
        void testTrimTrailingSpaces() {
            String input = "行末有空格   \n下一行";

            String result = textCleaningService.cleanText(input);

            assertFalse(result.contains("   \n"));
        }

        @Test
        @DisplayName("综合清理测试")
        void testComprehensiveCleaning() {
            String input = """
                个人简历
                ============



                姓名：张三
                image001.png
                https://example.com/photo.jpg
                file:///tmp/temp.html

                技能：Java

                --------
                """;

            String result = textCleaningService.cleanText(input);

            assertTrue(result.contains("个人简历"));
            assertTrue(result.contains("姓名：张三"));
            assertTrue(result.contains("技能：Java"));
            assertFalse(result.contains("============"));
            assertFalse(result.contains("--------"));
            assertFalse(result.contains("image001.png"));
            assertFalse(result.contains("https://example.com"));
            assertFalse(result.contains("file:///"));
            assertFalse(result.contains("\n\n\n"));
        }
    }

    @Nested
    @DisplayName("cleanTextWithLimit() 测试")
    class CleanTextWithLimitTests {

        @Test
        @DisplayName("文本长度在限制内应完整返回")
        void testTextWithinLimit() {
            String input = "短文本内容";
            int maxLength = 100;

            String result = textCleaningService.cleanTextWithLimit(input, maxLength);

            assertEquals("短文本内容", result);
        }

        @Test
        @DisplayName("文本长度超过限制应截断")
        void testTextExceedsLimit() {
            String input = "这是一段比较长的文本内容，需要被截断处理";
            int maxLength = 10;

            String result = textCleaningService.cleanTextWithLimit(input, maxLength);

            assertEquals(10, result.length());
            assertEquals("这是一段比较长的文本", result);
        }

        @Test
        @DisplayName("清理后再截断")
        void testCleanThenTruncate() {
            String input = "内容\n\n\n\n\n长文本";
            int maxLength = 5;

            String result = textCleaningService.cleanTextWithLimit(input, maxLength);

            // 清理后应该是 "内容\n\n长文本"，然后截断到5个字符
            assertTrue(result.length() <= maxLength);
        }

        @Test
        @DisplayName("空内容应返回空字符串")
        void testEmptyContent() {
            String result = textCleaningService.cleanTextWithLimit(null, 100);
            assertEquals("", result);

            result = textCleaningService.cleanTextWithLimit("", 100);
            assertEquals("", result);
        }
    }

    @Nested
    @DisplayName("cleanToSingleLine() 测试")
    class CleanToSingleLineTests {

        @Test
        @DisplayName("多行文本转为单行")
        void testMultiLineToSingleLine() {
            String input = "第一行\n第二行\n第三行";

            String result = textCleaningService.cleanToSingleLine(input);

            assertFalse(result.contains("\n"));
            assertTrue(result.contains("第一行"));
            assertTrue(result.contains("第二行"));
            assertTrue(result.contains("第三行"));
        }

        @Test
        @DisplayName("压缩多余空格")
        void testCompressSpaces() {
            String input = "多个   空格    之间";

            String result = textCleaningService.cleanToSingleLine(input);

            assertFalse(result.contains("  "));
            assertEquals("多个 空格 之间", result);
        }

        @Test
        @DisplayName("处理混合换行符")
        void testMixedLineEndings() {
            String input = "Windows\r\nMac\rUnix\n混合";

            String result = textCleaningService.cleanToSingleLine(input);

            assertFalse(result.contains("\r"));
            assertFalse(result.contains("\n"));
        }

        @ParameterizedTest
        @NullAndEmptySource
        @ValueSource(strings = {"   ", "\n\n", "\t"})
        @DisplayName("空白内容应返回空字符串")
        void testBlankContent(String input) {
            String result = textCleaningService.cleanToSingleLine(input);
            assertEquals("", result);
        }
    }

    @Nested
    @DisplayName("stripHtml() 测试")
    class StripHtmlTests {

        @Test
        @DisplayName("移除 HTML 标签")
        void testRemoveHtmlTags() {
            String input = "<html><body><p>段落内容</p><div>div内容</div></body></html>";

            String result = textCleaningService.stripHtml(input);

            assertFalse(result.contains("<"));
            assertFalse(result.contains(">"));
            assertTrue(result.contains("段落内容"));
            assertTrue(result.contains("div内容"));
        }

        @Test
        @DisplayName("移除自闭合标签")
        void testRemoveSelfClosingTags() {
            String input = "图片<img src='test.jpg'/>和换行<br/>标签";

            String result = textCleaningService.stripHtml(input);

            assertFalse(result.contains("<img"));
            assertFalse(result.contains("<br"));
            assertTrue(result.contains("图片"));
            assertTrue(result.contains("和换行"));
            assertTrue(result.contains("标签"));
        }

        @Test
        @DisplayName("转换 HTML 实体")
        void testConvertHtmlEntities() {
            String input = "A &amp; B &lt; C &gt; D &quot;E&quot; &apos;F&apos;";

            String result = textCleaningService.stripHtml(input);

            assertTrue(result.contains("A & B"));
            assertTrue(result.contains("< C >"));
            assertTrue(result.contains("\"E\""));
            assertTrue(result.contains("'F'"));
        }

        @Test
        @DisplayName("处理 nbsp 空格")
        void testHandleNbsp() {
            String input = "单词1&nbsp;&nbsp;&nbsp;单词2";

            String result = textCleaningService.stripHtml(input);

            assertTrue(result.contains("单词1"));
            assertTrue(result.contains("单词2"));
            assertFalse(result.contains("&nbsp;"));
        }

        @Test
        @DisplayName("压缩多余空格")
        void testCompressSpacesAfterStripping() {
            String input = "<p>   多余   空格   </p>";

            String result = textCleaningService.stripHtml(input);

            assertFalse(result.contains("  "));
        }

        @ParameterizedTest
        @NullAndEmptySource
        @ValueSource(strings = {"   ", "\n"})
        @DisplayName("空白内容应返回空字符串")
        void testBlankContent(String input) {
            String result = textCleaningService.stripHtml(input);
            assertEquals("", result);
        }

        @Test
        @DisplayName("纯文本不应被修改")
        void testPlainTextUnchanged() {
            String input = "这是纯文本，没有HTML标签";

            String result = textCleaningService.stripHtml(input);

            assertEquals("这是纯文本，没有HTML标签", result);
        }
    }
}
