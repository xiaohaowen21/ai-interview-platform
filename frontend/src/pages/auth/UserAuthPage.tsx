import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { appConfigApi } from '../../api/appConfig';
import { authApi, type EmailCodePurpose } from '../../api/auth';
import DottedSurface from '../../components/DottedSurface';
import MediaAsset from '../../components/MediaAsset';
import { ProjectCard } from '../../components/newweb/ui/ProjectCard';
import TestimonialMarquee from '../../components/newweb/ui/TestimonialMarquee';
import TurnstileWidget from '../../components/TurnstileWidget';
import { useI18n } from '../../i18n/I18nContext';
import { setCurrentUser } from '../../utils/auth';
import '../../styles/auth.css';

type RegisterStep = 1 | 2;
type ModalMode = 'login' | 'register' | 'forgot' | null;

type ModuleMediaUrls = {
  resumeAnalysis: string;
  mockWrittenExam: string;
  formalInterview: string;
  knowledgeBaseQa: string;
  careerGuide: string;
};

type FeatureCardMediaUrls = {
  resumeAnalysis: string;
  mockWrittenExam: string;
  formalInterview: string;
  knowledgeBaseQa: string;
  careerGuide: string;
};

function createModulePlaceholder(title: string, accent: string): string {
  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f8fafc" />
          <stop offset="100%" stop-color="#e2e8f0" />
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${accent}" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>
      <rect width="1200" height="720" fill="url(#bg)" />
      <circle cx="988" cy="122" r="168" fill="${accent}" opacity="0.16" />
      <circle cx="166" cy="594" r="208" fill="#94a3b8" opacity="0.14" />
      <rect x="120" y="120" width="960" height="480" rx="42" fill="url(#accent)" opacity="0.94" />
      <rect x="168" y="172" width="320" height="28" rx="14" fill="rgba(255,255,255,0.22)" />
      <rect x="168" y="222" width="480" height="96" rx="28" fill="rgba(255,255,255,0.1)" />
      <rect x="168" y="348" width="392" height="20" rx="10" fill="rgba(255,255,255,0.22)" />
      <rect x="168" y="388" width="462" height="20" rx="10" fill="rgba(255,255,255,0.16)" />
      <rect x="168" y="428" width="420" height="20" rx="10" fill="rgba(255,255,255,0.12)" />
      <text x="168" y="275" fill="#ffffff" font-size="58" font-family="Arial, PingFang SC, Microsoft YaHei, sans-serif" font-weight="700">${escapedTitle}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';
const fallbackTurnstileToken = 'turnstile-disabled';
const HEADER_LOGO_URL = '/favicon-mascot.png?v=20260415a';
const DEFAULT_MODULE_IMAGES: ModuleMediaUrls = {
  resumeAnalysis: createModulePlaceholder('Resume Analysis', '#4f7cff'),
  mockWrittenExam: createModulePlaceholder('Mock Interview', '#0f766e'),
  formalInterview: createModulePlaceholder('Formal Interview', '#7c3aed'),
  knowledgeBaseQa: createModulePlaceholder('Knowledge Q&A', '#c2410c'),
  careerGuide: createModulePlaceholder('Career Guide', '#d97706'),
};

const DEFAULT_FEATURE_CARD_MEDIA: FeatureCardMediaUrls = {
  resumeAnalysis: DEFAULT_MODULE_IMAGES.resumeAnalysis,
  mockWrittenExam: DEFAULT_MODULE_IMAGES.mockWrittenExam,
  formalInterview: DEFAULT_MODULE_IMAGES.formalInterview,
  knowledgeBaseQa: DEFAULT_MODULE_IMAGES.knowledgeBaseQa,
  careerGuide: DEFAULT_MODULE_IMAGES.careerGuide,
};

function normalizeCredential(value: string): string {
  return value.replace(/\u3000/g, ' ').trim();
}

export default function UserAuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale, setLocale } = useI18n();
  const isZh = locale === 'zh';
  const fromPath = (location.state as { from?: string } | null)?.from;

  const [modal, setModal] = useState<ModalMode>(null);
  const [registerStep, setRegisterStep] = useState<RegisterStep>(1);
  const [currentSection, setCurrentSection] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [heroSurfaceReady, setHeroSurfaceReady] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [moduleImages, setModuleImages] = useState<ModuleMediaUrls>(DEFAULT_MODULE_IMAGES);
  const [featureCardMedia, setFeatureCardMedia] = useState<FeatureCardMediaUrls>(DEFAULT_FEATURE_CARD_MEDIA);

  const sectionsRef = useRef<Array<HTMLElement | null>>([]);
  const scrollTargetRefs = useRef<Array<HTMLElement | null>>([]);
  const scrollClickRefs = useRef<Array<HTMLElement | null>>([]);

  const copy = useMemo(
    () => ({
      logo: 'Bread',
      navItems: isZh
        ? ['首页', '核心功能', '简历分析', 'AI预测面试', '语音面试', '知识库问答', '求职攻略', '用户评价']
        : ['Home', 'Core Features', 'Resume Analysis', 'Mock Written Exam', 'Voice Interview', 'Knowledge Base Q&A', 'Career Guides', 'User Reviews'],
      modules: isZh
        ? ['简历分析', 'AI预测面试', '语音面试', '知识库问答', '求职攻略']
        : ['Resume Analysis', 'Mock Written Exam', 'Voice Interview', 'Knowledge Base Q&A', 'Career Guides'],
      moduleDeliverLabel: isZh ? '你将获得' : 'You will get',
      moduleFlowLabel: isZh ? '典型流程' : 'Typical flow',
      moduleContent: isZh
        ? [
            {
              overview: '上传 PDF / DOC / DOCX / TXT 后，系统会自动提取简历信息并生成结构化分析结果。',
              tags: ['多格式解析', '结构化评分', '历史可追溯'],
              outputs: ['核心评价与综合得分', '优势与改进建议清单', '可在历史简历中持续回看'],
              steps: ['上传简历并等待首轮分析', '查看优势、短板与岗位匹配建议', '继续进入模拟面试或正式面试'],
            },
            {
              overview: '系统会结合简历内容生成岗位相关题目，提交后给出评分与复盘建议。',
              tags: ['按简历出题', '自动评分', '记录沉淀'],
              outputs: ['本次得分与维度反馈', '逐题点评与改进方向', '完整的模拟面试记录'],
              steps: ['从历史简历选择一份发起', '完成答题并提交', '查看评分图表与复盘结论'],
            },
            {
              overview: '选择简历与面试官风格后进入语音会话，支持追问，并在结束后生成总结。',
              tags: ['语音对话', '追问机制', '会话留痕'],
              outputs: ['完整问答文本记录', '面试表现总结与建议', '可在面试记录中回看'],
              steps: ['选择简历与面试官风格', '授权麦克风并开始对话', '结束后查看面试总结'],
            },
            {
              overview: '上传资料后进行向量化，在问答助手中完成检索增强问答，持续积累岗位知识。',
              tags: ['分类管理', '向量检索', 'RAG 回答'],
              outputs: ['按分类查看知识文件', '基于资料上下文的问答结果', '可持续扩充的知识库体系'],
              steps: ['上传并分类知识文件', '等待向量化处理完成', '在问答助手中检索提问'],
            },
            {
              overview: '沉淀简历写作、岗位准备和面试策略内容，帮助用户在投递前快速补齐求职准备。',
              tags: ['攻略文章', '分类浏览', '持续更新'],
              outputs: ['按主题浏览求职内容', '点击标题查看文章详情', '结合简历分析结果查漏补缺'],
              steps: ['进入求职攻略列表', '按关键词或分类筛选内容', '阅读文章并用于求职准备'],
            },
          ]
        : [
            {
              overview: 'Upload PDF / DOC / DOCX / TXT resumes and get structured analysis automatically.',
              tags: ['Multi-format parsing', 'Structured scoring', 'History tracking'],
              outputs: ['Core evaluation and overall score', 'Strengths and improvement suggestions', 'Traceable records in history'],
              steps: ['Upload a resume and wait for first analysis', 'Review strengths, gaps, and role-fit suggestions', 'Continue to written or voice interview'],
            },
            {
              overview: 'Questions are generated from resume context, then scored automatically after submission.',
              tags: ['Resume-based questions', 'Auto scoring', 'Record retention'],
              outputs: ['Current score with dimensions', 'Per-question feedback and improvement tips', 'Complete written interview record'],
              steps: ['Pick a resume from history', 'Finish and submit answers', 'Review charts and post-exam summary'],
            },
            {
              overview: 'Choose a resume and interviewer style, then start a voice session with follow-up questions.',
              tags: ['Voice conversation', 'Follow-up logic', 'Session trace'],
              outputs: ['Full interview transcript', 'Performance summary and suggestions', 'Replayable interview records'],
              steps: ['Select resume and interviewer style', 'Grant microphone access and start', 'Read summary after interview ends'],
            },
            {
              overview: 'Upload documents, vectorize them, and run retrieval-augmented Q&A in the assistant.',
              tags: ['Category management', 'Vector retrieval', 'RAG answers'],
              outputs: ['Category-based file view', 'Context-grounded answers', 'Expandable knowledge base'],
              steps: ['Upload files with categories', 'Wait for vectorization to finish', 'Ask questions in the assistant'],
            },
            {
              overview: 'Curated guidance for resume writing, role preparation, and interview strategy.',
              tags: ['Guide articles', 'Category browsing', 'Continuous updates'],
              outputs: ['Topic-based career content', 'Clickable article detail pages', 'Preparation tips linked to resume gaps'],
              steps: ['Open the career guide list', 'Filter by keyword or category', 'Read articles before applying'],
            },
          ],
      heroTitle: isZh ? '您的梦想工作从这里开始' : 'YOUR DREAM JOB STARTS HERE',
      heroSubtitle: isZh ? '您的面试求职顾问' : 'Your interview job-seeking consultant',
      coreTitle: isZh ? '核心功能' : 'CORE FEATURES',
      testimonialsTitle: isZh ? '用户评价' : 'User Testimonials',
      login: isZh ? '登录' : 'LOG IN',
      loginTitle: isZh ? '登录' : 'Log in',
      loginDesc: isZh ? '登录您的账户，继续管理您的项目、想法和进度。' : 'Log in to your account and continue managing your projects, ideas, and progress.',
      registerTitle: isZh ? '注册' : 'Sign up',
      registerDesc: isZh ? '创建新账户，开始您的项目管理之旅。' : 'Create a new account to start your project management journey.',
      forgotTitle: isZh ? '找回密码' : 'Reset Password',
      forgotDesc: isZh ? '使用邮箱验证码重置密码。' : 'Use email verification code to reset password.',
      username: isZh ? '用户名' : 'Username',
      usernamePlaceholder: isZh ? '请输入用户名' : 'Enter your username',
      password: isZh ? '密码' : 'Password',
      passwordPlaceholder: isZh ? '请输入密码' : 'Enter your password',
      confirmPassword: isZh ? '确认密码' : 'Confirm Password',
      confirmPasswordPlaceholder: isZh ? '请再次输入密码' : 'Enter password again',
      email: isZh ? '邮箱' : 'Email',
      emailPlaceholder: isZh ? '请输入邮箱地址' : 'Enter your email address',
      code: isZh ? '验证码' : 'Verification Code',
      codePlaceholder: isZh ? '请输入6位验证码' : 'Enter 6-digit verification code',
      sendCode: isZh ? '发送验证码' : 'Send Code',
      next: isZh ? '下一步' : 'Next',
      back: isZh ? '上一步' : 'Back',
      createAccount: isZh ? '创建账号' : 'Create Account',
      resetPassword: isZh ? '重置密码' : 'Reset Password',
      processing: isZh ? '处理中...' : 'Processing...',
      noAccount: isZh ? '还没有账户？' : "Don't have an account?",
      hasAccount: isZh ? '已有账号？' : 'Already have an account?',
      goLogin: isZh ? '去登录' : 'Log in',
      goRegister: isZh ? '注册' : 'Sign up',
      forgotLink: isZh ? '找回密码' : 'Forgot Password',
      emptyAuth: isZh ? '请输入用户名和密码。' : 'Please enter username and password.',
      emailRequired: isZh ? '请输入邮箱。' : 'Please enter email.',
      codeRequired: isZh ? '请输入验证码。' : 'Please enter verification code.',
      passwordMismatch: isZh ? '两次输入的密码不一致。' : 'Passwords do not match.',
      captchaRequired: isZh ? '请先完成人机验证。' : 'Please complete captcha first.',
      registerCodeSent: isZh ? '注册验证码已发送，请查收邮箱。' : 'Registration code sent.',
      resetCodeSent: isZh ? '重置验证码已发送，请查收邮箱。' : 'Reset code sent.',
      resetSuccess: isZh ? '密码重置成功，请返回登录。' : 'Password reset successfully. Please sign in.',
      submitFailed: isZh ? '操作失败，请稍后重试。' : 'Operation failed. Please try again later.',
    }),
    [isZh],
  );

  const featureProjects = useMemo(
    () =>
      isZh
        ? [
            {
              imgSrc: featureCardMedia.resumeAnalysis,
              title: '智能简历分析',
              description: '简历分析 上传简历即可获得 AI 驱动的深度解析与岗位匹配建议。',
              link: '#nav-2',
              linkText: '查看详情',
            },
            {
              imgSrc: featureCardMedia.mockWrittenExam,
              title: 'AI预测面试',
              description: 'AI预测面试 海量真题库配合智能评分系统，精准定位薄弱环节并生成专属提升计划。',
              link: '#nav-3',
              linkText: '查看详情',
            },
            {
              imgSrc: featureCardMedia.formalInterview,
              title: '语音面试',
              description: '语音面试 真实场景模拟面试，AI 实时分析表达逻辑与回答质量，提供针对性改进建议。',
              link: '#nav-4',
              linkText: '查看详情',
            },
            {
              imgSrc: featureCardMedia.knowledgeBaseQa,
              title: '知识库问答',
              description: '知识库问答 基于海量面试资料构建的智能问答，7×24 小时随时解答你的求职疑问。',
              link: '#nav-5',
              linkText: '查看详情',
            },
            {
              imgSrc: featureCardMedia.careerGuide,
              title: '求职攻略',
              description: '求职攻略 汇总简历写作、岗位准备和面试策略内容，帮助你更高效完成求职准备。',
              link: '#nav-6',
              linkText: '查看详情',
            },
          ]
        : [
            {
              imgSrc: featureCardMedia.resumeAnalysis,
              title: 'Intelligent Resume Analysis',
              description: 'Resume analysis with deep AI insights and role-fit recommendations.',
              link: '#nav-2',
              linkText: 'View Project',
            },
            {
              imgSrc: featureCardMedia.mockWrittenExam,
              title: 'Mock Written Exam',
              description: 'Question banks with smart scoring to pinpoint gaps and improve quickly.',
              link: '#nav-3',
              linkText: 'View Project',
            },
            {
              imgSrc: featureCardMedia.formalInterview,
              title: 'Voice Interview',
              description: 'Realistic sessions with live analysis on delivery and answer quality.',
              link: '#nav-4',
              linkText: 'View Project',
            },
            {
              imgSrc: featureCardMedia.knowledgeBaseQa,
              title: 'Knowledge Base Q&A',
              description: '24/7 interview Q&A companion built on curated materials.',
              link: '#nav-5',
              linkText: 'View Project',
            },
            {
              imgSrc: featureCardMedia.careerGuide,
              title: 'Career Guides',
              description: 'Career content for resume writing, role preparation, and interview strategy.',
              link: '#nav-6',
              linkText: 'View Project',
            },
          ],
    [featureCardMedia, isZh],
  );

  const clearNotice = () => {
    setError('');
    setSuccess('');
  };

  const resetTurnstile = () => {
    setTurnstileToken('');
    setTurnstileResetKey((value) => value + 1);
  };

  const clearForm = () => {
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setEmail('');
    setVerificationCode('');
    setNewPassword('');
    setNewPasswordConfirm('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowResetPassword(false);
    setRegisterStep(1);
    clearNotice();
    resetTurnstile();
  };

  const openModal = (next: Exclude<ModalMode, null>) => {
    setModal(next);
    clearForm();
  };

  const closeModal = () => {
    setModal(null);
    clearForm();
  };

  const completeLogin = (
    userId: string,
    usernameValue: string,
    role: 'ADMIN' | 'USER',
    hasEmail: boolean,
  ) => {
    setCurrentUser({ userId, username: usernameValue, role, hasEmail });
    if (role === 'ADMIN') {
      navigate('/admin', { replace: true });
      return;
    }
    if (fromPath && fromPath !== '/auth' && fromPath !== '/admin') {
      navigate(fromPath, { replace: true });
      return;
    }
    navigate('/upload', { replace: true });
  };

  const handleLogin = async () => {
    clearNotice();
    const normalizedUsername = normalizeCredential(username);
    const normalizedPassword = normalizeCredential(password);
    if (!normalizedUsername || !normalizedPassword) {
      setError(copy.emptyAuth);
      return;
    }
    try {
      setSubmitting(true);
      const result = await authApi.login({ username: normalizedUsername, password: normalizedPassword });
      completeLogin(result.userId, result.username, result.role, result.hasEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.submitFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterNext = () => {
    clearNotice();
    const normalizedUsername = normalizeCredential(username);
    const normalizedPassword = normalizeCredential(password);
    const normalizedConfirm = normalizeCredential(confirmPassword);
    if (!normalizedUsername || !normalizedPassword) {
      setError(copy.emptyAuth);
      return;
    }
    if (normalizedPassword !== normalizedConfirm) {
      setError(copy.passwordMismatch);
      return;
    }
    setRegisterStep(2);
  };

  const resolveTurnstileToken = () => (turnstileSiteKey ? turnstileToken : fallbackTurnstileToken);

  const handleSendCode = async (purpose: EmailCodePurpose) => {
    clearNotice();
    const normalizedEmail = normalizeCredential(email);
    const token = resolveTurnstileToken().trim();
    if (!normalizedEmail) {
      setError(copy.emailRequired);
      return;
    }
    if (!token) {
      setError(copy.captchaRequired);
      return;
    }
    try {
      setSendingCode(true);
      await authApi.sendEmailCode({ email: normalizedEmail, purpose, turnstileToken: token });
      setSuccess(purpose === 'REGISTER' ? copy.registerCodeSent : copy.resetCodeSent);
      resetTurnstile();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.submitFailed);
      resetTurnstile();
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async () => {
    clearNotice();
    const normalizedUsername = normalizeCredential(username);
    const normalizedPassword = normalizeCredential(password);
    const normalizedConfirm = normalizeCredential(confirmPassword);
    const normalizedEmail = normalizeCredential(email);
    const normalizedCode = normalizeCredential(verificationCode);
    if (!normalizedUsername || !normalizedPassword) {
      setError(copy.emptyAuth);
      return;
    }
    if (normalizedPassword !== normalizedConfirm) {
      setError(copy.passwordMismatch);
      return;
    }
    if (!normalizedEmail) {
      setError(copy.emailRequired);
      return;
    }
    if (!normalizedCode) {
      setError(copy.codeRequired);
      return;
    }
    try {
      setSubmitting(true);
      const result = await authApi.register({
        username: normalizedUsername,
        password: normalizedPassword,
        email: normalizedEmail,
        verificationCode: normalizedCode,
      });
      completeLogin(result.userId, result.username, result.role, result.hasEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.submitFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    clearNotice();
    const normalizedEmail = normalizeCredential(email);
    const normalizedCode = normalizeCredential(verificationCode);
    const normalizedNewPassword = normalizeCredential(newPassword);
    const normalizedNewPasswordConfirm = normalizeCredential(newPasswordConfirm);
    if (!normalizedEmail) {
      setError(copy.emailRequired);
      return;
    }
    if (!normalizedCode) {
      setError(copy.codeRequired);
      return;
    }
    if (!normalizedNewPassword || !normalizedNewPasswordConfirm) {
      setError(copy.emptyAuth);
      return;
    }
    if (normalizedNewPassword !== normalizedNewPasswordConfirm) {
      setError(copy.passwordMismatch);
      return;
    }
    try {
      setSubmitting(true);
      await authApi.resetPasswordByEmail({
        email: normalizedEmail,
        verificationCode: normalizedCode,
        newPassword: normalizedNewPassword,
      });
      setSuccess(copy.resetSuccess);
      setModal('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.submitFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToTarget = (index: number) => {
    const target = scrollClickRefs.current[index] ?? scrollTargetRefs.current[index];
    if (!target) {
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.history?.replaceState) {
      window.history.replaceState(null, '', `#nav-${index}`);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setHeaderVisible(window.scrollY > 50);
      const middleLine = window.scrollY + window.innerHeight / 2;
      let active = 0;
      scrollTargetRefs.current.forEach((element, idx) => {
        if (element && element.offsetTop <= middleLine) {
          active = idx;
        }
      });
      setCurrentSection(active);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const matched = window.location.hash.match(/^#nav-(\d)$/);
    if (!matched) {
      return;
    }
    const idx = Number(matched[1]);
    if (idx < 0 || idx > 7) {
      return;
    }
    const raf = requestAnimationFrame(() => scrollToTarget(idx));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setHeroSurfaceReady(true);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPublicConfig = async () => {
      try {
        const config = await appConfigApi.getPublicConfig();
        if (cancelled) {
          return;
        }
        setModuleImages({
          resumeAnalysis: config.resumeAnalysisImageUrl || DEFAULT_MODULE_IMAGES.resumeAnalysis,
          mockWrittenExam: config.mockWrittenExamImageUrl || DEFAULT_MODULE_IMAGES.mockWrittenExam,
          formalInterview: config.formalInterviewImageUrl || DEFAULT_MODULE_IMAGES.formalInterview,
          knowledgeBaseQa: config.knowledgeBaseQaImageUrl || DEFAULT_MODULE_IMAGES.knowledgeBaseQa,
          careerGuide: config.careerGuideImageUrl || DEFAULT_MODULE_IMAGES.careerGuide,
        });
        setFeatureCardMedia({
          resumeAnalysis: config.resumeAnalysisCardMediaUrl || config.resumeAnalysisImageUrl || DEFAULT_FEATURE_CARD_MEDIA.resumeAnalysis,
          mockWrittenExam: config.mockWrittenExamCardMediaUrl || config.mockWrittenExamImageUrl || DEFAULT_FEATURE_CARD_MEDIA.mockWrittenExam,
          formalInterview: config.formalInterviewCardMediaUrl || config.formalInterviewImageUrl || DEFAULT_FEATURE_CARD_MEDIA.formalInterview,
          knowledgeBaseQa: config.knowledgeBaseQaCardMediaUrl || config.knowledgeBaseQaImageUrl || DEFAULT_FEATURE_CARD_MEDIA.knowledgeBaseQa,
          careerGuide: config.careerGuideCardMediaUrl || config.careerGuideImageUrl || DEFAULT_FEATURE_CARD_MEDIA.careerGuide,
        });
      } catch {
        if (!cancelled) {
          setModuleImages(DEFAULT_MODULE_IMAGES);
          setFeatureCardMedia(DEFAULT_FEATURE_CARD_MEDIA);
        }
      }
    };
    void loadPublicConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const showTurnstile = Boolean(turnstileSiteKey);

  return (
    <div className="app-container">
      <header className={`header ${headerVisible ? 'visible' : ''}`}>
        <div className="logo">
          <img
            src={HEADER_LOGO_URL}
            alt={isZh ? '面包图标' : 'Bread logo'}
            className="logo-image"
          />
        </div>
        <nav className="nav">
          <div className="nav-links">
            {copy.navItems.map((label, index) => (
              <a
                key={label}
                href={`#nav-${index}`}
                className="nav-link"
                onClick={(event) => {
                  event.preventDefault();
                  scrollToTarget(index);
                }}
              >
                {label}
              </a>
            ))}
          </div>
          <div className="language-switcher">
            <button type="button" className={`language-btn ${locale === 'en' ? 'active' : ''}`} onClick={() => setLocale('en')}>EN</button>
            <button type="button" className={`language-btn ${locale === 'zh' ? 'active' : ''}`} onClick={() => setLocale('zh')}>中文</button>
          </div>
          <button type="button" className="nav-button" onClick={() => openModal('login')}>
            {copy.login}
            <span className="arrow">↗</span>
          </button>
        </nav>
      </header>

      <div className="scroll-indicator">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
          <div key={index} className={`indicator-dot ${currentSection === index ? 'active' : ''}`} onClick={() => scrollToTarget(index)} />
        ))}
      </div>

      <section className="section hero-section nav-scroll-target" id="nav-0" ref={(el) => { sectionsRef.current[0] = el; scrollTargetRefs.current[0] = el; scrollClickRefs.current[0] = el; }}>
        {heroSurfaceReady ? <DottedSurface className="hero-dotted-surface" /> : null}
        <h1 className="hero-title">{copy.heroTitle}</h1>
        <div className="hero-subtitle">{copy.heroSubtitle}</div>
        <div className="hero-buttons">
          <button type="button" className="primary-button" onClick={() => openModal('login')}>{isZh ? '开始使用' : 'Get Started'}</button>
          <button type="button" className="secondary-button" onClick={() => scrollToTarget(1)}>{isZh ? '了解更多' : 'Learn More'}</button>
        </div>
      </section>

      <section className="section features-section" ref={(el) => { sectionsRef.current[1] = el; scrollTargetRefs.current[1] = el; }}>
        <h2 id="nav-1" className="section-title nav-scroll-target" ref={(el) => { scrollClickRefs.current[1] = el; }}>
          {copy.coreTitle}
        </h2>
        <div className="features-project-grid mx-auto w-full max-w-7xl px-4">
          <div className="features-card-row">
            {featureProjects.map((item, idx) => (
              <ProjectCard
                key={item.title}
                {...item}
                onLinkClick={() => {
                  scrollToTarget(idx + 2);
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {copy.modules.map((name, idx) => {
        const module = copy.moduleContent[idx];
        const moduleImage =
          idx === 0
            ? moduleImages.resumeAnalysis
            : idx === 1
              ? moduleImages.mockWrittenExam
              : idx === 2
                ? moduleImages.formalInterview
                : idx === 3
                  ? moduleImages.knowledgeBaseQa
                  : moduleImages.careerGuide;
        return (
          <section
            key={name}
            id={`nav-${idx + 2}`}
            className="section module-page-section nav-scroll-target"
            ref={(el) => { sectionsRef.current[idx + 2] = el; scrollTargetRefs.current[idx + 2] = el; scrollClickRefs.current[idx + 2] = el; }}
          >
            <h2 className="section-title module-page-title">{name}</h2>
            <div className="module-page-body module-showcase-body">
              <div className="module-showcase-card">
                <div className="module-showcase-content">
                  <p className="module-showcase-overview">{module.overview}</p>
                  <ul className="module-showcase-list">
                    {module.outputs.slice(0, 3).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <div className="module-showcase-steps">
                    {module.steps.slice(0, 2).map((step, stepIndex) => (
                      <div key={`${stepIndex}-${step}`} className="module-showcase-step">
                        <span>{stepIndex + 1}</span>
                        <p>{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="module-showcase-media">
                  <MediaAsset
                    src={moduleImage}
                    alt={`${name} preview`}
                    interactive
                  />
                </div>
              </div>
            </div>
          </section>
        );
      })}

      <section id="nav-7" className="section testimonials-page-section nav-scroll-target" ref={(el) => { sectionsRef.current[7] = el; scrollTargetRefs.current[7] = el; scrollClickRefs.current[7] = el; }}>
        <div className="testimonials-container">
          <h3 className="testimonials-title">{copy.testimonialsTitle}</h3>
          <TestimonialMarquee />
        </div>
      </section>

      <section className="section footer-section">
        <div className="footer-copyright">
          <p>© 2026 Bread. {isZh ? '保留所有权利' : 'All rights reserved.'}</p>
        </div>
      </section>

      {modal !== null && (
        <div className="language-toggle" onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}>
          {isZh ? 'EN' : '中文'}
        </div>
      )}

      <div className={`modal-overlay ${modal === 'login' ? 'active' : ''}`} onClick={closeModal}>
        {modal === 'login' && (
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="login-container">
              <h2 className="login-title">{copy.loginTitle}</h2>
              <p className="login-description">{copy.loginDesc}</p>
              <div className="login-form">
                <div className="form-group">
                  <label className="form-label">{copy.username}</label>
                  <input type="text" placeholder={copy.usernamePlaceholder} className="login-input" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{copy.password}</label>
                  <div className="password-input-container">
                    <input type={showPassword ? 'text' : 'password'} placeholder={copy.passwordPlaceholder} className="login-input password-input" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                {error ? <div className="auth-feedback error">{error}</div> : null}
                {success ? <div className="auth-feedback success">{success}</div> : null}
                <button type="button" className="login-button" disabled={submitting} onClick={() => void handleLogin()}>
                  {submitting ? copy.processing : copy.loginTitle}
                </button>
              </div>
              <div className="signup-link">{copy.noAccount} <button type="button" className="signup-text" onClick={() => openModal('register')}>{copy.goRegister}</button></div>
              <div className="signup-link"><button type="button" className="forgot-password" onClick={() => openModal('forgot')}>{copy.forgotLink}</button></div>
            </div>
          </div>
        )}
      </div>

      <div className={`modal-overlay ${modal === 'register' ? 'active' : ''}`} onClick={closeModal}>
        {modal === 'register' && (
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="login-container">
              <h2 className="login-title">{copy.registerTitle}</h2>
              <p className="login-description">{copy.registerDesc}</p>
              <div className="login-form">
                {registerStep === 1 && (
                  <>
                    <div className="form-group">
                      <label className="form-label">{copy.username}</label>
                      <input type="text" placeholder={copy.usernamePlaceholder} className="login-input" value={username} onChange={(e) => setUsername(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{copy.password}</label>
                      <div className="password-input-container">
                        <input type={showPassword ? 'text' : 'password'} placeholder={copy.passwordPlaceholder} className="login-input password-input" value={password} onChange={(e) => setPassword(e.target.value)} />
                        <button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)}>
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">{copy.confirmPassword}</label>
                      <div className="password-input-container">
                        <input type={showConfirmPassword ? 'text' : 'password'} placeholder={copy.confirmPasswordPlaceholder} className="login-input password-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                        <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword((v) => !v)}>
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    {error ? <div className="auth-feedback error">{error}</div> : null}
                    <button type="button" className="login-button create-account-button" onClick={handleRegisterNext}>
                      {copy.next}
                    </button>
                  </>
                )}

                {registerStep === 2 && (
                  <>
                    <div className="form-group">
                      <label className="form-label">{copy.email}</label>
                      <input type="email" placeholder={copy.emailPlaceholder} className="login-input" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{copy.code}</label>
                      <div className="verification-container">
                        <input type="text" placeholder={copy.codePlaceholder} className="login-input verification-input" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} />
                        <button type="button" className="verification-button" disabled={sendingCode || submitting} onClick={() => void handleSendCode('REGISTER')}>
                          {sendingCode ? copy.processing : copy.sendCode}
                        </button>
                      </div>
                    </div>

                    {showTurnstile ? (
                      <div className="auth-turnstile-wrap">
                        <TurnstileWidget siteKey={turnstileSiteKey} action="register" onTokenChange={setTurnstileToken} resetKey={turnstileResetKey} />
                      </div>
                    ) : null}

                    {error ? <div className="auth-feedback error">{error}</div> : null}
                    {success ? <div className="auth-feedback success">{success}</div> : null}

                    <div className="register-buttons">
                      <button type="button" className="login-button back-button" onClick={() => setRegisterStep(1)}>
                        {copy.back}
                      </button>
                      <button type="button" className="login-button create-account-button" onClick={() => void handleRegister()} disabled={submitting}>
                        {submitting ? copy.processing : copy.createAccount}
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="signup-link">{copy.hasAccount} <button type="button" className="signup-text" onClick={() => openModal('login')}>{copy.goLogin}</button></div>
            </div>
          </div>
        )}
      </div>

      <div className={`modal-overlay ${modal === 'forgot' ? 'active' : ''}`} onClick={closeModal}>
        {modal === 'forgot' && (
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="login-container">
              <h2 className="login-title">{copy.forgotTitle}</h2>
              <p className="login-description">{copy.forgotDesc}</p>
              <div className="login-form forgot-modal-actions">
                <div className="form-group">
                  <label className="form-label">{copy.email}</label>
                  <input type="email" placeholder={copy.emailPlaceholder} className="login-input" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{copy.code}</label>
                  <div className="verification-container">
                    <input type="text" placeholder={copy.codePlaceholder} className="login-input verification-input" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} />
                    <button type="button" className="verification-button" disabled={sendingCode || submitting} onClick={() => void handleSendCode('RESET_PASSWORD')}>
                      {sendingCode ? copy.processing : copy.sendCode}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{copy.password}</label>
                  <div className="password-input-container">
                    <input type={showResetPassword ? 'text' : 'password'} placeholder={copy.passwordPlaceholder} className="login-input password-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    <button type="button" className="password-toggle" onClick={() => setShowResetPassword((v) => !v)}>
                      {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{copy.confirmPassword}</label>
                  <input type={showResetPassword ? 'text' : 'password'} placeholder={copy.confirmPasswordPlaceholder} className="login-input" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} />
                </div>

                {showTurnstile ? (
                  <div className="auth-turnstile-wrap">
                    <TurnstileWidget siteKey={turnstileSiteKey} action="reset-password" onTokenChange={setTurnstileToken} resetKey={turnstileResetKey} />
                  </div>
                ) : null}

                {error ? <div className="auth-feedback error">{error}</div> : null}
                {success ? <div className="auth-feedback success">{success}</div> : null}

                <button type="button" className="login-button" disabled={submitting} onClick={() => void handleReset()}>
                  {submitting ? copy.processing : copy.resetPassword}
                </button>
              </div>
              <div className="signup-link"><button type="button" className="signup-text" onClick={() => openModal('login')}>{copy.goLogin}</button></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
