import { useEffect, useState } from 'react';
import { MonitorPlay, Clock, Wifi, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../api/apiClient';

function formatSecs(secs) {
  const m = Math.floor((secs || 0) / 60);
  const s = (secs || 0) % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function ActiveSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);

  const fetchActiveSessions = async () => {
    try {
      const res = await apiFetch('/api/recruiter/interviews?status_filter=in_progress');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error('[ActiveSessions] Error loading active sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveSessions();
    const interval = setInterval(fetchActiveSessions, 5000); // Live poll every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h1>Active Live Sessions</h1>
            <p>Monitor candidates currently taking live AI interview sessions in real time</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="live-badge">
              <span className="live-dot" />
              LIVE
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{sessions.length} Active Sessions</span>
            <button className="btn btn-secondary btn-sm flex items-center gap-1" onClick={fetchActiveSessions}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Session Cards Grid */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Loading active interview sessions...
        </div>
      ) : sessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          <Wifi size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
          <p style={{ fontSize: '1rem', fontWeight: 600 }}>No candidates are currently in an active interview session.</p>
          <p style={{ fontSize: '0.82rem', marginTop: 4 }}>When candidates begin their interview, live session cards will automatically appear here.</p>
        </div>
      ) : (
        <div className="grid-2" style={{ marginBottom: 'var(--space-8)' }}>
          {sessions.map(s => (
            <div key={s.id} className="session-card">
              {/* Header */}
              <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: '0.85rem', flexShrink: 0
                }}>
                  {s.candidate_name ? s.candidate_name.charAt(0).toUpperCase() : 'C'}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-2">
                    <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{s.candidate_name}</p>
                    <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>{(s.status || 'IN_PROGRESS').toUpperCase()}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.job_role} &bull; {s.interview_type}</p>
                </div>
              </div>

              {/* Progress */}
              <div className="session-progress-wrap">
                <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-2)' }}>
                  <span className="session-question-label">
                    Completed {s.completed_questions} of {s.total_questions} questions
                  </span>
                  <div className="flex items-center gap-2" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Clock size={12} />
                    {formatSecs(s.duration)}
                  </div>
                </div>
                <div className="progress-bar" style={{ height: 8 }}>
                  <div className="progress-fill" style={{ width: `${s.total_questions > 0 ? (s.completed_questions / s.total_questions) * 100 : 0}%` }} />
                </div>
              </div>

              {/* Live indicator */}
              <div className="flex items-center gap-4" style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1">
                  <Wifi size={12} color="var(--accent-green)" />
                  Live Audio/Video Session Active
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
