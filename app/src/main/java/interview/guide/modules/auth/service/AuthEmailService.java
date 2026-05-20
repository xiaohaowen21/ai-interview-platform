package interview.guide.modules.auth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.mail.javamail.MimeMessageHelper;

import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class AuthEmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${app.mail.sender-name:}")
    private String senderName;

    public boolean isReady() {
        return mailEnabled && mailFrom != null && !mailFrom.isBlank();
    }

    public void sendPasswordResetCode(String toEmail, String username, String verificationCode) {
        var mimeMessage = mailSender.createMimeMessage();
        try {
            var helper = new MimeMessageHelper(mimeMessage, false, StandardCharsets.UTF_8.name());
            if (senderName != null && !senderName.isBlank()) {
                helper.setFrom(mailFrom.trim(), senderName.trim());
            } else {
                helper.setFrom(mailFrom.trim());
            }
            helper.setTo(toEmail.trim());
            helper.setSubject("Interview Guide 验证码");
            helper.setText("""
            您好，%s：

            您本次操作的验证码为：%s
            验证码 10 分钟内有效，请勿泄露给他人。

            如果这不是您的操作，请忽略本邮件。
            """.formatted(username, verificationCode));
            mailSender.send(mimeMessage);
        } catch (Exception exception) {
            throw new IllegalStateException("邮件发送失败", exception);
        }
    }
}
