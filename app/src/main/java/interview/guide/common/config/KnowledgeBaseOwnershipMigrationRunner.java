package interview.guide.common.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Migrates knowledge bases and RAG chat sessions to per-user ownership.
 *
 * <p>Knowledge bases used to be one global pool deduplicated by file hash. Each user now owns
 * their own uploads, so the global unique constraint on {@code file_hash} is dropped (two users
 * may upload the same file). Rows created before ownership existed have no {@code user_id}; they
 * are handed to the first admin account so they stay reachable instead of disappearing.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KnowledgeBaseOwnershipMigrationRunner implements ApplicationRunner {

    private static final String FIRST_ADMIN_ID =
        "(SELECT CAST(id AS VARCHAR) FROM user_accounts WHERE role = 'ADMIN' ORDER BY id LIMIT 1)";

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            jdbcTemplate.execute("ALTER TABLE IF EXISTS knowledge_bases DROP CONSTRAINT IF EXISTS idx_kb_hash");
            jdbcTemplate.execute("DROP INDEX IF EXISTS idx_kb_hash");
            jdbcTemplate.execute("""
                DO $$
                DECLARE c record;
                BEGIN
                    FOR c IN
                        SELECT con.conname
                        FROM pg_constraint con
                        JOIN pg_attribute att
                          ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
                        WHERE con.conrelid = to_regclass('knowledge_bases')
                          AND con.contype = 'u'
                          AND array_length(con.conkey, 1) = 1
                          AND att.attname = 'file_hash'
                    LOOP
                        EXECUTE format('ALTER TABLE knowledge_bases DROP CONSTRAINT %I', c.conname);
                    END LOOP;
                END $$
                """);
            log.info("Ensured knowledge base file hash is unique per user only");
        } catch (Exception e) {
            log.warn("Failed to drop global knowledge base hash constraint: {}", e.getMessage());
        }

        try {
            int kbRows = jdbcTemplate.update(
                "UPDATE knowledge_bases SET user_id = " + FIRST_ADMIN_ID + " WHERE user_id IS NULL");
            int sessionRows = jdbcTemplate.update(
                "UPDATE rag_chat_sessions SET user_id = " + FIRST_ADMIN_ID + " WHERE user_id IS NULL");
            if (kbRows > 0 || sessionRows > 0) {
                log.info("Assigned {} unowned knowledge bases and {} RAG chat sessions to the first admin",
                    kbRows, sessionRows);
            }
        } catch (Exception e) {
            log.warn("Failed to assign unowned knowledge bases to an admin: {}", e.getMessage());
        }
    }
}
