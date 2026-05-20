import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDateTime, getDateTimestamp } from '../utils/date';
import { getScoreColor } from '../utils/score';
import type { InterviewItem } from '../api/history';
import { historyApi } from '../api/history';
import ConfirmDialog from './ConfirmDialog';
import { Calendar, ChevronRight, Download, MessageSquare, Mic, Trash2, TrendingUp } from 'lucide-react';

const CHINESE_NUMBERS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function toChineseNumber(value: number): string {
  if (value <= 10) {
    return value === 10 ? '十' : CHINESE_NUMBERS[value];
  }
  if (value < 20) {
    return `十${CHINESE_NUMBERS[value % 10]}`;
  }
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const units = value % 10;
    return `${CHINESE_NUMBERS[tens]}十${units === 0 ? '' : CHINESE_NUMBERS[units]}`;
  }
  return String(value);
}

function getMockInterviewLabel(sequence: number): string {
  return `第${toChineseNumber(sequence)}次模拟面试`;
}

interface InterviewPanelProps {
  interviews: InterviewItem[];
  onStartInterview: () => void;
  onViewInterview: (sessionId: string) => void;
  onExportInterview: (sessionId: string) => void;
  onDeleteInterview: (sessionId: string) => void;
  exporting: string | null;
  loadingInterview: boolean;
}

export default function InterviewPanel({
  interviews,
  onStartInterview,
  onViewInterview,
  onExportInterview,
  onDeleteInterview,
  exporting,
  loadingInterview
}: InterviewPanelProps) {
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ sessionId: string } | null>(null);

  const orderedByTime = useMemo(() => {
    return [...interviews].sort((left, right) => {
      const diff = getDateTimestamp(left.createdAt) - getDateTimestamp(right.createdAt);
      if (diff !== 0) {
        return diff;
      }
      return left.id - right.id;
    });
  }, [interviews]);

  const sequenceMap = useMemo(() => {
    return new Map(orderedByTime.map((interview, index) => [interview.sessionId, index + 1]));
  }, [orderedByTime]);

  const displayInterviews = useMemo(() => {
    return [...orderedByTime].reverse();
  }, [orderedByTime]);

  const chartData = useMemo(() => {
    return orderedByTime
      .filter((item) => item.overallScore !== null)
      .map((interview) => ({
        name: getMockInterviewLabel(sequenceMap.get(interview.sessionId) ?? 1),
        score: interview.overallScore || 0,
        createdAt: interview.createdAt,
      }));
  }, [orderedByTime, sequenceMap]);

  const handleDeleteClick = (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setDeleteConfirm({ sessionId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    const { sessionId } = deleteConfirm;
    setDeletingSessionId(sessionId);
    try {
      await historyApi.deleteInterview(sessionId);
      onDeleteInterview(sessionId);
      setDeleteConfirm(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败，请稍后重试');
    } finally {
      setDeletingSessionId(null);
    }
  };

  if (interviews.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center dark:bg-slate-800">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
          <Mic className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="mb-2 text-xl font-semibold text-slate-700 dark:text-slate-300">暂无面试记录</h3>
        <p className="mb-6 text-slate-500 dark:text-slate-400">开始一次正式面试，系统会在这里汇总问答与分析结果</p>
        <motion.button
          onClick={onStartInterview}
          className="rounded-xl bg-slate-900 px-6 py-3 font-medium text-white dark:bg-white dark:text-slate-900"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          开始正式面试
        </motion.button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {chartData.length > 0 && (
        <motion.div
          className="rounded-2xl bg-white p-6 dark:bg-slate-800"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-500" />
              <span className="font-semibold text-slate-800 dark:text-white">模拟面试表现趋势</span>
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">已评分 {chartData.length} 次</span>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  labelFormatter={(label, payload) => {
                    const point = payload?.[0]?.payload as { createdAt?: string } | undefined;
                    if (!point?.createdAt) {
                      return label;
                    }
                    return `${label} · ${formatDateTime(point.createdAt)}`;
                  }}
                  formatter={(value) => [`${value} 分`, '得分']}
                />
                <Bar
                  dataKey="score"
                  fill="#a5b4fc"
                  barSize={18}
                  radius={[6, 6, 0, 0]}
                  fillOpacity={0.75}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ fill: '#6366f1', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 8, fill: '#6366f1' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      <motion.div
        className="rounded-2xl bg-white p-6 dark:bg-slate-800"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="mb-6 flex items-center justify-between">
          <span className="font-semibold text-slate-800 dark:text-white">历次模拟面试</span>
        </div>

        <div className="space-y-4">
          {displayInterviews.map((interview, index) => (
            <InterviewItemCard
              key={interview.id}
              interview={interview}
              index={index}
              sequence={sequenceMap.get(interview.sessionId) ?? displayInterviews.length - index}
              exporting={exporting === interview.sessionId}
              deleting={deletingSessionId === interview.sessionId}
              onView={() => onViewInterview(interview.sessionId)}
              onExport={() => onExportInterview(interview.sessionId)}
              onDelete={(event) => handleDeleteClick(interview.sessionId, event)}
            />
          ))}
        </div>

        <ConfirmDialog
          open={deleteConfirm !== null}
          title="删除面试记录"
          message="确定要删除这条面试记录吗？删除后无法恢复。"
          confirmText="确定删除"
          cancelText="取消"
          confirmVariant="danger"
          loading={deletingSessionId !== null}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
        />

        {loadingInterview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/50">
            <div className="flex items-center gap-4 rounded-2xl bg-white p-6 dark:bg-slate-800">
              <motion.div
                className="h-8 w-8 rounded-full border-3 border-slate-200 border-t-primary-500 dark:border-slate-600"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <span className="text-slate-600 dark:text-slate-300">加载面试详情...</span>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function InterviewItemCard({
  interview,
  index,
  sequence,
  exporting,
  deleting,
  onView,
  onExport,
  onDelete
}: {
  interview: InterviewItem;
  index: number;
  sequence: number;
  exporting: boolean;
  deleting: boolean;
  onView: () => void;
  onExport: () => void;
  onDelete: (event: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={onView}
      className="group flex cursor-pointer items-center gap-4 rounded-xl bg-slate-50 p-4 transition-colors hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700"
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold ${
        interview.overallScore !== null
          ? getScoreColor(interview.overallScore, [85, 70])
          : 'bg-slate-100 text-slate-400 dark:bg-slate-600'
      }`}>
        {interview.overallScore ?? '-'}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-800 dark:text-white">
          {getMockInterviewLabel(sequence)}
        </p>
        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDateTime(interview.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            {interview.totalQuestions} 题
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
        <motion.button
          onClick={(event) => {
            event.stopPropagation();
            onExport();
          }}
          disabled={exporting}
          className="rounded-lg px-3 py-2 text-slate-400 transition-all hover:bg-white hover:text-primary-500 dark:hover:bg-slate-600"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Download className="h-5 w-5" />
        </motion.button>

        <button
          onClick={onDelete}
          disabled={deleting}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-900/30"
          title="删除面试记录"
        >
          {deleting ? (
            <motion.div
              className="h-5 w-5 rounded-full border-2 border-red-500 border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <Trash2 className="h-5 w-5" />
          )}
        </button>
      </div>

      <ChevronRight className="h-5 w-5 flex-shrink-0 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-primary-500 dark:text-slate-600" />
    </motion.div>
  );
}
