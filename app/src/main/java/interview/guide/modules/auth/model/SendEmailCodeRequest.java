package interview.guide.modules.auth.model;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendEmailCodeRequest(
    @NotBlank(message = "请输入邮箱")
    @Email(message = "邮箱格式不正确")
    @Size(max = 120, message = "邮箱长度不能超过 120 个字符")
    String email,

    @NotBlank(message = "验证码校验未通过")
    String turnstileToken,

    EmailVerificationPurpose purpose
) {}
