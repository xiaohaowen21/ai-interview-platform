package interview.guide.modules.auth.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
    @NotBlank(message = "请输入用户名")
    @Size(min = 3, max = 32, message = "用户名长度需为 3 到 32 位")
    String username,

    @NotBlank(message = "请输入密码")
    @Size(min = 6, max = 64, message = "密码长度需为 6 到 64 位")
    String password
) {}
