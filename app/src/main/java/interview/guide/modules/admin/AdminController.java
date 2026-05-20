package interview.guide.modules.admin;

import interview.guide.common.result.Result;
import interview.guide.modules.admin.model.AdminResumeAiSettingsDTO;
import interview.guide.modules.admin.model.AdminResumeAiSettingsTestResultDTO;
import interview.guide.modules.admin.model.AdminResumeAiSettingsUpdateRequest;
import interview.guide.modules.admin.model.AdminSelfPasswordUpdateRequest;
import interview.guide.modules.admin.model.AdminUserItemDTO;
import interview.guide.modules.admin.model.AdminUserPasswordResetRequest;
import interview.guide.modules.admin.model.AdminUserStatusUpdateRequest;
import interview.guide.modules.admin.model.AdminUserUpdateRequest;
import interview.guide.modules.admin.service.AdminGuardService;
import interview.guide.modules.admin.service.AdminResumeAiSettingsService;
import interview.guide.modules.admin.service.AdminUserService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminGuardService adminGuardService;
    private final AdminUserService adminUserService;
    private final AdminResumeAiSettingsService adminResumeAiSettingsService;

    @GetMapping("/users")
    public Result<List<AdminUserItemDTO>> listUsers(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        adminGuardService.requireAdmin(userId);
        return Result.success(adminUserService.listUsers());
    }

    @PutMapping("/users/{userId}/role")
    public Result<AdminUserItemDTO> updateUserRole(
        @RequestHeader(value = "X-User-Id", required = false) String currentUserId,
        @PathVariable Long userId,
        @Valid @RequestBody AdminUserUpdateRequest request
    ) {
        var currentAdmin = adminGuardService.requireAdmin(currentUserId);
        return Result.success(adminUserService.updateUserRole(currentAdmin.getId(), userId, request.role()));
    }

    @PutMapping("/users/{userId}/password")
    public Result<AdminUserItemDTO> resetUserPassword(
        @RequestHeader(value = "X-User-Id", required = false) String currentUserId,
        @PathVariable Long userId,
        @Valid @RequestBody AdminUserPasswordResetRequest request
    ) {
        adminGuardService.requireAdmin(currentUserId);
        return Result.success(adminUserService.resetPassword(userId, request.newPassword()));
    }

    @PutMapping("/users/{userId}/status")
    public Result<AdminUserItemDTO> updateUserStatus(
        @RequestHeader(value = "X-User-Id", required = false) String currentUserId,
        @PathVariable Long userId,
        @RequestBody AdminUserStatusUpdateRequest request
    ) {
        var currentAdmin = adminGuardService.requireAdmin(currentUserId);
        return Result.success(adminUserService.updateUserStatus(currentAdmin.getId(), userId, request.enabled()));
    }

    @DeleteMapping("/users/{userId}")
    public Result<Void> deleteUser(
        @RequestHeader(value = "X-User-Id", required = false) String currentUserId,
        @PathVariable Long userId
    ) {
        var currentAdmin = adminGuardService.requireAdmin(currentUserId);
        adminUserService.deleteUser(currentAdmin.getId(), userId);
        return Result.success();
    }

    @PutMapping("/me/password")
    public Result<Void> changeOwnPassword(
        @RequestHeader(value = "X-User-Id", required = false) String currentUserId,
        @Valid @RequestBody AdminSelfPasswordUpdateRequest request
    ) {
        var currentAdmin = adminGuardService.requireAdmin(currentUserId);
        adminUserService.changeOwnPassword(currentAdmin.getId(), request.currentPassword(), request.newPassword());
        return Result.success();
    }

    @GetMapping("/resume-ai-settings")
    public Result<AdminResumeAiSettingsDTO> getResumeAiSettings(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        adminGuardService.requireAdmin(userId);
        return Result.success(adminResumeAiSettingsService.getSettings());
    }

    @PutMapping("/resume-ai-settings")
    public Result<AdminResumeAiSettingsDTO> updateResumeAiSettings(
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        @Valid @RequestBody AdminResumeAiSettingsUpdateRequest request
    ) {
        adminGuardService.requireAdmin(userId);
        return Result.success(adminResumeAiSettingsService.updateSettings(request));
    }

    @PostMapping("/resume-ai-settings/test")
    public Result<AdminResumeAiSettingsTestResultDTO> testResumeAiSettings(
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        @Valid @RequestBody AdminResumeAiSettingsUpdateRequest request
    ) {
        adminGuardService.requireAdmin(userId);
        return Result.success(adminResumeAiSettingsService.testSettings(request));
    }

    @PostMapping(value = "/landing-images/{moduleKey}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<AdminResumeAiSettingsDTO> uploadLandingImage(
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        @PathVariable String moduleKey,
        @RequestPart("file") MultipartFile file
    ) {
        adminGuardService.requireAdmin(userId);
        return Result.success(adminResumeAiSettingsService.uploadLandingImage(moduleKey, file));
    }

    @PostMapping(value = "/interviewer-avatars/{personaKey}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<AdminResumeAiSettingsDTO> uploadInterviewerAvatar(
        @RequestHeader(value = "X-User-Id", required = false) String userId,
        @PathVariable String personaKey,
        @RequestPart("file") MultipartFile file
    ) {
        adminGuardService.requireAdmin(userId);
        return Result.success(adminResumeAiSettingsService.uploadInterviewerAvatar(personaKey, file));
    }
}
