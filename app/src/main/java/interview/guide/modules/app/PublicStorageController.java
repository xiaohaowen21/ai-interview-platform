package interview.guide.modules.app;

import interview.guide.infrastructure.file.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

@RestController
@RequiredArgsConstructor
public class PublicStorageController {

    private final FileStorageService fileStorageService;

    @GetMapping("/api/public/storage")
    public ResponseEntity<byte[]> getPublicAsset(@RequestParam("key") String key) {
        FileStorageService.StoredFile file = fileStorageService.downloadPublicAsset(key);
        MediaType mediaType = resolveMediaType(file);
        // 文件和站点同源：禁止浏览器猜测类型，并让直接打开的文件运行在沙箱里，
        // 这样即使存储里有旧的 SVG/HTML 文件，也无法以站点身份执行脚本
        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic())
            .header("X-Content-Type-Options", "nosniff")
            .header("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'")
            .contentType(mediaType)
            .body(file.bytes());
    }

    private MediaType resolveMediaType(FileStorageService.StoredFile file) {
        String contentType = file.contentType() == null ? "" : file.contentType().trim();
        if (!contentType.isBlank()) {
            try {
                return MediaType.parseMediaType(contentType);
            } catch (Exception ignored) {
                // Fall back to filename-based detection below.
            }
        }
        return MediaTypeFactory.getMediaType(file.fileName()).orElse(MediaType.APPLICATION_OCTET_STREAM);
    }
}
