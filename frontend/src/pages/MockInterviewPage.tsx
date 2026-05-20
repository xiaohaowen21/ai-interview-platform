import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, FileStack, Loader2, Mic, RefreshCw } from 'lucide-react';
import { appConfigApi } from '../api/appConfig';
import { historyApi, type ResumeListItem } from '../api/history';
import { oralInterviewApi } from '../api/oralInterview';
import {
  DEFAULT_ORAL_PERSONA_KEY,
  ORAL_PERSONAS,
  applyOralPersonaAvatarOverrides,
  buildOralPersonaStyle,
} from '../constants/oralPersonas';
import { useI18n } from '../i18n/I18nContext';

type MockInterviewLocationState = { resumeId?: number } | null;
type MicrophoneReadinessError =
  | 'MIC_UNSUPPORTED'
  | 'MIC_INSECURE_CONTEXT'
  | 'MIC_PERMISSION_DENIED'
  | 'MIC_DEVICE_NOT_FOUND'
  | 'MIC_DEVICE_BUSY'
  | 'MIC_UNKNOWN';

function isMicDenied(error: unknown) {
  return error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError');
}

async function getMicrophonePermissionState(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  const permissionsApi = navigator.permissions;
  if (!permissionsApi?.query) {
    return 'unknown';
  }
  try {
    const status = await permissionsApi.query({ name: 'microphone' as PermissionName });
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

async function ensureMicrophoneReady() {
  if (!window.isSecureContext) {
    throw new Error('MIC_INSECURE_CONTEXT');
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('MIC_UNSUPPORTED');
  }

  const permission = await getMicrophonePermissionState();
  if (permission === 'denied') {
    throw new Error('MIC_PERMISSION_DENIED');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    if (isMicDenied(error)) {
      throw new Error('MIC_PERMISSION_DENIED');
    }
    if (error instanceof DOMException) {
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('MIC_DEVICE_NOT_FOUND');
      }
      if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        throw new Error('MIC_DEVICE_BUSY');
      }
    }
    throw new Error('MIC_UNKNOWN');
  }
}

