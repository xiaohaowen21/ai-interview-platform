import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { InterviewSession } from '../types/interview';

interface InterviewConfigPanelProps {
  questionCount: number;
  onQuestionCountChange: (count: number) => void;
  onStart: () => void;
  isCreating: boolean;
  checkingUnfinished: boolean;
  unfinishedSession: InterviewSession | null;
  onContinueUnfinished: () => void;
  onStartNew: () => void;
  resumeText: string;
  onBack: () => void;
  error?: string;
}

export default function InterviewConfigPanel({
  questionCount,
  onQuestionCountChange,
  onStart,
  isCreating,
  checkingUnfinished,
  unfinishedSession,
  onContinueUnfinished,
  onStartNew,
  resumeText,
  onBack,
  error,
}: InterviewConfigPanelProps) {
  const presets = [6, 8, 10, 12, 15];
  const [customCountInput, setCustomCountInput] = useState(String(questionCount));
  const [customCountError, setCustomCountError] = useState('');

  useEffect(() => {
    setCustomCountInput(String(questionCount));
  }, [questionCount]);

  const handleApplyCustomCount = () => {
    const parsed = Number.parseInt(customCountInput, 10);
    if (Number.isNaN(parsed)) {
      setCustomCountError('请输入有效数字');
      return;
    }
    if (parsed < 1 || parsed > 20) {
      setCustomCountError('题目数量范围为 1 - 20');
      return;
    }
    setCustomCountError('');
    onQuestionCountChange(parsed);
  };

  return (
    <motion.div
      className="mx-auto max-w-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-900/50">
        <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
            <svg className="h-5 w-5 text-primary-600 dark:text-primary-400" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
          </div>
          AI预测面试配置
        </h2>

        <AnimatePresence>
          {checkingUnfinished && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-center text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
            >
              <div className="flex items-center justify-center gap-2">
                <motion.div
                  className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                正在检查是否有未完成的AI预测面试...
              </div>
            </motion.div>
          )}

          {unfinishedSession && !checkingUnfinished && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
                  <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 font-semibold text-amber-900 dark:text-amber-300">检测到未完成的AI预测面试</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    已完成 {unfinishedSession.currentQuestionIndex} / {unfinishedSession.totalQuestions} 题
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <motion.button
                  onClick={onContinueUnfinished}
                  className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-amber-600"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  继续AI预测面试
                </motion.button>
                <motion.button
                  onClick={onStartNew}
                  className="flex-1 rounded-lg border border-amber-300 bg-white px-4 py-2.5 font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-700 dark:text-amber-400 dark:hover:bg-amber-900/30"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  开始新的AI预测面试
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-6">
          <div>
            <label className="mb-3 block text-sm font-semibold text-slate-700 dark:text-slate-300">题目数量</label>
            <div className="grid grid-cols-5 gap-3">
              {presets.map((count) => (
                <motion.button
                  key={count}
                  onClick={() => onQuestionCountChange(count)}
                  className={`rounded-xl px-4 py-3 font-medium transition-all ${
                    questionCount === count
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {count}
                </motion.button>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-900/70">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={customCountInput}
                  onChange={(event) => {
                    setCustomCountInput(event.target.value);
                    if (customCountError) {
                      setCustomCountError('');
                    }
                  }}
                  className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-primary-500 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200"
                  placeholder="1 - 20"
                />
                <motion.button
                  type="button"
                  onClick={handleApplyCustomCount}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  自定义题数
                </motion.button>
                <span className="text-xs text-slate-500 dark:text-slate-400">支持自定义，最多 20 题</span>
              </div>
              {customCountError && <p className="mt-2 text-xs text-red-500 dark:text-red-400">{customCountError}</p>}
            </div>
          </div>

          <div>
            <label className="mb-3 block text-sm font-semibold text-slate-600 dark:text-slate-400">简历预览（前 500 字）</label>
            <textarea
              value={resumeText.substring(0, 500) + (resumeText.length > 500 ? '...' : '')}
              readOnly
              className="h-32 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
            系统将基于简历生成主问题，并在作答过程中按回答质量决定是否继续追问。
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-center gap-4">
            <motion.button
              onClick={onBack}
              className="rounded-xl border border-slate-200 px-6 py-3 font-medium text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              返回
            </motion.button>
            <motion.button
              onClick={onStart}
              disabled={isCreating}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-3 font-semibold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              whileHover={{ scale: isCreating ? 1 : 1.02, y: isCreating ? 0 : -1 }}
              whileTap={{ scale: isCreating ? 1 : 0.98 }}
            >
              {isCreating ? (
                <>
                  <motion.span
                    className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  正在生成AI预测面试流程...
                </>
              ) : (
                <>开始AI预测面试</>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
