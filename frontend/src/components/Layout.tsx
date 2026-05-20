import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  CheckSquare,
  ChevronDown,
  Database,
  Download,
  FileStack,
  FileText,
  MessageSquare,
  Mic,
  Moon,
  Settings,
  Sun,
  Upload,
  Users,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { getCurrentUser, logoutUser } from '../utils/auth';
import { useI18n } from '../i18n/I18nContext';
import LottieScene from './LottieScene';
import { getLastViewedResumeId } from '../utils/resumeNavigation';

const SIDEBAR_ANIMATION = 'https://assets1.lottiefiles.com/packages/lf20_kyu7xb1v.json';
const BRAND_ICON_URL = '/favicon-mascot.png?v=20260413h';

type ResumeTab = 'analysis' | 'rewrite' | 'interview';
type HistoryChildActive = 'analysis' | 'rewrite' | 'interview' | 'export';

interface LocationState {
  openTab?: ResumeTab;
  triggerExport?: 'analysis';
  openHistory?: boolean;
}

interface SidebarSection {
  id: string;
  title: string;
  content: ReactNode;
}

function SidebarNavButton(props: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
  nested?: boolean;
}) {
  const { icon: Icon, label, active, onClick, nested = false } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-2xl transition-all ${
        nested
          ? `px-3 py-2.5 text-sm ${
              active
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-white'
            }`
          : `px-3 py-3 ${
              active
                ? 'bg-slate-900 text-white shadow-sm shadow-slate-300 dark:bg-white dark:text-slate-900'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            }`
      }`}
    >
      <div
        className={`flex items-center justify-center rounded-xl ${
          nested
            ? `h-8 w-8 ${
                active
                  ? 'bg-white text-slate-900 dark:bg-slate-700 dark:text-white'
                  : 'bg-slate-100 text-slate-600 group-hover:bg-white dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700'
              }`
            : `h-10 w-10 ${
                active
                  ? 'bg-white/15 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-700 group-hover:bg-white dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700'
              }`
        }`}
      >
        <Icon className={nested ? 'h-4 w-4' : 'h-5 w-5'} />
      </div>
      <span className={`min-w-0 flex-1 text-left ${nested ? 'font-medium' : 'font-semibold'}`}>{label}</span>
    </button>
  );
}

function SidebarExpandableGroup(props: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  expanded: boolean;
  onNavigate: () => void;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { icon: Icon, label, active, expanded, onNavigate, onToggle, children } = props;
  const highlighted = active || expanded;

  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${
          active
            ? 'bg-slate-900 text-white shadow-sm shadow-slate-300 dark:bg-white dark:text-slate-900'
            : highlighted
              ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
        }`}
      >
        <button type="button" onClick={onNavigate} className="group flex min-w-0 flex-1 items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              active
                ? 'bg-white/15 text-white dark:bg-slate-200 dark:text-slate-900'
                : highlighted
                  ? 'bg-white text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                  : 'bg-slate-100 text-slate-700 group-hover:bg-white dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700'
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <span className="min-w-0 flex-1 text-left text-sm font-semibold">{label}</span>
        </button>

        <button
          type="button"
          onClick={onToggle}
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
            active
              ? 'text-white/80 hover:bg-white/10 dark:text-slate-700 dark:hover:bg-slate-200'
              : 'text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white'
          }`}
          aria-expanded={expanded}
          aria-label={`${expanded ? '收起' : '展开'}${label}`}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="ml-6 mt-2 space-y-1 border-l border-slate-200 pl-4 dark:border-slate-700">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const routeState = (location.state as LocationState | null) ?? null;
  const { theme, toggleTheme } = useTheme();
  const currentUser = getCurrentUser();
  const { locale, setLocale, t } = useI18n();

  const isUploadRoute = currentPath === '/upload' || currentPath === '/';
  const isHistoryRoute = currentPath === '/history' || currentPath.startsWith('/history/');
  const isOralRoute =
    currentPath === '/mock-interview' ||
    currentPath.startsWith('/oral-interview/') ||
    currentPath.startsWith('/oral-assistant/');
  const isInterviewRoute = currentPath.startsWith('/interviews');
  const isCareerArticlesRoute = currentPath === '/career-articles' || currentPath.startsWith('/career-articles/');
  const isKnowledgeRoute = currentPath === '/knowledgebase' || currentPath.startsWith('/knowledgebase/');
  const canAccessAdmin = currentUser?.role === 'ADMIN';
  const careerArticlesLabel = locale === 'zh' ? '求职攻略' : 'Career Guides';

  const [expandedGroups, setExpandedGroups] = useState({
    history: isHistoryRoute,
    qa: isKnowledgeRoute,
  });

  useEffect(() => {
    setExpandedGroups((previous) => ({
      history: isHistoryRoute ? true : previous.history,
      qa: isKnowledgeRoute ? true : previous.qa,
    }));
  }, [isHistoryRoute, isKnowledgeRoute]);

  const historyChildActive: HistoryChildActive =
    routeState?.triggerExport === 'analysis'
      ? 'export'
      : routeState?.openTab === 'interview'
        ? 'interview'
      : routeState?.openTab === 'rewrite'
        ? 'rewrite'
        : 'analysis';
  const qaChildActive = currentPath === '/knowledgebase/upload' ? 'upload' : currentPath === '/knowledgebase/chat' ? 'history' : null;

  const toggleGroup = (group: 'history' | 'qa') => {
    setExpandedGroups((previous) => ({
      ...previous,
      [group]: !previous[group],
    }));
  };

  const navigateToResumeWorkspace = (options?: { tab?: ResumeTab; exportAnalysis?: boolean }) => {
    const lastResumeId = getLastViewedResumeId();
    if (!lastResumeId) {
      navigate('/history');
      return;
    }

    navigate(`/history/${lastResumeId}`, {
      state: {
        openTab: options?.tab ?? 'analysis',
        ...(options?.exportAnalysis ? { triggerExport: 'analysis' as const } : {}),
      },
    });
  };

  const handleLogout = () => {
    logoutUser();
    navigate('/auth');
  };

  const sidebarSections = useMemo<SidebarSection[]>(() => {
    const sections: SidebarSection[] = [
      {
        id: 'career',
        title: t('layout.groupCareer'),
        content: (
          <div className="space-y-2.5">
            <SidebarNavButton
              icon={Upload}
              label={t('layout.upload')}
              active={isUploadRoute}
              onClick={() => navigate('/upload')}
            />

            <SidebarExpandableGroup
              icon={FileStack}
              label={t('layout.history')}
              active={isHistoryRoute}
              expanded={expandedGroups.history}
              onNavigate={() => navigate('/history')}
              onToggle={() => toggleGroup('history')}
            >
              <SidebarNavButton
                nested
                icon={CheckSquare}
                label={t('layout.historyAnalysis')}
                active={isHistoryRoute && historyChildActive === 'analysis'}
                onClick={() => navigateToResumeWorkspace({ tab: 'analysis' })}
              />
              <SidebarNavButton
                nested
                icon={FileText}
                label={t('layout.historyRewrite')}
                active={isHistoryRoute && historyChildActive === 'rewrite'}
                onClick={() => navigateToResumeWorkspace({ tab: 'rewrite' })}
              />
              <SidebarNavButton
                nested
                icon={MessageSquare}
                label={t('layout.historyAiInterview')}
                active={isHistoryRoute && historyChildActive === 'interview'}
                onClick={() => navigateToResumeWorkspace({ tab: 'interview' })}
              />
              <SidebarNavButton
                nested
                icon={Download}
                label={t('layout.historyExport')}
                active={isHistoryRoute && historyChildActive === 'export'}
                onClick={() => navigateToResumeWorkspace({ tab: 'analysis', exportAnalysis: true })}
              />
            </SidebarExpandableGroup>

            <SidebarNavButton
              icon={Mic}
              label={t('layout.oral')}
              active={isOralRoute}
              onClick={() => navigate('/mock-interview')}
            />

            <SidebarNavButton
              icon={Users}
              label={t('layout.interviews')}
              active={isInterviewRoute}
              onClick={() => navigate('/interviews')}
            />

            <SidebarNavButton
              icon={BookOpen}
              label={careerArticlesLabel}
              active={isCareerArticlesRoute}
              onClick={() => navigate('/career-articles')}
            />
          </div>
        ),
      },
      {
        id: 'knowledge',
        title: t('layout.groupKnowledge'),
        content: (
          <div className="space-y-2.5">
            <SidebarNavButton
              icon={Database}
              label={t('layout.kbManage')}
              active={currentPath === '/knowledgebase' || currentPath === '/knowledgebase/upload'}
              onClick={() => navigate('/knowledgebase')}
            />

            <SidebarExpandableGroup
              icon={MessageSquare}
              label={t('layout.qa')}
              active={currentPath === '/knowledgebase/chat'}
              expanded={expandedGroups.qa}
              onNavigate={() => navigate('/knowledgebase/chat')}
              onToggle={() => toggleGroup('qa')}
            >
              <SidebarNavButton
                nested
                icon={Upload}
                label={t('layout.qaUpload')}
                active={qaChildActive === 'upload'}
                onClick={() => navigate('/knowledgebase/upload')}
              />
              <SidebarNavButton
                nested
                icon={MessageSquare}
                label={t('layout.qaHistory')}
                active={qaChildActive === 'history'}
                onClick={() => navigate('/knowledgebase/chat', { state: { openHistory: true } })}
              />
            </SidebarExpandableGroup>
          </div>
        ),
      },
    ];

    if (canAccessAdmin) {
      sections.push({
        id: 'management',
        title: t('layout.groupManagement'),
        content: (
          <div className="space-y-2.5">
            <SidebarNavButton
              icon={Settings}
              label={t('layout.adminPortal')}
              active={false}
              onClick={() => navigate('/admin')}
            />
          </div>
        ),
      });
    }

    return sections;
  }, [
    canAccessAdmin,
    currentPath,
    expandedGroups.history,
    expandedGroups.qa,
    historyChildActive,
    isHistoryRoute,
    isInterviewRoute,
    isOralRoute,
    isUploadRoute,
    isCareerArticlesRoute,
    navigate,
    qaChildActive,
    t,
    locale,
  ]);

  const renderSidebarMenu = () => (
    <div className="space-y-5">
      {sidebarSections.map((section) => (
        <section key={section.id}>
          <p className="mb-2 px-3 text-xs font-semibold tracking-[0.08em] text-slate-400 dark:text-slate-500">
            {section.title}
          </p>
          {section.content}
        </section>
      ))}
    </div>
  );

  const renderBrandIcon = (sizeClassName: string) => (
    <div className={`flex items-center justify-center overflow-hidden rounded-2xl ${sizeClassName}`}>
      <img src={BRAND_ICON_URL} alt="面包图标" className="h-full w-full object-contain" />
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-80 flex-col border-r border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:flex">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <Link to="/upload" className="flex items-center gap-3">
            {renderBrandIcon('h-12 w-12')}
            <div>
              <span className="block text-base font-bold tracking-tight">面包</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{t('layout.brandSubTitle')}</span>
            </div>
          </Link>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <span>{t('common.language')}</span>
            <div className="flex items-center gap-1 rounded-xl bg-white p-1 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setLocale('zh')}
                className={`rounded-lg px-2 py-1 ${locale === 'zh' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-300'}`}
              >
                {t('common.chinese')}
              </button>
              <button
                type="button"
                onClick={() => setLocale('en')}
                className={`rounded-lg px-2 py-1 ${locale === 'en' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-300'}`}
              >
                {t('common.english')}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-4 w-4" />
                <span className="text-sm font-medium">{t('common.lightMode')}</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" />
                <span className="text-sm font-medium">{t('common.darkMode')}</span>
              </>
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-4">
          {renderSidebarMenu()}
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="mb-3 rounded-[28px] border border-slate-200 bg-slate-100 p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white dark:bg-slate-900">
                <LottieScene src={SIDEBAR_ANIMATION} className="h-full w-full" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Workspace</p>
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {currentUser?.username ?? 'Guest'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('common.currentUser')}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-2xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60"
          >
            {t('common.logout')}
          </button>
        </div>
      </aside>

      <main className="min-h-screen flex-1 p-4 md:p-6 lg:ml-80 lg:p-8 xl:p-10">
        <div className="mb-4 rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {renderBrandIcon('h-11 w-11')}
              <div>
                <p className="text-sm font-bold">面包</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{currentUser?.username ?? 'Guest'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400"
            >
              {t('common.logout')}
            </button>
          </div>

          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <span>{t('common.language')}</span>
              <div className="flex items-center gap-1 rounded-xl bg-white p-1 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() => setLocale('zh')}
                  className={`rounded-lg px-2 py-1 ${locale === 'zh' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-300'}`}
                >
                  {t('common.chinese')}
                </button>
                <button
                  type="button"
                  onClick={() => setLocale('en')}
                  className={`rounded-lg px-2 py-1 ${locale === 'en' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-300'}`}
                >
                  {t('common.english')}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4" />
                  <span className="text-sm font-medium">{t('common.lightMode')}</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" />
                  <span className="text-sm font-medium">{t('common.darkMode')}</span>
                </>
              )}
            </button>

            {renderSidebarMenu()}
          </div>
        </div>

        <motion.div
          key={currentPath}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.24 }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
