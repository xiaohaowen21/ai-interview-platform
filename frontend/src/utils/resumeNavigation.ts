import { getCurrentUserId } from './auth';

const LAST_VIEWED_RESUME_KEY = 'ig_last_viewed_resume_id';

function buildStorageKey(): string {
  return `${LAST_VIEWED_RESUME_KEY}:${getCurrentUserId() ?? 'guest'}`;
}

export function getLastViewedResumeId(): number | null {
  try {
    const raw = window.localStorage.getItem(buildStorageKey());
    if (!raw) {
      return null;
    }

    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function setLastViewedResumeId(resumeId: number): void {
  if (!Number.isInteger(resumeId) || resumeId <= 0) {
    return;
  }

  try {
    window.localStorage.setItem(buildStorageKey(), String(resumeId));
  } catch {
    return;
  }
}
