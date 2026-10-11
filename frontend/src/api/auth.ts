import { request } from './request';
import { setAuthToken } from '../utils/auth';

export type EmailCodePurpose = 'REGISTER' | 'RESET_PASSWORD';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
  email: string;
  verificationCode: string;
}

export interface AuthResult {
  userId: string;
  username: string;
  role: 'ADMIN' | 'USER';
  hasEmail: boolean;
  token?: string;
}

export interface SendEmailCodePayload {
  email: string;
  purpose: EmailCodePurpose;
  turnstileToken: string;
}

export interface ForgotPasswordResetPayload {
  email: string;
  verificationCode: string;
  newPassword: string;
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthResult> {
    const result = await request.post<AuthResult>('/api/auth/register', payload);
    setAuthToken(result.token);
    return result;
  },

  async login(payload: LoginPayload): Promise<AuthResult> {
    const result = await request.post<AuthResult>('/api/auth/login', payload);
    setAuthToken(result.token);
    return result;
  },

  sendEmailCode(payload: SendEmailCodePayload): Promise<void> {
    return request.post<void>('/api/auth/forgot-password/send-code', payload);
  },

  resetPasswordByEmail(payload: ForgotPasswordResetPayload): Promise<void> {
    return request.post<void>('/api/auth/forgot-password/reset', payload);
  },
};
