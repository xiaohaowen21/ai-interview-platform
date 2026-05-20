import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { historyApi, InterviewDetail, ResumeDetail } from '../api/history';
import AnalysisPanel from '../components/AnalysisPanel';
import InterviewPanel from '../components/InterviewPanel';
import InterviewDetailPanel from '../components/InterviewDetailPanel';
import ResumeRewritePanel from '../components/ResumeRewritePanel';
import { formatDateOnly } from '../utils/date';
import { setLastViewedResumeId } from '../utils/resumeNavigation';
import { CheckSquare, ChevronLeft, Clock, Download, FileText, MessageSquare, Mic } from 'lucide-react';

interface ResumeDetailPageProps {
  resumeId: number;
  onBack: () => void;
  onStartOralInterview: (resumeId: number) => void;
  onStartWrittenInterview: (resumeText: string, resumeId: number) => void;
}

type TabType = 'analysis' | 'rewrite' | 'interview';
type DetailViewType = 'list' | 'interviewDetail';

const DETAIL_POLLING_INTERVAL = 3000;

function isProcessing(status?: string | null) {
  return status === 'PENDING' || status === 'PROCESSING';
}

export default function ResumeDetailPage({
  resumeId,
  onBack,
  onStartOralInterview,
  onStartWrittenInterview,
}: ResumeDetailPageProps) {
  const location = useLocation();
  const [resume, setResume] = useState<ResumeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const openTab = (location.state as { openTab?: TabType } | null)?.openTab;
    if (openTab === 'analysis' || openTab === 'rewrite' || openTab === 'interview') {
      return openTab;
    }
    return 'analysis';
  });
  const [exporting, setExporting] = useState<string | null>(null);
  const [detailView, setDetailView] = useState<DetailViewType>('list');
  const [selectedInterview, setSelectedInterview] = useState<InterviewDetail | null>(null);
  const [loadingInterview, setLoadingInterview] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const loadingDetailRef = useRef(false);
  const autoViewInterviewRef = useRef<string | null>(
    (location.state as { viewInterview?: string } | null)?.viewInterview ?? null
  );
  const autoExportLocationKeyRef = useRef<string | null>(null);

  const loadResumeDetail = useCallback(async (silent = false) => {
    if (loadingDetailRef.current) {
      return;
    }

    loadingDetailRef.current = true;
    if (!silent) {
      setLoading(true);
    }

    try {
      const data = await historyApi.getResumeDetail(resumeId);
      setResume(data);
    } catch (err) {
      console.error('加载简历详情失败', err);
    } finally {
      loadingDetailRef.current = false;
      if (!silent) {
        setLoading(false);
      }
    }
  }, [resumeId]);

  const loadInterviewDetail = useCallback(
    async (sessionId: string, options?: { silent?: boolean; openDetail?: boolean }) => {
      if (!options?.silent) {
        setLoadingInterview(true);
      }

      try {
        const detail = await historyApi.getInterviewDetail(sessionId);
        setSelectedInterview(detail);
        if (options?.openDetail !== false) {
          setActiveTab('interview');
          setDetailView('interviewDetail');
        }
        return detail;
      } catch (err) {
        console.error('加载面试详情失败', err);
        throw err;
      } finally {
        if (!options?.silent) {
          setLoadingInterview(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void loadResumeDetail();
  }, [loadResumeDetail]);

  useEffect(() => {
    setLastViewedResumeId(resumeId);
  }, [resumeId]);

  useEffect(() => {
    const hasPendingEvaluation = resume?.interviews?.some(
      (item) => (item.mode ?? 'WRITTEN') !== 'ORAL' && isProcessing(item.evaluateStatus)
    ) ?? false;
    if (!isProcessing(resume?.analyzeStatus) && !hasPendingEvaluation) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadResumeDetail(true);
    }, DETAIL_POLLING_INTERVAL);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadResumeDetail, resume?.analyzeStatus, resume?.interviews]);

  useEffect(() => {
    const sessionId = autoViewInterviewRef.current;
    if (!sessionId || !resume) {
      return;
    }

    autoViewInterviewRef.current = null;
    void loadInterviewDetail(sessionId, { openDetail: true });
  }, [loadInterviewDetail, resume]);

  useEffect(() => {
    const openTab = (location.state as { openTab?: TabType } | null)?.openTab;
    if (openTab === 'analysis' || openTab === 'rewrite' || openTab === 'interview') {
      setActiveTab(openTab);
      setDetailView('list');
      setSelectedInterview(null);
    }
  }, [location.state]);

  useEffect(() => {
    if (!selectedInterview?.sessionId || !isProcessing(selectedInterview.evaluateStatus)) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadInterviewDetail(selectedInterview.sessionId, {
        silent: true,
        openDetail: false,
      });
    }, DETAIL_POLLING_INTERVAL);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadInterviewDetail, selectedInterview?.evaluateStatus, selectedInterview?.sessionId]);

  useEffect(() => {
    const state = location.state as { triggerExport?: 'analysis' } | null;
    if (!resume || state?.triggerExport !== 'analysis') {
      return;
    }
    if (autoExportLocationKeyRef.current === location.key) {
      return;
    }
    autoExportLocationKeyRef.current = location.key;
    void handleExportAnalysisPdf();
  }, [location.key, location.state, resume]);

  const handleExportAnalysisPdf = async () => {
    setExporting('analysis');
    try {
      const blob = await historyApi.exportAnalysisPdf(resumeId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `简历分析报告_${resume?.filename || resumeId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      alert('导出失败，请重试');
    } finally {
      setExporting(null);
    }
  };

  const handleExportInterviewPdf = async (sessionId: string) => {
    setExporting(sessionId);
    try {
      const blob = await historyApi.exportInterviewPdf(sessionId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `面试报告_${sessionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      alert('导出失败，请重试');
    } finally {
      setExporting(null);
    }
  };

  const handleViewInterview = async (sessionId: string) => {
    try {
      await loadInterviewDetail(sessionId, { openDetail: true });
    } catch {
      alert('加载面试详情失败');
    }
  };

  const handleBackToInterviewList = () => {
    setDetailView('list');
    setSelectedInterview(null);
  };

  const handleDeleteInterview = async () => {
    await loadResumeDetail(true);
    if (selectedInterview?.sessionId) {
      setDetailView('list');
      setSelectedInterview(null);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setDetailView('list');
    setSelectedInterview(null);
  };

  const handleReanalyze = async () => {
    try {
      setReanalyzing(true);
      await historyApi.reanalyze(resumeId);
      await loadResumeDetail(true);
    } catch (err) {
      console.error('重新分析失败', err);
    } finally {
      setReanalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <motion.div
          className="h-12 w-12 rounded-full border-4 border-slate-200 border-t-primary-500 dark:border-slate-600"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="py-20 text-center">
        <p className="mb-4 text-red-500">加载失败，请返回重试</p>
        <button onClick={onBack} className="rounded-lg bg-primary-500 px-6 py-2 text-white">返回列表</button>
      </div>
    );
  }

  const latestAnalysis = resume.analyses?.[0];
  const writtenInterviews = (resume.interviews || []).filter((item) => (item.mode ?? 'WRITTEN') !== 'ORAL');

  const tabs = [
    { id: 'analysis' as const, label: '简历分析', icon: CheckSquare },
    { id: 'rewrite' as const, label: '简历优化', icon: FileText },
    { id: 'interview' as const, label: '面试记录', icon: MessageSquare, count: writtenInterviews.length },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <motion.button
            onClick={detailView === 'interviewDetail' ? handleBackToInterviewList : onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {detailView === 'interviewDetail' ? `面试详情 #${selectedInterview?.sessionId?.slice(-6) || ''}` : resume.filename}
            </h2>
            <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <Clock className="h-4 w-4" />
              {detailView === 'interviewDetail'
                ? `${isProcessing(selectedInterview?.evaluateStatus) ? '提交于' : '完成于'} ${formatDateOnly(selectedInterview?.completedAt || selectedInterview?.createdAt || '')}`
                : `上传于 ${formatDateOnly(resume.uploadedAt)}`}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {detailView === 'interviewDetail' && selectedInterview && (
            <motion.button
              onClick={() => void handleExportInterviewPdf(selectedInterview.sessionId)}
              disabled={exporting === selectedInterview.sessionId}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-600"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Download className="h-4 w-4" />
              {exporting === selectedInterview.sessionId ? '导出中...' : '导出 PDF'}
            </motion.button>
          )}
          {detailView !== 'interviewDetail' && (
            <>
              <motion.button
                onClick={() => onStartOralInterview(resumeId)}
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 font-medium text-white transition-all hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                <Mic className="h-4 w-4" />
                正式面试
              </motion.button>
              <motion.button
                onClick={() => onStartWrittenInterview(resume.resumeText, resumeId)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-medium text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                <CheckSquare className="h-4 w-4" />
                AI预测面试
              </motion.button>
            </>
          )}
        </div>
      </div>

      {detailView !== 'interviewDetail' && (
        <div className="mb-6 inline-flex gap-1 rounded-2xl bg-white p-2 dark:bg-slate-800">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`relative flex items-center gap-2 rounded-xl px-6 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-xl bg-primary-50 dark:bg-primary-900"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <tab.icon className="h-5 w-5" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-600 dark:bg-primary-900 dark:text-primary-400">
                    {tab.count}
                  </span>
                )}
              </span>
            </motion.button>
          ))}
        </div>
      )}

      <div className="relative overflow-hidden">
        {detailView === 'interviewDetail' && selectedInterview ? (
          <InterviewDetailPanel interview={selectedInterview} />
        ) : (
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              {activeTab === 'analysis' ? (
                <AnalysisPanel
                  analysis={latestAnalysis}
                  analyzeStatus={resume.analyzeStatus}
                  analyzeError={resume.analyzeError}
                  onExport={handleExportAnalysisPdf}
                  exporting={exporting === 'analysis'}
                  onReanalyze={handleReanalyze}
                  reanalyzing={reanalyzing}
                />
              ) : activeTab === 'rewrite' ? (
                <ResumeRewritePanel
                  resumeId={resumeId}
                  filename={resume.filename}
                />
              ) : (
                <InterviewPanel
                  interviews={writtenInterviews}
                  onStartInterview={() => onStartWrittenInterview(resume.resumeText, resumeId)}
                  onViewInterview={handleViewInterview}
                  onExportInterview={handleExportInterviewPdf}
                  onDeleteInterview={handleDeleteInterview}
                  exporting={exporting}
                  loadingInterview={loadingInterview}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
