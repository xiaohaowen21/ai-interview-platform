package interview.guide.modules.admin.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminUserPasswordResetRequest(
    @NotBlank(message = "New password is required")
    @Size(min = 6, max = 64, message = "Password length must be between 6 and 64")
    String newPassword
) {}
