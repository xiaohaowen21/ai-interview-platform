export interface InterviewSession {
  sessionId: string;
  resumeText: string;
  totalQuestions: number;
  currentQuestionIndex: number;
  questions: InterviewQuestion[];
  status: 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'EVALUATED';
  mode?: 'WRITTEN' | 'ORAL';
  interviewerStyle?: string | null;
}

export interface InterviewQuestion {
  questionIndex: number;
  question: string;
  type: QuestionType;
  category: string;
  userAnswer: string | null;
  score: number | null;
  feedback: string | null;
  isFollowUp?: boolean;
  parentQuestionIndex?: number | null;
  followUpCandidates?: string[];
}

export type QuestionType =
  | 'PROJECT'
  | 'ROLE_KNOWLEDGE'
  | 'PROFESSIONAL_BASICS'
  | 'SCENARIO_ANALYSIS'
  | 'PROBLEM_SOLVING'
  | 'COMMUNICATION'
  | 'JAVA_BASIC'
  | 'JAVA_COLLECTION'
  | 'JAVA_CONCURRENT'
  | 'MYSQL'
  | 'REDIS'
  | 'SPRING'
  | 'SPRING_BOOT';

export interface CreateInterviewRequest {
  resumeText: string;
  questionCount: number;
  resumeId?: number;
  forceCreate?: boolean;
  mode?: 'WRITTEN' | 'ORAL';
  interviewerStyle?: string;
}

export interface SubmitAnswerRequest {
  sessionId: string;
  questionIndex: number;
  answer: string;
}

export interface SubmitAnswerResponse {
  hasNextQuestion: boolean;
  nextQuestion: InterviewQuestion | null;
  currentIndex: number;
  totalQuestions: number;
}

export interface CurrentQuestionResponse {
  completed: boolean;
  question?: InterviewQuestion;
  message?: string;
}

export interface InterviewReport {
  sessionId: string;
  totalQuestions: number;
  overallScore: number;
  categoryScores: CategoryScore[];
  questionDetails: QuestionEvaluation[];
  overallFeedback: string;
  strengths: string[];
  improvements: string[];
  referenceAnswers: ReferenceAnswer[];
}

export interface CategoryScore {
  category: string;
  score: number;
  questionCount: number;
}

export interface QuestionEvaluation {
  questionIndex: number;
  question: string;
  category: string;
  userAnswer: string;
  score: number;
  feedback: string;
}

export interface ReferenceAnswer {
  questionIndex: number;
  question: string;
  referenceAnswer: string;
  keyPoints: string[];
}

export interface InterviewStreamMetaEvent {
  type: 'meta';
  hasNextQuestion: boolean;
  nextQuestion: InterviewQuestion | null;
  currentIndex: number;
  totalQuestions: number;
}

export interface InterviewStreamChunkEvent {
  type: 'chunk';
  content: string;
}

export interface InterviewStreamDoneEvent {
  type: 'done';
  message: string;
  hasNextQuestion: boolean;
  nextQuestion: InterviewQuestion | null;
  currentIndex: number;
  totalQuestions: number;
}

export interface InterviewStreamErrorEvent {
  type: 'error';
  message: string;
}

export type InterviewStreamEvent =
  | InterviewStreamMetaEvent
  | InterviewStreamChunkEvent
  | InterviewStreamDoneEvent
  | InterviewStreamErrorEvent;
