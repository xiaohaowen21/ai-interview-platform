import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EvaluateStatus, historyApi, InterviewItem } from '../api/history';
import { formatDate, getDateTimestamp } from '../utils/date';
import { getScoreProgressColor } from '../utils/score';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog';
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Loader2,
  PlayCircle,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';

interface InterviewHistoryPageProps {
  onBack: () => void;
  onViewInterview: (sessionId: string, resumeId?: number) => void;
  onViewTrend: (resumeId: number) => void;
  onStartMockInterview: () => void;
}

interface InterviewWithResume extends InterviewItem {
  resumeId: number;
  resumeFilename: string;
  evaluateStatus?: EvaluateStatus;
  evaluateError?: string;
}

interface InterviewStats {
  totalCount: number;
  completedCount: number;
  averageScore: number;
}

type RecordTab = 'mock' | 'real';

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  color,
  onClick,
  hint,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  suffix?: string;
  color: string;
  onClick?: () => void;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 ${
        onClick
          ? 'cursor-pointer transition-transform hover:-translate-y-0.5 hover:border-primary-200 dark:hover:border-primary-700'
          : ''
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
                {value}{suffix &&
                <span className="text-base font-normal text-slate-400 dark:text-slate-500 ml-1">{suffix}</span>}
          </p>
          {hint && <p className="mt-1 text-xs text-primary-500 dark:text-primary-300">{hint}</p>}
        </div>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAction();
          }}
          className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}

function isCompletedStatus(status: string): boolean {
  return status === 'COMPLETED' || status === 'EVALUATED';
}

function isEvaluateCompleted(interview: InterviewWithResume): boolean {
  if (interview.evaluateStatus === 'COMPLETED') return true;
  if (interview.status === 'EVALUATED') return true;
  return false;
}

function isEvaluating(interview: InterviewWithResume): boolean {
  return interview.evaluateStatus === 'PENDING' || interview.evaluateStatus === 'PROCESSING';
}

function isEvaluateFailed(interview: InterviewWithResume): boolean {
  return interview.evaluateStatus === 'FAILED';
}

function StatusIcon({ interview }: { interview: InterviewWithResume }) {
  if (isEvaluateFailed(interview)) {
      return <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400"/>;
  }
  if (isEvaluating(interview)) {
      return <RefreshCw className="w-4 h-4 text-blue-500 dark:text-blue-400 animate-spin"/>;
  }
  if (isEvaluateCompleted(interview)) {
      return <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400"/>;
  }
  if (interview.status === 'IN_PROGRESS') {
      return <PlayCircle className="w-4 h-4 text-blue-500 dark:text-blue-400"/>;
  }
  if (isCompletedStatus(interview.status)) {
      return <Clock className="w-4 h-4 text-yellow-500 dark:text-yellow-400"/>;
  }
    return <Clock className="w-4 h-4 text-yellow-500 dark:text-yellow-400"/>;
}

function getStatusText(interview: InterviewWithResume): string {
  if (isEvaluateFailed(interview)) {
    return '评估失败';
  }
  if (isEvaluating(interview)) {
    return interview.evaluateStatus === 'PROCESSING' ? '评估中' : '等待评估';
  }
  if (isEvaluateCompleted(interview)) {
    return '已完成';
  }
  if (interview.status === 'IN_PROGRESS') {
    return '进行中';
  }
  if (isCompletedStatus(interview.status)) {
    return '已提交';
  }
  return '已创建';
}

function buildStats(items: InterviewWithResume[], tab: RecordTab): InterviewStats {
  const completedItems = items.filter((item) =>
    tab === 'real' ? isCompletedStatus(item.status) : isEvaluateCompleted(item),
  );
  const scoredItems = completedItems.filter((item) => item.overallScore !== null);
  const totalScore = scoredItems.reduce((sum, item) => sum + (item.overallScore ?? 0), 0);
  return {
    totalCount: items.length,
    completedCount: completedItems.length,
    averageScore: scoredItems.length > 0 ? Math.round(totalScore / scoredItems.length) : 0,
  };
}

function canExportInterview(interview: InterviewWithResume): boolean {
  if (interview.mode === 'ORAL') {
    return isCompletedStatus(interview.status);
  }
  return isEvaluateCompleted(interview);
}

