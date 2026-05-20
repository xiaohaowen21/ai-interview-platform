import { request } from './request';
import { getCurrentUserId } from '../utils/auth';
import type {
  CreateInterviewRequest,
  CurrentQuestionResponse,
  InterviewReport,
  InterviewSession,
  InterviewStreamEvent,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from '../types/interview';

function getApiBaseUrl() {
  return request.getInstance().defaults.baseURL || '';
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string; code?: number };
    return data?.message || '请求失败，请重试';
  } catch {
    return '请求失败，请重试';
  }
}

export const interviewApi = {
  async createSession(req: CreateInterviewRequest): Promise<InterviewSession> {
    return request.post<InterviewSession>('/api/interview/sessions', req, {
      timeout: 180000,
    });
  },

  async getSession(sessionId: string): Promise<InterviewSession> {
    return request.get<InterviewSession>(`/api/interview/sessions/${sessionId}`);
  },

  async getCurrentQuestion(sessionId: string): Promise<CurrentQuestionResponse> {
    return request.get<CurrentQuestionResponse>(`/api/interview/sessions/${sessionId}/question`);
  },

  async submitAnswer(req: SubmitAnswerRequest): Promise<SubmitAnswerResponse> {
    return request.post<SubmitAnswerResponse>(
      `/api/interview/sessions/${req.sessionId}/answers`,
      { questionIndex: req.questionIndex, answer: req.answer },
      { timeout: 180000 }
    );
  },

  async submitAnswerStream(
    req: SubmitAnswerRequest,
    handlers: {
      onEvent: (event: InterviewStreamEvent) => void;
    }
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
    };

    const userId = getCurrentUserId();
    if (userId) {
      headers['X-User-Id'] = userId;
    }

    const response = await fetch(`${getApiBaseUrl()}/api/interview/sessions/${req.sessionId}/answers/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        questionIndex: req.questionIndex,
        answer: req.answer,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(await readErrorMessage(response));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        handlers.onEvent(JSON.parse(trimmed) as InterviewStreamEvent);
      }
    }

    const tail = buffer.trim();
    if (tail) {
      handlers.onEvent(JSON.parse(tail) as InterviewStreamEvent);
    }
  },

  async getReport(sessionId: string): Promise<InterviewReport> {
    return request.get<InterviewReport>(`/api/interview/sessions/${sessionId}/report`, {
      timeout: 180000,
    });
  },

  async findUnfinishedSession(resumeId: number): Promise<InterviewSession | null> {
    try {
      return await request.get<InterviewSession>(`/api/interview/sessions/unfinished/${resumeId}`);
    } catch {
      return null;
    }
  },

  async saveAnswer(req: SubmitAnswerRequest): Promise<void> {
    return request.put<void>(
      `/api/interview/sessions/${req.sessionId}/answers`,
      { questionIndex: req.questionIndex, answer: req.answer }
    );
  },

  async completeInterview(sessionId: string): Promise<void> {
    return request.post<void>(`/api/interview/sessions/${sessionId}/complete`);
  },
};
