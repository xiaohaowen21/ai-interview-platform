export interface CurrentUser {
  userId: string;
  username: string;
  role: 'ADMIN' | 'USER';
  hasEmail: boolean;
}

const CURRENT_USER_KEY = 'ig_current_user';
const AUTH_CHANGE_EVENT = 'ig-auth-change';

function emitAuthChange(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function setCurrentUser(user: CurrentUser): void {
  try {
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    emitAuthChange();
  } catch {
    return;
  }
}

export function getCurrentUser(): CurrentUser | null {
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CurrentUser> & { hasSecurityQuestion?: boolean };
    if (!parsed.userId || !parsed.username) {
      return null;
    }

    const role = parsed.role === 'ADMIN' ? 'ADMIN' : 'USER';
    const hasEmail = Boolean(parsed.hasEmail ?? parsed.hasSecurityQuestion);

    return {
      userId: parsed.userId,
      username: parsed.username,
      role,
      hasEmail,
    };
  } catch {
    return null;
  }
}

export function getCurrentUserId(): string | null {
  return getCurrentUser()?.userId ?? null;
}

export function logoutUser(): void {
  try {
    window.localStorage.removeItem(CURRENT_USER_KEY);
    emitAuthChange();
  } catch {
    return;
  }
}

export function isAdminUser(): boolean {
  return getCurrentUser()?.role === 'ADMIN';
}

export function subscribeAuthChange(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = () => listener();
  window.addEventListener(AUTH_CHANGE_EVENT, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
