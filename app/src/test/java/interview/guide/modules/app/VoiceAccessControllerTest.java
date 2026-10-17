package interview.guide.modules.app;

import interview.guide.common.security.RequestQuotaService;
import interview.guide.modules.auth.model.UserAccountEntity;
import interview.guide.modules.auth.repository.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 语音服务准入：nginx 只看状态码，所以这里必须返回真实的 401 / 403 / 204
 */
@DisplayName("语音服务准入检查测试")
class VoiceAccessControllerTest {

    private UserAccountRepository userAccountRepository;
    private RequestQuotaService requestQuotaService;
    private VoiceAccessController controller;
    private UserAccountEntity user;

    @BeforeEach
    void setUp() {
        userAccountRepository = mock(UserAccountRepository.class);
        requestQuotaService = mock(RequestQuotaService.class);
        controller = new VoiceAccessController(userAccountRepository, requestQuotaService);
        ReflectionTestUtils.setField(controller, "perMinuteLimit", 30L);
        ReflectionTestUtils.setField(controller, "perHourLimit", 300L);

        user = new UserAccountEntity();
        user.setId(7L);
        when(userAccountRepository.findById(7L)).thenReturn(Optional.of(user));
        when(requestQuotaService.tryAcquire(anyString(), anyLong(), any())).thenReturn(true);
    }

    @Test
    @DisplayName("未登录返回 401")
    void rejectsAnonymous() {
        assertEquals(HttpStatus.UNAUTHORIZED, controller.checkAccess(null).getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, controller.checkAccess("not-a-number").getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, controller.checkAccess("99").getStatusCode());
        verifyNoInteractions(requestQuotaService);
    }

    @Test
    @DisplayName("已停用的账号返回 401")
    void rejectsDisabledUser() {
        user.setDisabled(true);

        assertEquals(HttpStatus.UNAUTHORIZED, controller.checkAccess("7").getStatusCode());
    }

    @Test
    @DisplayName("登录用户在额度内放行")
    void allowsSignedInUser() {
        assertEquals(HttpStatus.NO_CONTENT, controller.checkAccess("7").getStatusCode());
        verify(requestQuotaService).tryAcquire(eq("voice:minute:7"), eq(30L), any());
    }

    @Test
    @DisplayName("超出额度返回 403")
    void rejectsWhenQuotaExceeded() {
        when(requestQuotaService.tryAcquire(eq("voice:minute:7"), anyLong(), any())).thenReturn(false);

        assertEquals(HttpStatus.FORBIDDEN, controller.checkAccess("7").getStatusCode());
    }
}
