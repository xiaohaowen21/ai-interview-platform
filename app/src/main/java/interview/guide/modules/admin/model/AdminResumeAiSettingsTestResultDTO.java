package interview.guide.modules.admin.model;

public record AdminResumeAiSettingsTestResultDTO(
    boolean success,
    String message,
    Integer statusCode,
    long latencyMs
) {
}
