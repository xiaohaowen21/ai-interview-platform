import { useMemo, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Languages } from 'lucide-react';
import { authApi } from '../../api/auth';
import { useI18n } from '../../i18n/I18nContext';
import { getCurrentUser, setCurrentUser } from '../../utils/auth';

function copy(isZh: boolean) {
  return {
    brand: isZh ? '管理员入口' : 'Admin Portal',
    title: isZh ? '管理员登录' : 'Admin Sign In',
    subtitle: isZh ? '请输入管理员账号和密码' : 'Enter admin credentials',
    username: isZh ? '用户名' : 'Username',
    usernamePlaceholder: isZh ? '请输入管理员用户名' : 'Enter admin username',
    password: isZh ? '密码' : 'Password',
    passwordPlaceholder: isZh ? '请输入管理员密码' : 'Enter admin password',
    login: isZh ? '登录' : 'Sign In',
    processing: isZh ? '处理中...' : 'Processing...',
    show: isZh ? '显示密码' : 'Show password',
    hide: isZh ? '隐藏密码' : 'Hide password',
    emptyAuth: isZh ? '请输入用户名和密码。' : 'Please enter username and password.',
    adminOnly: isZh ? '该账号没有管理员权限。' : 'This account does not have admin access.',
    submitFailed: isZh ? '操作失败，请稍后重试。' : 'Operation failed. Please try again later.',
    language: isZh ? '语言' : 'Language',
    leftTop: isZh ? '管理后台' : 'Admin Console',
    leftTitle: isZh ? '统一配置与权限控制' : 'Unified settings and permissions',
  };
}

function normalizeCredential(value: string): string {
  return value.replace(/\u3000/g, ' ').trim();
}

export default function AdminAuthPage() {
  const { locale, setLocale } = useI18n();
  const text = useMemo(() => copy(locale === 'zh'), [locale]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const completeLogin = (userId: string, usernameValue: string, role: 'ADMIN' | 'USER', hasEmail: boolean) => {
    setCurrentUser({ userId, username: usernameValue, role, hasEmail });
    const user = getCurrentUser();
    if (!user) {
      setError(text.submitFailed);
      return;
    }

    // Force a full route reload so the admin shell picks up the fresh auth state immediately.
    window.location.replace('/admin');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedUsername = normalizeCredential(username);
    const normalizedPassword = normalizeCredential(password);
    if (!normalizedUsername || !normalizedPassword) {
      setError(text.emptyAuth);
      return;
    }

    try {
      setSubmitting(true);
      const result = await authApi.login({ username: normalizedUsername, password: normalizedPassword });
      if (result.role !== 'ADMIN') {
        setError(text.adminOnly);
        return;
      }
      completeLogin(result.userId, result.username, result.role, result.hasEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.submitFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#efeeea] px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[30px] bg-white shadow-[0_24px_80px_rgba(49,42,36,0.12)] lg:grid-cols-[0.94fr_1.06fr]">
          <section className="p-6 md:p-8">
            <div className="relative flex min-h-[560px] flex-col justify-between overflow-hidden rounded-[26px] bg-[linear-gradient(180deg,#8ac0cc_0%,#6baab1_26%,#406d73_100%)] p-7 text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.36),transparent_32%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.12),transparent_28%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.2))]" />
              <div className="absolute left-10 top-16 h-48 w-48 rounded-full bg-white/14 blur-3xl" />
              <div className="absolute right-6 bottom-10 h-56 w-56 rounded-full bg-black/12 blur-3xl" />
              <div className="relative z-10">
                <p className="text-sm font-semibold tracking-[0.2em] text-white/82">— {text.leftTop} —</p>
              </div>
              <div className="relative z-10 max-w-[260px]">
                <p className="text-sm text-white/82">{text.brand}</p>
                <h2 className="mt-3 text-4xl font-semibold leading-[1.28]">{text.leftTitle}</h2>
              </div>
              <div className="relative z-10 text-lg font-semibold">{text.login}</div>
            </div>
          </section>

          <section className="flex flex-col px-6 py-6 md:px-10 md:py-8">
            <div className="flex justify-end">
              <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 text-xs text-slate-500">
                <span className="flex items-center gap-1 px-2"><Languages className="h-3.5 w-3.5" /><span className="hidden md:inline">{text.language}</span></span>
                <button type="button" onClick={() => setLocale('zh')} className={`rounded-full px-3 py-1.5 ${locale === 'zh' ? 'bg-slate-900 text-white' : ''}`}>中文</button>
                <button type="button" onClick={() => setLocale('en')} className={`rounded-full px-3 py-1.5 ${locale === 'en' ? 'bg-slate-900 text-white' : ''}`}>EN</button>
              </div>
            </div>

            <div className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center">
              <div className="mb-10">
                <h1 className="text-4xl font-semibold text-slate-900">{text.title}</h1>
                <p className="mt-3 text-sm text-slate-500">{text.subtitle}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">{text.username}</span>
                  <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder={text.usernamePlaceholder} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">{text.password}</span>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={text.passwordPlaceholder} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-11 text-sm text-slate-900 outline-none transition focus:border-slate-400" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label={showPassword ? text.hide : text.show}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}

                <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2d2b29] px-5 py-3.5 text-base font-medium text-white hover:bg-[#1f1d1b] disabled:opacity-70">
                  <span>{submitting ? text.processing : text.login}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