export default function InterviewHistoryPage({
  onBack: _onBack,
  onViewInterview,
  onViewTrend,
  onStartMockInterview,
}: InterviewHistoryPageProps) {
  const [interviews, setInterviews] = useState<InterviewWithResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RecordTab>('mock');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [deleteItem, setDeleteItem] = useState<InterviewWithResume | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  const loadAllInterviews = useCallback(async (isPolling = false) => {
    if (!isPolling) {
      setLoading(true);
    }
    try {
      const resumes = await historyApi.getResumes();
      const allInterviews: InterviewWithResume[] = [];

      for (const resume of resumes) {
        const detail = await historyApi.getResumeDetail(resume.id);
        const resumeInterviews = detail.interviews || [];
        if (resumeInterviews.length > 0) {
          resumeInterviews.forEach((interview) => {
            allInterviews.push({
              ...interview,
              resumeId: resume.id,
              resumeFilename: resume.filename,
            });
          });
        }
      }

      allInterviews.sort((a, b) => getDateTimestamp(b.createdAt) - getDateTimestamp(a.createdAt));
      setInterviews(allInterviews);
    } catch (err) {
      console.error('加载面试记录失败', err);
    } finally {
      if (!isPolling) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadAllInterviews();
  }, [loadAllInterviews]);

  useEffect(() => {
    const hasEvaluating = interviews.some(i => isEvaluating(i));

    if (hasEvaluating) {
      pollingRef.current = window.setInterval(() => {
        loadAllInterviews(true);
      }, 3000); // 每3秒轮询一次
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [interviews, loadAllInterviews]);

  const handleDeleteClick = (interview: InterviewWithResume, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteItem(interview);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteItem) return;

    setDeletingSessionId(deleteItem.sessionId);
    try {
      await historyApi.deleteInterview(deleteItem.sessionId);
      await loadAllInterviews();
      setDeleteItem(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败，请稍后重试');
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleExport = async (interview: InterviewWithResume, e: React.MouseEvent) => {
    e.stopPropagation();
    setExporting(interview.sessionId);
    try {
      const blob = await historyApi.exportInterviewPdf(interview.sessionId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filePrefix = interview.mode === 'ORAL' ? '真实面试对话' : '模拟面试报告';
      a.download = `${filePrefix}_${interview.sessionId.slice(-8)}.pdf`;
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

  const mockInterviews = useMemo(
    () => interviews.filter((interview) => (interview.mode ?? 'WRITTEN') !== 'ORAL'),
    [interviews],
  );
  const realInterviews = useMemo(
    () => interviews.filter((interview) => interview.mode === 'ORAL'),
    [interviews],
  );
  const currentInterviews = activeTab === 'mock' ? mockInterviews : realInterviews;
  const stats = useMemo(() => buildStats(currentInterviews, activeTab), [activeTab, currentInterviews]);
  const filteredInterviews = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) {
      return currentInterviews;
    }
    return currentInterviews.filter((interview) =>
      interview.resumeFilename.toLowerCase().includes(keyword),
    );
  }, [currentInterviews, searchTerm]);
  const isMockTab = activeTab === 'mock';
  const currentTitle = isMockTab ? '模拟面试记录' : '真实面试记录';
  const currentEmptyDesc = isMockTab
    ? '完成一次模拟面试后，记录将显示在这里'
    : '完成一次真实面试后，记录将显示在这里';
  const canViewInterviewDetail = isMockTab;
  const countLabel = isMockTab ? '题目数' : '对话轮次';
  const exportTitle = isMockTab ? '导出PDF' : '导出对话';
  const statTotalLabel = isMockTab ? '模拟总数' : '真实总数';
  const trendTargetResumeId =
    currentInterviews.find((interview) => interview.overallScore !== null)?.resumeId ??
    currentInterviews[0]?.resumeId;

  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* 头部 */}
      <div className="flex justify-between items-start mb-8 flex-wrap gap-6">
        <div>
          <motion.h1
              className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Users className="w-7 h-7 text-primary-500" />
            面试记录
          </motion.h1>
          <motion.p
              className="text-slate-500 dark:text-slate-400 mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            查看和管理所有面试记录
          </motion.p>
        </div>

        <motion.div
            className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 min-w-[280px] focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100 dark:focus-within:ring-primary-900/30 transition-all"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="搜索简历名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400 bg-transparent"
          />
        </motion.div>
      </div>

      {/* 记录类型切换 */}
      <div className="mb-6 inline-flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setActiveTab('mock')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'mock'
              ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          模拟面试记录 ({mockInterviews.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('real')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'real'
              ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          真实面试记录 ({realInterviews.length})
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          icon={Users}
          label={statTotalLabel}
          value={stats.totalCount}
          color="bg-primary-500"
          actionLabel={isMockTab ? '开始模拟面试' : undefined}
          onAction={isMockTab ? onStartMockInterview : undefined}
        />
        <StatCard
          icon={CheckCircle}
          label="已完成"
          value={stats.completedCount}
          color="bg-emerald-500"
        />
        <StatCard
          icon={TrendingUp}
          label="平均分数"
          value={stats.averageScore}
          suffix="分"
          color="bg-indigo-500"
          onClick={
            isMockTab && trendTargetResumeId
              ? () => {
                  onViewTrend(trendTargetResumeId);
                }
              : undefined
          }
          hint={isMockTab && trendTargetResumeId ? '点击查看成绩趋势' : undefined}
        />
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      )}

      {/* 空状态 */}
      {!loading && filteredInterviews.length === 0 && (
        <motion.div
            className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
            <Users className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4"/>
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">暂无{currentTitle}</h3>
            <p className="text-slate-500 dark:text-slate-400">{currentEmptyDesc}</p>
        </motion.div>
      )}

      {/* 表格 */}
      {!loading && filteredInterviews.length > 0 && (
        <motion.div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-600">
              <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">关联简历</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">{countLabel}</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">状态</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">得分</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">创建时间</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">操作</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredInterviews.map((interview, index) => (
                  <motion.tr
                    key={interview.sessionId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => {
                      if (canViewInterviewDetail) {
                        onViewInterview(interview.sessionId, interview.resumeId);
                      }
                    }}
                    className={`border-b border-slate-50 dark:border-slate-700 transition-colors group ${
                      canViewInterviewDetail
                        ? 'hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer'
                        : ''
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-400" />
                        <div>
                            <p className="font-medium text-slate-800 dark:text-white">{interview.resumeFilename}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">#{interview.sessionId.slice(-8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm">
                        {interview.totalQuestions} {isMockTab ? '题' : '轮'}
                      </span>
                      {!isMockTab && interview.interviewerStyle && (
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{interview.interviewerStyle}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <StatusIcon interview={interview} />
                          <span className="text-sm text-slate-600 dark:text-slate-300">
                          {getStatusText(interview)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {isEvaluateCompleted(interview) && interview.overallScore !== null ? (
                        <div className="flex items-center gap-3">
                            <div className="w-16 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full ${getScoreProgressColor(interview.overallScore)} rounded-full`}
                              initial={{ width: 0 }}
                              animate={{ width: `${interview.overallScore}%` }}
                              transition={{ duration: 0.8, delay: index * 0.05 }}
                            />
                          </div>
                            <span className="font-bold text-slate-800 dark:text-white">{interview.overallScore}</span>
                        </div>
                      ) : isEvaluating(interview) ? (
                          <span className="text-blue-500 dark:text-blue-400 text-sm">生成中...</span>
                      ) : isEvaluateFailed(interview) ? (
                          <span className="text-red-500 dark:text-red-400 text-sm"
                                title={interview.evaluateError}>失败</span>
                      ) : (
                          <span className="text-slate-400 dark:text-slate-500">-</span>
                      )}
                    </td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(interview.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* 导出按钮 */}
                        {canExportInterview(interview) && (
                          <button
                            onClick={(e) => handleExport(interview, e)}
                            disabled={exporting === interview.sessionId}
                            className="p-2 text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-colors disabled:opacity-50"
                            title={exportTitle}
                          >
                            {exporting === interview.sessionId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {/* 删除按钮 */}
                        <button
                          onClick={(e) => handleDeleteClick(interview, e)}
                          disabled={deletingSessionId === interview.sessionId}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {canViewInterviewDetail && (
                          <ChevronRight
                            className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-primary-500 group-hover:translate-x-1 transition-all"
                          />
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </motion.div>
      )}

      {/* 删除确认对话框 */}
      <DeleteConfirmDialog
        open={deleteItem !== null}
        item={deleteItem ? { id: deleteItem.id, sessionId: deleteItem.sessionId } : null}
        itemType={activeTab === 'mock' ? '模拟面试记录' : '真实面试记录'}
        loading={deletingSessionId !== null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteItem(null)}
      />
    </motion.div>
  );
}
