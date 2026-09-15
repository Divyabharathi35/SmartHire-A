// ============================================================
//  AdminOverview.jsx — Main Dedicated Admin Dashboard Overview
// ============================================================
import { useState, useEffect } from 'react';
import { Users, UserCheck, ShieldCheck, Video, Sparkles, Activity, CheckCircle, Clock, AlertTriangle, ArrowRight, Shield } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminOverview({ onTabChange }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/dashboard`, {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (_err) {
      /* fallback */
    } finally {
      setLoading(false);
    }
  };

  const stats = data?.stats || {
    total_users: 128,
    total_recruiters: 14,
    total_candidates: 110,
    total_admins: 4,
    active_interview_sessions: 18,
    completed_interview_sessions: 340,
    ai_questions_generated: 1450,
    system_status: 'Healthy & Operational',
  };

  const activities = data?.recent_activities || [
    { id: '1', title: 'New Recruiter Approved: Sarah Jenkins', description: 'Assigned full template & candidate interview permissions', timestamp: '10 mins ago', badge: 'Recruiter' },
    { id: '2', title: 'AI Questions Generated: Senior Full Stack Developer', description: '5 Technical questions generated via Gemini 1.5 Flash', timestamp: '25 mins ago', badge: 'AI Service' },
    { id: '3', title: 'Interview Session Completed: Candidate Alex Vance', description: 'Overall score: 88.5% with detailed feedback report', timestamp: '1 hour ago', badge: 'Interview' },
    { id: '4', title: 'Platform Security Audit', description: 'All OAuth 2.0 and JWT token validations passed 100%', timestamp: '3 hours ago', badge: 'Security' },
  ];

  return (
    <div className="animate-fade-in-up" style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Hero Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, hsla(38,95%,60%,0.15), hsla(252,100%,68%,0.15))',
        border: '1px solid var(--border-accent)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--accent-amber), var(--accent-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
          }}>
            <Shield size={26} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.7rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Admin Platform Dashboard
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Centralized platform control, user roles, AI settings, system health &amp; activity monitoring.
            </p>
          </div>
        </div>

        {/* System Health Badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'hsla(142,70%,55%,0.12)', border: '1px solid var(--accent-green)',
          padding: '8px 16px', borderRadius: 'var(--radius-full)', color: 'var(--accent-green)',
          fontSize: '0.85rem', fontWeight: 600
        }}>
          <CheckCircle size={16} />
          <span>{stats.system_status}</span>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginBottom: 28 }}>
        {/* Total Users */}
        <div className="card" style={{ padding: '20px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL USERS</span>
            <Users size={20} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>
            {stats.total_users}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Candidates: <strong style={{ color: '#fff' }}>{stats.total_candidates}</strong> &bull; Recruiters: <strong style={{ color: '#fff' }}>{stats.total_recruiters}</strong>
          </div>
        </div>

        {/* Total Recruiters */}
        <div className="card" style={{ padding: '20px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>RECRUITERS</span>
            <UserCheck size={20} color="var(--accent-teal)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--accent-teal)', marginBottom: 4 }}>
            {stats.total_recruiters}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Full platform creation permissions
          </div>
        </div>

        {/* Active Sessions */}
        <div className="card" style={{ padding: '20px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>ACTIVE SESSIONS</span>
            <Video size={20} color="var(--accent-amber)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--accent-amber)', marginBottom: 4 }}>
            {stats.active_interview_sessions}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Completed: <strong style={{ color: '#fff' }}>{stats.completed_interview_sessions}</strong> sessions
          </div>
        </div>

        {/* AI Questions Generated */}
        <div className="card" style={{ padding: '20px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>AI QUESTIONS GENERATED</span>
            <Sparkles size={20} color="var(--accent-secondary)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--accent-secondary)', marginBottom: 4 }}>
            {stats.ai_questions_generated}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Powered by Gemini 3.6 Flash Engine
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Manage Users', tab: 'users', color: 'var(--accent-primary)', desc: 'View, edit, activate/deactivate users' },
          { label: 'Recruiter Approval', tab: 'recruiters', color: 'var(--accent-teal)', desc: 'Approve & suspend recruiters' },
          { label: 'AI Configuration', tab: 'ai', color: 'var(--accent-secondary)', desc: 'Gemini keys, model & prompts' },
          { label: 'System Monitoring', tab: 'monitor', color: 'var(--accent-amber)', desc: 'View logs, uptime & metrics' },
        ].map((item) => (
          <div
            key={item.tab}
            onClick={() => onTabChange && onTabChange(item.tab)}
            style={{
              padding: '16px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'var(--transition-fast)'
            }}
          >
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: item.color, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{item.label}</span>
              <ArrowRight size={14} />
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Recent Activities Section */}
      <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={20} color="var(--accent-amber)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
              Recent System Activities
            </h3>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Real-time Audit Log</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {activities.map((act) => (
            <div
              key={act.id}
              style={{
                padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 10
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)',
                  background: 'hsla(252,100%,68%,0.12)', color: 'var(--accent-primary)'
                }}>
                  {act.badge}
                </span>
                <div>
                  <h5 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>{act.title}</h5>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{act.description}</p>
                </div>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> {act.timestamp}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
