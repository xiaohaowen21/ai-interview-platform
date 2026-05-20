package interview.guide.modules.admin.model;

import jakarta.validation.constraints.NotBlank;

public record AdminUserUpdateRequest(
    @NotBlank(message = "Role is required")
    String role
) {}
