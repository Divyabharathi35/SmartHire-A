// ============================================================
//  Analytics.jsx — Candidate Performance Analytics Dashboard
//  Exclusively renders:
//  1. Skill Analysis (Vertical Bar Graph)
//  2. Predicted Weak Areas (Horizontal Bar Graph)
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../api/apiClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';
import { AlertTriangle, CheckCircle, RefreshCw, BarChart2 } from 'lucide-react';
import ErrorBoundary from '../common/ErrorBoundary';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.8rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <p style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>{label}</p>
        {payload.map((p, i) => {
          const rawVal = p?.value;
          const numVal = rawVal !== null && rawVal !== undefined && !isNaN(Number(rawVal)) ? Number(rawVal) : null;
          return (
            <p key={i} style={{ color: p?.color || p?.fill || 'var(--text-primary)', fontWeight: 700, margin: 0 }}>
              {p?.name || 'Score'}: {numVal !== null ? `${numVal.toFixed(1)}%` : 'N/A'}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/candidate/performance-analytics', {
        method: 'GET'
      });
      if (res.ok) {
        const json = await res.json();
        setData(json || null);
      } else {
        const errTxt = await res.text().catch(() => '');
        setError(`HTTP ${res.status}: ${errTxt || 'Failed to load analytics'}`);
      }
    } catch (err) {
      console.error('[Analytics] Fetch error:', err);
      setError(err?.message || 'Network error loading analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="card text-center" style={{ padding: '60px 20px', maxWidth: '1100px', margin: '0 auto' }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--accent-primary)', margin: '0 auto 14px' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>Loading candidate performance analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ borderColor: 'var(--accent-rose, #ef4444)', padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent-rose, #ef4444)', marginBottom: 8 }}>
          <AlertTriangle size={22} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Unable to Load Analytics</h3>
        </div>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 16 }}>{error}</p>
        <button
          onClick={fetchAnalytics}
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

  const completedCount = typeof data?.completed_interviews_count === 'number'
    ? data.completed_interviews_count
    : (Array.isArray(data?.completed_interviews) ? data.completed_interviews.length : 0);

  const rawSkillAnalytics = Array.isArray(data?.skill_analytics)
    ? data.skill_analytics
    : (Array.isArray(data?.skill_analysis) ? data.skill_analysis : []);

  const skillAnalytics = rawSkillAnalytics
    .map(item => {
      const name = String(item?.skill || item?.category || item?.name || 'Skill');
      const scoreVal = typeof item?.score === 'number'
        ? item.score
        : (typeof item?.average_score === 'number' ? item.average_score : (parseFloat(item?.score) || 0));
      return { skill: name, score: isNaN(scoreVal) ? 0 : scoreVal };
    })
    .filter(item => typeof item.score === 'number' && !isNaN(item.score));

  const rawWeakAreas = Array.isArray(data?.predicted_weak_areas)
    ? data.predicted_weak_areas
    : (Array.isArray(data?.weak_areas) ? data.weak_areas : []);

  const weakAreas = rawWeakAreas
    .map(item => {
      const name = String(item?.skill || item?.category || item?.name || 'Skill');
      const scoreVal = typeof item?.average_score === 'number'
        ? item.average_score
        : (typeof item?.score === 'number' ? item.score : (parseFloat(item?.average_score || item?.score) || 0));
      return { skill: name, average_score: isNaN(scoreVal) ? 0 : scoreVal };
    })
    .filter(item => typeof item.average_score === 'number' && !isNaN(item.average_score));

  return (
    <ErrorBoundary>
      <div className="animate-fade-in-up" style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
              Candidate Performance Analytics
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4, margin: 0 }}>
              Real-time analytics grounded strictly in your completed interview sessions.
            </p>
          </div>
          <button
            id="btn-refresh-analytics"
            onClick={fetchAnalytics}
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
            SECTION 1: SKILL ANALYSIS (Vertical Bar Graph)
        ──────────────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-lg, 12px)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <BarChart2 size={18} color="var(--accent-primary, #6366f1)" />
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Skill Analysis
            </h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Performance across evaluated question skills &amp; domains
          </p>

          {skillAnalytics.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={skillAnalytics} margin={{ top: 24, right: 24, left: -16, bottom: 24 }} barSize={42}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="skill"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  ticks={[0, 25, 50, 75, 100]}
                  unit="%"
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsla(252,100%,68%,0.06)' }} />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} name="Skill Score">
                  <LabelList
                    dataKey="score"
                    position="top"
                    fill="var(--text-primary)"
                    fontSize={11}
                    fontWeight={700}
                    formatter={(v) => `${Math.round(Number(v) || 0)}%`}
                  />
                  {skillAnalytics.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.score < 70 ? 'var(--accent-amber, #f59e0b)' : 'var(--accent-primary, #6366f1)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{
              height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)',
              color: 'var(--text-muted)', textAlign: 'center', padding: 20
            }}>
              <BarChart2 size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                Insufficient Data for Skill Analysis
              </p>
              <p style={{ fontSize: '0.78rem', marginTop: 4, margin: 0 }}>
                Complete interview sessions to generate skill performance graphs.
              </p>
            </div>
          )}
        </div>

        {/* ────────────────────────────────────────────────────────────
            SECTION 2: PREDICTED WEAK AREAS (Horizontal Bar Graph)
        ──────────────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-lg, 12px)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <AlertTriangle size={18} color="var(--accent-amber, #f59e0b)" />
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Predicted Weak Areas
            </h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Identified from repeated low performance (&lt;70% average score) across actual questions
          </p>

          {completedCount === 0 || skillAnalytics.length === 0 ? (
            <div style={{
              padding: '36px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)',
              color: 'var(--text-muted)', textAlign: 'center'
            }}>
              <AlertTriangle size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                Insufficient Data for Weak Area Analysis
              </p>
              <p style={{ fontSize: '0.78rem', marginTop: 4, margin: 0 }}>
                Complete interview sessions to analyze question evaluations and detect improvement areas.
              </p>
            </div>
          ) : weakAreas.length === 0 ? (
            <div style={{
              background: 'hsla(142,70%,55%,0.08)', border: '1px solid var(--accent-green, #10b981)',
              borderRadius: 'var(--radius-md, 8px)', padding: '24px', textAlign: 'center'
            }}>
              <CheckCircle size={28} color="var(--accent-green, #10b981)" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                No Critical Weak Areas Detected
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, margin: 0 }}>
                All evaluated skills and question categories meet or exceed the 70% benchmark threshold.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, weakAreas.length * 54)}>
              <BarChart
                data={weakAreas}
                layout="vertical"
                margin={{ top: 12, right: 48, left: 24, bottom: 12 }}
                barSize={24}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  ticks={[0, 25, 50, 75, 100]}
                  unit="%"
                />
                <YAxis
                  type="category"
                  dataKey="skill"
                  tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  width={140}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsla(38,95%,60%,0.06)' }} />
                <Bar dataKey="average_score" radius={[0, 4, 4, 0]} fill="var(--accent-amber, #f59e0b)" name="Avg Score">
                  <LabelList
                    dataKey="average_score"
                    position="right"
                    fill="var(--accent-amber, #f59e0b)"
                    fontSize={11}
                    fontWeight={700}
                    formatter={(v) => `${Math.round(Number(v) || 0)}%`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
