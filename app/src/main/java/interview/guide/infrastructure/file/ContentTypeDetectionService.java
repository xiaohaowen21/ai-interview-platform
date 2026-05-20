package interview.guide.infrastructure.file;

import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;

/**
 * 文件内容类型检测服务
 * 使用 Apache Tika 进行精确的 MIME 类型检测
 */
@Slf4j
@Service
public class ContentTypeDetectionService {

    private final Tika tika;

    public ContentTypeDetectionService() {
        this.tika = new Tika();
    }

    /**
     * 检测文件的 MIME 类型
     * 使用 Tika 进行基于内容的检测，比 HTTP 头部更准确
     *
     * @param file MultipartFile 文件
     * @return MIME 类型字符串
     */
    public String detectContentType(MultipartFile file) {
        try (InputStream inputStream = file.getInputStream()) {
            return tika.detect(inputStream, file.getOriginalFilename());
        } catch (IOException e) {
            log.warn("无法检测文件类型，使用 Content-Type 头部: {}", e.getMessage());
            return file.getContentType();
        }
    }

    /**
     * 检测输入流的 MIME 类型
     *
     * @param inputStream 输入流
     * @param fileName    文件名（可选，用于辅助检测）
     * @return MIME 类型字符串
     */
    public String detectContentType(InputStream inputStream, String fileName) {
        try {
            return tika.detect(inputStream, fileName);
        } catch (IOException e) {
            log.warn("无法检测文件类型: {}", e.getMessage());
            return "application/octet-stream";
        }
    }

    /**
     * 检测字节数组的 MIME 类型
     *
     * @param data     字节数组
     * @param fileName 文件名（可选，用于辅助检测）
     * @return MIME 类型字符串
     */
    public String detectContentType(byte[] data, String fileName) {
        return tika.detect(data, fileName);
    }

    /**
     * 判断是否为 PDF 文件
     */
    public boolean isPdf(String contentType) {
        return contentType != null && contentType.toLowerCase().contains("pdf");
    }

    /**
     * 判断是否为 Word 文档（DOC/DOCX）
     */
    public boolean isWordDocument(String contentType) {
        if (contentType == null) return false;
        String lower = contentType.toLowerCase();
        return lower.contains("msword") || lower.contains("wordprocessingml");
    }

    /**
     * 判断是否为纯文本文件
     */
    public boolean isPlainText(String contentType) {
        return contentType != null && contentType.toLowerCase().startsWith("text/");
    }

    /**
     * 判断是否为 Markdown 文件
     */
    public boolean isMarkdown(String contentType, String fileName) {
        if (contentType != null) {
            String lower = contentType.toLowerCase();
            if (lower.contains("markdown") || lower.contains("x-markdown")) {
                return true;
            }
        }
        if (fileName != null) {
            String lowerName = fileName.toLowerCase();
            return lowerName.endsWith(".md") ||
                   lowerName.endsWith(".markdown") ||
                   lowerName.endsWith(".mdown");
        }
        return false;
    }
}
