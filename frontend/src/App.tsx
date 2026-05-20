import { Suspense, lazy, useEffect, useState, type ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getCurrentUser, subscribeAuthChange, type CurrentUser } from './utils/auth';

const CareerArticleDetailPage = lazy(() => import('./pages/CareerArticleDetailPage'));
const CareerArticlesPage = lazy(() => import('./pages/CareerArticlesPage'));
const Layout = lazy(() => import('./components/Layout'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const InterviewHistoryPage = lazy(() => import('./pages/InterviewHistoryPage'));
const InterviewPage = lazy(() => import('./pages/InterviewPage'));
const KnowledgeBaseManagePage = lazy(() => import('./pages/KnowledgeBaseManagePage'));
const KnowledgeBaseQueryPage = lazy(() => import('./pages/KnowledgeBaseQueryPage'));
const KnowledgeBaseUploadPage = lazy(() => import('./pages/KnowledgeBaseUploadPage'));
const MockInterviewPage = lazy(() => import('./pages/MockInterviewPage'));
const OralInterviewPage = lazy(() => import('./pages/OralInterviewPage'));
const ResumeDetailPage = lazy(() => import('./pages/ResumeDetailPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
      加载中...
    </div>
  );
}

function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => getCurrentUser());

  useEffect(() => {
    return subscribeAuthChange(() => {
      setCurrentUser(getCurrentUser());
    });
  }, []);

  return currentUser;
}

function RequireAuth({ children }: { children: ReactElement }) {
  const user = useCurrentUser();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function AdminGate({ children }: { children: ReactElement }) {
  const user = useCurrentUser();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (user.role !== 'ADMIN') {
    return <Navigate to="/upload" replace />;
  }

  return children;
}

function AuthGate() {
  const user = useCurrentUser();

  if (user) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/upload'} replace />;
  }

  return <AuthPage />;
}

function UploadRoute() {
  const navigate = useNavigate();

  return <UploadPage onUploadComplete={(resumeId) => navigate(`/history/${resumeId}`)} />;
}

function HistoryRoute() {
  const navigate = useNavigate();

  return <HistoryPage onSelectResume={(resumeId) => navigate(`/history/${resumeId}`)} />;
}

function ResumeDetailRoute() {
  const navigate = useNavigate();
  const params = useParams();
  const resumeId = Number(params.resumeId);

  if (!Number.isFinite(resumeId)) {
    return <Navigate to="/history" replace />;
  }

  const handleStartOralInterview = (nextResumeId: number) => {
    navigate('/mock-interview', {
      state: { resumeId: nextResumeId },
    });
  };

  const handleStartWrittenInterview = (resumeText: string, nextResumeId: number) => {
    navigate(`/history/${nextResumeId}/interview`, {
      state: { resumeText },
    });
  };

  return (
    <ResumeDetailPage
      resumeId={resumeId}
      onBack={() => navigate('/history')}
      onStartOralInterview={handleStartOralInterview}
      onStartWrittenInterview={handleStartWrittenInterview}
    />
  );
}

function InterviewRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const resumeId = Number(params.resumeId);
  const resumeText = (location.state as { resumeText?: string } | null)?.resumeText ?? '';

  if (!Number.isFinite(resumeId) || !resumeText) {
    return <Navigate to={Number.isFinite(resumeId) ? `/history/${resumeId}` : '/history'} replace />;
  }

  return (
    <InterviewPage
      resumeId={resumeId}
      resumeText={resumeText}
      onBack={() => navigate(`/history/${resumeId}`)}
      onInterviewComplete={(sessionId) =>
        navigate(`/history/${resumeId}`, {
          state: { viewInterview: sessionId },
        })}
    />
  );
}

function InterviewHistoryRoute() {
  const navigate = useNavigate();

  return (
    <InterviewHistoryPage
      onBack={() => navigate('/upload')}
      onViewInterview={(sessionId, resumeId) => {
        if (resumeId) {
          navigate(`/history/${resumeId}`, {
            state: { viewInterview: sessionId },
          });
          return;
        }

        navigate('/history');
      }}
      onViewTrend={(resumeId) => {
        navigate(`/history/${resumeId}`, {
          state: { openTab: 'interview' },
        });
      }}
      onStartMockInterview={() => navigate('/mock-interview')}
    />
  );
}

function OralInterviewRoute() {
  const navigate = useNavigate();
  const params = useParams();
  const sessionId = params.sessionId;

  if (!sessionId) {
    return <Navigate to="/mock-interview" replace />;
  }

  return (
    <OralInterviewPage
      sessionId={sessionId}
      onBack={() => navigate('/mock-interview')}
      onInterviewComplete={() => navigate('/mock-interview')}
    />
  );
}

function KnowledgeBaseManageRoute() {
  const navigate = useNavigate();

  return (
    <KnowledgeBaseManagePage
      onUpload={() => navigate('/knowledgebase/upload')}
      onChat={() => navigate('/knowledgebase/chat')}
    />
  );
}

function KnowledgeBaseUploadRoute() {
  const navigate = useNavigate();

  return (
    <KnowledgeBaseUploadPage
      onBack={() => navigate('/knowledgebase')}
      onUploadComplete={() => navigate('/knowledgebase')}
    />
  );
}

function KnowledgeBaseChatRoute() {
  const navigate = useNavigate();

  return (
    <KnowledgeBaseQueryPage
      onBack={() => navigate('/knowledgebase')}
      onUpload={() => navigate('/knowledgebase/upload')}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/auth" element={<AuthGate />} />

          <Route
            path="/admin"
            element={
              <AdminGate>
                <AdminLayout />
              </AdminGate>
            }
          >
            <Route index element={<AdminPage />} />
          </Route>

          <Route
            path="/"
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="/upload" replace />} />
            <Route path="upload" element={<UploadRoute />} />
            <Route path="history" element={<HistoryRoute />} />
            <Route path="history/:resumeId" element={<ResumeDetailRoute />} />
            <Route path="history/:resumeId/interview" element={<InterviewRoute />} />
            <Route path="mock-interview" element={<MockInterviewPage />} />
            <Route path="oral-interview/:sessionId" element={<OralInterviewRoute />} />
            <Route path="oral-assistant/:sessionId" element={<OralInterviewRoute />} />
            <Route path="interviews" element={<InterviewHistoryRoute />} />
            <Route path="career-articles" element={<CareerArticlesPage />} />
            <Route path="career-articles/:articleId/:slug" element={<CareerArticleDetailPage />} />
            <Route path="knowledgebase" element={<KnowledgeBaseManageRoute />} />
            <Route path="knowledgebase/upload" element={<KnowledgeBaseUploadRoute />} />
            <Route path="knowledgebase/chat" element={<KnowledgeBaseChatRoute />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
