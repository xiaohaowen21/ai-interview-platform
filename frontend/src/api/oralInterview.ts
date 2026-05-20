import { request } from './request';
import { getCurrentUserId } from '../utils/auth';
import type {
  CreateInterviewRequest,
  InterviewReport,
  InterviewSession,
  InterviewStreamEvent,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from '../types/interview';

function getApiBaseUrl() {
  return request.getInstance().defaults.baseURL || '';
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string };
    return data?.message || '请求失败，请重试';
  } catch {
    return '请求失败，请重试';
  }
}

export const oralInterviewApi = {
  async createSession(req: CreateInterviewRequest): Promise<InterviewSession> {
    return request.post<InterviewSession>('/api/oral/sessions', req, {
      timeout: 180000,
    });
  },

  async getSession(sessionId: string): Promise<InterviewSession> {
    return request.get<InterviewSession>(`/api/oral/sessions/${sessionId}`);
  },

  async submitAnswer(req: SubmitAnswerRequest): Promise<SubmitAnswerResponse> {
    return request.post<SubmitAnswerResponse>(
      `/api/oral/sessions/${req.sessionId}/answers`,
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

    const response = await fetchWithTimeout(`${getApiBaseUrl()}/api/oral/sessions/${req.sessionId}/answers/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        questionIndex: req.questionIndex,
        answer: req.answer,
      }),
    }, 180000);

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

  async completeInterview(sessionId: string): Promise<void> {
    return request.post<void>(`/api/oral/sessions/${sessionId}/complete`);
  },

  async getReport(sessionId: string): Promise<InterviewReport> {
    return request.get<InterviewReport>(`/api/oral/sessions/${sessionId}/report`, {
      timeout: 180000,
    });
  },

  async answerFollowUp(sessionId: string, question: string): Promise<{ answer: string }> {
    return request.post<{ answer: string }>(`/api/oral/sessions/${sessionId}/follow-up`, { question }, {
      timeout: 180000,
    });
  },
};
