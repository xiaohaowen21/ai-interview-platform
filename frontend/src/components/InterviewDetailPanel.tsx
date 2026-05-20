import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getScoreColor } from '../utils/score';
import type { InterviewDetail } from '../api/history';

interface InterviewDetailPanelProps {
  interview: InterviewDetail;
}

export default function InterviewDetailPanel({ interview }: InterviewDetailPanelProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(() => {
    const allIndices = new Set<number>();
    interview.answers?.forEach((_, idx) => allIndices.add(idx));
    return allIndices;
  });

  useEffect(() => {
    const allIndices = new Set<number>();
    interview.answers?.forEach((_, idx) => allIndices.add(idx));
    setExpandedQuestions(allIndices);
  }, [interview.answers, interview.sessionId]);

  const toggleQuestion = (index: number) => {
    setExpandedQuestions((previous) => {
      const next = new Set(previous);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const { scorePercent, circumference, strokeDashoffset } = useMemo(() => {
    const percent = interview.overallScore !== null ? (interview.overallScore / 100) * 100 : 0;
    const circleCircumference = 2 * Math.PI * 54;
    const offset = circleCircumference - (percent / 100) * circleCircumference;
    return {
      scorePercent: percent,
      circumference: circleCircumference,
      strokeDashoffset: offset,
    };
  }, [interview.overallScore]);

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <ScoreCard
        interview={interview}
        scorePercent={scorePercent}
        circumference={circumference}
        strokeDashoffset={strokeDashoffset}
      />

      {interview.strengths && interview.strengths.length > 0 && (
        <StrengthsSection strengths={interview.strengths} />
      )}

      {interview.improvements && interview.improvements.length > 0 && (
        <ImprovementsSection improvements={interview.improvements} />
      )}

      <QuestionsSection
        answers={interview.answers || []}
        expandedQuestions={expandedQuestions}
        toggleQuestion={toggleQuestion}
      />
    </motion.div>
  );
}

function ScoreCard({
  interview,
  circumference,
  strokeDashoffset
}: {
  interview: InterviewDetail;
  scorePercent: number;
  circumference: number;
  strokeDashoffset: number;
}) {
  const isGenerating = interview.evaluateStatus === 'PENDING' || interview.evaluateStatus === 'PROCESSING';
  const isFailed = interview.evaluateStatus === 'FAILED';

  const summary = (() => {
    if (isGenerating) {
      return '正在生成本次模拟面试分析，请稍候。';
    }
    if (isFailed) {
      return interview.evaluateError?.trim() || '本次模拟面试分析生成失败，请稍后重试。';
    }
    if (interview.overallFeedback?.trim()) {
      return interview.overallFeedback.trim();
    }
    if ((interview.overallScore ?? 0) <= 0) {
      return '本次模拟面试暂未体现出有效作答表现，建议回看题目与回答后再次尝试。';
    }
    if ((interview.overallScore ?? 0) < 60) {
      return '本次模拟面试已完成，但整体表现仍有提升空间，建议结合下方逐题评估继续复盘。';
    }
    return '本次模拟面试已完成，建议结合下方逐题评估继续复盘。';
  })();

  return (
    <div className="rounded-2xl bg-slate-900 p-8 text-white dark:bg-slate-800">
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-6 h-32 w-32">
          <svg className="h-32 w-32 -rotate-90 transform" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="8"
              fill="none"
            />
            <motion.circle
              cx="60"
              cy="60"
              r="54"
              stroke="white"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-4xl font-bold"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              {interview.overallScore ?? '-'}
            </motion.span>
            <span className="mt-1 flex items-center gap-2 text-sm text-white/70">
              {isGenerating && <LoadingSpinner />}
              {isGenerating ? '评估中' : '本次得分'}
            </span>
          </div>
        </div>

        <div className="mb-3 flex items-center gap-2">
          {isGenerating && <LoadingSpinner />}
          <h3 className="text-2xl font-bold">面试评估</h3>
        </div>
        <p className="max-w-2xl leading-relaxed text-white/90">{summary}</p>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <motion.span
      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/25 border-t-white"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
    />
  );
}

function StrengthsSection({ strengths }: { strengths: string[] }) {
  return (
    <motion.div
      className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <h4 className="mb-4 flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="22,4 12,14.01 9,11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        表现优势
      </h4>
      <ul className="space-y-3">
        {strengths.map((item, index) => (
          <li key={index} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
            <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function ImprovementsSection({ improvements }: { improvements: string[] }) {
  return (
    <motion.div
      className="rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <h4 className="mb-4 flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        改进建议
      </h4>
      <ul className="space-y-3">
        {improvements.map((item, index) => (
          <li key={index} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
            <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function QuestionsSection({
  answers,
  expandedQuestions,
  toggleQuestion
}: {
  answers: Array<InterviewDetail['answers'][number]>;
  expandedQuestions: Set<number>;
  toggleQuestion: (index: number) => void;
}) {
  return (
    <div>
      <h4 className="mb-4 flex items-center gap-2 font-semibold text-slate-800 dark:text-white">
        <svg className="h-5 w-5 text-primary-500" viewBox="0 0 24 24" fill="none">
          <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        面试记录
      </h4>

      <div className="space-y-4">
        {answers.map((answer, index) => (
          <QuestionCard
            key={index}
            answer={answer}
            index={index}
            isExpanded={expandedQuestions.has(index)}
            onToggle={() => toggleQuestion(index)}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionCard({
  answer,
  index,
  isExpanded,
  onToggle
}: {
  answer: InterviewDetail['answers'][number];
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-slate-800"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.05 }}
    >
      <div
        className="flex cursor-pointer items-center justify-between px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {answer.questionIndex + 1}
          </span>
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
            {answer.category || '综合'}
          </span>
          <span className={`font-semibold ${getScoreColor(answer.score || 0, [80, 60])}`}>
            得分: {answer.score ?? 0}
          </span>
        </div>
        <motion.svg
          className="h-5 w-5 text-slate-400"
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          viewBox="0 0 24 24"
          fill="none"
        >
          <polyline points="6,9 12,15 18,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </div>

      <div className="px-5 pb-2">
        <p className="font-medium leading-relaxed text-slate-800 dark:text-white">{answer.question}</p>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-5 pb-5">
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-700/50">
                <p className="mb-2 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  你的回答
                </p>
                <p className={`leading-relaxed ${
                  !answer.userAnswer || answer.userAnswer === '不知道'
                    ? 'font-medium text-red-500'
                    : 'text-slate-700 dark:text-slate-300'
                }`}>
                  "{answer.userAnswer || '(未回答)'}"
                </p>
              </div>

              {answer.feedback && (
                <div>
                  <p className="mb-2 flex items-center gap-2 pl-0 text-sm font-medium text-slate-600 dark:text-slate-400">
                    <svg className="h-4 w-4 text-primary-500" viewBox="0 0 24 24" fill="none">
                      <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M18 9L12 15L9 12L3 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    系统评语
                  </p>
                  <p className="pl-6 leading-relaxed text-slate-700 dark:text-slate-300">{answer.feedback}</p>
                </div>
              )}

              {answer.referenceAnswer && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700/50">
                  <p className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                    <svg className="h-4 w-4 text-primary-500" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                      <path d="M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M12 9V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    参考答案
                  </p>
                  <div className="whitespace-pre-line leading-relaxed text-slate-700 dark:text-slate-300">{answer.referenceAnswer}</div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
