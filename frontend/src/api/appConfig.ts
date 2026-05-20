import { request } from './request';

export interface PublicAppConfig {
  mockInterviewUrl: string;
  resumeAnalysisImageUrl: string;
  mockWrittenExamImageUrl: string;
  formalInterviewImageUrl: string;
  knowledgeBaseQaImageUrl: string;
  careerGuideImageUrl: string;
  resumeAnalysisCardMediaUrl: string;
  mockWrittenExamCardMediaUrl: string;
  formalInterviewCardMediaUrl: string;
  knowledgeBaseQaCardMediaUrl: string;
  careerGuideCardMediaUrl: string;
  dongmingzhuAvatarUrl: string;
  leijunAvatarUrl: string;
  muskAvatarUrl: string;
  trumpAvatarUrl: string;
}

export const appConfigApi = {
  getPublicConfig(): Promise<PublicAppConfig> {
    return request.get<PublicAppConfig>('/api/public/app-config');
  },
};
