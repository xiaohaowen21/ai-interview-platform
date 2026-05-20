import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mic,
  Radio,
  Square,
  Volume2,
  Waves,
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
import { appConfigApi } from '../api/appConfig';
import { oralInterviewApi } from '../api/oralInterview';
import { voiceApi } from '../api/voice';
import {
  DEFAULT_ORAL_PERSONA_KEY,
  ORAL_PERSONAS,
  applyOralPersonaAvatarOverrides,
  getOralPersonaByStyleFromList,
  parseOralPersonaKey,
  type OralPersona,
} from '../constants/oralPersonas';
import type {
  InterviewQuestion,
  InterviewReport,
  InterviewSession,
  InterviewStreamDoneEvent,
  InterviewStreamMetaEvent,
} from '../types/interview';

type InterviewStage =
  | 'booting'
  | 'waitingStart'
  | 'speaking'
  | 'ready'
  | 'recording'
  | 'submitting'
  | 'evaluating'
  | 'completed';

type InteractionMode = 'interview' | 'followUp';

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

interface OralInterviewPageProps {
  sessionId: string;
  onBack: () => void;
  onInterviewComplete: (sessionId: string) => void;
}

interface SpeechQueueItem {
  text: string;
  styleHint: string;
  audioPromise?: Promise<Blob>;
}

function getSpeechRecognitionCtor() {
  const customWindow = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return customWindow.SpeechRecognition || customWindow.webkitSpeechRecognition;
}

function getAudioContextCtor() {
  const customWindow = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  return window.AudioContext || customWindow.webkitAudioContext || null;
}

function getRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];

  return candidates.find((item) => MediaRecorder.isTypeSupported(item)) || '';
}

