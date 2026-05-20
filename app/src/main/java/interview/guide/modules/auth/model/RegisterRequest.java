package interview.guide.modules.auth.model;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank(message = "请输入用户名")
    @Size(min = 3, max = 32, message = "用户名长度需为 3 到 32 位")
    String username,

    @NotBlank(message = "请输入密码")
    @Size(min = 6, max = 64, message = "密码长度需为 6 到 64 位")
    String password,

    @NotBlank(message = "请输入邮箱")
    @Email(message = "邮箱格式不正确")
    @Size(max = 120, message = "邮箱长度不能超过 120 个字符")
    String email,

    @NotBlank(message = "请输入验证码")
    @Pattern(regexp = "\\d{6}", message = "验证码需为 6 位数字")
    String verificationCode
) {}
