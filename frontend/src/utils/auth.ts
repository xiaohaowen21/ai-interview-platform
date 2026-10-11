export interface CurrentUser {
  userId: string;
  username: string;
  role: 'ADMIN' | 'USER';
  hasEmail: boolean;
}

const CURRENT_USER_KEY = 'ig_current_user';
const AUTH_TOKEN_KEY = 'ig_auth_token';
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
    // 旧版本的登录状态没有签名令牌，服务端不再承认，视为未登录以引导重新登录
    if (!window.localStorage.getItem(AUTH_TOKEN_KEY)) return null;
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

export function setAuthToken(token: string | null | undefined): void {
  try {
    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    return;
  }
}

export function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** 需要登录身份的请求统一带上这组请求头，服务端只认签名令牌。 */
export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function logoutUser(): void {
  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
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
