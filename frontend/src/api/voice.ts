export interface SynthesizeVoiceRequest {
  text: string;
  personaKey: string;
  styleHint?: string;
}

export interface TranscribeVoiceResult {
  text: string;
  provider: string;
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
      throw new Error('语音服务请求超时，请稍后重试');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json() as { detail?: string; message?: string };
    return data?.detail || data?.message || '语音服务请求失败';
  } catch {
    return '语音服务请求失败';
  }
}

export const voiceApi = {
  async synthesize(payload: SynthesizeVoiceRequest): Promise<Blob> {
    const response = await fetchWithTimeout('/voice-api/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }, 120000);

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    return response.blob();
  },

  async transcribe(audioBlob: Blob, filename = 'answer.webm'): Promise<TranscribeVoiceResult> {
    const formData = new FormData();
    formData.append('audio', audioBlob, filename);

    const response = await fetchWithTimeout('/voice-api/transcribe', {
      method: 'POST',
      body: formData,
    }, 180000);

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    return response.json() as Promise<TranscribeVoiceResult>;
  },
};
