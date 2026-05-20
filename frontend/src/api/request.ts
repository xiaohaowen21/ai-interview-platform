import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getCurrentUserId, logoutUser } from '../utils/auth';

interface Result<T = unknown> {
  code: number;
  message: string;
  data: T;
}

const baseURL = import.meta.env.PROD ? '' : 'http://localhost:8080';

const instance: AxiosInstance = axios.create({
  baseURL,
  timeout: 90000,
});

function translateMessage(message?: string): string {
  const normalized = (message || '').trim();

  if (!normalized) {
    return '请求失败，请稍后重试。';
  }

  const dictionary: Array<[string, string]> = [
    ['AllocationQuota.FreeTierOnly', 'AI 服务额度已用尽，请稍后重试；如持续失败请联系管理员。'],
    ['The free tier of the model has been exhausted', 'AI 服务额度已用尽，请稍后重试；如持续失败请联系管理员。'],
    ['Please disable the "use free tier only" mode', 'AI 服务额度已用尽，请稍后重试；如持续失败请联系管理员。'],
    ['Invalid username or password', '用户名或密码错误'],
    ['Username already exists', '用户名已存在'],
    ['User not found', '用户不存在'],
    ['Please complete the security check', '请先完成人机验证'],
    ['Security verification failed', '安全验证未通过，请重试'],
    ['Security verification service error', '安全验证服务异常，请稍后重试'],
    ['Turnstile service is not configured', '安全验证服务未配置'],
    ['Please enter email', '请输入邮箱'],
    ['Please enter verification code', '请输入验证码'],
    ['Verification code has expired', '验证码已过期，请重新获取'],
    ['Verification code is incorrect', '验证码错误'],
    ['Email service is not configured. Please contact admin.', '邮箱服务未配置，请联系管理员'],
    ['Failed to send verification code', '验证码发送失败，请稍后重试'],
    ['This email is already in use', '该邮箱已被绑定'],
    ['This email is not linked to any account', '该邮箱未绑定账号'],
    ['This account has no email linked', '该账号未绑定邮箱'],
    ['No security question set. Please contact admin to reset.', '该账号未设置密保问题，请联系管理员重置。'],
    ['Security answer is incorrect', '密保答案错误'],
    ['Operation failed. Please try again later.', '操作失败，请稍后重试。'],
    ['Request failed', '请求失败'],
    ['Network Error', '网络连接失败，请检查网络后重试。'],
  ];

  for (const [source, target] of dictionary) {
    if (normalized.includes(source)) {
      return target;
    }
  }

  return normalized;
}

function humanizeUploadError(message?: string): string {
  const normalized = translateMessage(message);

  if (!normalized) {
    return '上传失败，请稍后重试。';
  }

  if (normalized.includes('存储空间正在初始化')) {
    return normalized;
  }

  if (normalized.includes('specified bucket does not exist') || normalized.includes('NoSuchBucket')) {
    return '上传失败：文件存储空间尚未准备完成，请稍后再试。';
  }

  if (normalized.includes('Network Error')) {
    return '上传失败：网络连接异常，请检查网络后重试。';
  }

  if (normalized.toLowerCase().includes('timeout') || normalized.includes('超时')) {
    return '上传失败：请求超时，请稍后再试。';
  }

  return normalized;
}

instance.interceptors.request.use((config) => {
  const userId = getCurrentUserId();
  if (userId) {
    config.headers = config.headers || {};
    config.headers['X-User-Id'] = userId;
  }
  return config;
});

instance.interceptors.response.use(
  (response) => {
    const result = response.data as Result;

    if (result && typeof result === 'object' && 'code' in result) {
      if (result.code === 200) {
        response.data = result.data;
        return response;
      }
      return Promise.reject(new Error(translateMessage(result.message)));
    }

    return response;
  },
  (error) => {
    const config = error.config;
    const isUpload = config && (
      config.url?.includes('/upload') ||
      config.headers?.['Content-Type']?.toString().includes('multipart')
    );

    if (error.response) {
      if (error.response.status === 401) {
        logoutUser();
      }

      const { data } = error.response;
      if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
        const result = data as Result;
        const nextMessage = isUpload
          ? humanizeUploadError(result.message)
          : translateMessage(result.message);
        return Promise.reject(new Error(nextMessage));
      }

      return Promise.reject(new Error(isUpload ? '上传失败，请重试。' : '请求失败，请重试。'));
    }

    if (isUpload) {
      return Promise.reject(new Error('上传失败：网络连接异常或服务繁忙，请稍后重试。'));
    }

    return Promise.reject(new Error('网络连接失败，请检查网络。'));
  }
);

export const request = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return instance.get(url, config).then((response) => response.data);
  },

  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return instance.post(url, data, config).then((response) => response.data);
  },

  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return instance.put(url, data, config).then((response) => response.data);
  },

  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return instance.delete(url, config).then((response) => response.data);
  },

  upload<T>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<T> {
    return instance.post(url, formData, {
      timeout: 300000,
      headers: { 'Content-Type': 'multipart/form-data' },
      ...config,
    }).then((response) => response.data);
  },

  getInstance(): AxiosInstance {
    return instance;
  },
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return translateMessage(error.message);
  }
  return '未知错误';
}

export default request;
