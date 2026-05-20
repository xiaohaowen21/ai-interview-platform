package interview.guide.modules.app;

import interview.guide.common.result.Result;
import interview.guide.modules.admin.service.AdminResumeAiSettingsService;
import interview.guide.modules.app.model.PublicAppConfigDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class AppConfigController {

    private final AdminResumeAiSettingsService adminResumeAiSettingsService;

    @GetMapping({"/api/public/app-config", "/api/app/config"})
    public Result<PublicAppConfigDTO> getAppConfig() {
        var landingImages = adminResumeAiSettingsService.getLandingModuleImages();
        var landingCardMedia = adminResumeAiSettingsService.getLandingCardMedia();
        var interviewerAvatars = adminResumeAiSettingsService.getInterviewerAvatarUrls();
        return Result.success(new PublicAppConfigDTO(
            adminResumeAiSettingsService.getMockInterviewUrl(),
            landingImages.resumeAnalysisImageUrl(),
            landingImages.mockWrittenExamImageUrl(),
            landingImages.formalInterviewImageUrl(),
            landingImages.knowledgeBaseQaImageUrl(),
            landingImages.careerGuideImageUrl(),
            landingCardMedia.resumeAnalysisCardMediaUrl(),
            landingCardMedia.mockWrittenExamCardMediaUrl(),
            landingCardMedia.formalInterviewCardMediaUrl(),
            landingCardMedia.knowledgeBaseQaCardMediaUrl(),
            landingCardMedia.careerGuideCardMediaUrl(),
            interviewerAvatars.dongmingzhuAvatarUrl(),
            interviewerAvatars.leijunAvatarUrl(),
            interviewerAvatars.muskAvatarUrl(),
            interviewerAvatars.trumpAvatarUrl()
        ));
    }
}
