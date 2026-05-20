package interview.guide.modules.admin.model;

import java.time.LocalDateTime;

public record AdminUserItemDTO(
    Long id,
    String username,
    String email,
    String role,
    boolean enabled,
    boolean hasEmail,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}
