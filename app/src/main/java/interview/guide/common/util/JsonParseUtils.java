package interview.guide.common.util;

import org.slf4j.Logger;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Lightweight helper around {@link ObjectMapper} to keep JSON parsing logic consistent.
 */
public final class JsonParseUtils {

    private JsonParseUtils() {
    }

    public static <T> T parseOrDefault(
        ObjectMapper mapper,
        String json,
        TypeReference<T> typeReference,
        T defaultValue,
        Logger logger,
        String logContext
    ) {
        if (json == null) {
            return defaultValue;
        }
        try {
            T parsed = mapper.readValue(json, typeReference);
            return parsed != null ? parsed : defaultValue;
        } catch (JacksonException exception) {
            if (logger != null) {
                logger.error(logContext, exception);
            }
            return defaultValue;
        }
    }
}
