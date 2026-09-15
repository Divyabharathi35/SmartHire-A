// ============================================================
//  InterviewHistory.jsx — Candidate Interview History
// ============================================================
import { useState, useEffect } from 'react';
import { Clock, Download, ChevronDown, ChevronUp, Tag, Star, Play, Award, Filter } from 'lucide-react';
import { apiFetch, getAuthToken, API_BASE } from '../../api/apiClient';
import ErrorBoundary from '../common/ErrorBoundary';

function ScoreRing({ score, size = 60 }) {
  const numericScore = score !== null && score !== undefined ? parseFloat(score) : null;
  if (numericScore === null || isNaN(numericScore)) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', border: '2px dashed var(--border-medium)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-muted)'
      }}>
        N/A
      </div>
    );
  }
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const offset = circ - (numericScore / 100) * circ;
  const color = numericScore >= 85 ? 'var(--accent-green)' : numericScore >= 70 ? 'var(--accent-primary)' : 'var(--accent-amber)';
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-medium)" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transformOrigin: `${size / 2}px ${size / 2}px`, transform: 'rotate(-90deg)', transition: 'stroke-dashoffset 1s ease' }}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill={color} fontSize="13" fontFamily="var(--font-heading)" fontWeight="700">
        {Math.round(numericScore)}
      </text>
    </svg>
  );
}

