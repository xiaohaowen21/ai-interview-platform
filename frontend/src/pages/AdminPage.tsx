import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Power, RefreshCcw, Search, Settings, Shield, Trash2, UserRound, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  adminApi,
  type InterviewerAvatarKey,
  type LandingModuleKey,
  type AdminResumeAiSettings,
  type AdminUserItem,
} from '../api/admin';
import { getErrorMessage } from '../api/request';
import MediaAsset from '../components/MediaAsset';
import { ADMIN_SECTIONS, parseAdminSection } from '../constants/adminSections';
import { formatDateTime } from '../utils/date';
import { getCurrentUser } from '../utils/auth';

const PAGE_SIZE = 8;
const LANDING_IMAGE_SPECS: Array<{
  field: keyof Pick<AdminResumeAiSettings, 'resumeAnalysisImageUrl' | 'mockWrittenExamImageUrl' | 'formalInterviewImageUrl' | 'knowledgeBaseQaImageUrl' | 'careerGuideImageUrl'>;
  moduleKey: LandingModuleKey;
  title: string;
}> = [
  { field: 'resumeAnalysisImageUrl', moduleKey: 'resume-analysis', title: '简历分析展示媒体' },
  { field: 'mockWrittenExamImageUrl', moduleKey: 'mock-written-exam', title: 'AI预测面试展示媒体' },
  { field: 'formalInterviewImageUrl', moduleKey: 'formal-interview', title: '正式面试展示媒体' },
  { field: 'knowledgeBaseQaImageUrl', moduleKey: 'knowledge-base-qa', title: '知识库问答展示媒体' },
  { field: 'careerGuideImageUrl', moduleKey: 'career-guide', title: '求职攻略展示媒体' },
];

const FEATURE_CARD_MEDIA_SPECS: Array<{
  field: keyof Pick<AdminResumeAiSettings, 'resumeAnalysisCardMediaUrl' | 'mockWrittenExamCardMediaUrl' | 'formalInterviewCardMediaUrl' | 'knowledgeBaseQaCardMediaUrl' | 'careerGuideCardMediaUrl'>;
  moduleKey: LandingModuleKey;
  title: string;
}> = [
  { field: 'resumeAnalysisCardMediaUrl', moduleKey: 'resume-analysis-card', title: '简历分析卡片媒体' },
  { field: 'mockWrittenExamCardMediaUrl', moduleKey: 'mock-written-exam-card', title: 'AI预测面试卡片媒体' },
  { field: 'formalInterviewCardMediaUrl', moduleKey: 'formal-interview-card', title: '语音面试卡片媒体' },
  { field: 'knowledgeBaseQaCardMediaUrl', moduleKey: 'knowledge-base-qa-card', title: '知识库问答卡片媒体' },
  { field: 'careerGuideCardMediaUrl', moduleKey: 'career-guide-card', title: '求职攻略卡片媒体' },
];

const INTERVIEWER_AVATAR_SPECS: Array<{
  field: keyof Pick<AdminResumeAiSettings, 'dongmingzhuAvatarUrl' | 'leijunAvatarUrl' | 'muskAvatarUrl' | 'trumpAvatarUrl'>;
  personaKey: InterviewerAvatarKey;
  title: string;
}> = [
  { field: 'dongmingzhuAvatarUrl', personaKey: 'dongmingzhu', title: '面试官 A 头像' },
  { field: 'leijunAvatarUrl', personaKey: 'leijun', title: '面试官 B 头像' },
  { field: 'muskAvatarUrl', personaKey: 'musk', title: '面试官 C 头像' },
  { field: 'trumpAvatarUrl', personaKey: 'trump', title: '面试官 D 头像' },
];

function formatTime(value: string | null): string {
  return formatDateTime(value);
}

