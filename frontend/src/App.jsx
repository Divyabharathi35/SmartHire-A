// ============================================================
//  App.jsx — SmartHire Root Component with Auth Integration
// ============================================================
import { useState } from 'react';
import './styles/app.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Header    from './components/layout/Header';
import Sidebar   from './components/layout/Sidebar';
import ErrorBoundary from './components/common/ErrorBoundary';

// Candidate
import InterviewGenerator from './components/candidate/InterviewGenerator';
import ResumeUpload       from './components/candidate/ResumeUpload';
import InterviewRoom      from './components/candidate/InterviewRoom';
import MockInterview      from './components/candidate/MockInterview';
import Analytics          from './components/candidate/Analytics';
import InterviewHistory   from './components/candidate/InterviewHistory';
import ImprovementTracker from './components/candidate/ImprovementTracker';

// Recruiter
import CandidateOverview   from './components/recruiter/CandidateOverview';
import CandidateRanking    from './components/recruiter/CandidateRanking';
import CandidateReports    from './components/recruiter/CandidateReports';
import ComparisonDashboard from './components/recruiter/ComparisonDashboard';
import TemplateBuilder     from './components/recruiter/TemplateBuilder';
import RecruiterAnalytics  from './components/recruiter/RecruiterAnalytics';
import ActiveSessions      from './components/recruiter/ActiveSessions';

// Admin
import AdminOverview       from './components/admin/AdminOverview';
import UserManagement      from './components/admin/UserManagement';
import RecruiterManagement from './components/admin/RecruiterManagement';
import PlatformConfig      from './components/admin/PlatformConfig';
import SystemMonitor       from './components/admin/SystemMonitor';
import AIConfig            from './components/admin/AIConfig';
import GlobalStats         from './components/admin/GlobalStats';

// ── View registries ──────────────────────────────────────────
const defaultTabs = { candidate: 'interview', recruiter: 'generator', admin: 'overview' };

const candidateViews = {
  interview: InterviewRoom,
  mock:      MockInterview,
  history:   InterviewHistory,
  resume:    ResumeUpload,
  analytics: Analytics,
  tracker:   ImprovementTracker,
};

const recruiterViews = {
  generator:  InterviewGenerator,
  overview:   CandidateOverview,
  ranking:    CandidateRanking,
  reports:    CandidateReports,
  comparison: ComparisonDashboard,
  builder:    TemplateBuilder,
  analytics:  RecruiterAnalytics,
  sessions:   ActiveSessions,
};

const adminViews = {
  overview:   AdminOverview,
  users:      UserManagement,
  recruiters: RecruiterManagement,
  config:     PlatformConfig,
  ai:         AIConfig,
  monitor:    SystemMonitor,
  stats:      GlobalStats,
};

const viewsByRole = { candidate: candidateViews, recruiter: recruiterViews, admin: adminViews };


// ── Loading screen ───────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="auth-loading-screen">
      <div className="auth-loading-spinner" />
      <p className="auth-loading-text">Loading SmartHire…</p>
    </div>
  );
}

// ── Forbidden screen ─────────────────────────────────────────
function ForbiddenScreen({ role }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'hsl(222,47%,5%)', gap: 16,
    }}>
      <div style={{ fontSize: 48 }}>🚫</div>
      <h2 style={{ fontFamily: 'Outfit,sans-serif', color: 'hsl(220,20%,85%)', fontSize: 22 }}>
        Access Denied
      </h2>
      <p style={{ color: 'hsl(220,15%,55%)', fontSize: 14 }}>
        Your role ({role}) does not have permission to access this area.
      </p>
    </div>
  );
}

// ── Dashboard shell (requires auth) ─────────────────────────
function Dashboard() {
  const { role, user, isLoading } = useAuth();
  const [tabs, setTabs] = useState(defaultTabs);

  if (isLoading) return <LoadingScreen />;

  const activeRole = role ? String(role).toLowerCase().trim() : null;

  console.log('[App Router Debug] Current User Email:', user?.email);
  console.log('[App Router Debug] Auth Context Raw Role:', role);
  console.log('[App Router Debug] Normalized Active Role:', activeRole);

  if (!activeRole || !viewsByRole[activeRole]) {
    console.error('[App Router Debug] Unauthorized or invalid role detected:', activeRole);
    return <ForbiddenScreen role={role || 'unknown'} />;
  }

  const views = viewsByRole[activeRole];
  const requestedTab = tabs[activeRole];
  const activeTab = (views && views[requestedTab]) ? requestedTab : defaultTabs[activeRole];
  const ActiveView = views[activeTab] || views[defaultTabs[activeRole]];

  console.log('[App Router Debug] Redirected Route Target -> Role:', activeRole, '| Active Tab:', activeTab, '| Rendering Component:', ActiveView?.name);

  const handleTabChange = (tab) => {
    if (views && views[tab]) {
      console.log('[App Router Debug] Switching tab for role', activeRole, 'to:', tab);
      setTabs(t => ({ ...t, [activeRole]: tab }));
    } else {
      console.warn('[App Router Debug] Blocked unauthorized tab request for role', activeRole, '-> tab:', tab);
    }
  };

  return (
    <div className="app-shell">
      <Header activeRole={activeRole} activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="app-body">
        <Sidebar role={activeRole} activeTab={activeTab} onTabChange={handleTabChange} />
        <main className="main-content" id="main-content">
          <ErrorBoundary key={`${activeRole}-${activeTab}`}>
            <ActiveView key={`${activeRole}-${activeTab}`} onTabChange={handleTabChange} />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}


// ── Inner app (inside AuthProvider) ─────────────────────────
function InnerApp() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <LoginPage onSuccess={() => {}} />;
  return <Dashboard />;
}

// ── Root export ──────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <InnerApp />
    </AuthProvider>
  );
}
