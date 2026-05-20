package interview.guide.common.util;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;

public final class UserIdUtil {
    private UserIdUtil() {}

    public static String requireUserId(String userId) {
        if (userId == null || userId.trim().isEmpty()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Please sign in first.");
        }
        return userId.trim();
    }
}