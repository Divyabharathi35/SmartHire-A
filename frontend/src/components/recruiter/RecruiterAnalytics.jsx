// ============================================================
//  RecruiterAnalytics.jsx — Recruiter Performance & Analytics View
//  Exact Requested Layout:
//  1. Performance Trends (Full Width)
//  2. Skill-wise Analytics (Full Width)
//  3. Shortlisting Insights (Full Width)
//  4. Shortlisted Candidates List (Full Width)
// ============================================================
import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/apiClient';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList
} from 'recharts';
import { BarChart2, TrendingUp, Award, Sparkles, RefreshCw, AlertTriangle, UserCheck, ShieldCheck, ArrowRight } from 'lucide-react';
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
        <p style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>{label || payload[0].name}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || p.fill, fontWeight: 700, margin: 0 }}>
            {p.name || 'Value'}: {p.value !== null && p.value !== undefined ? (typeof p.value === 'number' && p.name?.toLowerCase().includes('score') ? `${p.value}%` : p.value) : 'N/A'}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function RecruiterAnalytics({ onTabChange }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/recruiter/analytics');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        const errTxt = await res.text();
        setError(`HTTP ${res.status}: ${errTxt || 'Failed to fetch recruiter analytics'}`);
      }
    } catch (err) {
      console.error('[RecruiterAnalytics] Fetch error:', err);
      setError(err.message || 'Network error loading recruiter analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="card text-center" style={{ padding: '60px 20px', maxWidth: '1100px', margin: '0 auto' }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--accent-primary)', margin: '0 auto 14px' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading recruiter performance analytics...</p>
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
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{error}</p>
        <button
          onClick={fetchAnalytics}
          style={{
            marginTop: 12, padding: '8px 16px', borderRadius: 'var(--radius-md, 6px)',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
            color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const trends              = data?.performance_trends || [];
  const skillAnalytics      = data?.skill_analytics || [];
  const shortlisting        = data?.shortlisting_insights || {};
  const shortlistedList     = data?.shortlisted_candidates || [];

  const totalEvaluated      = shortlisting.total_evaluated || 0;
  const recCount            = shortlisting.recommended || 0;
  const recPct              = shortlisting.recommended_pct || 0;
  const revCount            = shortlisting.review_required || 0;
  const revPct              = shortlisting.review_required_pct || 0;
  const notCount            = shortlisting.not_recommended || 0;
  const notPct              = shortlisting.not_recommended_pct || 0;
  const shortlistingRate    = shortlisting.shortlisting_rate || `${recPct}%`;
  const avgShortlistedScore = shortlisting.avg_shortlisted_score;
  const topScore            = shortlisting.top_score;

  const donutData = totalEvaluated > 0 ? [
    { name: 'Recommended / Shortlisted', value: recCount, pct: recPct, color: 'var(--accent-green, #10b981)' },
    { name: 'Review Required',           value: revCount, pct: revPct, color: 'var(--accent-amber, #f59e0b)' },
    { name: 'Not Recommended',           value: notCount, pct: notPct, color: 'var(--accent-rose, #ef4444)' },
  ] : [];

  return (
    <ErrorBoundary>
      <div className="animate-fade-in-up" style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <BarChart2 size={24} color="var(--accent-primary, #6366f1)" /> Performance &amp; Analytics
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4, margin: 0 }}>
              Real-time candidate evaluation metrics, performance trends, skill analytics, and AI shortlisting insights.
            </p>
          </div>
          <button
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
            SECTION 1 — PERFORMANCE TRENDS (Full-Width Horizontal Card)
        ──────────────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-lg, 12px)', background: 'var(--bg-card)', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <TrendingUp size={20} color="var(--accent-green, #10b981)" />
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              Performance Trends
            </h2>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Chronological score progression across completed candidate interview sessions in PostgreSQL
          </p>

          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trends} margin={{ top: 20, right: 30, left: -10, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} ticks={[0, 25, 50, 75, 100]} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="overall_score" stroke="var(--accent-green, #10b981)" strokeWidth={3} dot={{ r: 6, fill: 'var(--accent-green, #10b981)' }} activeDot={{ r: 8 }} name="Overall Score">
                  <LabelList dataKey="overall_score" position="top" fill="var(--accent-green, #10b981)" fontSize={11} fontWeight={700} formatter={(v) => `${Math.round(v)}%`} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', textAlign: 'center' }}>
              <TrendingUp size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Insufficient Data</p>
              <p style={{ fontSize: '0.8rem', marginTop: 4, margin: 0 }}>No completed interview sessions available for trend analysis.</p>
            </div>
          )}
        </div>

        {/* ────────────────────────────────────────────────────────────
            SECTION 2 — SKILL-WISE ANALYTICS (Full-Width Horizontal Card)
        ──────────────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-lg, 12px)', background: 'var(--bg-card)', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Award size={20} color="var(--accent-primary, #6366f1)" />
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              Skill-wise Analytics
            </h2>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Average candidate performance across evaluated skills (Technical Relevance, Communication, Confidence, Professionalism)
          </p>

          {skillAnalytics.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={skillAnalytics} margin={{ top: 20, right: 30, left: -10, bottom: 20 }} barSize={42}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="skill" tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} ticks={[0, 25, 50, 75, 100]} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} name="Skill Score">
                  <LabelList dataKey="score" position="top" fill="var(--text-primary)" fontSize={12} fontWeight={700} formatter={(v) => `${Math.round(v)}%`} />
                  {skillAnalytics.map((entry, i) => (
                    <Cell key={i} fill={entry.score < 70 ? 'var(--accent-amber, #f59e0b)' : 'var(--accent-primary, #6366f1)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', textAlign: 'center' }}>
              <Award size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Insufficient Data</p>
              <p style={{ fontSize: '0.8rem', marginTop: 4, margin: 0 }}>No skill evaluation scores recorded in database.</p>
            </div>
          )}
        </div>

        {/* ────────────────────────────────────────────────────────────
            SECTION 3 — SHORTLISTING INSIGHTS (Full-Width Horizontal Card)
        ──────────────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-lg, 12px)', background: 'var(--bg-card)', border: '1px solid var(--border-medium)', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={20} color="var(--accent-amber, #f59e0b)" />
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                Shortlisting Insights
              </h2>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 24 }}>
            AI-powered candidate recommendations based on completed interview performance.
          </p>

          {totalEvaluated === 0 ? (
            <div style={{
              padding: '36px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)',
              color: 'var(--text-muted)', textAlign: 'center'
            }}>
              <Sparkles size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                Insufficient Data
              </p>
              <p style={{ fontSize: '0.8rem', marginTop: 4, margin: 0 }}>
                Complete candidate interview evaluations to generate shortlisting recommendations.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Summary Metric Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                <div style={{ padding: '14px 18px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Evaluated</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>{totalEvaluated}</div>
                </div>

                <div style={{ padding: '14px 18px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Shortlisted Rate</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-green, #10b981)', marginTop: 4 }}>{shortlistingRate}</div>
                </div>

                <div style={{ padding: '14px 18px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Shortlisted Score</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-amber, #f59e0b)', marginTop: 4 }}>
                    {avgShortlistedScore != null ? `${avgShortlistedScore}%` : 'Unavailable'}
                  </div>
                </div>

                <div style={{ padding: '14px 18px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Score</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary, #6366f1)', marginTop: 4 }}>
                    {topScore != null ? `${topScore}%` : 'Unavailable'}
                  </div>
                </div>
              </div>

              {/* Chart & Legend Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, alignItems: 'center' }}>
                <div style={{ height: 220, position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--bg-card)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    textAlign: 'center', pointerEvents: 'none'
                  }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalEvaluated}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Evaluated</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{
                    padding: '12px 16px', borderRadius: 'var(--radius-md, 8px)', background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent-green, #10b981)' }} />
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Recommended / Shortlisted (≥75%)</span>
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-green, #10b981)' }}>
                      {recCount} ({recPct}%)
                    </span>
                  </div>

                  <div style={{
                    padding: '12px 16px', borderRadius: 'var(--radius-md, 8px)', background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent-amber, #f59e0b)' }} />
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Review Required (60-74%)</span>
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-amber, #f59e0b)' }}>
                      {revCount} ({revPct}%)
                    </span>
                  </div>

                  <div style={{
                    padding: '12px 16px', borderRadius: 'var(--radius-md, 8px)', background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--accent-rose, #ef4444)' }} />
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Not Recommended (&lt;60%)</span>
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-rose, #ef4444)' }}>
                      {notCount} ({notPct}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ────────────────────────────────────────────────────────────
            SECTION 4 — SHORTLISTED CANDIDATES LIST (Full-Width Horizontal Card)
        ──────────────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-lg, 12px)', background: 'var(--bg-card)', border: '1px solid var(--border-medium)', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCheck size={20} color="var(--accent-green, #10b981)" />
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                Shortlisted Candidates List
              </h2>
            </div>
            {shortlistedList.length > 0 && (
              <span className="badge badge-success" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                <ShieldCheck size={12} style={{ marginRight: 4 }} /> {shortlistedList.length} Qualified
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Real evaluated candidates qualifying for shortlisting based on PostgreSQL interview performance
          </p>

          {shortlistedList.length === 0 ? (
            <div style={{
              padding: '36px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)',
              color: 'var(--text-muted)', textAlign: 'center'
            }}>
              <UserCheck size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                No shortlisted candidates available.
              </p>
              <p style={{ fontSize: '0.8rem', marginTop: 4, margin: 0 }}>
                No completed interview evaluations currently meet the shortlisting criteria (score ≥ 75%).
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 14px', fontWeight: 600 }}>Candidate Name</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600 }}>Job / Role</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center' }}>Overall Score</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center' }}>Technical</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center' }}>Communication</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center' }}>Confidence</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center' }}>Professionalism</th>
                    <th style={{ padding: '12px 14px', fontWeight: 600, textAlign: 'center' }}>Shortlist Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shortlistedList.map((cand, idx) => (
                    <tr key={cand.session_id || idx} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s ease' }}>
                      <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {cand.candidate_name}
                        {cand.candidate_email && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{cand.candidate_email}</div>
                        )}
                      </td>
                      <td style={{ padding: '14px', color: 'var(--text-secondary)' }}>{cand.job_role}</td>
                      <td style={{ padding: '14px', textAlign: 'center', fontWeight: 800, color: 'var(--accent-green, #10b981)', fontSize: '1rem' }}>
                        {cand.overall_score != null ? `${cand.overall_score}%` : 'Unavailable'}
                      </td>
                      <td style={{ padding: '14px', textAlign: 'center', color: cand.technical_score != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {cand.technical_score != null ? `${cand.technical_score}%` : 'Unavailable'}
                      </td>
                      <td style={{ padding: '14px', textAlign: 'center', color: cand.communication_score != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {cand.communication_score != null ? `${cand.communication_score}%` : 'Unavailable'}
                      </td>
                      <td style={{ padding: '14px', textAlign: 'center', color: cand.confidence_score != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {cand.confidence_score != null ? `${cand.confidence_score}%` : 'Unavailable'}
                      </td>
                      <td style={{ padding: '14px', textAlign: 'center', color: cand.professionalism_score != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {cand.professionalism_score != null ? `${cand.professionalism_score}%` : 'Unavailable'}
                      </td>
                      <td style={{ padding: '14px', textAlign: 'center' }}>
                        <span className="badge badge-success" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                          {cand.shortlist_status || 'Shortlisted'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </ErrorBoundary>
  );
}
