// ============================================================
//  ComparisonDashboard.jsx — Side-by-side Candidate Analytics
// ============================================================
import { useState, useEffect } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip
} from 'recharts';
import { ArrowUp, ArrowDown, Minus, RefreshCw, AlertCircle, Users } from 'lucide-react';
import ErrorBoundary from '../common/ErrorBoundary';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function DeltaBadge({ diff }) {
  if (diff === null || diff === undefined) {
    return <span className="badge badge-neutral" style={{ opacity: 0.7 }}><Minus size={10} /> N/A</span>;
  }
  if (Math.abs(diff) < 0.5) {
    return <span className="badge badge-neutral"><Minus size={10} /> Tie</span>;
  }
  return diff > 0
    ? <span className="badge badge-success"><ArrowUp size={10} /> +{diff}</span>
    : <span className="badge badge-danger"><ArrowDown size={10} /> {diff}</span>;
}

function getStatusBadgeClass(statusStr) {
  if (!statusStr) return 'badge-neutral';
  const lower = statusStr.toLowerCase();
  if (lower.includes('shortlisted') || lower.includes('recommended') || lower.includes('pass')) {
    return 'badge-success';
  }
  if (lower.includes('review') || lower.includes('under')) {
    return 'badge-warning';
  }
  if (lower.includes('not') || lower.includes('reject') || lower.includes('fail')) {
    return 'badge-danger';
  }
  return 'badge-neutral';
}