export default function MockInterviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale, t } = useI18n();
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [startingLocal, setStartingLocal] = useState(false);
  const [personas, setPersonas] = useState(ORAL_PERSONAS);
  const [selectedPersonaKey, setSelectedPersonaKey] = useState(DEFAULT_ORAL_PERSONA_KEY);

  const presetResumeId = useMemo(() => {
    const state = location.state as MockInterviewLocationState;
    const id = state?.resumeId;
    return Number.isFinite(id) ? String(id) : '';
  }, [location.state]);

  const selectedPersona = useMemo(
    () => personas.find((item) => item.key === selectedPersonaKey) ?? personas[0],
    [personas, selectedPersonaKey],
  );

  const copy = locale === 'zh'
    ? {
        localTitle: '独立语音面试',
        localDesc: '选择简历与面试官风格，进入独立语音面试会话。',
        resumeSelectLabel: '选择简历',
        resumeSelectPlaceholder: '请选择用于语音面试的简历',
        personaLabel: '面试官风格',
        loadingResumes: '正在加载简历列表...',
        emptyResume: '还没有可用于语音面试的简历，先上传一份后再开始。',
        resumeLoadFailed: '简历列表加载失败，请刷新后重试。',
        resumeRequired: '请先选择一份简历。',
        resumeUnavailable: '这份简历暂时没有可用内容，请重新上传或更换简历。',
        personaRequired: '请先选择一个面试官风格。',
        micUnavailable: '当前浏览器不支持麦克风调用，请更换浏览器后重试。',
        micInsecure: '当前页面不是 HTTPS 安全连接，浏览器会阻止麦克风，请改用 HTTPS 域名访问。',
        micDenied: '麦克风权限被拒绝，请在浏览器设置中允许后重试。',
        micNoDevice: '没有检测到可用麦克风设备，请检查系统输入设备后重试。',
        micBusy: '麦克风被其他程序占用，请关闭占用程序后重试。',
        micUnknown: '麦克风初始化失败，请刷新页面后重试。',
        localStart: '开始语音面试',
        localStarting: '正在创建语音面试会话...',
        localStartFailed: '进入语音面试失败，请稍后重试。',
        viewHistory: '查看历史简历',
        goUpload: '先上传简历',
        refresh: '刷新列表',
      }
    : {
        localTitle: 'Independent Local Voice Interview',
        localDesc: 'Choose resume and interviewer persona, then enter a dedicated voice interview session.',
        resumeSelectLabel: 'Choose Resume',
        resumeSelectPlaceholder: 'Select a resume for the voice interview',
        personaLabel: 'Choose Interviewer Persona',
        loadingResumes: 'Loading resume list...',
        emptyResume: 'No resume is available for local voice interview yet. Upload one first.',
        resumeLoadFailed: 'Failed to load resumes. Please refresh and try again.',
        resumeRequired: 'Please choose a resume first.',
        resumeUnavailable: 'This resume has no usable content right now. Please upload again or choose another one.',
        personaRequired: 'Please choose an interviewer persona first.',
        micUnavailable: 'This browser does not support microphone access. Please try another browser.',
        micInsecure: 'This page is not secure (HTTPS required), so microphone access is blocked.',
        micDenied: 'Microphone permission was denied. Please allow it in browser settings.',
        micNoDevice: 'No microphone device was detected. Please check your input device.',
        micBusy: 'Microphone is busy in another app. Please close the other app and retry.',
        micUnknown: 'Failed to initialize microphone. Please refresh and retry.',
        localStart: 'Start Local Voice Interview',
        localStarting: 'Creating voice interview session...',
        localStartFailed: 'Failed to start local voice interview. Please try again later.',
        viewHistory: 'Open Resume History',
        goUpload: 'Upload Resume First',
        refresh: 'Refresh List',
      };

  const loadResumes = async () => {
    setLoadingResumes(true);
    setResumeError('');
    try {
      const data = await historyApi.getResumes();
      setResumes(data);
      setSelectedResumeId((previous) => {
        if (data.some((item) => String(item.id) === previous)) return previous;
        if (presetResumeId && data.some((item) => String(item.id) === presetResumeId)) return presetResumeId;
        return data[0] ? String(data[0].id) : '';
      });
    } catch (error) {
      console.error('Failed to load resumes for local interview', error);
      setResumes([]);
      setSelectedResumeId('');
      setResumeError(copy.resumeLoadFailed);
    } finally {
      setLoadingResumes(false);
    }
  };

  useEffect(() => {
    void loadResumes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadAvatarConfig = async () => {
      try {
        const config = await appConfigApi.getPublicConfig();
        if (cancelled) {
          return;
        }
        setPersonas(
          applyOralPersonaAvatarOverrides(ORAL_PERSONAS, {
            dongmingzhuAvatarUrl: config.dongmingzhuAvatarUrl,
            leijunAvatarUrl: config.leijunAvatarUrl,
            muskAvatarUrl: config.muskAvatarUrl,
            trumpAvatarUrl: config.trumpAvatarUrl,
          }),
        );
      } catch {
        if (!cancelled) {
          setPersonas(ORAL_PERSONAS);
        }
      }
    };
    void loadAvatarConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (presetResumeId && resumes.some((item) => String(item.id) === presetResumeId)) {
      setSelectedResumeId(presetResumeId);
    }
  }, [presetResumeId, resumes]);

  const handleStartLocal = async () => {
    setResumeError('');
    if (!selectedResumeId) {
      setResumeError(copy.resumeRequired);
      return;
    }
    if (!selectedPersona) {
      setResumeError(copy.personaRequired);
      return;
    }
    setStartingLocal(true);
    try {
      await ensureMicrophoneReady();
      const resumeId = Number(selectedResumeId);
      const detail = await historyApi.getResumeDetail(resumeId);
      const resumeText = detail.resumeText?.trim();
      if (!resumeText) {
        setResumeError(copy.resumeUnavailable);
        return;
      }
      const session = await oralInterviewApi.createSession({
        resumeText,
        questionCount: 8,
        resumeId,
        forceCreate: true,
        interviewerStyle: buildOralPersonaStyle(selectedPersona.key),
      });
      navigate(`/oral-interview/${session.sessionId}`);
    } catch (error) {
      console.error('Failed to open local oral interview', error);
      if (error instanceof Error) {
        const code = error.message as MicrophoneReadinessError;
        if (code === 'MIC_UNSUPPORTED') {
          setResumeError(copy.micUnavailable);
        } else if (code === 'MIC_INSECURE_CONTEXT') {
          setResumeError(copy.micInsecure);
        } else if (code === 'MIC_PERMISSION_DENIED') {
          setResumeError(copy.micDenied);
        } else if (code === 'MIC_DEVICE_NOT_FOUND') {
          setResumeError(copy.micNoDevice);
        } else if (code === 'MIC_DEVICE_BUSY') {
          setResumeError(copy.micBusy);
        } else if (code === 'MIC_UNKNOWN') {
          setResumeError(copy.micUnknown);
        } else {
          setResumeError(copy.localStartFailed);
        }
      } else if (isMicDenied(error)) {
        setResumeError(copy.micDenied);
      } else {
        setResumeError(copy.localStartFailed);
      }
    } finally {
      setStartingLocal(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="rounded-[32px] border border-slate-200 bg-white/95 p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800/95">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 text-white dark:bg-white dark:text-slate-900"><Mic className="h-8 w-8" /></div>
          <div><h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('mockInterview.title')}</h1></div>
        </div>
      </motion.div>

      <div className="grid gap-6">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex h-full flex-col rounded-[32px] border border-slate-200 bg-white/95 p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800/95">
          <div className="flex h-full flex-col">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-white"><FileStack className="h-7 w-7" /></div>
                <div><h2 className="text-2xl font-bold text-slate-900 dark:text-white">{copy.localTitle}</h2><p className="mt-1 text-slate-500 dark:text-slate-400">{copy.localDesc}</p></div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label htmlFor="local-interview-resume" className="text-sm font-medium text-slate-700 dark:text-slate-300">{copy.resumeSelectLabel}</label>
                <button type="button" onClick={() => void loadResumes()} disabled={loadingResumes} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/60">
                  <RefreshCw className={`h-4 w-4 ${loadingResumes ? 'animate-spin' : ''}`} />{copy.refresh}
                </button>
              </div>

              <select id="local-interview-resume" value={selectedResumeId} disabled={loadingResumes || resumes.length === 0} onChange={(event) => setSelectedResumeId(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <option value="">{loadingResumes ? copy.loadingResumes : copy.resumeSelectPlaceholder}</option>
                {resumes.map((item) => <option key={item.id} value={item.id}>{item.filename}</option>)}
              </select>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">{copy.personaLabel}</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {personas.map((persona) => {
                    const selected = persona.key === selectedPersonaKey;
                    return (
                      <button key={persona.key} type="button" onClick={() => setSelectedPersonaKey(persona.key)} className={`rounded-2xl border px-4 py-3 text-left transition ${selected ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-slate-500'}`}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <img
                              src={persona.avatar}
                              alt={persona.label}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                            <span className="text-sm font-semibold">{persona.label}</span>
                          </div>
                          {selected ? <CheckCircle2 className="h-4 w-4" /> : null}
                        </div>
                        <p className={`text-xs ${selected ? 'text-white/80 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>{persona.subtitle}</p>
                        <p className={`mt-2 text-xs ${selected ? 'text-white/90 dark:text-slate-700' : 'text-slate-500 dark:text-slate-400'}`}>{persona.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {resumeError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">{resumeError}</div> : null}
              {resumes.length === 0 && !loadingResumes && !resumeError ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">{copy.emptyResume}</div> : null}
            </div>

            <div className="mt-auto flex flex-wrap gap-3 pt-6">
              <button type="button" onClick={handleStartLocal} disabled={startingLocal || loadingResumes || !selectedResumeId} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3.5 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
                {startingLocal ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}
                {startingLocal ? copy.localStarting : copy.localStart}
              </button>
              <button type="button" onClick={() => navigate(resumes.length > 0 ? '/history' : '/upload')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3.5 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700/60">
                {resumes.length > 0 ? copy.viewHistory : copy.goUpload}<ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
