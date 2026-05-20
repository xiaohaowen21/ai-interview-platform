package interview.guide.infrastructure.mapper;

import org.mapstruct.Named;

/**
 * Common MapStruct helpers for handling nullable integer mappings.
 */
public interface NullSafeIntMapper {

    @Named("nullToZero")
    default int nullToZero(Integer value) {
        return value != null ? value : 0;
    }
}
