// ============================================================
//  ImprovementTracker.jsx — Candidate Improvement Tracker
//  Displays EXACTLY 3 sections in order:
//  1. Performance Trend (Line Graph)
//  2. Session Milestones (Cards)
//  3. Improvement Insights (Progress, Strongest Area, Focus Area)
// ============================================================
import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList
} from 'recharts';
import { TrendingUp, Award, Target, CheckCircle2, RefreshCw, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import ErrorBoundary from '../common/ErrorBoundary';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.8rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <p style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || p.fill, fontWeight: 700, margin: 0 }}>
            {p.name || 'Score'}: {p.value !== null && p.value !== undefined ? `${p.value}%` : 'N/A'}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ImprovementTracker() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchTrackerData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/candidate/performance-analytics', {
        method: 'GET'
      });

      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        const errTxt = await res.text();
        setError(`HTTP ${res.status}: ${errTxt || 'Failed to load improvement data'}`);
      }
    } catch (err) {
      console.error('[ImprovementTracker] Fetch error:', err);
      setError(err.message || 'Network error loading improvement tracker data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackerData();
  }, []);

  if (loading) {
    return (
      <div className="card text-center" style={{ padding: '60px 20px', maxWidth: '1100px', margin: '0 auto' }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--accent-primary)', margin: '0 auto 14px' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>Loading candidate improvement tracker...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ borderColor: 'var(--accent-rose, #ef4444)', padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent-rose, #ef4444)', marginBottom: 8 }}>
          <AlertTriangle size={22} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Unable to Load Improvement Tracker</h3>
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 16 }}>{error}</p>
        <button
          onClick={fetchTrackerData}
          style={{
            padding: '8px 16px', borderRadius: 'var(--radius-md, 6px)',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
            color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const completedCount = data?.completed_interviews_count || 0;
  const trends = data?.performance_trends || data?.performance_trend || [];
  const milestones = data?.milestones || [];
  const insights = data?.improvement_insights || {};

  const overallProgress = insights.overall_progress || {};
  const strongestArea   = insights.strongest_area || {};
  const focusArea       = insights.focus_area || {};

  return (
    <ErrorBoundary>
      <div className="animate-fade-in-up" style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
              Improvement Tracker
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4, margin: 0 }}>
              Track your chronological progress, session milestones, and actionable insights over time.
            </p>
          </div>
          <button
            id="btn-refresh-tracker"
            onClick={fetchTrackerData}
            style={{
              padding: '9px 18px', borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--bg-card)', border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)', transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={14} /> Refresh Data
          </button>
        </div>

        {/* ────────────────────────────────────────────────────────────
            SECTION 1: PERFORMANCE TREND (Line Graph)
        ──────────────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-lg, 12px)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <TrendingUp size={20} color="var(--accent-green, #10b981)" />
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              Performance Trend
            </h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Chronological progress across completed interviews
          </p>

          {trends.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends} margin={{ top: 24, right: 28, left: -16, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis
                    dataKey="session_label"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    ticks={[0, 25, 50, 75, 100]}
                    unit="%"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="overall_score"
                    stroke="var(--accent-green, #10b981)"
                    strokeWidth={3}
                    dot={{ r: 6, fill: 'var(--accent-green, #10b981)', stroke: 'var(--bg-card)', strokeWidth: 2 }}
                    activeDot={{ r: 8 }}
                    name="Overall Score"
                  >
                    <LabelList
                      dataKey="overall_score"
                      position="top"
                      fill="var(--accent-green, #10b981)"
                      fontSize={11}
                      fontWeight={700}
                      formatter={(v) => `${Math.round(v)}%`}
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
              {trends.length === 1 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 12, fontStyle: 'italic' }}>
                  Note: At least 2 completed interview sessions are required to display a progress trend line.
                </p>
              )}
            </>
          ) : (
            <div style={{
              height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)',
              color: 'var(--text-muted)', textAlign: 'center', padding: 20
            }}>
              <TrendingUp size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                Insufficient Data for Performance Trend
              </p>
              <p style={{ fontSize: '0.8rem', marginTop: 4, margin: 0 }}>
                Complete interview sessions to view chronological progress tracking.
              </p>
            </div>
          )}
        </div>

        {/* ────────────────────────────────────────────────────────────
            SECTION 2: SESSION MILESTONES
        ──────────────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-lg, 12px)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <CheckCircle2 size={20} color="var(--accent-primary, #6366f1)" />
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              Session Milestones
            </h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Key achievements across completed interview sessions
          </p>

          {milestones.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {milestones.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '16px 20px', borderRadius: 'var(--radius-md, 8px)',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                    display: 'flex', flexDirection: 'column', gap: 8, transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={16} color="var(--accent-green, #10b981)" />
                      {m.session_label}
                    </span>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 12,
                      background: 'hsla(142,70%,55%,0.12)', color: 'var(--accent-green, #10b981)',
                      border: '1px solid hsla(142,70%,55%,0.25)'
                    }}>
                      {m.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                    <div><strong style={{ color: 'var(--text-muted)' }}>Date:</strong> {m.date}</div>
                    <div><strong style={{ color: 'var(--text-muted)' }}>Role:</strong> {m.job_role} ({m.domain})</div>
                    <div><strong style={{ color: 'var(--text-muted)' }}>Score:</strong> <span style={{ fontWeight: 700, color: 'var(--accent-primary, #6366f1)' }}>{m.display_score}</span></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '36px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)',
              color: 'var(--text-muted)', textAlign: 'center'
            }}>
              <CheckCircle2 size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                No completed interview milestones available.
              </p>
              <p style={{ fontSize: '0.8rem', marginTop: 4, margin: 0 }}>
                Complete assigned interviews to create achievement milestones.
              </p>
            </div>
          )}
        </div>

        {/* ────────────────────────────────────────────────────────────
            SECTION 3: IMPROVEMENT INSIGHTS
        ──────────────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-lg, 12px)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Award size={20} color="var(--accent-amber, #f59e0b)" />
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              Improvement Insights
            </h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 24 }}>
            Progress and focus areas based on your completed interview performance
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {/* A. OVERALL PROGRESS */}
            <div style={{
              padding: '20px', borderRadius: 'var(--radius-md, 10px)', background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                <TrendingUp size={16} color="var(--accent-primary, #6366f1)" />
                <span>Overall Progress</span>
              </div>

              {overallProgress.status === 'positive' || overallProgress.status === 'negative' ? (
                <div>
                  <div style={{
                    fontSize: '1.8rem', fontWeight: 800,
                    color: overallProgress.status === 'positive' ? 'var(--accent-green, #10b981)' : 'var(--accent-rose, #ef4444)',
                    display: 'flex', alignItems: 'center', gap: 6, margin: '4px 0'
                  }}>
                    {overallProgress.status === 'positive' ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                    {overallProgress.display_change}
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                    {overallProgress.detail}
                  </p>
                </div>
              ) : overallProgress.status === 'single_session' ? (
                <div style={{ marginTop: 6 }}>
                  <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                    {overallProgress.display_change}
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
                    {overallProgress.detail}
                  </p>
                </div>
              ) : (
                <div style={{ marginTop: 6 }}>
                  <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>
                    Insufficient Data
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
                    Complete interview sessions to measure performance progress.
                  </p>
                </div>
              )}
            </div>

            {/* B. STRONGEST AREA */}
            <div style={{
              padding: '20px', borderRadius: 'var(--radius-md, 10px)', background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                <Award size={16} color="var(--accent-green, #10b981)" />
                <span>Strongest Area</span>
              </div>

              {strongestArea.status === 'available' ? (
                <div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 6, marginBottom: 2 }}>
                    {strongestArea.skill}
                  </div>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-green, #10b981)' }}>
                    Average Score: {strongestArea.display_score}
                  </span>
                </div>
              ) : (
                <div style={{ marginTop: 6 }}>
                  <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>
                    Insufficient Data
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
                    Skill evaluations required to determine strongest area.
                  </p>
                </div>
              )}
            </div>

            {/* C. FOCUS AREA */}
            <div style={{
              padding: '20px', borderRadius: 'var(--radius-md, 10px)', background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                <Target size={16} color="var(--accent-amber, #f59e0b)" />
                <span>Focus Area</span>
              </div>

              {focusArea.status === 'available' ? (
                <div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 6, marginBottom: 2 }}>
                    {focusArea.skill}
                  </div>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--accent-amber, #f59e0b)' }}>
                    Average Score: {focusArea.display_score}
                  </span>
                </div>
              ) : (
                <div style={{ marginTop: 6 }}>
                  <p style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>
                    Insufficient Data
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
                    Skill evaluations required to determine focus area.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
