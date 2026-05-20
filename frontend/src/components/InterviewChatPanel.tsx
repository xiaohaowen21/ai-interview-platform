import { useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import {
  Mic,
  MicOff,
  PauseCircle,
  Send,
  User,
} from 'lucide-react';
import type { InterviewQuestion, InterviewSession } from '../types/interview';

export interface InterviewMessage {
  type: 'interviewer' | 'user';
  content: string;
  category?: string;
  questionIndex?: number;
  streaming?: boolean;
}

interface InterviewChatPanelProps {
  session: InterviewSession;
  currentQuestion: InterviewQuestion | null;
  messages: InterviewMessage[];
  answer: string;
  onAnswerChange: (answer: string) => void;
  onSubmit: () => void;
  onCompleteEarly: () => void;
  isSubmitting: boolean;
  onShowCompleteConfirm: (show: boolean) => void;
  speechSupported: boolean;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export default function InterviewChatPanel({
  session,
  currentQuestion,
  messages,
  answer,
  onAnswerChange,
  onSubmit,
  isSubmitting,
  onShowCompleteConfirm,
  speechSupported,
  isRecording,
  onStartRecording,
  onStopRecording,
}: InterviewChatPanelProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const progress = useMemo(() => {
    if (!session || !currentQuestion || session.totalQuestions <= 0) {
      return 0;
    }
    return ((currentQuestion.questionIndex + 1) / session.totalQuestions) * 100;
  }, [session, currentQuestion]);

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      onSubmit();
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-200px)] max-w-5xl flex-col">
      <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-900/50">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            题目 {currentQuestion ? currentQuestion.questionIndex + 1 : 0} / {session.totalQuestions}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {speechSupported ? '语音输入可用' : '当前浏览器不支持语音输入'}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <motion.div
            className="h-full rounded-full bg-slate-900 dark:bg-white"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-900/50">
        <Virtuoso
          ref={virtuosoRef}
          data={messages}
          initialTopMostItemIndex={messages.length - 1}
          followOutput="smooth"
          className="flex-1"
          itemContent={(_index, message) => (
            <div className="px-6 pb-4 first:pt-6">
              <MessageBubble message={message} />
            </div>
          )}
        />

        <div className="border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700/50">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {speechSupported && (
              <>
                {isRecording ? (
                  <button
                    type="button"
                    onClick={onStopRecording}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
                  >
                    <MicOff className="h-4 w-4" />
                    停止录音
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onStartRecording}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    <Mic className="h-4 w-4" />
                    语音输入
                  </button>
                )}
              </>
            )}
            {isRecording && (
              <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">
                <motion.span
                  className="h-2.5 w-2.5 rounded-full bg-red-500"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                正在聆听，请直接说话
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <textarea
              value={answer}
              onChange={(event) => onAnswerChange(event.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="输入你的回答，或使用语音输入。按 Ctrl/Cmd + Enter 可直接提交。"
              className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-500 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
              rows={3}
              disabled={isSubmitting}
            />
            <div className="flex flex-col gap-2">
              <motion.button
                onClick={onSubmit}
                disabled={!answer.trim() || isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-3 font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                whileHover={{ scale: isSubmitting || !answer.trim() ? 1 : 1.02 }}
                whileTap={{ scale: isSubmitting || !answer.trim() ? 1 : 0.98 }}
              >
                {isSubmitting ? (
                  <>
                    <motion.div
                      className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    系统处理中...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    提交答案
                  </>
                )}
              </motion.button>
              <motion.button
                onClick={() => onShowCompleteConfirm(true)}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-200 px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500"
                whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              >
                <PauseCircle className="h-4 w-4" />
                  结束本次AI预测面试
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: InterviewMessage }) {
  if (message.type === 'interviewer') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-start gap-3"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/50">
          <User className="h-4 w-4 text-primary-600 dark:text-primary-400" />
        </div>
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">系统</span>
            {message.category && (
              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                {message.category}
              </span>
            )}
          </div>
          <div className="rounded-2xl rounded-tl-none bg-slate-100 p-4 leading-relaxed text-slate-800 dark:bg-slate-700 dark:text-slate-200">
            {message.content || (message.streaming ? '...' : '')}
            {message.streaming && (
              <motion.span
                className="ml-1 inline-block h-2.5 w-2.5 rounded-full bg-primary-500"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start justify-end gap-3"
    >
      <div className="max-w-[80%] flex-1">
        <div className="rounded-2xl rounded-tr-none bg-primary-500 p-4 leading-relaxed text-white">
          {message.content}
        </div>
      </div>
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-600">
        <User className="h-4 w-4 text-slate-600 dark:text-slate-300" />
      </div>
    </motion.div>
  );
}
