package interview.guide.modules.admin.service;

import interview.guide.common.exception.BusinessException;
import interview.guide.common.exception.ErrorCode;
import interview.guide.common.util.UserIdUtil;
import interview.guide.modules.auth.model.UserAccountEntity;
import interview.guide.modules.auth.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AdminGuardService {

    private final UserAccountRepository userAccountRepository;

    public UserAccountEntity requireAdmin(String userIdHeader) {
        String userId = UserIdUtil.requireUserId(userIdHeader);
        Long id;
        try {
            id = Long.parseLong(userId);
        } catch (NumberFormatException exception) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "登录状态无效，请重新登录");
        }

        UserAccountEntity currentUser = userAccountRepository.findById(id)
            .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED, "账号不存在或已被删除"));

        if (currentUser.isDisabled()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "该账号已被停用");
        }

        if (currentUser.getRole() != UserAccountEntity.UserRole.ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有管理员可以访问后台");
        }

        return currentUser;
    }
}
