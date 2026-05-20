import { request } from './request';

export type ResumeRewriteStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ResumeRewriteProfile {
  fullName: string;
  phone: string;
  email: string;
  location: string;
  links: string;
}

export interface ResumeRewriteSectionItem {
  title: string;
  subtitle: string;
  period: string;
  highlights: string[];
}

export interface ResumeRewriteContent {
  profile: ResumeRewriteProfile;
  targetPosition: string;
  professionalSummary: string;
  coreSkills: string[];
  workExperiences: ResumeRewriteSectionItem[];
  projectExperiences: ResumeRewriteSectionItem[];
  educationExperiences: ResumeRewriteSectionItem[];
  certifications: string[];
  additionalInformation: string[];
  optimizationHighlights: string[];
}

export interface ResumeRewriteItem {
  id: number;
  resumeId: number;
  filename: string;
  jobDescription: string;
  status: ResumeRewriteStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  content: ResumeRewriteContent;
}

export interface ResumeRewriteGenerateRequest {
  jobDescription: string;
}

export interface ResumeRewriteUpdateRequest {
  jobDescription: string;
  content: ResumeRewriteContent;
}

export const resumeRewriteApi = {
  async listByResume(resumeId: number): Promise<ResumeRewriteItem[]> {
    return request.get<ResumeRewriteItem[]>(`/api/resumes/${resumeId}/rewrites`);
  },

  async generate(resumeId: number, data: ResumeRewriteGenerateRequest): Promise<ResumeRewriteItem> {
    return request.post<ResumeRewriteItem>(`/api/resumes/${resumeId}/rewrites`, data, {
      timeout: 300000,
    });
  },

  async getById(rewriteId: number): Promise<ResumeRewriteItem> {
    return request.get<ResumeRewriteItem>(`/api/resume-rewrites/${rewriteId}`);
  },

  async update(rewriteId: number, data: ResumeRewriteUpdateRequest): Promise<ResumeRewriteItem> {
    return request.put<ResumeRewriteItem>(`/api/resume-rewrites/${rewriteId}`, data, {
      timeout: 300000,
    });
  },

  async exportPdf(rewriteId: number): Promise<Blob> {
    const response = await request.getInstance().get(`/api/resume-rewrites/${rewriteId}/export`, {
      responseType: 'blob',
      skipResultTransform: true,
      timeout: 180000,
    } as never);
    return response.data;
  },
};
