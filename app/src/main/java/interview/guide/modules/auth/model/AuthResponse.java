package interview.guide.modules.auth.model;

public record AuthResponse(
    String userId,
    String username,
    String role,
    boolean hasEmail
) {}
