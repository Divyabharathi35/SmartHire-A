// ============================================================
//  CandidateRanking.jsx — Recruiter Candidate Ranking View
// ============================================================
import { useState, useEffect } from 'react';
import { Trophy, Search, RefreshCw, AlertTriangle, Filter, RotateCcw } from 'lucide-react';
import ErrorBoundary from '../common/ErrorBoundary';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const INTERVIEW_TYPE_OPTIONS = [
  { value: 'all', label: 'All Interview Types' },
  { value: 'Technical', label: 'Technical Interview' },
  { value: 'HR', label: 'HR Interview' },
  { value: 'Behavioral', label: 'Behavioral Interview' },
  { value: 'Aptitude', label: 'Aptitude Interview' },
];

export default function CandidateRanking({ onTabChange }) {
  const [candidates, setCandidates]     = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [search, setSearch]               = useState('');
  const [interviewType, setInterviewType] = useState('all');

  const fetchRankings = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('smarthire_token') || localStorage.getItem('token') || localStorage.getItem('access_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let url = `${API_BASE}/api/recruiter/interviews?sort_by=score&sort_order=desc`;
      if (interviewType !== 'all') {
        url += `&interview_type=${encodeURIComponent(interviewType)}`;
      }
      if (search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }

      const res = await fetch(url, { credentials: 'include', headers });
      if (res.ok) {
        const data = await res.json();
        setCandidates(data || []);
      } else {
        const errTxt = await res.text();
        setError(`HTTP ${res.status}: ${errTxt || 'Failed to fetch candidate rankings'}`);
      }
    } catch (err) {
      console.error('[CandidateRanking] Fetch error:', err);
      setError(err.message || 'Network error fetching candidate rankings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, [interviewType]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRankings();
  };

  const handleResetFilters = () => {
    setSearch('');
    setInterviewType('all');
  };

  const getRankBadgeStyle = (index) => {
    if (index === 0) return { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', label: '🏆 #1 Top Candidate' };
    if (index === 1) return { bg: 'linear-gradient(135deg, #94a3b8, #64748b)', color: '#fff', label: '🥈 #2 Second Place' };
    if (index === 2) return { bg: 'linear-gradient(135deg, #b45309, #78350f)', color: '#fff', label: '🥉 #3 Third Place' };
    return { bg: 'var(--bg-surface)', color: 'var(--text-secondary)', label: `#${index + 1}` };
  };

  const getRecommendationBadge = (rec, score) => {
    const r = (rec || '').toLowerCase();
    if (r.includes('strong') || r.includes('hire') || r.includes('recommend') || r.includes('shortlisted') || score >= 75) {
      return { bg: 'hsla(142,70%,55%,0.15)', color: 'var(--accent-green, #10b981)', border: '1px solid hsla(142,70%,55%,0.3)' };
    }
    if (r.includes('consider') || r.includes('review') || (score >= 60 && score < 75)) {
      return { bg: 'hsla(38,95%,60%,0.15)', color: 'var(--accent-amber, #f59e0b)', border: '1px solid hsla(38,95%,60%,0.3)' };
    }
    return { bg: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' };
  };

  const selectedTypeLabel = INTERVIEW_TYPE_OPTIONS.find(o => o.value === interviewType)?.label || interviewType;
  const isFiltered = interviewType !== 'all' || search.trim() !== '';

  return (
    <ErrorBoundary>
      <div className="animate-fade-in-up" style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Trophy size={24} color="var(--accent-amber, #f59e0b)" /> Candidate Ranking
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 4, margin: 0 }}>
              Ranked candidate leaderboard based on evaluated interview overall performance.
            </p>
          </div>
          <button
            onClick={fetchRankings}
            style={{
              padding: '9px 18px', borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--bg-card)', border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
            }}
          >
            <RefreshCw size={14} /> Refresh Rankings
          </button>
        </div>

        {/* Filters Card */}
        <div className="card" style={{ padding: '20px 24px', borderRadius: 'var(--radius-lg, 10px)', background: 'var(--bg-card)', marginBottom: 24, border: '1px solid var(--border-medium)' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, alignItems: 'end' }}>
              
              {/* Interview Type Filter */}
              <div>
                <label className="form-label" style={{ marginBottom: 6, display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Interview Type
                </label>
                <select
                  id="filter-interview-type"
                  value={interviewType}
                  onChange={(e) => setInterviewType(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-md, 6px)',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)', fontSize: '0.85rem'
                  }}
                >
                  {INTERVIEW_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Search Bar */}
              <div>
                <label className="form-label" style={{ marginBottom: 6, display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Search Candidates
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Candidate name, email, or role..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px 9px 36px', borderRadius: 'var(--radius-md, 6px)',
                      background: 'var(--bg-surface)', border: '1px solid var(--border-medium)',
                      color: 'var(--text-primary)', fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  style={{
                    flex: 1, padding: '9px 16px', borderRadius: 'var(--radius-md, 6px)',
                    background: 'var(--accent-primary, #6366f1)', border: 'none',
                    color: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}
                >
                  <Filter size={14} /> Apply Filter
                </button>

                {isFiltered && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    style={{
                      padding: '9px 14px', borderRadius: 'var(--radius-md, 6px)',
                      background: 'var(--bg-surface)', border: '1px solid var(--border-medium)',
                      color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <RotateCcw size={14} /> Reset
                  </button>
                )}
              </div>

            </div>

            {/* Currently Applied Active Filter Bar */}
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 4 }}>
              <span><strong>Active Filter:</strong></span>
              <span className="badge badge-neutral" style={{ padding: '3px 10px', fontSize: '0.75rem' }}>
                TYPE: {selectedTypeLabel.toUpperCase()}
              </span>
              {search.trim() && (
                <span className="badge badge-neutral" style={{ padding: '3px 10px', fontSize: '0.75rem' }}>
                  SEARCH: "{search.trim()}"
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Loading / Error / Candidates Content */}
        {loading ? (
          <div className="card text-center" style={{ padding: '60px 20px' }}>
            <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--accent-primary)', margin: '0 auto 14px' }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading candidate rankings...</p>
          </div>
        ) : error ? (
          <div className="card" style={{ borderColor: 'var(--accent-rose, #ef4444)', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent-rose, #ef4444)', marginBottom: 8 }}>
              <AlertTriangle size={22} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Failed to Load Rankings</h3>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{error}</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="card text-center" style={{ padding: '48px 20px', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)' }}>
            <Trophy size={40} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              No candidates found for this interview type.
            </h3>
            <p style={{ fontSize: '0.85rem', marginTop: 6, color: 'var(--text-muted)' }}>
              Try selecting "All Interview Types" or adjusting your search criteria.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'right', marginBottom: -4 }}>
              Displaying <strong>{candidates.length}</strong> ranked candidate{candidates.length === 1 ? '' : 's'}
            </div>
            {candidates.map((c, idx) => {
              const isTop3 = idx < 3;
              const badge = getRankBadgeStyle(idx);
              const recStyle = getRecommendationBadge(c.recommendation, c.overall_score);
              return (
                <div
                  key={c.session_id || idx}
                  className="card"
                  style={{
                    padding: '20px 24px', borderRadius: 'var(--radius-lg, 12px)', background: 'var(--bg-card)',
                    border: isTop3 ? '1px solid hsla(38,95%,60%,0.4)' : '1px solid var(--border-subtle)',
                    boxShadow: isTop3 ? '0 4px 14px rgba(245,158,11,0.08)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      padding: '8px 14px', borderRadius: 'var(--radius-md, 8px)',
                      background: badge.bg, color: badge.color, fontWeight: 700, fontSize: '0.85rem',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)', userSelect: 'none'
                    }}>
                      {badge.label}
                    </div>

                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        {c.candidate_name}
                      </h3>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span><strong>Role:</strong> {c.job_role}</span>
                        <span><strong>Interview Type:</strong> {c.interview_type || 'N/A'}</span>
                        <span><strong>Difficulty:</strong> {c.difficulty || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-primary, #6366f1)' }}>
                        {c.overall_score != null ? `${Math.round(c.overall_score)}%` : 'Not Evaluated'}
                      </div>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        background: recStyle.bg, color: recStyle.color, border: recStyle.border
                      }}>
                        {c.recommendation || 'Under Review'}
                      </span>
                    </div>

                    {onTabChange && (
                      <button
                        onClick={() => onTabChange('reports')}
                        style={{
                          padding: '8px 14px', borderRadius: 'var(--radius-md, 6px)',
                          background: 'var(--bg-surface)', border: '1px solid var(--border-medium)',
                          color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        View Report
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
