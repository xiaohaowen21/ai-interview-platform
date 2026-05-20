package interview.guide.common.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Ensures the resume hash index is non-unique so identical files can be uploaded multiple times.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ResumeIndexMigrationRunner implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            jdbcTemplate.execute("ALTER TABLE IF EXISTS resumes DROP CONSTRAINT IF EXISTS idx_resume_user_hash");
            jdbcTemplate.execute("DROP INDEX IF EXISTS idx_resume_user_hash");
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_resume_user_hash ON resumes (user_id, file_hash)");
            log.info("Ensured non-unique resume hash index");
        } catch (Exception e) {
            log.warn("Failed to ensure non-unique resume hash index: {}", e.getMessage());
        }
    }
}
