package interview.guide.modules.auth.model;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ForgotPasswordResetRequest(
    @NotBlank(message = "请输入邮箱")
    @Email(message = "邮箱格式不正确")
    @Size(max = 120, message = "邮箱长度不能超过 120 个字符")
    String email,

    @NotBlank(message = "请输入验证码")
    @Pattern(regexp = "\\d{6}", message = "验证码需为 6 位数字")
    String verificationCode,

    @NotBlank(message = "请输入新密码")
    @Size(min = 6, max = 64, message = "密码长度需为 6 到 64 位")
    String newPassword
) {}
