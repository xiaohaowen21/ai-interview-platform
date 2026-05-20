import { request } from './request';

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
  register(payload: RegisterPayload): Promise<AuthResult> {
    return request.post<AuthResult>('/api/auth/register', payload);
  },

  login(payload: LoginPayload): Promise<AuthResult> {
    return request.post<AuthResult>('/api/auth/login', payload);
  },

  sendEmailCode(payload: SendEmailCodePayload): Promise<void> {
    return request.post<void>('/api/auth/forgot-password/send-code', payload);
  },

  resetPasswordByEmail(payload: ForgotPasswordResetPayload): Promise<void> {
    return request.post<void>('/api/auth/forgot-password/reset', payload);
  },
};
