package interview.guide.common.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Ensures interview mode columns and indexes exist for mixed written/oral sessions.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class InterviewModeMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            jdbcTemplate.execute("ALTER TABLE IF EXISTS interview_sessions ADD COLUMN IF NOT EXISTS interview_mode VARCHAR(20)");
            jdbcTemplate.execute("ALTER TABLE IF EXISTS interview_sessions ADD COLUMN IF NOT EXISTS interviewer_style VARCHAR(40)");
            jdbcTemplate.execute("UPDATE interview_sessions SET interview_mode = 'WRITTEN' WHERE interview_mode IS NULL");
            jdbcTemplate.execute("ALTER TABLE interview_sessions ALTER COLUMN interview_mode SET DEFAULT 'WRITTEN'");
            jdbcTemplate.execute("ALTER TABLE interview_sessions ALTER COLUMN interview_mode SET NOT NULL");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_interview_session_resume_mode_status_created ON interview_sessions (resume_id, interview_mode, status, created_at)");
            log.info("Ensured interview mode schema columns and indexes");
        } catch (Exception exception) {
            log.warn("Failed to ensure interview mode schema: {}", exception.getMessage());
        }
    }
}