function ComparisonDashboardContent() {
  const [candidatesList, setCandidatesList] = useState([]);
  const [sessionA, setSessionA]             = useState('');
  const [sessionB, setSessionB]             = useState('');
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading]               = useState(true);
  const [compLoading, setCompLoading]       = useState(false);
  const [error, setError]                   = useState(null);

  const getHeaders = () => {
    const token = localStorage.getItem('smarthire_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  // 1. Fetch Candidate List for Selectors
  useEffect(() => {
    let isMounted = true;
    const fetchCandidates = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/recruiter/interviews?sort_by=completed_at&sort_order=desc`, {
          credentials: 'include',
          headers: getHeaders(),
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            // Include candidates with sessions (prefer completed sessions)
            setCandidatesList(data || []);
            if (data && data.length > 0) {
              const firstId = String(data[0].session_id || data[0].id);
              setSessionA(firstId);
              if (data.length > 1) {
                const secondId = String(data[1].session_id || data[1].id);
                setSessionB(secondId);
              } else {
                setSessionB(firstId);
              }
            }
          }
        } else {
          const errTxt = await res.text();
          if (isMounted) setError(`HTTP ${res.status}: ${errTxt || 'Failed to load candidates'}`);
        }
      } catch (err) {
        console.error('[ComparisonDashboard] Fetch candidates error:', err);
        if (isMounted) setError(err.message || 'Network error fetching candidates');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCandidates();
    return () => { isMounted = false; };
  }, []);

  // 2. Fetch Side-by-Side Comparison when Session Selection Changes
  useEffect(() => {
    let isMounted = true;
    if (!sessionA && !sessionB) return;

    const fetchComparison = async () => {
      setCompLoading(true);
      try {
        let url = `${API_BASE}/api/recruiter/comparison`;
        const params = [];
        if (sessionA) params.push(`session_id_a=${encodeURIComponent(sessionA)}`);
        if (sessionB) params.push(`session_id_b=${encodeURIComponent(sessionB)}`);
        if (params.length > 0) url += `?${params.join('&')}`;

        const res = await fetch(url, { credentials: 'include', headers: getHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setComparisonData(data);
        } else {
          console.error('[ComparisonDashboard] Comparison API returned status:', res.status);
          if (isMounted) setComparisonData(null);
        }
      } catch (err) {
        console.error('[ComparisonDashboard] Comparison fetch error:', err);
        if (isMounted) setComparisonData(null);
      } finally {
        if (isMounted) setCompLoading(false);
      }
    };

    fetchComparison();
    return () => { isMounted = false; };
  }, [sessionA, sessionB]);

  if (loading) {
    return (
      <div className="card text-center" style={{ padding: 'var(--space-12)' }}>
        <RefreshCw size={28} className="animate-spin text-accent" style={{ margin: '0 auto var(--space-4)' }} />
        <p className="text-secondary">Loading comparison data from database...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center" style={{ padding: 'var(--space-8)', borderColor: 'hsla(0, 84%, 60%, 0.3)' }}>
        <AlertCircle size={32} className="text-danger" style={{ margin: '0 auto var(--space-3)' }} />
        <h3>Failed to Load Comparison</h3>
        <p className="text-muted text-sm" style={{ marginBottom: 'var(--space-4)' }}>{error}</p>
        <button className="btn btn-secondary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  const candidateA = comparisonData?.candidate_a;
  const candidateB = comparisonData?.candidate_b;
  const diffs      = comparisonData?.comparison;
  const radarData  = comparisonData?.radar_data || [];
  const isNoData   = !candidateA && !candidateB;

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <h1>Comparison Dashboard</h1>
        <p>Side-by-side candidate performance analysis to make data-driven hiring decisions</p>
      </div>

      {candidatesList.length === 0 ? (
        <div className="card text-center" style={{ padding: 'var(--space-12)' }}>
          <Users size={40} className="text-muted" style={{ margin: '0 auto var(--space-4)', opacity: 0.5 }} />
          <h3>No candidate data available for comparison</h3>
          <p className="text-muted text-sm" style={{ marginTop: 8 }}>
            No completed candidate interview records were found in the database.
          </p>
        </div>
      ) : (
        <>
          {/* Selectors */}
          <div className="comparison-grid" style={{ marginBottom: 'var(--space-8)' }}>
            {/* Candidate 1 */}
            <div>
              <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Candidate A</label>
              <select
                className="form-control"
                value={sessionA}
                onChange={e => setSessionA(e.target.value)}
                id="compare-candidate-1"
              >
                {candidatesList.map(c => {
                  const sId = String(c.session_id || c.id);
                  const scText = c.overall_score != null ? `${c.overall_score}%` : 'No score';
                  return (
                    <option key={`a-${sId}`} value={sId} disabled={sId === sessionB && candidatesList.length > 1}>
                      {c.candidate_name} — {c.job_role} ({scText})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="vs-divider">
              <div className="vs-badge">VS</div>
            </div>

            {/* Candidate 2 */}
            <div>
              <label className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>Candidate B</label>
              <select
                className="form-control"
                value={sessionB}
                onChange={e => setSessionB(e.target.value)}
                id="compare-candidate-2"
              >
                {candidatesList.map(c => {
                  const sId = String(c.session_id || c.id);
                  const scText = c.overall_score != null ? `${c.overall_score}%` : 'No score';
                  return (
                    <option key={`b-${sId}`} value={sId} disabled={sId === sessionA && candidatesList.length > 1}>
                      {c.candidate_name} — {c.job_role} ({scText})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {compLoading ? (
            <div className="card text-center" style={{ padding: 'var(--space-8)' }}>
              <RefreshCw size={24} className="animate-spin text-accent" style={{ margin: '0 auto var(--space-3)' }} />
              <p className="text-secondary text-sm">Comparing candidate data...</p>
            </div>
          ) : isNoData ? (
            <div className="card text-center" style={{ padding: 'var(--space-10)' }}>
              <AlertCircle size={32} className="text-muted" style={{ margin: '0 auto var(--space-3)' }} />
              <h4>No candidate data available for comparison</h4>
              <p className="text-muted text-sm" style={{ marginTop: 4 }}>
                Please select valid candidates from the dropdowns above.
              </p>
            </div>
          ) : (
            <>
              {/* Profile Cards */}
              <div className="comparison-grid" style={{ marginBottom: 'var(--space-8)' }}>
                {/* Candidate A Card */}
                <div className="card" style={{ borderColor: 'hsla(252,100%,68%,0.3)', textAlign: 'center' }}>
                  {candidateA ? (
                    <>
                      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, hsl(252,80%,50%), hsl(280,80%,60%))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: '1.3rem', margin: '0 auto var(--space-4)' }}>
                        {candidateA.initials || 'A'}
                      </div>
                      <h3 style={{ marginBottom: 4 }}>{candidateA.name}</h3>
                      <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-4)' }}>{candidateA.role}</p>
                      <div style={{ fontSize: '3rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: 4 }}>
                        {candidateA.overall_score != null ? `${candidateA.overall_score}%` : 'Unavailable'}
                      </div>
                      <p className="text-xs text-muted">Overall Score</p>
                      <span className={`badge ${getStatusBadgeClass(candidateA.status)}`} style={{ marginTop: 'var(--space-3)' }}>
                        {candidateA.status || 'Insufficient Data'}
                      </span>
                    </>
                  ) : (
                    <p className="text-muted text-sm">No candidate data</p>
                  )}
                </div>

                {/* Middle: Key metrics comparison */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', justifyContent: 'center', padding: '0 var(--space-4)' }}>
                  {[
                    { label: 'Technical', diff: diffs?.technical_difference },
                    { label: 'Confidence', diff: diffs?.confidence_difference },
                    { label: 'Communication', diff: diffs?.communication_difference },
                    { label: 'Professionalism', diff: diffs?.professionalism_difference },
                    { label: 'Overall', diff: diffs?.overall_difference },
                  ].map(m => (
                    <div key={m.label} style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{m.label}</p>
                      <DeltaBadge diff={m.diff} />
                    </div>
                  ))}
                </div>

                {/* Candidate B Card */}
                <div className="card" style={{ borderColor: 'hsla(174,80%,55%,0.3)', textAlign: 'center' }}>
                  {candidateB ? (
                    <>
                      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, hsl(174,80%,40%), hsl(200,80%,50%))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: '1.3rem', margin: '0 auto var(--space-4)' }}>
                        {candidateB.initials || 'B'}
                      </div>
                      <h3 style={{ marginBottom: 4 }}>{candidateB.name}</h3>
                      <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-4)' }}>{candidateB.role}</p>
                      <div style={{ fontSize: '3rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'hsl(174,80%,55%)', marginBottom: 4 }}>
                        {candidateB.overall_score != null ? `${candidateB.overall_score}%` : 'Unavailable'}
                      </div>
                      <p className="text-xs text-muted">Overall Score</p>
                      <span className={`badge ${getStatusBadgeClass(candidateB.status)}`} style={{ marginTop: 'var(--space-3)' }}>
                        {candidateB.status || 'Insufficient Data'}
                      </span>
                    </>
                  ) : (
                    <p className="text-muted text-sm">No candidate data</p>
                  )}
                </div>
              </div>

              {/* Radar Chart */}
              <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <h3 className="section-title">Multi-Dimensional Comparison</h3>
                <ResponsiveContainer width="100%" height={360}>
                  <RadarChart data={radarData} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                    <PolarGrid stroke="var(--border-subtle)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-body)' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name={candidateA?.name || 'Candidate A'} dataKey="candidate1" stroke="hsl(252,100%,68%)" fill="hsl(252,100%,68%)" fillOpacity={0.15} strokeWidth={2} dot={{ r: 4 }} />
                    <Radar name={candidateB?.name || 'Candidate B'} dataKey="candidate2" stroke="hsl(174,80%,55%)" fill="hsl(174,80%,55%)" fillOpacity={0.12} strokeWidth={2} dot={{ r: 4 }} />
                    <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-medium)', borderRadius: 8 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Metric Bars */}
              <div className="grid-2">
                {[
                  {
                    name: candidateA?.name || 'Candidate A',
                    color: 'hsl(252,100%,68%)',
                    metrics: [
                      { label: 'Technical', val: candidateA?.technical_score },
                      { label: 'Confidence', val: candidateA?.confidence_score },
                      { label: 'Communication', val: candidateA?.communication_score },
                      { label: 'Professionalism', val: candidateA?.professionalism_score },
                    ]
                  },
                  {
                    name: candidateB?.name || 'Candidate B',
                    color: 'hsl(174,80%,55%)',
                    metrics: [
                      { label: 'Technical', val: candidateB?.technical_score },
                      { label: 'Confidence', val: candidateB?.confidence_score },
                      { label: 'Communication', val: candidateB?.communication_score },
                      { label: 'Professionalism', val: candidateB?.professionalism_score },
                    ]
                  },
                ].map(card => (
                  <div key={card.name} className="card">
                    <h4 style={{ marginBottom: 'var(--space-5)' }}>{card.name}</h4>
                    {card.metrics.map(m => (
                      <div key={m.label} style={{ marginBottom: 'var(--space-4)' }}>
                        <div className="flex justify-between" style={{ marginBottom: 6, fontSize: '0.82rem' }}>
                          <span className="text-secondary">{m.label}</span>
                          <span style={{ fontWeight: 700, color: m.val != null ? card.color : 'var(--text-muted)' }}>
                            {m.val != null ? `${m.val}%` : 'Unavailable'}
                          </span>
                        </div>
                        <div className="progress-bar" style={{ height: 8 }}>
                          <div style={{ height: '100%', width: `${m.val != null ? Math.min(100, Math.max(0, m.val)) : 0}%`, background: card.color, borderRadius: 99, transition: 'width 0.8s ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function ComparisonDashboard() {
  return (
    <ErrorBoundary componentName="ComparisonDashboard">
      <ComparisonDashboardContent />
    </ErrorBoundary>
  );
}
