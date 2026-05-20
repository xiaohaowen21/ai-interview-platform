import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { interviewApi } from '../api/interview';
import ConfirmDialog from '../components/ConfirmDialog';
import InterviewChatPanel, { type InterviewMessage } from '../components/InterviewChatPanel';
import InterviewConfigPanel from '../components/InterviewConfigPanel';
import type {
  InterviewQuestion,
  InterviewSession,
  InterviewStreamDoneEvent,
  InterviewStreamMetaEvent,
} from '../types/interview';

type InterviewStage = 'config' | 'interview';

interface InterviewProps {
  resumeText: string;
  resumeId?: number;
  onBack: () => void;
  onInterviewComplete: (sessionId: string) => void;
}

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor() {
  const customWindow = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return customWindow.SpeechRecognition || customWindow.webkitSpeechRecognition;
}

function buildInterviewerMessage(question: InterviewQuestion | null, mode: 'opening' | 'next' = 'next') {
  if (!question) {
    return '好的，本轮AI预测面试先到这里。系统正在为你生成本轮分析结果，请稍等。';
  }
  if (mode === 'opening') {
    return `你好，下面进入本轮AI预测面试。我们先从这个问题开始：${question.question}`;
  }
  if (question.isFollowUp) {
    return `我想继续追问一下：${question.question}`;
  }
  return `好的，我们继续下一题：${question.question}`;
}

function updateStreamingMessage(
  messages: InterviewMessage[],
  updater: (message: InterviewMessage) => InterviewMessage
) {
  const next = [...messages];
  for (let index = next.length - 1; index >= 0; index -= 1) {
    if (next[index].type === 'interviewer' && next[index].streaming) {
      next[index] = updater(next[index]);
      break;
    }
  }
  return next;
}

