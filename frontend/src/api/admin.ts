import { request } from './request';

export interface AdminUserItem {
  id: number;
  username: string;
  email: string | null;
  role: 'ADMIN' | 'USER' | string;
  enabled: boolean;
  hasEmail: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminResumeAiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
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
  updatedAt: string | null;
}

export interface AdminResumeAiSettingsUpdatePayload {
  baseUrl: string;
  apiKey: string;
  model: string;
  mockInterviewUrl: string;
  resumeAnalysisImageUrl?: string;
  mockWrittenExamImageUrl?: string;
  formalInterviewImageUrl?: string;
  knowledgeBaseQaImageUrl?: string;
  careerGuideImageUrl?: string;
  resumeAnalysisCardMediaUrl?: string;
  mockWrittenExamCardMediaUrl?: string;
  formalInterviewCardMediaUrl?: string;
  knowledgeBaseQaCardMediaUrl?: string;
  careerGuideCardMediaUrl?: string;
  dongmingzhuAvatarUrl?: string;
  leijunAvatarUrl?: string;
  muskAvatarUrl?: string;
  trumpAvatarUrl?: string;
}

export interface AdminResumeAiSettingsTestResult {
  success: boolean;
  message: string;
  statusCode: number | null;
  latencyMs: number;
}

export interface AdminUserRoleUpdatePayload {
  role: 'ADMIN' | 'USER';
}

export interface AdminUserPasswordResetPayload {
  newPassword: string;
}

export interface AdminUserStatusUpdatePayload {
  enabled: boolean;
}

export interface AdminSelfPasswordUpdatePayload {
  currentPassword: string;
  newPassword: string;
}

export type LandingModuleKey =
  | 'resume-analysis'
  | 'mock-written-exam'
  | 'formal-interview'
  | 'knowledge-base-qa'
  | 'career-guide'
  | 'resume-analysis-card'
  | 'mock-written-exam-card'
  | 'formal-interview-card'
  | 'knowledge-base-qa-card'
  | 'career-guide-card';

export type InterviewerAvatarKey =
  | 'dongmingzhu'
  | 'leijun'
  | 'musk'
  | 'trump';

export const adminApi = {
  listUsers(): Promise<AdminUserItem[]> {
    return request.get<AdminUserItem[]>('/api/admin/users');
  },

  updateUserRole(userId: number, payload: AdminUserRoleUpdatePayload): Promise<AdminUserItem> {
    return request.put<AdminUserItem>(`/api/admin/users/${userId}/role`, payload);
  },

  resetUserPassword(userId: number, payload: AdminUserPasswordResetPayload): Promise<AdminUserItem> {
    return request.put<AdminUserItem>(`/api/admin/users/${userId}/password`, payload);
  },

  updateUserStatus(userId: number, payload: AdminUserStatusUpdatePayload): Promise<AdminUserItem> {
    return request.put<AdminUserItem>(`/api/admin/users/${userId}/status`, payload);
  },

  deleteUser(userId: number): Promise<void> {
    return request.delete<void>(`/api/admin/users/${userId}`);
  },

  changeOwnPassword(payload: AdminSelfPasswordUpdatePayload): Promise<void> {
    return request.put<void>('/api/admin/me/password', payload);
  },

  getResumeAiSettings(): Promise<AdminResumeAiSettings> {
    return request.get<AdminResumeAiSettings>('/api/admin/resume-ai-settings');
  },

  updateResumeAiSettings(payload: AdminResumeAiSettingsUpdatePayload): Promise<AdminResumeAiSettings> {
    return request.put<AdminResumeAiSettings>('/api/admin/resume-ai-settings', payload);
  },

  testResumeAiSettings(payload: AdminResumeAiSettingsUpdatePayload): Promise<AdminResumeAiSettingsTestResult> {
    return request.post<AdminResumeAiSettingsTestResult>('/api/admin/resume-ai-settings/test', payload);
  },

  uploadLandingImage(module: LandingModuleKey, file: File): Promise<AdminResumeAiSettings> {
    const formData = new FormData();
    formData.append('file', file);
    return request.upload<AdminResumeAiSettings>(`/api/admin/landing-images/${module}`, formData);
  },

  uploadInterviewerAvatar(persona: InterviewerAvatarKey, file: File): Promise<AdminResumeAiSettings> {
    const formData = new FormData();
    formData.append('file', file);
    return request.upload<AdminResumeAiSettings>(`/api/admin/interviewer-avatars/${persona}`, formData);
  },
};