export default function AdminPage() {
  const currentUser = getCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingSettings, setTestingSettings] = useState(false);
  const [savingOwnPassword, setSavingOwnPassword] = useState(false);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [settings, setSettings] = useState<AdminResumeAiSettings>({
    baseUrl: '',
    apiKey: '',
    model: '',
    mockInterviewUrl: '',
    resumeAnalysisImageUrl: '',
    mockWrittenExamImageUrl: '',
    formalInterviewImageUrl: '',
    knowledgeBaseQaImageUrl: '',
    careerGuideImageUrl: '',
    resumeAnalysisCardMediaUrl: '',
    mockWrittenExamCardMediaUrl: '',
    formalInterviewCardMediaUrl: '',
    knowledgeBaseQaCardMediaUrl: '',
    careerGuideCardMediaUrl: '',
    dongmingzhuAvatarUrl: '',
    leijunAvatarUrl: '',
    muskAvatarUrl: '',
    trumpAvatarUrl: '',
    updatedAt: null,
  });
  const [roleDraft, setRoleDraft] = useState<Record<number, 'ADMIN' | 'USER'>>({});
  const [passwordDraft, setPasswordDraft] = useState<Record<number, string>>({});
  const [ownPassword, setOwnPassword] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testPassed, setTestPassed] = useState<boolean | null>(null);
  const [uploadingModule, setUploadingModule] = useState<LandingModuleKey | null>(null);
  const [uploadingPersona, setUploadingPersona] = useState<InterviewerAvatarKey | null>(null);
  const activeSection = parseAdminSection(location.hash);

  const filteredUsers = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return users;
    }

    return users.filter((item) => {
      const text = [
        item.username,
        item.email ?? '',
        item.role,
        item.enabled ? '启用' : '停用',
      ].join(' ').toLowerCase();
      return text.includes(normalized);
    });
  }, [keyword, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, page]);

  useEffect(() => {
    setPage(1);
  }, [keyword]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const clearMessages = () => {
    setError('');
    setSuccess('');
    setTestMessage('');
    setTestPassed(null);
  };

  const buildSettingsPayload = () => ({
    baseUrl: settings.baseUrl.trim(),
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
    mockInterviewUrl: settings.mockInterviewUrl.trim(),
    resumeAnalysisImageUrl: settings.resumeAnalysisImageUrl.trim(),
    mockWrittenExamImageUrl: settings.mockWrittenExamImageUrl.trim(),
    formalInterviewImageUrl: settings.formalInterviewImageUrl.trim(),
    knowledgeBaseQaImageUrl: settings.knowledgeBaseQaImageUrl.trim(),
    careerGuideImageUrl: settings.careerGuideImageUrl.trim(),
    resumeAnalysisCardMediaUrl: settings.resumeAnalysisCardMediaUrl.trim(),
    mockWrittenExamCardMediaUrl: settings.mockWrittenExamCardMediaUrl.trim(),
    formalInterviewCardMediaUrl: settings.formalInterviewCardMediaUrl.trim(),
    knowledgeBaseQaCardMediaUrl: settings.knowledgeBaseQaCardMediaUrl.trim(),
    careerGuideCardMediaUrl: settings.careerGuideCardMediaUrl.trim(),
    dongmingzhuAvatarUrl: settings.dongmingzhuAvatarUrl.trim(),
    leijunAvatarUrl: settings.leijunAvatarUrl.trim(),
    muskAvatarUrl: settings.muskAvatarUrl.trim(),
    trumpAvatarUrl: settings.trumpAvatarUrl.trim(),
  });

  const syncRoleDraft = (userList: AdminUserItem[]) => {
    const nextRoleDraft: Record<number, 'ADMIN' | 'USER'> = {};
    for (const item of userList) {
      nextRoleDraft[item.id] = item.role === 'ADMIN' ? 'ADMIN' : 'USER';
    }
    setRoleDraft(nextRoleDraft);
  };

  const loadData = async () => {
    clearMessages();
    try {
      setLoading(true);
      const [userList, apiSettings] = await Promise.all([
        adminApi.listUsers(),
        adminApi.getResumeAiSettings(),
      ]);
      setUsers(userList);
      syncRoleDraft(userList);
      setSettings(apiSettings);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSectionChange = (section: string) => {
    navigate({ pathname: '/admin', hash: `#${section}` });
  };

  const updateUserInList = (nextUser: AdminUserItem) => {
    setUsers((previous) => previous.map((item) => (item.id === nextUser.id ? nextUser : item)));
    setRoleDraft((previous) => ({
      ...previous,
      [nextUser.id]: nextUser.role === 'ADMIN' ? 'ADMIN' : 'USER',
    }));
  };

  const saveSettings = async () => {
    clearMessages();
    if (!settings.baseUrl.trim() || !settings.apiKey.trim() || !settings.model.trim() || !settings.mockInterviewUrl.trim()) {
      setError('请填写完整的系统配置。');
      return;
    }

    try {
      setSavingSettings(true);
      const updated = await adminApi.updateResumeAiSettings(buildSettingsPayload());
      setSettings(updated);
      setSuccess('系统配置已保存。');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingSettings(false);
    }
  };

  const testSettings = async () => {
    clearMessages();
    if (!settings.baseUrl.trim() || !settings.apiKey.trim() || !settings.model.trim() || !settings.mockInterviewUrl.trim()) {
      setError('请先填写完整的系统配置。');
      return;
    }

    try {
      setTestingSettings(true);
      const result = await adminApi.testResumeAiSettings(buildSettingsPayload());
      setTestPassed(result.success);
      setTestMessage(`${result.message}（耗时 ${result.latencyMs}ms）`);
    } catch (err) {
      setTestPassed(false);
      setTestMessage(getErrorMessage(err));
    } finally {
      setTestingSettings(false);
    }
  };

  const uploadLandingImage = async (moduleKey: LandingModuleKey, file: File) => {
    clearMessages();
    try {
      setUploadingModule(moduleKey);
      const updated = await adminApi.uploadLandingImage(moduleKey, file);
      setSettings(updated);
      setSuccess('展示媒体已更新。');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingModule(null);
    }
  };

  const uploadInterviewerAvatar = async (personaKey: InterviewerAvatarKey, file: File) => {
    clearMessages();
    try {
      setUploadingPersona(personaKey);
      const updated = await adminApi.uploadInterviewerAvatar(personaKey, file);
      setSettings(updated);
      setSuccess('面试官头像已更新。');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingPersona(null);
    }
  };

  const changeOwnPassword = async () => {
    clearMessages();
    if (!ownPassword.currentPassword.trim() || !ownPassword.newPassword.trim()) {
      setError('请填写当前密码和新密码。');
      return;
    }
    if (ownPassword.newPassword !== ownPassword.confirmPassword) {
      setError('两次输入的新密码不一致。');
      return;
    }

    try {
      setSavingOwnPassword(true);
      await adminApi.changeOwnPassword({
        currentPassword: ownPassword.currentPassword,
        newPassword: ownPassword.newPassword,
      });
      setOwnPassword({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setSuccess('管理员密码已更新。');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingOwnPassword(false);
    }
  };

  const saveUserRole = async (userId: number) => {
    clearMessages();
    try {
      setBusyUserId(userId);
      const updated = await adminApi.updateUserRole(userId, { role: roleDraft[userId] ?? 'USER' });
      updateUserInList(updated);
      setSuccess('用户角色已更新。');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyUserId(null);
    }
  };

  const resetUserPassword = async (userId: number) => {
    clearMessages();
    const nextPassword = (passwordDraft[userId] ?? '').trim();
    if (!nextPassword) {
      setError('请先输入新密码。');
      return;
    }

    try {
      setBusyUserId(userId);
      const updated = await adminApi.resetUserPassword(userId, { newPassword: nextPassword });
      updateUserInList(updated);
      setPasswordDraft((previous) => ({ ...previous, [userId]: '' }));
      setSuccess('用户密码已重置。');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyUserId(null);
    }
  };

  const toggleUserStatus = async (user: AdminUserItem) => {
    clearMessages();
    const nextEnabled = !user.enabled;
    const actionText = nextEnabled ? '启用' : '停用';
    if (!window.confirm(`确认${actionText}用户“${user.username}”吗？`)) {
      return;
    }

    try {
      setBusyUserId(user.id);
      const updated = await adminApi.updateUserStatus(user.id, { enabled: nextEnabled });
      updateUserInList(updated);
      setSuccess(`用户已${actionText}。`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyUserId(null);
    }
  };

  const deleteUser = async (user: AdminUserItem) => {
    clearMessages();
    if (!window.confirm(`确认删除用户“${user.username}”吗？删除后不可恢复。`)) {
      return;
    }

    try {
      setBusyUserId(user.id);
      await adminApi.deleteUser(user.id);
      setUsers((previous) => previous.filter((item) => item.id !== user.id));
      setRoleDraft((previous) => {
        const next = { ...previous };
        delete next[user.id];
        return next;
      });
      setPasswordDraft((previous) => {
        const next = { ...previous };
        delete next[user.id];
        return next;
      });
      setSuccess('用户已删除。');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-12 text-center text-slate-600 shadow-sm">
          正在加载管理员数据...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <Shield className="h-7 w-7 text-[#1f3b2f]" />
              后台管理
            </h1>
            <p className="mt-2 text-sm text-slate-500">集中管理系统配置、管理员密码和用户状态。</p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            <RefreshCcw className="h-4 w-4" />
            刷新
          </button>
        </div>

        {error ? <Notice tone="error" message={error} /> : null}
        {success ? <Notice tone="success" message={success} /> : null}
      </section>

      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-3 shadow-sm lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {ADMIN_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => handleSectionChange(section.id)}
                className={`whitespace-nowrap rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                  activeSection === section.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {section.title}
              </button>
            ))}
          </div>
        </div>

      {(activeSection === 'system' || activeSection === 'password') && (
      <section className="grid gap-6">
        {activeSection === 'system' && (
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Settings className="h-5 w-5 text-slate-700" />
            系统配置
          </h2>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ConfigField label="API 地址" value={settings.baseUrl} placeholder="https://example.com/compatible-mode" onChange={(value) => setSettings((previous) => ({ ...previous, baseUrl: value }))} />
            <ConfigField label="API Key" value={settings.apiKey} placeholder="输入 API Key" onChange={(value) => setSettings((previous) => ({ ...previous, apiKey: value }))} />
            <ConfigField label="模型名称" value={settings.model} placeholder="qwen-plus" onChange={(value) => setSettings((previous) => ({ ...previous, model: value }))} />
            <ConfigField label="模拟面试地址" value={settings.mockInterviewUrl} placeholder="https://mianbaojob.xyz/mock-interview" onChange={(value) => setSettings((previous) => ({ ...previous, mockInterviewUrl: value }))} />
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ImagePlus className="h-4 w-4 text-slate-600" />
              模块详情展示媒体（用于下方大展示位，支持 PNG/JPG/JPEG/WEBP/GIF/MP4/MOV/M4V/WEBM/OGG）
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {LANDING_IMAGE_SPECS.map((spec) => (
                <div key={spec.field} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                  <label className="mb-2 block text-xs font-semibold text-slate-700">{spec.title}</label>
                  <input
                    type="text"
                    value={settings[spec.field] ?? ''}
                    onChange={(event) => setSettings((previous) => ({ ...previous, [spec.field]: event.target.value }))}
                    placeholder="可直接粘贴图片、GIF 或视频 URL"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  />

                  <div className="mt-3 aspect-[16/9] overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {settings[spec.field] ? (
                      <MediaAsset
                        src={settings[spec.field]}
                        alt={spec.title}
                        interactive
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">未设置媒体</div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                      {uploadingModule === spec.moduleKey ? '上传中...' : '上传/替换'}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/x-m4v,video/webm,video/ogg,.mp4,.mov,.m4v,.webm,.ogg"
                        disabled={uploadingModule !== null}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.currentTarget.value = '';
                          if (!file) {
                            return;
                          }
                          void uploadLandingImage(spec.moduleKey, file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      onClick={() => setSettings((previous) => ({ ...previous, [spec.field]: '' }))}
                    >
                      清空
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ImagePlus className="h-4 w-4 text-slate-600" />
              核心功能卡片媒体（用于上方四张卡片缩略位，支持 PNG/JPG/JPEG/WEBP/GIF/MP4/MOV/M4V/WEBM/OGG）
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {FEATURE_CARD_MEDIA_SPECS.map((spec) => (
                <div key={spec.field} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                  <label className="mb-2 block text-xs font-semibold text-slate-700">{spec.title}</label>
                  <input
                    type="text"
                    value={settings[spec.field] ?? ''}
                    onChange={(event) => setSettings((previous) => ({ ...previous, [spec.field]: event.target.value }))}
                    placeholder="可直接粘贴图片、GIF 或视频 URL"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                  />

                  <div className="mt-3 aspect-[16/9] overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {settings[spec.field] ? (
                      <MediaAsset
                        src={settings[spec.field]}
                        alt={spec.title}
                        interactive
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">未设置媒体</div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                      {uploadingModule === spec.moduleKey ? '上传中...' : '上传/替换'}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/x-m4v,video/webm,video/ogg,.mp4,.mov,.m4v,.webm,.ogg"
                        disabled={uploadingModule !== null}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.currentTarget.value = '';
                          if (!file) {
                            return;
                          }
                          void uploadLandingImage(spec.moduleKey, file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      onClick={() => setSettings((previous) => ({ ...previous, [spec.field]: '' }))}
                    >
                      清空
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">最近更新时间：{formatTime(settings.updatedAt)}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void testSettings()}
                disabled={testingSettings || savingSettings}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {testingSettings ? '测试中...' : '测试 API'}
              </button>
              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={savingSettings || testingSettings}
                className="rounded-xl bg-[#1f3b2f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#172d24] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {savingSettings ? '保存中...' : '保存配置'}
              </button>
            </div>
          </div>

          {testMessage ? <Notice tone={testPassed ? 'success' : 'error'} message={testMessage} compact /> : null}
        </div>
        )}

        {activeSection === 'password' && (
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Shield className="h-5 w-5 text-slate-700" />
            管理员密码
          </h2>
          <div className="space-y-4">
            <ConfigField
              label="当前密码"
              type="password"
              value={ownPassword.currentPassword}
              placeholder="输入当前密码"
              onChange={(value) => setOwnPassword((previous) => ({ ...previous, currentPassword: value }))}
            />
            <ConfigField
              label="新密码"
              type="password"
              value={ownPassword.newPassword}
              placeholder="输入新密码"
              onChange={(value) => setOwnPassword((previous) => ({ ...previous, newPassword: value }))}
            />
            <ConfigField
              label="确认新密码"
              type="password"
              value={ownPassword.confirmPassword}
              placeholder="再次输入新密码"
              onChange={(value) => setOwnPassword((previous) => ({ ...previous, confirmPassword: value }))}
            />
            <button
              type="button"
              onClick={() => void changeOwnPassword()}
              disabled={savingOwnPassword}
              className="w-full rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingOwnPassword ? '保存中...' : '更新管理员密码'}
            </button>
          </div>
        </div>
        )}
      </section>
      )}

      {activeSection === 'avatars' && (
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <UserRound className="h-5 w-5 text-slate-700" />
          面试官头像
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {INTERVIEWER_AVATAR_SPECS.map((spec) => (
            <div key={spec.field} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
              <label className="mb-2 block text-xs font-semibold text-slate-700">{spec.title}</label>
              <input
                type="text"
                value={settings[spec.field] ?? ''}
                onChange={(event) => setSettings((previous) => ({ ...previous, [spec.field]: event.target.value }))}
                placeholder="可直接粘贴图片 URL"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />
              <div className="mt-3 h-40 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {settings[spec.field] ? (
                  <img src={settings[spec.field]} alt={spec.title} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">未设置头像</div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                  {uploadingPersona === spec.personaKey ? '上传中...' : '上传/替换'}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={uploadingPersona !== null}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = '';
                      if (!file) {
                        return;
                      }
                      void uploadInterviewerAvatar(spec.personaKey, file);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  onClick={() => setSettings((previous) => ({ ...previous, [spec.field]: '' }))}
                >
                  清空
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {activeSection === 'users' && (
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Users className="h-5 w-5 text-slate-700" />
              用户管理
            </h2>
            <p className="mt-1 text-sm text-slate-500">支持搜索、分页、停用、删除、修改角色和重置用户密码。</p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索用户名、邮箱、角色"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] bg-white">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                <th className="px-2 py-3">用户</th>
                <th className="px-2 py-3">邮箱</th>
                <th className="px-2 py-3">状态</th>
                <th className="px-2 py-3">角色</th>
                <th className="px-2 py-3">重置密码</th>
                <th className="px-2 py-3">注册时间</th>
                <th className="px-2 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length > 0 ? (
                paginatedUsers.map((item) => {
                  const isCurrentAdmin = currentUser?.userId === String(item.id);
                  const isBusy = busyUserId === item.id;
                  return (
                    <tr key={item.id} className="border-b border-slate-100 text-sm text-slate-700">
                      <td className="px-2 py-3 align-top">
                        <p className="font-semibold text-slate-900">{item.username}</p>
                        <p className="text-xs text-slate-500">ID: {item.id}</p>
                      </td>
                      <td className="px-2 py-3 align-top">
                        {item.hasEmail ? (
                          <div>
                            <p className="font-medium text-slate-900">{item.email}</p>
                            <p className="text-xs text-emerald-600">已绑定邮箱</p>
                          </div>
                        ) : (
                          <span className="text-slate-500">未绑定邮箱</span>
                        )}
                      </td>
                      <td className="px-2 py-3 align-top">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                          {item.enabled ? '启用中' : '已停用'}
                        </span>
                      </td>
                      <td className="px-2 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <select
                            value={roleDraft[item.id] ?? (item.role === 'ADMIN' ? 'ADMIN' : 'USER')}
                            onChange={(event) => {
                              const nextRole = event.target.value === 'ADMIN' ? 'ADMIN' : 'USER';
                              setRoleDraft((previous) => ({ ...previous, [item.id]: nextRole }));
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                          >
                            <option value="USER">普通用户</option>
                            <option value="ADMIN">管理员</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => void saveUserRole(item.id)}
                            disabled={isBusy}
                            className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            保存角色
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            value={passwordDraft[item.id] ?? ''}
                            onChange={(event) => setPasswordDraft((previous) => ({ ...previous, [item.id]: event.target.value }))}
                            className="w-36 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                            placeholder="输入新密码"
                          />
                          <button
                            type="button"
                            onClick={() => void resetUserPassword(item.id)}
                            disabled={isBusy}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            重置密码
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-3 align-top text-xs text-slate-500 whitespace-nowrap">{formatTime(item.createdAt)}</td>
                      <td className="px-2 py-3 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void toggleUserStatus(item)}
                            disabled={isBusy || isCurrentAdmin}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                            title={isCurrentAdmin ? '不能停用当前管理员账号' : ''}
                          >
                            <Power className="h-3.5 w-3.5" />
                            {item.enabled ? '停用' : '启用'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteUser(item)}
                            disabled={isBusy || isCurrentAdmin}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
                            title={isCurrentAdmin ? '不能删除当前管理员账号' : ''}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-2 py-10 text-center text-sm text-slate-500">
                    没有找到匹配的用户。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-500">
            共 {filteredUsers.length} 个用户，当前第 {page} / {totalPages} 页
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              上一页
            </button>
            <button
              type="button"
              onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              下一页
            </button>
          </div>
        </div>
      </section>
      )}
      </div>
    </div>
  );
}

function ConfigField(props: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const { label, value, placeholder, onChange, type = 'text' } = props;
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        placeholder={placeholder}
      />
    </div>
  );
}

function Notice(props: { tone: 'error' | 'success'; message: string; compact?: boolean }) {
  const { tone, message, compact = false } = props;
  return (
    <p
      className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
        compact ? 'mt-3' : ''
      } ${
        tone === 'error'
          ? 'border-red-200 bg-red-50 text-red-600'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      {message}
    </p>
  );
}
