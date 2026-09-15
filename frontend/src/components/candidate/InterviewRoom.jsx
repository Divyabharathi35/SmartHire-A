// ============================================================
//  InterviewRoom.jsx — Candidate Assigned Interviews & Practice Room
// ============================================================
import { useState, useEffect } from 'react';
import { Play, CheckCircle, Clock, Video, Tag, Award, AlertCircle } from 'lucide-react';
import InterviewSession from './InterviewSession';
import InterviewSummary from './InterviewSummary';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function InterviewRoom() {
  const [assignedSessions, setAssignedSessions] = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [activeSession, setActiveSession]       = useState(null);
  const [summarySession, setSummarySession]     = useState(null);

  useEffect(() => {
    fetchAssignedSessions();
  }, []);

  const fetchAssignedSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/sessions`, {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setAssignedSessions(data);
      }
    } catch (_err) {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSession = async (session) => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${session.id}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const detail = await res.json();
        if (detail.status === 'completed') {
          setSummarySession(detail);
        } else {
          setActiveSession(detail);
        }
        return;
      }
    } catch (_e) {
      /* ignore */
    }
    setActiveSession(session);
  };

  if (summarySession) {
    return <InterviewSummary session={summarySession} onBack={() => setSummarySession(null)} />;
  }

  if (activeSession) {
    return <InterviewSession session={activeSession} onBackToGenerator={() => { setActiveSession(null); fetchAssignedSessions(); }} />;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, hsla(252,100%,68%,0.12), hsla(280,90%,65%,0.12))',
        border: '1px solid var(--border-accent)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Video size={28} color="var(--accent-primary)" />
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 700 }}>
              Candidate Interview Room
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              View and take interviews assigned to you by recruiters and administrators.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <div className="auth-loading-spinner" style={{ margin: '0 auto 12px' }} />
          <p>Loading assigned interviews...</p>
        </div>
      ) : assignedSessions.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>
          <AlertCircle size={36} color="var(--accent-primary)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 6 }}>
            No Assigned Interviews Found
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto' }}>
            You do not currently have any assigned interviews. When a recruiter assigns an AI interview session to you, it will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-heading)', marginBottom: 4 }}>
            Your Assigned Interview Sessions ({assignedSessions.length})
          </h3>

          {assignedSessions.map((item) => {
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
              <div key={item.id} className="card" style={{ padding: '20px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontWeight: 600,
                        background: badgeBg,
                        color: badgeColor
                      }}>
                        {badgeLabel}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Difficulty: {item.difficulty || 'Medium'}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {item.job_role || 'Interview Session'}
                    </h4>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span><Tag size={10} style={{ display: 'inline', marginRight: 4 }} />Domain: {item.domain || 'General'}</span>
                      <span>Type: {item.interview_type || 'Technical'}</span>
                      {item.num_questions && <span>Questions: {item.num_questions}</span>}
                    </div>
                  </div>

                  {itemStatus === 'completed' ? (
                    <button
                      onClick={() => handleOpenSession(item)}
                      style={{
                        padding: '10px 22px', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-medium)',
                        color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem'
                      }}
                    >
                      <Award size={16} /> View Report
                    </button>
                  ) : itemStatus === 'in_progress' || itemStatus === 'in progress' || itemStatus === 'paused' ? (
                    <button
                      onClick={() => handleOpenSession(item)}
                      style={{
                        padding: '10px 22px', borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem',
                        boxShadow: 'var(--shadow-glow)'
                      }}
                    >
                      <Play size={16} /> Continue Interview
                    </button>
                  ) : itemStatus === 'cancelled' || itemStatus === 'expired' ? (
                    <button
                      disabled
                      style={{
                        padding: '10px 22px', borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                        color: 'var(--text-muted)', fontWeight: 500, cursor: 'not-allowed',
                        display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', opacity: 0.7
                      }}
                    >
                      Unavailable
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenSession(item)}
                      style={{
                        padding: '10px 22px', borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem',
                        boxShadow: 'var(--shadow-glow)'
                      }}
                    >
                      <Play size={16} /> Start Interview
                    </button>
                  )}
                </div>
              </div>
            );
          })}

        </div>
      )}
    </div>
  );
}