export default function InterviewPage({ resumeText, resumeId, onBack, onInterviewComplete }: InterviewProps) {
  const [stage, setStage] = useState<InterviewStage>('config');
  const [questionCount, setQuestionCount] = useState(8);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [checkingUnfinished, setCheckingUnfinished] = useState(false);
  const [unfinishedSession, setUnfinishedSession] = useState<InterviewSession | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [forceCreateNew, setForceCreateNew] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const recordingPrefixRef = useRef('');
  const recordedFinalTextRef = useRef('');
  const completeTimerRef = useRef<number | null>(null);

  const speechSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);

  useEffect(() => {
    if (resumeId) {
      void checkUnfinishedSession();
    }
    return () => {
      if (completeTimerRef.current) {
        window.clearTimeout(completeTimerRef.current);
      }
      recognitionRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      return;
    }

    const recognition = new Ctor();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interimText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? '';
        if (!transcript) {
          continue;
        }
        if (result.isFinal) {
          recordedFinalTextRef.current += transcript;
        } else {
          interimText += transcript;
        }
      }

      const parts = [
        recordingPrefixRef.current.trim(),
        recordedFinalTextRef.current.trim(),
        interimText.trim(),
      ].filter(Boolean);

      setAnswer(parts.join('\n'));
    };
    recognition.onerror = () => {
      setIsRecording(false);
      setError('语音识别失败，请检查麦克风权限后重试。');
    };
    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  const checkUnfinishedSession = async () => {
    if (!resumeId) {
      return;
    }

    setCheckingUnfinished(true);
    try {
      const foundSession = await interviewApi.findUnfinishedSession(resumeId);
      if (foundSession) {
        setUnfinishedSession(foundSession);
      }
    } catch (exception) {
      console.error('检查未完成面试失败', exception);
    } finally {
      setCheckingUnfinished(false);
    }
  };

  const restoreSession = (sessionToRestore: InterviewSession) => {
    setSession(sessionToRestore);

    const current = sessionToRestore.questions[sessionToRestore.currentQuestionIndex];
    if (current) {
      setCurrentQuestion(current);
      if (current.userAnswer) {
        setAnswer(current.userAnswer);
      } else {
        setAnswer('');
      }
    }

    const restoredMessages: InterviewMessage[] = [];
    sessionToRestore.questions.forEach((question, index) => {
      if (index > sessionToRestore.currentQuestionIndex) {
        return;
      }
      restoredMessages.push({
        type: 'interviewer',
        content: index === 0 ? buildInterviewerMessage(question, 'opening') : question.question,
        category: question.category,
        questionIndex: question.questionIndex,
      });
      if (question.userAnswer) {
        restoredMessages.push({
          type: 'user',
          content: question.userAnswer,
        });
      }
    });

    setMessages(restoredMessages);
    setStage('interview');
  };

  const handleContinueUnfinished = () => {
    if (!unfinishedSession) {
      return;
    }
    setForceCreateNew(false);
    restoreSession(unfinishedSession);
    setUnfinishedSession(null);
  };

  const handleStartNew = () => {
    setUnfinishedSession(null);
    setForceCreateNew(true);
  };

  const startInterview = async () => {
    setIsCreating(true);
    setError('');

    try {
      const newSession = await interviewApi.createSession({
        resumeText,
        questionCount,
        resumeId,
        forceCreate: forceCreateNew,
      });

      setForceCreateNew(false);

      const hasProgress =
        newSession.currentQuestionIndex > 0 ||
        newSession.questions.some((question) => question.userAnswer) ||
        newSession.status === 'IN_PROGRESS';

      if (hasProgress) {
        restoreSession(newSession);
        return;
      }

      setSession(newSession);
      if (newSession.questions.length > 0) {
        const firstQuestion = newSession.questions[0];
        const openingMessage = buildInterviewerMessage(firstQuestion, 'opening');
        setCurrentQuestion(firstQuestion);
        setMessages([
          {
            type: 'interviewer',
            content: openingMessage,
            category: firstQuestion.category,
            questionIndex: firstQuestion.questionIndex,
          },
        ]);
      }

      setStage('interview');
    } catch (exception) {
      setError('创建面试失败，请重试。');
      console.error(exception);
      setForceCreateNew(false);
    } finally {
      setIsCreating(false);
    }
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const startRecording = () => {
    if (!speechSupported || !recognitionRef.current || isSubmitting) {
      return;
    }
    recordedFinalTextRef.current = '';
    recordingPrefixRef.current = answer.trim();
    setError('');
    setIsRecording(true);
    recognitionRef.current.start();
  };

  const applyInterviewProgress = (
    answerText: string,
    meta: InterviewStreamMetaEvent | InterviewStreamDoneEvent
  ) => {
    setSession((previous) => {
      if (!previous) {
        return previous;
      }

      const nextQuestions = [...previous.questions];
      if (currentQuestion) {
        nextQuestions[currentQuestion.questionIndex] = {
          ...currentQuestion,
          userAnswer: answerText,
        };
      }
      if (meta.nextQuestion) {
        nextQuestions[meta.nextQuestion.questionIndex] = meta.nextQuestion;
      }

      return {
        ...previous,
        currentQuestionIndex: meta.currentIndex,
        totalQuestions: meta.totalQuestions,
        questions: nextQuestions.slice(0, meta.totalQuestions),
        status: meta.hasNextQuestion ? 'IN_PROGRESS' : 'COMPLETED',
      };
    });

    if (meta.hasNextQuestion && meta.nextQuestion) {
      setCurrentQuestion(meta.nextQuestion);
      return;
    }

    setCurrentQuestion(null);
    completeTimerRef.current = window.setTimeout(() => {
      if (session) {
        onInterviewComplete(session.sessionId);
      }
    }, 600);
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim() || !session || !currentQuestion) {
      return;
    }

    stopRecording();
    const answerText = answer.trim();
    setIsSubmitting(true);
    setError('');
    setAnswer('');

    setMessages((previous) => [
      ...previous,
      {
        type: 'user',
        content: answerText,
      },
      {
        type: 'interviewer',
        content: '',
        category: currentQuestion.category,
        streaming: true,
      },
    ]);

    let latestMeta: InterviewStreamMetaEvent | null = null;
    let latestDone: InterviewStreamDoneEvent | null = null;

    try {
      await interviewApi.submitAnswerStream(
        {
          sessionId: session.sessionId,
          questionIndex: currentQuestion.questionIndex,
          answer: answerText,
        },
        {
          onEvent: (event) => {
            if (event.type === 'meta') {
              latestMeta = event;
              setMessages((previous) =>
                updateStreamingMessage(previous, (message) => ({
                  ...message,
                  category: event.nextQuestion?.category || message.category,
                }))
              );
              return;
            }

            if (event.type === 'chunk') {
              setMessages((previous) =>
                updateStreamingMessage(previous, (message) => ({
                  ...message,
                  content: `${message.content}${event.content}`,
                }))
              );
              return;
            }

            if (event.type === 'done') {
              latestDone = event;
              setMessages((previous) =>
                updateStreamingMessage(previous, (message) => ({
                  ...message,
                  content: event.message || message.content || buildInterviewerMessage(event.nextQuestion),
                  category: event.nextQuestion?.category || message.category,
                  streaming: false,
                }))
              );
            }
          },
        }
      );

      const doneEvent = latestDone as InterviewStreamDoneEvent | null;
      const metaEvent = latestMeta as InterviewStreamMetaEvent | null;
      const outcome = doneEvent ?? metaEvent;
      if (!outcome) {
        throw new Error('未收到面试官回复');
      }

      applyInterviewProgress(answerText, outcome);
    } catch (exception) {
      console.error('流式回答失败，尝试回退普通模式', exception);
      try {
        const response = await interviewApi.submitAnswer({
          sessionId: session.sessionId,
          questionIndex: currentQuestion.questionIndex,
          answer: answerText,
        });

        const fallbackMessage = response.hasNextQuestion
          ? buildInterviewerMessage(response.nextQuestion)
          : buildInterviewerMessage(null);

        setMessages((previous) =>
          updateStreamingMessage(previous, (message) => ({
            ...message,
            content: fallbackMessage,
            category: response.nextQuestion?.category || message.category,
            streaming: false,
          }))
        );

        applyInterviewProgress(answerText, {
          type: 'done',
          message: fallbackMessage,
          hasNextQuestion: response.hasNextQuestion,
          nextQuestion: response.nextQuestion,
          currentIndex: response.currentIndex,
          totalQuestions: response.totalQuestions,
        });
      } catch (fallbackException) {
        console.error('提交回答失败', fallbackException);
        setError('提交回答失败，请重试。');
        setMessages((previous) => previous.slice(0, Math.max(previous.length - 2, 0)));
        setAnswer(answerText);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteEarly = async () => {
    if (!session) {
      return;
    }

    setIsSubmitting(true);
    try {
      await interviewApi.completeInterview(session.sessionId);
      setShowCompleteConfirm(false);
      onInterviewComplete(session.sessionId);
    } catch (exception) {
      setError('提前结束失败，请重试。');
      console.error(exception);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderConfig = () => (
    <InterviewConfigPanel
      questionCount={questionCount}
      onQuestionCountChange={setQuestionCount}
      onStart={startInterview}
      isCreating={isCreating}
      checkingUnfinished={checkingUnfinished}
      unfinishedSession={unfinishedSession}
      onContinueUnfinished={handleContinueUnfinished}
      onStartNew={handleStartNew}
      resumeText={resumeText}
      onBack={onBack}
      error={error}
    />
  );

  const renderInterview = () => {
    if (!session || !currentQuestion) {
      return null;
    }

    return (
      <InterviewChatPanel
        session={session}
        currentQuestion={currentQuestion}
        messages={messages}
        answer={answer}
        onAnswerChange={setAnswer}
        onSubmit={handleSubmitAnswer}
        onCompleteEarly={handleCompleteEarly}
        isSubmitting={isSubmitting}
        onShowCompleteConfirm={setShowCompleteConfirm}
        speechSupported={speechSupported}
        isRecording={isRecording}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
      />
    );
  };

  const stageSubtitles: Record<InterviewStage, string> = {
    config: '设置题数后即可开始一轮AI预测面试',
    interview: '按题目逐题作答，系统会实时推进并生成评估',
  };

  return (
    <div className="pb-10">
      <motion.div
        className="mb-10 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="mb-2 flex items-center justify-center gap-3 text-3xl font-bold text-slate-900 dark:text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 dark:bg-white">
            <svg className="h-6 w-6 text-white dark:text-slate-900" viewBox="0 0 24 24" fill="none">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          AI预测面试
        </h1>
        <p className="text-slate-500 dark:text-slate-400">{stageSubtitles[stage]}</p>
      </motion.div>

      <AnimatePresence mode="wait" initial={false}>
        {stage === 'config' && (
          <motion.div
            key="config"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderConfig()}
          </motion.div>
        )}
        {stage === 'interview' && (
          <motion.div
            key="interview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {renderInterview()}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={showCompleteConfirm}
        title="提前结束面试"
        message="确定要提前结束本轮面试吗？未完成的问题将不会继续追问，系统会直接进入分析阶段。"
        confirmText="确定结束"
        cancelText="继续作答"
        confirmVariant="warning"
        loading={isSubmitting}
        onConfirm={handleCompleteEarly}
        onCancel={() => setShowCompleteConfirm(false)}
      />
    </div>
  );
}