function buildRecordingFilename(mimeType: string) {
  if (mimeType.includes('ogg')) {
    return 'answer.ogg';
  }
  if (mimeType.includes('mp4')) {
    return 'answer.m4a';
  }
  if (mimeType.includes('wav')) {
    return 'answer.wav';
  }
  return 'answer.webm';
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

function buildOpeningLine(persona: OralPersona | null, question: InterviewQuestion) {
  const name = persona?.label ? `${persona.label}面试官` : '面试官';
  return `你好，我是本轮${name}。请先回答第一个问题：${question.question}`;
}

function buildNextLine(nextQuestion: InterviewQuestion | null) {
  if (!nextQuestion) {
    return '好的，本轮语音面试结束。系统正在生成评估结果，请稍等。';
  }
  return nextQuestion.isFollowUp
    ? `继续追问：${nextQuestion.question}`
    : `下一个问题：${nextQuestion.question}`;
}

function buildReviewNarration(report: InterviewReport) {
  const strengths = (report.strengths || []).filter(Boolean).slice(0, 2);
  const improvements = (report.improvements || []).filter(Boolean).slice(0, 2);
  const blocks = [
    `本轮面试已完成，你的综合得分是${report.overallScore}分。`,
    report.overallFeedback?.trim() || '',
    strengths.length > 0 ? `你的优势是：${strengths.join('；')}。` : '',
    improvements.length > 0 ? `建议优先改进：${improvements.join('；')}。` : '',
  ].filter(Boolean);
  return blocks.join('');
}

function normalizeInput(input: string) {
  return input
    .toLowerCase()
    .replace(/[，。！？,.!?;；:：\s]/g, '')
    .trim();
}

function shouldFinishFollowUp(input: string) {
  const normalized = normalizeInput(input);
  if (!normalized) {
    return false;
  }

  const endings = [
    '没有',
    '没有了',
    '没了',
    '没有问题',
    '没有问题了',
    '没问题',
    '没问题了',
    '不用了',
    '不需要了',
    '暂时没有',
    '就这些',
    '结束吧',
    '可以结束',
    '就这样',
    'thatsall',
    'thatsallthanks',
    'none',
    'no',
  ];
  return endings.some((item) => normalized === item || normalized.endsWith(item));
}

function getStageLabel(stage: InterviewStage, mode: InteractionMode) {
  if (stage === 'booting') return '正在加载语音面试';
  if (stage === 'waitingStart') return '准备就绪，点击开始';
  if (stage === 'speaking') return mode === 'followUp' ? '面试官正在答疑' : '面试官正在发问';
  if (stage === 'recording') return mode === 'followUp' ? '正在聆听你的追问' : '正在聆听你的回答';
  if (stage === 'submitting') return mode === 'followUp' ? '正在整理你的追问' : '正在分析本轮回答';
  if (stage === 'evaluating') return '正在生成并播报面试评估';
  if (stage === 'completed') return '本轮语音面试已完成';
  return mode === 'followUp' ? '正在自动收音（答疑）' : '自动开启收音';
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function splitSpeechSegments(text: string, forceFlush = false) {
  const segments: string[] = [];
  let buffer = '';

  for (const char of text) {
    buffer += char;
    const trimmed = buffer.trim();
    if (!trimmed) {
      continue;
    }

    const strongBreak = /[，。！？、；：,.!?:;]/.test(char) && trimmed.length >= 20;
    const softBreak = /[，、：:]/.test(char) && trimmed.length >= 30;
    const lengthBreak = trimmed.length >= 56;

    if (strongBreak || softBreak || lengthBreak) {
      segments.push(trimmed);
      buffer = '';
    }
  }

  const remainder = buffer.trim();
  if (forceFlush && remainder) {
    segments.push(remainder);
    return { segments, remainder: '' };
  }

  return { segments, remainder };
}

function pickBestTranscript(...candidates: Array<string | null | undefined>) {
  return candidates
    .map((item) => (item || '').trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)[0] || '';
}

export default function OralInterviewPage({ sessionId, onBack, onInterviewComplete }: OralInterviewPageProps) {
  const [personas, setPersonas] = useState<OralPersona[]>(ORAL_PERSONAS);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [persona, setPersona] = useState<OralPersona | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [stage, setStage] = useState<InterviewStage>('booting');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('interview');
  const [promptLine, setPromptLine] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [reviewNarration, setReviewNarration] = useState('');
  const [reviewReport, setReviewReport] = useState<InterviewReport | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 24 }, () => 10));

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedAudioBlobRef = useRef<Blob | null>(null);
  const recordingStopPromiseRef = useRef<Promise<Blob | null> | null>(null);
  const recordingStopResolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  const recordedFinalTextRef = useRef('');
  const recordingPrefixRef = useRef('');
  const manualEditedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserDataRef = useRef<Uint8Array | null>(null);
  const speechQueueRef = useRef<SpeechQueueItem[]>([]);
  const speechQueueRunningRef = useRef(false);
  const speechWaitersRef = useRef<Array<() => void>>([]);
  const streamedSpeechBufferRef = useRef('');
  const recordingPeakRef = useRef(0);
  const isMountedRef = useRef(true);
  const speakingTokenRef = useRef(0);

  const personaKey = useMemo(() => persona?.key ?? DEFAULT_ORAL_PERSONA_KEY, [persona?.key]);
  const recognitionSupported = useMemo(() => Boolean(getSpeechRecognitionCtor()), []);
  const recordingSupported = useMemo(() => {
    return Boolean(navigator.mediaDevices?.getUserMedia)
      && (typeof MediaRecorder !== 'undefined' || recognitionSupported);
  }, [recognitionSupported]);

  const releaseMicrophone = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    analyserSourceRef.current?.disconnect();
    analyserSourceRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    analyserDataRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
    }
    audioContextRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch (error) {
        console.warn('Speech recognition stop failed', error);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      releaseMicrophone();
      recordingStopResolveRef.current?.(recordedAudioBlobRef.current);
      recordingStopResolveRef.current = null;
      speechQueueRef.current = [];
      speechQueueRunningRef.current = false;
      streamedSpeechBufferRef.current = '';
      const speechWaiters = speechWaitersRef.current.splice(0);
      speechWaiters.forEach((resolve) => resolve());
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [releaseMicrophone]);

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
      setAnswerText(parts.join('\n'));
    };

    recognition.onerror = (event) => {
      console.warn('Browser speech recognition failed', event);
    };

    recognition.onend = () => {
      console.info('Browser speech recognition ended');
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const speaking = stage === 'speaking';
    const recording = stage === 'recording';
    const busy = stage === 'submitting' || stage === 'booting' || stage === 'evaluating';

    const interval = window.setInterval(() => {
      if (recording && analyserRef.current && analyserDataRef.current) {
        analyserRef.current.getByteFrequencyData(analyserDataRef.current);
        const bucketSize = Math.max(1, Math.floor(analyserDataRef.current.length / 24));
        const nextBars = Array.from({ length: 24 }, (_, index) => {
          const start = index * bucketSize;
          const end = Math.min(analyserDataRef.current!.length, start + bucketSize);
          let total = 0;
          for (let pointer = start; pointer < end; pointer += 1) {
            total += analyserDataRef.current![pointer];
          }
          const average = end > start ? total / (end - start) : 0;
          const normalized = average / 255;
          recordingPeakRef.current = Math.max(recordingPeakRef.current, normalized);
          return 8 + normalized * 34;
        });
        setBars(nextBars);
        return;
      }

      setBars((previous) =>
        previous.map(() => {
          if (speaking) {
            return 12 + Math.random() * 18;
          }
          if (busy) {
            return 9 + Math.random() * 7;
          }
          return 8 + Math.random() * 4;
        })
      );
    }, 85);

    return () => {
      window.clearInterval(interval);
    };
  }, [stage]);

  const prepareMicrophone = useCallback(async () => {
    if (!window.isSecureContext) {
      setError('当前页面不是 HTTPS 安全连接，浏览器会阻止麦克风。请使用 HTTPS 域名访问。');
      return false;
    }

    const permissionState = await getMicrophonePermissionState();
    if (permissionState === 'denied') {
      setError('麦克风权限已被拒绝，请在浏览器地址栏左侧图标中允许麦克风后重试。');
      return false;
    }
    if (!recordingSupported) {
      setError('当前浏览器不支持录音，请更换最新版 Chrome 或 Edge 后重试。');
      return false;
    }

    const existingStream = mediaStreamRef.current;
    const hasLiveTrack = existingStream?.getAudioTracks().some((track) => track.readyState === 'live');
    if (hasLiveTrack) {
      if (audioContextRef.current?.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
        } catch (error) {
          console.warn('Resume audio context failed', error);
        }
      }
      return true;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (error) {
      console.error('Get user media failed', error);
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setError('麦克风权限被拒绝，请允许麦克风后重试。');
          return false;
        }
        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setError('未检测到可用麦克风设备，请检查系统输入设备后重试。');
          return false;
        }
        if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          setError('麦克风设备被其他程序占用，请关闭占用程序后重试。');
          return false;
        }
      }
      if (!window.isSecureContext) {
        setError('当前页面不是安全连接，浏览器已阻止麦克风。请使用 HTTPS 域名访问。');
      } else {
        setError('麦克风权限被拒绝，请点击地址栏左侧图标允许麦克风后重试。');
      }
      return false;
    }

    const AudioContextCtor = getAudioContextCtor();
    if (AudioContextCtor) {
      try {
        const audioContext = new AudioContextCtor();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.72;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        analyserSourceRef.current = source;
        analyserDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      } catch (error) {
        console.warn('Prepare microphone analyser failed', error);
        analyserRef.current = null;
        analyserSourceRef.current = null;
        analyserDataRef.current = null;
      }
    }

    mediaStreamRef.current = stream;
    setError('');
    return true;
  }, [recordingSupported]);

  const primeSpeechAudio = useCallback((item: SpeechQueueItem) => {
    if (!item.audioPromise) {
      item.audioPromise = voiceApi.synthesize({
        text: item.text,
        personaKey,
        styleHint: item.styleHint,
      });
    }
    return item.audioPromise;
  }, [personaKey]);

  const playVoice = useCallback(
    async (item: SpeechQueueItem) => {
      const voiceBlob = await primeSpeechAudio(item);

      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }

      const url = URL.createObjectURL(voiceBlob);
      audioUrlRef.current = url;
      const audio = audioRef.current;
      audio.src = url;
      audio.currentTime = 0;

      await audio.play();
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('audio playback failed'));
      });
    },
    [primeSpeechAudio]
  );

  const resolveSpeechWaiters = useCallback(() => {
    const waiters = speechWaitersRef.current.splice(0);
    waiters.forEach((resolve) => resolve());
  }, []);

  const stopSpeechPlayback = useCallback((advanceToken = true) => {
    if (advanceToken) {
      speakingTokenRef.current += 1;
    }

    speechQueueRef.current = [];
    speechQueueRunningRef.current = false;
    streamedSpeechBufferRef.current = '';

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    resolveSpeechWaiters();
  }, [resolveSpeechWaiters]);

  const waitForSpeechQueue = useCallback(() => {
    if (!speechQueueRunningRef.current && speechQueueRef.current.length === 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      speechWaitersRef.current.push(resolve);
    });
  }, []);

  const runSpeechQueue = useCallback(async (token: number) => {
    if (speechQueueRunningRef.current) {
      return;
    }

    speechQueueRunningRef.current = true;

    while (token === speakingTokenRef.current && speechQueueRef.current.length > 0) {
      const current = speechQueueRef.current.shift();
      if (!current) {
        continue;
      }

      try {
        void primeSpeechAudio(current);
        const nextItem = speechQueueRef.current[0];
        if (nextItem) {
          void primeSpeechAudio(nextItem);
        }
        if (isMountedRef.current && token === speakingTokenRef.current) {
          setStage('speaking');
        }
        await playVoice(current);
      } catch (exception) {
        console.error('Queued voice playback failed', exception);
        if (isMountedRef.current && token === speakingTokenRef.current) {
          setError('面试官语音播放失败，请重试。');
        }
      }
    }

    if (token === speakingTokenRef.current) {
      speechQueueRunningRef.current = false;
      resolveSpeechWaiters();
    }
  }, [playVoice, primeSpeechAudio, resolveSpeechWaiters]);

  const enqueueSpeechText = useCallback((
    text: string,
    styleHint: string,
    token: number,
    forceFlush = false,
  ) => {
    if (token !== speakingTokenRef.current) {
      return;
    }

    const combined = streamedSpeechBufferRef.current + text;
    const { segments, remainder } = splitSpeechSegments(combined, forceFlush);
    streamedSpeechBufferRef.current = remainder;

    if (segments.length === 0) {
      return;
    }

    segments.forEach((segment) => {
      speechQueueRef.current.push({ text: segment, styleHint });
    });

    speechQueueRef.current.slice(0, 2).forEach((item) => {
      void primeSpeechAudio(item);
    });

    if (!speechQueueRunningRef.current) {
      void runSpeechQueue(token);
    }
  }, [primeSpeechAudio, runSpeechQueue]);

  const speakLine = useCallback(
    async (
      text: string,
      nextStage: InterviewStage = 'ready',
      styleHint: string = '常规发问'
    ) => {
      setPromptLine(text);
      setError('');
      stopSpeechPlayback();
      const speakingToken = speakingTokenRef.current;

      enqueueSpeechText(text, styleHint, speakingToken, true);
      if (speechQueueRef.current.length === 0) {
        if (isMountedRef.current && speakingTokenRef.current === speakingToken) {
          setStage(nextStage);
        }
        return;
      }

      try {
        await waitForSpeechQueue();
      } finally {
        if (isMountedRef.current && speakingTokenRef.current === speakingToken) {
          setStage(nextStage);
        }
      }
    },
    [enqueueSpeechText, stopSpeechPlayback, waitForSpeechQueue]
  );

  const streamInterviewerReply = useCallback(async (
    req: {
      sessionId: string;
      questionIndex: number;
      answer: string;
    },
    styleHint: string,
  ) => {
    let doneEvent: InterviewStreamDoneEvent | null = null;
    let metaEvent: InterviewStreamMetaEvent | null = null;
    let doneMessage = '';
    let fullMessage = '';

    stopSpeechPlayback();
    const speakingToken = speakingTokenRef.current;
    setPromptLine('');
    setError('');

    const appendChunk = (chunk: string) => {
      if (!chunk || speakingToken !== speakingTokenRef.current) {
        return;
      }

      fullMessage += chunk;
      if (isMountedRef.current) {
        setPromptLine(fullMessage);
      }
      enqueueSpeechText(chunk, styleHint, speakingToken, false);
    };

    await oralInterviewApi.submitAnswerStream(req, {
      onEvent: (event) => {
        if (event.type === 'meta') {
          metaEvent = event;
          return;
        }
        if (event.type === 'chunk') {
          appendChunk(event.content);
          return;
        }
        if (event.type === 'done') {
          doneEvent = event;
          doneMessage = event.message?.trim() ?? '';
          const normalizedMessage = doneMessage;
          if (!normalizedMessage) {
            return;
          }

          if (!fullMessage) {
            appendChunk(normalizedMessage);
            return;
          }

          if (normalizedMessage.startsWith(fullMessage)) {
            appendChunk(normalizedMessage.slice(fullMessage.length));
            return;
          }

          if (normalizedMessage !== fullMessage) {
            fullMessage = '';
            streamedSpeechBufferRef.current = '';
            speechQueueRef.current = [];
            appendChunk(normalizedMessage);
          }
        }
      },
    });

    enqueueSpeechText('', styleHint, speakingToken, true);
    await waitForSpeechQueue();

    return {
      doneEvent,
      metaEvent,
      spokenMessage: doneMessage || fullMessage.trim(),
    };
  }, [enqueueSpeechText, stopSpeechPlayback, waitForSpeechQueue]);

  const stopRecording = useCallback(async () => {
    try {
      recognitionRef.current?.stop();
    } catch (error) {
      console.warn('Speech recognition stop failed', error);
    }

    const recorder = mediaRecorderRef.current;
    const stopPromise = recordingStopPromiseRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }

    await sleep(320);
    return stopPromise ? await stopPromise : recordedAudioBlobRef.current;
  }, []);

  const waitForReport = useCallback(async (sid: string) => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      try {
        return await oralInterviewApi.getReport(sid);
      } catch (exception) {
        lastError = exception;
        if (attempt < 15) {
          await sleep(2500);
        }
      }
    }
    throw lastError ?? new Error('评估结果生成失败');
  }, []);

  const resolveCapturedText = useCallback(async () => {
    const audioBlob = await stopRecording();
    const browserAnswer = answerText.trim();
    const manualAnswer = manualEditedRef.current ? browserAnswer : '';
    const browserRecognitionAnswer = [
      recordingPrefixRef.current.trim(),
      recordedFinalTextRef.current.trim(),
    ].filter(Boolean).join('\n').trim();
    let resultText = pickBestTranscript(manualAnswer, browserRecognitionAnswer, browserAnswer);

    if (!manualAnswer && !browserRecognitionAnswer && audioBlob && audioBlob.size > 0) {
      try {
        const transcription = await voiceApi.transcribe(
          audioBlob,
          buildRecordingFilename(audioBlob.type || '')
        );
        const recognizedText = transcription.text.trim();
        if (recognizedText) {
          resultText = pickBestTranscript(recognizedText, resultText);
          if (!manualEditedRef.current) {
            setAnswerText(resultText);
          }
        }
      } catch (exception) {
        console.error('Voice transcription failed', exception);
        if (!resultText) {
          setError(getErrorMessage(exception, '语音转写失败，请重试。'));
          return '';
        }
      }
    }

    if (!resultText) {
      const lowInputDetected = recordingPeakRef.current < 0.03 || !audioBlob || audioBlob.size < 2048;
      setError(
        lowInputDetected
          ? '未检测到有效麦克风输入，请检查系统默认输入设备后重试。'
          : '未识别到你的回答，请重新录音或手动输入后再提交。'
      );
      return '';
    }

    return resultText;
  }, [answerText, stopRecording]);

  const closeConversation = useCallback(
    async (sid: string, line: string) => {
      await speakLine(line, 'completed', '结束总结');
      if (!isMountedRef.current) {
        return;
      }
      window.setTimeout(() => {
        onInterviewComplete(sid);
      }, 500);
    },
    [onInterviewComplete, speakLine]
  );

  const enterPostInterviewFlow = useCallback(
    async (sid: string, openingLine?: string) => {
      setInteractionMode('interview');
      setCurrentQuestion(null);
      setError('');

      if (openingLine) {
        await speakLine(openingLine, 'evaluating', '结束总结');
        if (!isMountedRef.current) {
          return;
        }
      } else {
        setStage('evaluating');
      }

      setPromptLine('系统正在生成本轮评估，请稍等。');

      let report: InterviewReport;
      try {
        report = await waitForReport(sid);
      } catch (exception) {
        setError(getErrorMessage(exception, '评估结果生成失败，请点击重试。'));
        setStage('evaluating');
        return;
      }

      if (!isMountedRef.current) {
        return;
      }

      setReviewReport(report);
      const narration = buildReviewNarration(report);
      setReviewNarration(narration);

      await speakLine(narration, 'evaluating', '评估播报');
      if (!isMountedRef.current) {
        return;
      }

      await speakLine('你还有什么需要问的吗？', 'ready', '收尾答疑');
      if (!isMountedRef.current) {
        return;
      }

      setInteractionMode('followUp');
      setAnswerText('');
      manualEditedRef.current = false;
    },
    [speakLine, waitForReport]
  );

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      setStage('booting');
      setError('');

      try {
        const data = await oralInterviewApi.getSession(sessionId);
        if (!mounted) {
          return;
        }

        const resolvedPersona =
          getOralPersonaByStyleFromList(data.interviewerStyle, personas)
          ?? personas.find((item) => item.key === parseOralPersonaKey(data.interviewerStyle))
          ?? personas.find((item) => item.key === DEFAULT_ORAL_PERSONA_KEY)
          ?? null;

        setPersona(resolvedPersona);
        setSession(data);

        const firstQuestion = data.questions[data.currentQuestionIndex] ?? null;
        if (!firstQuestion) {
          await enterPostInterviewFlow(data.sessionId);
          return;
        }

        setInteractionMode('interview');
        setCurrentQuestion(firstQuestion);
        setPromptLine('点击“开始面试”后，面试官会语音发出第一个问题。');
        setStage('waitingStart');
      } catch (exception) {
        console.error(exception);
        if (mounted) {
          setError('加载语音面试失败，请返回后重试。');
          setStage('waitingStart');
        }
      }
    };

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [enterPostInterviewFlow, personas, sessionId]);

  const handleStartInterview = useCallback(async () => {
    if (stage !== 'waitingStart' || !currentQuestion) {
      return;
    }
    const microphoneReady = await prepareMicrophone();
    if (!microphoneReady) {
      return;
    }
    await speakLine(buildOpeningLine(persona, currentQuestion), 'ready', '开场发问');
  }, [currentQuestion, persona, prepareMicrophone, speakLine, stage]);

  const startRecording = useCallback(async () => {
    if (stage !== 'ready') {
      return;
    }

    const microphoneReady = await prepareMicrophone();
    if (!microphoneReady || !mediaStreamRef.current) {
      return;
    }

    const existingRecorder = mediaRecorderRef.current;
    if (existingRecorder && existingRecorder.state !== 'inactive') {
      return;
    }

    recordedAudioBlobRef.current = null;
    recordingStopResolveRef.current = null;
    recordingStopPromiseRef.current = null;

    const chunks: Blob[] = [];
    const mimeType = getRecorderMimeType();
    const canUseRecorder = typeof MediaRecorder !== 'undefined';
    let recorder: MediaRecorder | null = null;

    if (canUseRecorder) {
      try {
        recorder = mimeType
          ? new MediaRecorder(mediaStreamRef.current, { mimeType })
          : new MediaRecorder(mediaStreamRef.current);
      } catch (error) {
        console.error('Create MediaRecorder failed', error);
        recorder = null;
      }
    }

    if (recorder) {
      recordingStopPromiseRef.current = new Promise<Blob | null>((resolve) => {
        recordingStopResolveRef.current = resolve;
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder failed', event);
        mediaRecorderRef.current = null;
        recordingStopResolveRef.current?.(null);
        recordingStopResolveRef.current = null;
        recordingStopPromiseRef.current = null;
        setStage((previous) => (previous === 'recording' ? 'ready' : previous));
        setError('录音失败，请检查麦克风设备后重试。');
      };

      recorder.onstop = () => {
        recordedAudioBlobRef.current = chunks.length
          ? new Blob(chunks, { type: chunks[0].type || recorder!.mimeType || mimeType || 'audio/webm' })
          : null;
        mediaRecorderRef.current = null;
        recordingStopResolveRef.current?.(recordedAudioBlobRef.current);
        recordingStopResolveRef.current = null;
        recordingStopPromiseRef.current = null;
      };
    } else if (!recognitionRef.current) {
      setError('当前浏览器无法使用录音或语音识别，请更换最新版 Chrome 或 Edge。');
      return;
    } else {
      setError('当前浏览器录音能力受限，已切换为浏览器语音识别模式。');
      recordingStopPromiseRef.current = Promise.resolve(null);
    }

    recordedFinalTextRef.current = '';
    recordingPrefixRef.current = answerText.trim();
    manualEditedRef.current = false;
    recordingPeakRef.current = 0;
    if (recorder) {
      setError('');
    }
    setStage('recording');

    mediaRecorderRef.current = recorder;
    if (recorder) {
      recorder.start(250);
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.warn('Speech recognition start failed', error);
      }
    }
  }, [answerText, prepareMicrophone, stage]);

  useEffect(() => {
    if (stage !== 'ready' || error) {
      return;
    }

    const timer = window.setTimeout(() => {
      void startRecording();
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [error, stage, startRecording]);

  const handleSubmitInterviewAnswer = useCallback(async () => {
    if (!session || !currentQuestion) {
      return;
    }

    setStage('submitting');
    setError('');

    const answer = await resolveCapturedText();
    if (!answer) {
      setStage('ready');
      return;
    }

    let spokenMessage = '';
    let doneEvent: InterviewStreamDoneEvent | null = null;
    let metaEvent: InterviewStreamMetaEvent | null = null;

    try {
      const streamResult = await streamInterviewerReply(
        {
          sessionId: session.sessionId,
          questionIndex: currentQuestion.questionIndex,
          answer,
        },
        '继续发问',
      );
      spokenMessage = streamResult.spokenMessage;
      doneEvent = streamResult.doneEvent;
      metaEvent = streamResult.metaEvent;
    } catch (exception) {
      console.error('Stream submit failed, fallback to normal submit', exception);
      try {
        const fallback = await oralInterviewApi.submitAnswer({
          sessionId: session.sessionId,
          questionIndex: currentQuestion.questionIndex,
          answer,
        });
        doneEvent = {
          type: 'done',
          message: fallback.hasNextQuestion ? buildNextLine(fallback.nextQuestion) : buildNextLine(null),
          hasNextQuestion: fallback.hasNextQuestion,
          nextQuestion: fallback.nextQuestion,
          currentIndex: fallback.currentIndex,
          totalQuestions: fallback.totalQuestions,
        };
      } catch (fallbackException) {
        console.error(fallbackException);
        setError('提交回答失败，请重试。');
        setStage('ready');
        return;
      }
    }

    const outcome = doneEvent ?? metaEvent;
    if (!outcome) {
      setError('未收到面试官回复，请重试。');
      setStage('ready');
      return;
    }

    setSession((previous) => {
      if (!previous) {
        return previous;
      }

      const nextQuestions = [...previous.questions];
      nextQuestions[currentQuestion.questionIndex] = {
        ...currentQuestion,
        userAnswer: answer,
      };
      if (outcome.nextQuestion) {
        nextQuestions[outcome.nextQuestion.questionIndex] = outcome.nextQuestion;
      }

      return {
        ...previous,
        currentQuestionIndex: outcome.currentIndex,
        totalQuestions: outcome.totalQuestions,
        questions: nextQuestions.slice(0, outcome.totalQuestions),
        status: outcome.hasNextQuestion ? 'IN_PROGRESS' : 'COMPLETED',
      };
    });

    setAnswerText('');
    manualEditedRef.current = false;

    if (outcome.hasNextQuestion && outcome.nextQuestion) {
      setCurrentQuestion(outcome.nextQuestion);
      if (!spokenMessage) {
        const line = doneEvent?.message?.trim() || buildNextLine(outcome.nextQuestion);
        await speakLine(line, 'ready', outcome.nextQuestion.isFollowUp ? '追问加压' : '继续发问');
        return;
      }
      setStage('ready');
      return;
    }

    if (spokenMessage) {
      await enterPostInterviewFlow(session.sessionId);
      return;
    }

    const endingLine = doneEvent?.message?.trim() || buildNextLine(null);
    await enterPostInterviewFlow(session.sessionId, endingLine);
  }, [currentQuestion, enterPostInterviewFlow, resolveCapturedText, session, speakLine, streamInterviewerReply]);

  const handleSubmitFollowUp = useCallback(async () => {
    if (!session) {
      return;
    }

    setStage('submitting');
    setError('');

    const followUpQuestion = await resolveCapturedText();
    if (!followUpQuestion) {
      setStage('ready');
      return;
    }

    if (shouldFinishFollowUp(followUpQuestion)) {
      setAnswerText('');
      manualEditedRef.current = false;
      await closeConversation(session.sessionId, '好的，本轮面试到这里。感谢你的参与，祝你求职顺利。');
      return;
    }

    try {
      const response = await oralInterviewApi.answerFollowUp(session.sessionId, followUpQuestion);
      const answer = response.answer?.trim()
        || '你的问题很有价值。建议你结合这轮表现继续打磨回答结构，下次会更稳。';

      setAnswerText('');
      manualEditedRef.current = false;
      await speakLine(answer, 'evaluating', '收尾答疑');
      if (!isMountedRef.current) {
        return;
      }
      await speakLine('你还有什么需要问的吗？', 'ready', '收尾答疑');
    } catch (exception) {
      console.error(exception);
      setError(getErrorMessage(exception, '答疑失败，请重试。'));
      setStage('ready');
    }
  }, [closeConversation, resolveCapturedText, session, speakLine]);

  const handleSubmitAnswer = useCallback(async () => {
    if (interactionMode === 'followUp') {
      await handleSubmitFollowUp();
      return;
    }
    await handleSubmitInterviewAnswer();
  }, [handleSubmitFollowUp, handleSubmitInterviewAnswer, interactionMode]);

  const handleCompleteEarly = useCallback(async () => {
    if (!session) {
      return;
    }

    setStage('submitting');
    try {
      await stopRecording();
      setShowCompleteConfirm(false);

      if (interactionMode === 'followUp') {
        await closeConversation(session.sessionId, '好的，本轮答疑到这里。感谢你的提问，祝你后续面试顺利。');
        return;
      }

      await oralInterviewApi.completeInterview(session.sessionId);
      await enterPostInterviewFlow(session.sessionId, '好的，本轮语音面试先到这里，系统正在生成评估结果。');
    } catch (exception) {
      console.error(exception);
      setError('结束面试失败，请稍后重试。');
      setStage('ready');
    }
  }, [closeConversation, enterPostInterviewFlow, interactionMode, session, stopRecording]);

  const handleRetryReview = useCallback(async () => {
    if (!session) {
      return;
    }
    await enterPostInterviewFlow(session.sessionId);
  }, [enterPostInterviewFlow, session]);

  const stageLabel = useMemo(() => getStageLabel(stage, interactionMode), [interactionMode, stage]);
  const stageTitle = stage === 'speaking'
    ? interactionMode === 'followUp' ? '面试官答疑中' : '面试官发问中'
    : stage === 'recording'
      ? interactionMode === 'followUp' ? '请说出你的追问' : '正在听你回答'
      : stage === 'waitingStart'
        ? '等待开始'
        : stage === 'ready'
          ? interactionMode === 'followUp' ? '答疑收音中' : '正在自动收音'
          : stage === 'evaluating'
            ? '评估生成中'
            : stage === 'completed'
              ? '面试完成'
              : '准备中';

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-8">
      <motion.div
        className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/95"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">沉浸式语音面试</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              当前面试官：{persona ? `${persona.label} · ${persona.subtitle}` : '系统面试官'}
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            返回入口
          </button>
        </div>
      </motion.div>

      <motion.section
        className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800/95"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/80">
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${
                persona ? `${persona.accentFrom} ${persona.accentTo}` : 'from-slate-400/15 to-slate-500/10'
              }`} />

              <div className="relative space-y-5">
                <div className="flex items-center gap-4">
                  <div className="relative h-24 w-24 rounded-full border border-white/70 bg-slate-200 p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    {persona?.avatar ? (
                      <img
                        src={persona.avatar}
                        alt={persona.label}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                        <Mic className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800/90 dark:text-slate-200">
                      <Radio className="h-3.5 w-3.5" />
                      {stageLabel}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{stageTitle}</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {persona?.description ?? '正在加载面试官风格...'}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/90 p-4 dark:bg-slate-800/90">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    {interactionMode === 'followUp' ? '收尾答疑' : '当前题目'}
                  </p>
                  <p className="mt-2 min-h-[68px] text-sm leading-7 text-slate-700 dark:text-slate-200">
                    {interactionMode === 'followUp'
                      ? '你可以继续追问本轮评估、答题表现或改进方向。'
                      : currentQuestion
                        ? currentQuestion.question
                        : '当前题目已结束，正在进入评估环节。'}
                  </p>
                </div>

                {reviewNarration && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <p className="text-xs uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">评估播报文本</p>
                    <p className="mt-2 text-sm leading-7 text-emerald-700 dark:text-emerald-200">{reviewNarration}</p>
                  </div>
                )}

                <div className="rounded-2xl border border-white/80 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-800/80">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">面试官语音文本</p>
                  <p className="mt-2 min-h-[58px] text-sm leading-7 text-slate-700 dark:text-slate-200">
                    {promptLine || '点击“开始面试”后，系统会语音发问。'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/80 bg-white/75 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/65">
                  <div className="mb-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                    <Waves className="h-4 w-4" />
                    语音状态
                  </div>
                  <div className="flex h-12 items-end gap-1">
                    {bars.map((height, index) => (
                      <motion.span
                        key={index}
                        className={`h-2 w-[4%] rounded-full ${
                          stage === 'recording'
                            ? 'bg-emerald-500/70'
                            : stage === 'speaking'
                              ? 'bg-indigo-500/70'
                              : 'bg-slate-400/60'
                        }`}
                        animate={{ height }}
                        transition={{ duration: 0.08, ease: 'linear' }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex h-52 flex-col items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/70">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                {stage === 'speaking' ? <Volume2 className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
              </div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{stageLabel}</p>
              {stage === 'completed' && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  已完成
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/70">
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                {interactionMode === 'followUp' ? '追问转写' : '回答转写'}
              </p>
              <textarea
                value={answerText}
                onChange={(event) => {
                  manualEditedRef.current = true;
                  setAnswerText(event.target.value);
                }}
                className="h-32 w-full resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm leading-7 text-slate-700 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                placeholder={interactionMode === 'followUp'
                  ? '系统会自动收音并识别你的追问；你也可以手动补充。'
                  : '系统会自动录音，并在提交时优先识别你的语音；你也可以手动补充。'}
              />
            </div>

            {reviewReport && (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-400">本轮评估结果</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">综合得分：{reviewReport.overallScore}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {reviewReport.overallFeedback || '评估已生成。'}
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-2">
              {stage === 'waitingStart' && (
                <button
                  type="button"
                  onClick={() => void handleStartInterview()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  <Volume2 className="h-4 w-4" />
                  开始面试
                </button>
              )}

              {stage === 'ready' && (
                <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {interactionMode === 'followUp' ? '正在自动开启答疑收音...' : '正在自动开启收音...'}
                </div>
              )}

              {stage === 'recording' && (
                <button
                  type="button"
                  onClick={() => void handleSubmitAnswer()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 font-semibold text-white transition hover:bg-red-600"
                >
                  <Square className="h-4 w-4" />
                  {interactionMode === 'followUp' ? '追问完毕并提交' : '回答完毕并提交'}
                </button>
              )}

              {stage === 'ready' && error && (
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Mic className="h-4 w-4" />
                  重试收音
                </button>
              )}

              {stage === 'evaluating' && error && (
                <button
                  type="button"
                  onClick={() => void handleRetryReview()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Loader2 className="h-4 w-4" />
                  重试生成评估
                </button>
              )}

              {(stage === 'speaking'
                || stage === 'submitting'
                || stage === 'booting'
                || (stage === 'evaluating' && !error)) && (
                <button
                  type="button"
                  disabled
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-300 px-4 py-3 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {stage === 'speaking' ? '面试官语音中' : stage === 'evaluating' ? '评估处理中' : '处理中'}
                </button>
              )}

              {stage === 'completed' && (
                <button
                  type="button"
                  onClick={() => session && onInterviewComplete(session.sessionId)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  返回面试入口
                </button>
              )}

              {stage !== 'completed' && (
                <button
                  type="button"
                  onClick={() => setShowCompleteConfirm(true)}
                  disabled={stage === 'submitting' || stage === 'booting'}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {interactionMode === 'followUp' ? '结束答疑' : '结束面试'}
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      <ConfirmDialog
        open={showCompleteConfirm}
        title={interactionMode === 'followUp' ? '结束答疑会话' : '结束本轮面试'}
        message={interactionMode === 'followUp'
          ? '确定现在结束吗？系统会收尾并退出当前语音会话。'
          : '确定现在结束吗？系统会进入评估流程并生成本轮结果。'}
        confirmText="确定结束"
        cancelText="继续进行"
        confirmVariant="warning"
        loading={stage === 'submitting'}
        onConfirm={handleCompleteEarly}
        onCancel={() => setShowCompleteConfirm(false)}
      />
    </div>
  );
}