export default function InterviewHistory() {
  const [sessions, setSessions]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [expanded, setExpanded]         = useState(null);
  const [downloading, setDownloading]   = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [filterDomain, setFilterDomain]   = useState('All');
  const [fetchError, setFetchError]     = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await apiFetch('/api/history', { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        setSessions(data || []);
      } else {
        const errTxt = await res.text();
        setFetchError(`HTTP ${res.status}: ${errTxt || 'Failed to load interview history'}`);
        setSessions([]);
      }
    } catch (err) {
      console.error('[InterviewHistory] Fetch error:', err);
      setFetchError(err.message || 'Network error loading history');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id) => {
    setDownloading(id);
    try {
      const token = getAuthToken();
      const queryToken = token ? `?token=${encodeURIComponent(token)}` : '';

      const res = await apiFetch(`/api/candidate/interviews/${id}/report.pdf${queryToken}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const disposition = res.headers.get('Content-Disposition');
        let filename = `SmartHire_Candidate_Report.pdf`;
        if (disposition && disposition.includes('filename=')) {
          const match = disposition.match(/filename=["']?([^"';]+)["']?/);
          if (match && match[1]) filename = match[1];
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const errTxt = await res.text().catch(() => '');
        alert(`Failed to download report PDF: ${errTxt || 'Server error'}`);
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Network error downloading report PDF.');
    } finally {
      setDownloading(null);
    }
  };

  if (selectedSession) {
    return <InterviewSummary session={selectedSession} onBack={() => setSelectedSession(null)} />;
  }

  if (activeSession) {
    return <InterviewSession session={activeSession} onBackToGenerator={() => setActiveSession(null)} />;
  }

  const filteredSessions = filterDomain === 'All'
    ? sessions
    : sessions.filter(s => s.domain === filterDomain);

  const validScores = sessions
    .map(s => parseFloat(s.score))
    .filter(sc => sc !== null && sc !== undefined && !isNaN(sc));

  const avgScore = validScores.length > 0
    ? `${Math.round(validScores.reduce((acc, val) => acc + val, 0) / validScores.length)}%`
    : '—';

  const bestScore = validScores.length > 0
    ? `${Math.round(Math.max(...validScores))}%`
    : '—';

  const domainsList = ['All', ...new Set(sessions.map(s => s.domain).filter(Boolean))];

  return (
    <ErrorBoundary>
      <div className="animate-fade-in-up" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
        <div className="page-header" style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 700 }}>
            Interview History &amp; Sessions
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Complete database record of all generated mock interview sessions with AI feedback
          </p>
        </div>

        {/* Stats Summary */}
        <div className="grid-3" style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div className="stat-card" style={{ padding: 20, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>🎙️</div>
            <div className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{sessions.length}</div>
            <div className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Interview Sessions</div>
          </div>

          <div className="stat-card" style={{ padding: 20, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>⭐</div>
            <div className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{avgScore}</div>
            <div className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Average AI Score</div>
          </div>

          <div className="stat-card" style={{ padding: 20, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>🏆</div>
            <div className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{bestScore}</div>
            <div className="stat-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Personal Best Score</div>
          </div>
        </div>

        {/* Domain Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={16} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filter Domain:</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {domainsList.map(d => (
              <button
                key={d}
                onClick={() => setFilterDomain(d)}
                style={{
                  padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 500,
                  border: filterDomain === d ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  background: filterDomain === d ? 'hsla(252,100%,68%,0.15)' : 'var(--bg-card)',
                  color: filterDomain === d ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Sessions List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading interview history from database...
          </div>
        ) : fetchError ? (
          <div style={{ textAlign: 'center', padding: '30px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', color: 'var(--accent-rose)' }}>
            <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>Unable to load interview history</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{fetchError}</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-medium)', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>No completed interview report available.</p>
            <p style={{ fontSize: '0.82rem', marginTop: 4 }}>Generate and complete a mock interview session to view performance metrics here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredSessions.map((item, i) => {
              const itemScore = item.score !== null && item.score !== undefined ? parseFloat(item.score) : null;
              const itemStatus = (item.status || '').toLowerCase();
              let badgeLabel = 'Pending Interview';
              let badgeBg = 'hsla(252,100%,68%,0.12)';
              let badgeColor = 'var(--accent-primary)';

              if (itemStatus === 'completed') {
                badgeLabel = 'Completed';
                badgeBg = 'hsla(142,70%,55%,0.12)';
                badgeColor = 'var(--accent-green)';
              } else if (itemStatus === 'in_progress' || itemStatus === 'in progress') {
                badgeLabel = 'In Progress';
                badgeBg = 'hsla(38,95%,60%,0.12)';
                badgeColor = 'var(--accent-amber)';
              } else if (itemStatus === 'paused') {
                badgeLabel = 'Paused';
                badgeBg = 'hsla(38,95%,60%,0.12)';
                badgeColor = 'var(--accent-amber)';
              } else if (itemStatus === 'cancelled' || itemStatus === 'expired') {
                badgeLabel = itemStatus === 'cancelled' ? 'Cancelled' : 'Expired';
                badgeBg = 'hsla(0,84%,60%,0.12)';
                badgeColor = 'var(--accent-rose)';
              }

              return (
                <div key={item.id || i} className="card" style={{ padding: '20px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <ScoreRing score={itemScore} />
                      <div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 4 }}>{item.job_role || 'Interview Session'}</h4>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                          <span><Clock size={12} style={{ display: 'inline', marginRight: 4 }} />{item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}</span>
                          <span>Type: {item.interview_type || 'General'}</span>
                          <span>Difficulty: {item.difficulty || 'Medium'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {item.domain && (
                            <span className="skill-tag" style={{ fontSize: '0.72rem', padding: '2px 8px', background: 'hsla(252,100%,68%,0.1)', color: 'var(--accent-primary)', borderRadius: 'var(--radius-sm)' }}>
                              <Tag size={10} style={{ display: 'inline', marginRight: 4 }} /> {item.domain}
                            </span>
                          )}
                          <span style={{
                            fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontWeight: 600,
                            background: badgeBg,
                            color: badgeColor
                          }}>
                            {badgeLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Session Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {itemStatus === 'completed' ? (
                        <button
                          onClick={() => setSelectedSession(item)}
                          style={{
                            padding: '8px 14px', borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
                            color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 500,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                          }}
                        >
                          <Award size={14} /> View Report
                        </button>
                      ) : itemStatus === 'in_progress' || itemStatus === 'in progress' || itemStatus === 'paused' ? (
                        <button
                          onClick={() => setActiveSession(item)}
                          style={{
                            padding: '8px 16px', borderRadius: 'var(--radius-md)',
                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                            border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                          }}
                        >
                          <Play size={14} /> Continue Interview
                        </button>
                      ) : itemStatus === 'cancelled' || itemStatus === 'expired' ? (
                        <button
                          disabled
                          style={{
                            padding: '8px 14px', borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                            color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500,
                            cursor: 'not-allowed', opacity: 0.7
                          }}
                        >
                          Unavailable
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveSession(item)}
                          style={{
                            padding: '8px 16px', borderRadius: 'var(--radius-md)',
                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                            border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                          }}
                        >
                          <Play size={14} /> Start Interview
                        </button>
                      )}

                      <button
                        onClick={() => handleDownload(item.id)}

                        style={{
                          padding: '8px 12px', borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)', fontSize: '0.82rem', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6
                        }}
                      >
                        <Download size={14} /> {downloading === item.id ? 'Exporting...' : 'PDF'}
                      </button>

                      <button
                        onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                      >
                        {expanded === item.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expanded === item.id && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
                        <strong>AI Feedback Summary:</strong> {item.questions?.[0]?.feedback || item.feedback || "Detailed feedback available in report."}
                      </p>
                      {item.questions && item.questions.length > 0 && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Total Questions in Session: {item.questions.length}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
