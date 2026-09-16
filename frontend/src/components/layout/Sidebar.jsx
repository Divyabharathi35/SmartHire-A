import {
  Sparkles, FileText, Video, BarChart2, Clock, TrendingUp,
  Users, FileSearch, GitCompare, Layout, MonitorPlay, Trophy,
  UserCog, Settings, Activity, Bot, Globe, LayoutDashboard, UserCheck
} from 'lucide-react';

const navConfig = {
  candidate: [
    { id: 'interview', label: 'Interview Room',       icon: Video,   badge: 'Live' },
    { id: 'mock',      label: 'Mock Interview',       icon: Sparkles, badge: 'Practice' },
    { id: 'history',   label: 'Interview History',    icon: Clock },
    { id: 'resume',    label: 'Resume Upload',       icon: FileText },
    { id: 'analytics', label: 'Performance Analytics',icon: BarChart2 },
    { id: 'tracker',   label: 'Improvement Tracker',  icon: TrendingUp },
  ],

  recruiter: [
    { id: 'generator',  label: 'AI Interview Generator', icon: Sparkles, badge: 'AI' },
    { id: 'overview',   label: 'Candidate Overview',  icon: Users },
    { id: 'ranking',    label: 'Candidate Ranking',   icon: Trophy },
    { id: 'reports',    label: 'Candidate Reports',   icon: FileSearch },
    { id: 'comparison', label: 'Comparison Dashboard',icon: GitCompare },
    { id: 'builder',    label: 'Template Builder',    icon: Layout },
    { id: 'analytics',  label: 'Performance & Analytics', icon: BarChart2 },
    { id: 'sessions',   label: 'Active Sessions',     icon: MonitorPlay },
  ],
  admin: [
    { id: 'overview',   label: 'Dashboard',           icon: LayoutDashboard },
    { id: 'users',      label: 'User Management',     icon: UserCog },
    { id: 'recruiters', label: 'Recruiter Management',icon: UserCheck },
    { id: 'config',     label: 'Platform Settings',   icon: Settings },
    { id: 'ai',         label: 'AI Configuration',    icon: Bot },
    { id: 'monitor',    label: 'System Monitoring',   icon: Activity },
    { id: 'stats',      label: 'Analytics',           icon: Globe },
  ],
};



const sectionLabels = {
  candidate: 'CANDIDATE TOOLS',
  recruiter:  'RECRUITER TOOLS',
  admin:      'ADMIN PANEL',
};

export default function Sidebar({ role, activeTab, onTabChange }) {
  const effectiveRole = (role || '').toLowerCase().trim();
  const items = navConfig[effectiveRole] || [];

  return (
    <aside className="sidebar">
      <p className="sidebar-section-label">{sectionLabels[effectiveRole]}</p>


      {items.map(item => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
            id={`sidebar-${item.id}`}
          >
            <Icon size={18} className="item-icon" />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge && (
              <span className="sidebar-badge">{item.badge}</span>
            )}
          </div>
        );
      })}

      {/* Bottom decoration */}
      <div style={{ marginTop: 'auto', padding: '24px 20px 8px' }}>
        <div style={{
          background: 'linear-gradient(135deg, hsla(252,100%,68%,0.08), hsla(280,90%,65%,0.08))',
          border: '1px solid hsla(252,100%,68%,0.15)',
          borderRadius: 'var(--radius-md)',
          padding: '14px',
        }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-primary)', marginBottom: 4 }}>
            AI-Powered Platform
          </p>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Powered by Gemini 3.6 Flash &amp; advanced ML models
          </p>
        </div>
      </div>
    </aside>
  );
}
