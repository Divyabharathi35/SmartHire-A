import { useState, useEffect } from 'react';
import { Users, BarChart2, Briefcase, Video, ArrowUp, ArrowDown, CheckCircle, Clock } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const skillData = [
  { name: 'Python', count: 32 }, { name: 'React', count: 28 }, { name: 'SQL', count: 24 },
  { name: 'Node.js', count: 20 }, { name: 'AWS', count: 18 }, { name: 'System Design', count: 15 },
];
const FILL_COLORS = ['hsl(252,100%,68%)', 'hsl(280,90%,65%)', 'hsl(174,80%,55%)', 'hsl(38,95%,60%)', 'hsl(142,70%,55%)', 'hsl(350,90%,65%)'];

function formatSecs(secs) {
  const m = Math.floor((secs || 0) / 60);
  const s = (secs || 0) % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

import ErrorBoundary from '../common/ErrorBoundary';

export default function CandidateOverview() {
  const [analytics, setAnalytics] = useState(null);
  const [topCandidates, setTopCandidates] = useState([]);

  const loadBackendData = async () => {
    try {
      const [resAnalytics, resInterviews] = await Promise.all([
        fetch(`${API_BASE}/api/recruiter/analytics`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/recruiter/interviews?sort_by=score&sort_order=desc`, { credentials: 'include' })
      ]);

      if (resAnalytics.ok) {
        const data = await resAnalytics.json();
        setAnalytics(data);
      }
      if (resInterviews.ok) {
        const data = await resInterviews.json();
        setTopCandidates(data.slice(0, 5));
      }
    } catch (err) {
      console.error('[CandidateOverview] Failed to fetch analytics:', err);
    }
  };

  useEffect(() => {
    loadBackendData();
    const interval = setInterval(loadBackendData, 15000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { label: 'Total Interviews', value: analytics ? analytics.total_interviews : '—', icon: Users, color: 'var(--accent-primary)', bg: 'hsla(252,100%,68%,0.12)' },
    { label: 'Completed Interviews', value: analytics ? analytics.completed_interviews : '—', icon: CheckCircle, color: 'var(--accent-teal)', bg: 'hsla(174,80%,55%,0.12)' },
    { label: 'Average Score', value: analytics ? `${analytics.average_score}%` : '—', icon: BarChart2, color: 'var(--accent-amber)', bg: 'hsla(38,95%,60%,0.12)' },
    { label: 'Average Duration', value: analytics ? formatSecs(analytics.average_duration) : '—', icon: Clock, color: 'var(--accent-secondary)', bg: 'hsla(280,90%,65%,0.12)' },
  ];

  return (
    <ErrorBoundary>
      <div className="animate-fade-in-up">
        <div className="page-header">
          <h1>Candidate Overview</h1>
          <p>Real-time analytics across all candidate interviews and assessment sessions</p>
        </div>

        {/* Stat Cards */}
        <div className="grid-4" style={{ marginBottom: 'var(--space-8)' }}>
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className={`stat-card animate-fade-in-up delay-${i + 1}`}>
                <div className="flex items-center justify-between">
                  <div className="stat-icon" style={{ background: stat.bg }}>
                    <Icon size={20} color={stat.color} />
                  </div>
                </div>
                <div className="stat-value" style={{ marginTop: 12 }}>{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid-2" style={{ marginBottom: 'var(--space-8)' }}>
          {/* Top Skills Chart */}
          <div className="card">
            <h3 className="section-title">Assessed Competencies</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={skillData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip cursor={{ fill: 'hsla(252,100%,68%,0.05)' }} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Assessments">
                  {skillData.map((_, i) => <Cell key={i} fill={FILL_COLORS[i % FILL_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Score Distribution */}
          <div className="card">
            <h3 className="section-title">Interview Status Breakdown</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {[
                { label: 'Completed', count: analytics?.completed_interviews || 0, color: 'var(--accent-green)' },
                { label: 'In Progress', count: analytics?.in_progress_interviews || 0, color: 'var(--accent-primary)' },
                { label: 'Pending / Created', count: analytics?.pending_interviews || 0, color: 'var(--accent-amber)' },
              ].map(r => (
                <div key={r.label}>
                  <div className="flex justify-between" style={{ fontSize: '0.82rem', marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{r.label}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{r.count} sessions</span>
                  </div>
                  <div className="progress-bar" style={{ height: 8 }}>
                    <div className="progress-fill" style={{
                      width: `${analytics?.total_interviews ? (r.count / analytics.total_interviews) * 100 : 0}%`,
                      background: r.color
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Candidates Quick View */}
        <div className="card">
          <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
            <h3>Top Performing Candidates</h3>
            <span className="badge badge-primary">{topCandidates.length} Active Records</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {topCandidates.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No candidate sessions recorded yet.</p>
            ) : (
              topCandidates.map((c, i) => (
                <div key={c.id} className="flex items-center gap-4" style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-elevated)',
                  transition: 'background 0.2s',
                }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', width: 20 }}>#{i + 1}</span>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, color: 'white', fontSize: '0.8rem', flexShrink: 0
                  }}>
                    {c.candidate_name ? c.candidate_name.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 2 }}>{c.candidate_name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.job_role} &bull; {c.interview_type}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>{c.recommendation || 'Under Review'}</span>
                    <div style={{ fontSize: '1.2rem', fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--accent-green)', minWidth: 50, textAlign: 'right' }}>
                      {c.overall_score !== undefined && c.overall_score !== null ? `${c.overall_score.toFixed(1)}%` : '—'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
