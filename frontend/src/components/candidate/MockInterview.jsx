// ============================================================
//  MockInterview.jsx — Candidate Private Practice Room & History
//  SmartHire — Mock Interview Module
// ============================================================
import { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, Play, ArrowLeft, ArrowRight, Clock, HelpCircle, FileText, History, AlertCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function MockInterview() {
  const [activeTab, setActiveTab] = useState('setup'); // 'setup' | 'room' | 'complete' | 'history'

  // Setup Form State
  const [jobRole, setJobRole]             = useState('Software Developer');
  const [domain, setDomain]               = useState('Software Development');
  const [interviewType, setInterviewType] = useState('Technical Interview');
  const [difficulty, setDifficulty]       = useState('Medium');
  const [numQuestions, setNumQuestions]   = useState(5);
  const [userSkills, setUserSkills]       = useState('');
  const [isGenerating, setIsGenerating]   = useState(false);
  const [errorMsg, setErrorMsg]           = useState('');

  // Active Practice Room State
  const [currentSession, setCurrentSession]   = useState(null);
  const [currentIndex, setCurrentIndex]       = useState(0);
  const [answers, setAnswers]                 = useState({});
  const [isSubmittingAnswer, setIsSubmitting] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);

  // Completed Session Summary State
  const [completedSummary, setCompletedSummary] = useState(null);

  // Practice History State
  const [historyList, setHistoryList]     = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHistorySession, setSelectedHistorySession] = useState(null);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/api/mock-interviews/sessions`, {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data || []);
      }
    } catch (_err) {
      /* ignore */
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleStartSession = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setIsGenerating(true);

    try {
      const res = await fetch(`${API_BASE}/api/mock-interviews/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          job_role: jobRole,
          domain,
          interview_type: interviewType,
          difficulty,
          num_questions: parseInt(numQuestions, 10),
          user_skills: userSkills || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to start practice session');
      }

      setCurrentSession(data);
      setCurrentIndex(0);
      const initialAnswers = {};
      (data.questions || []).forEach(q => {
        initialAnswers[q.id] = q.user_answer || '';
      });
      setAnswers(initialAnswers);
      setActiveTab('room');
    } catch (err) {
      setErrorMsg(err.message || 'Error starting practice interview');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveCurrentAnswer = async () => {
    if (!currentSession || !currentSession.questions || !currentSession.questions[currentIndex]) return;
    const q = currentSession.questions[currentIndex];
    const userAns = answers[q.id] || '';

    setIsSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/mock-interviews/sessions/${currentSession.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          question_id: q.id,
          user_answer: userAns,
        }),
      });
    } catch (_err) {
      /* ignore non-critical submit errors */
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextQuestion = async () => {
    await handleSaveCurrentAnswer();
    if (currentIndex < (currentSession?.questions?.length || 1) - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevQuestion = async () => {
    await handleSaveCurrentAnswer();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleCompletePractice = async () => {
    if (!currentSession) return;
    setIsEndingSession(true);
    try {
      await handleSaveCurrentAnswer();
      const res = await fetch(`${API_BASE}/api/mock-interviews/sessions/${currentSession.id}/end`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const summary = await res.json();
        setCompletedSummary(summary);
      } else {
        setCompletedSummary(currentSession);
      }
      setActiveTab('complete');
    } catch (_err) {
      setCompletedSummary(currentSession);
      setActiveTab('complete');
    } finally {
      setIsEndingSession(false);
    }
  };

  const viewHistoryDetail = async (sessionId) => {
    try {
      const res = await fetch(`${API_BASE}/api/mock-interviews/sessions/${sessionId}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedHistorySession(data);
      }
    } catch (_e) {
      /* ignore */
    }
  };

  const formatSeconds = (sec) => {
    if (!sec || isNaN(sec)) return '0m 0s';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  // Render History Detail Modal / View
  if (selectedHistorySession) {
    return (
      <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
        <button
          onClick={() => setSelectedHistorySession(null)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)', fontSize: '0.88rem', cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          <ArrowLeft size={16} /> Back to Practice History
        </button>

        <div className="card" style={{ padding: '28px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <span className="sidebar-badge" style={{ background: 'hsla(252,100%,68%,0.15)', color: 'var(--accent-primary)', padding: '4px 10px' }}>
                Practice History Session
              </span>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 700, marginTop: 8 }}>
                {selectedHistorySession.job_role} ({selectedHistorySession.domain})
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {new Date(selectedHistorySession.created_at).toLocaleDateString()} • {selectedHistorySession.interview_type} • {selectedHistorySession.difficulty}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Duration</p>
              <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>{formatSeconds(selectedHistorySession.duration)}</p>
            </div>
          </div>

          <div style={{
            background: 'hsla(215, 20%, 15%, 0.4)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '24px',
            fontSize: '0.82rem',
            color: 'var(--text-muted)'
          }}>
            ℹ️ Private Practice Record: Strictly candidate-only. No scores, AI evaluations, or recruiter reports are generated for mock sessions.
          </div>

          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 16 }}>
            Questions &amp; Your Practice Answers ({selectedHistorySession.questions?.length || 0})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(selectedHistorySession.questions || []).map((q, idx) => (
              <div key={q.id || idx} style={{
                background: 'var(--bg-body)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '16px'
              }}>
                <p style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: 8 }}>
                  Q{idx + 1}. {q.question_text}
                </p>
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px',
                  fontSize: '0.88rem',
                  color: q.user_answer ? 'var(--text-secondary)' : 'var(--text-muted)',
                  fontStyle: q.user_answer ? 'normal' : 'italic'
                }}>
                  {q.user_answer ? q.user_answer : 'No answer provided.'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, hsla(252,100%,68%,0.15), hsla(280,90%,65%,0.15))',
        border: '1px solid var(--border-accent)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px hsla(252,100%,68%,0.3)'
          }}>
            <Sparkles size={24} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 700 }}>
                Mock Interview Practice
              </h1>
              <span className="sidebar-badge" style={{ background: 'hsla(142,70%,55%,0.15)', color: 'hsl(142,70%,60%)' }}>
                Private Practice Mode
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 2 }}>
              Practice interview questions in a realistic environment without affecting candidate reports or recruiter evaluation.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Header */}
      {activeTab !== 'room' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
          <button
            onClick={() => setActiveTab('setup')}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              border: activeTab === 'setup' ? '1px solid var(--border-accent)' : '1px solid transparent',
              background: activeTab === 'setup' ? 'hsla(252,100%,68%,0.12)' : 'transparent',
              color: activeTab === 'setup' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            <Play size={16} /> New Practice Session
          </button>

          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              border: activeTab === 'history' ? '1px solid var(--border-accent)' : '1px solid transparent',
              background: activeTab === 'history' ? 'hsla(252,100%,68%,0.12)' : 'transparent',
              color: activeTab === 'history' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            <History size={16} /> Practice History
          </button>
        </div>
      )}

      {/* ── TAB 1: SETUP PRACTICE SESSION ── */}
      {activeTab === 'setup' && (
        <div className="card" style={{ padding: '32px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 600, marginBottom: 6 }}>
            Configure Your Mock Practice Session
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '24px' }}>
            Select your desired role, domain, difficulty, and question count to launch a personalized practice session.
          </p>

          {errorMsg && (
            <div style={{
              background: 'hsla(0,70%,50%,0.1)', border: '1px solid hsla(0,70%,50%,0.3)',
              color: '#ff6b6b', padding: '12px 16px', borderRadius: 'var(--radius-md)',
              fontSize: '0.88rem', marginBottom: '20px'
            }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleStartSession} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Job Role
              </label>
              <input
                type="text"
                value={jobRole}
                onChange={e => setJobRole(e.target.value)}
                placeholder="e.g. Full Stack Developer"
                required
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg-body)',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)', fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Domain / Specialization
              </label>
              <input
                type="text"
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="e.g. Software Development"
                required
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg-body)',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)', fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Interview Type
              </label>
              <select
                value={interviewType}
                onChange={e => setInterviewType(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg-body)',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)', fontSize: '0.9rem'
                }}
              >
                <option value="Technical Interview">Technical Interview</option>
                <option value="HR Interview">HR Interview</option>
                <option value="Behavioral Interview">Behavioral Interview</option>
                <option value="Aptitude Interview">Aptitude Interview</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Difficulty Level
              </label>
              <select
                value={difficulty}
                onChange={e => setDifficulty(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg-body)',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)', fontSize: '0.9rem'
                }}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
                <option value="Expert">Expert</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Number of Questions
              </label>
              <select
                value={numQuestions}
                onChange={e => setNumQuestions(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg-body)',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)', fontSize: '0.9rem'
                }}
              >
                <option value={3}>3 Questions (Quick Practice)</option>
                <option value={5}>5 Questions (Standard Practice)</option>
                <option value={10}>10 Questions (Deep Dive)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Focus Skills / Key Topics (Optional)
              </label>
              <input
                type="text"
                value={userSkills}
                onChange={e => setUserSkills(e.target.value)}
                placeholder="e.g. React, Python, System Design"
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg-body)',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)', fontSize: '0.9rem'
                }}
              />
            </div>

            <div style={{ gridColumn: 'span 2', marginTop: 12 }}>
              <button
                type="submit"
                disabled={isGenerating}
                style={{
                  width: '100%', padding: '14px',
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  color: '#fff', fontWeight: 600, fontSize: '1rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  opacity: isGenerating ? 0.7 : 1
                }}
              >
                {isGenerating ? (
                  <>
                    <div className="auth-loading-spinner" style={{ width: 18, height: 18 }} />
                    Generating Practice Questions...
                  </>
                ) : (
                  <>
                    <Play size={18} /> Start Mock Interview Practice
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── TAB 2: ACTIVE PRACTICE ROOM ── */}
      {activeTab === 'room' && currentSession && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Progress & Header */}
          <div className="card" style={{ padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <span className="sidebar-badge" style={{ background: 'hsla(252,100%,68%,0.15)', color: 'var(--accent-primary)' }}>
                  Question {currentIndex + 1} of {currentSession.questions?.length || 0}
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: 4 }}>
                  {currentSession.job_role} • {currentSession.domain}
                </h3>
              </div>
              <button
                onClick={handleCompletePractice}
                disabled={isEndingSession}
                style={{
                  padding: '8px 16px', background: 'hsla(142,70%,55%,0.15)',
                  border: '1px solid hsla(142,70%,55%,0.3)', borderRadius: 'var(--radius-md)',
                  color: 'hsl(142,70%,60%)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer'
                }}
              >
                {isEndingSession ? 'Finishing Practice...' : 'Finish Practice Session'}
              </button>
            </div>

            {/* Progress bar */}
            <div style={{ background: 'var(--bg-body)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${((currentIndex + 1) / (currentSession.questions?.length || 1)) * 100}%`,
                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Current Question Box */}
          {currentSession.questions && currentSession.questions[currentIndex] && (
            <div className="card" style={{ padding: '28px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textTransform: 'uppercase', tracking: '0.05em', fontWeight: 600, marginBottom: 8 }}>
                {currentSession.questions[currentIndex].interview_type} • {currentSession.questions[currentIndex].difficulty}
              </p>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.5, color: 'var(--text-primary)', marginBottom: '24px' }}>
                {currentSession.questions[currentIndex].question_text}
              </h2>

              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Your Answer (Practice Response)
              </label>
              <textarea
                value={answers[currentSession.questions[currentIndex].id] || ''}
                onChange={e => {
                  const val = e.target.value;
                  const qId = currentSession.questions[currentIndex].id;
                  setAnswers(prev => ({ ...prev, [qId]: val }));
                }}
                placeholder="Type your response here..."
                rows={7}
                style={{
                  width: '100%', padding: '14px', background: 'var(--bg-body)',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)', fontSize: '0.92rem', lineHeight: 1.6,
                  resize: 'vertical', fontFamily: 'inherit'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
                <button
                  onClick={handlePrevQuestion}
                  disabled={currentIndex === 0}
                  style={{
                    padding: '10px 20px', background: 'var(--bg-body)',
                    border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                    color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.88rem',
                    cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                    opacity: currentIndex === 0 ? 0.4 : 1,
                    display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <ArrowLeft size={16} /> Previous Question
                </button>

                {currentIndex < (currentSession.questions.length - 1) ? (
                  <button
                    onClick={handleNextQuestion}
                    disabled={isSubmittingAnswer}
                    style={{
                      padding: '10px 24px',
                      background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                      border: 'none', borderRadius: 'var(--radius-md)',
                      color: '#fff', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    Next Question <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleCompletePractice}
                    disabled={isEndingSession}
                    style={{
                      padding: '10px 24px',
                      background: 'linear-gradient(135deg, hsl(142,70%,45%), hsl(142,70%,35%))',
                      border: 'none', borderRadius: 'var(--radius-md)',
                      color: '#fff', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    Complete Practice <CheckCircle2 size={16} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: PRACTICE COMPLETION SCREEN ── */}
      {activeTab === 'complete' && (
        <div className="card" style={{ padding: '36px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'hsla(142,70%,55%,0.15)', color: 'hsl(142,70%,60%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <CheckCircle2 size={36} />
          </div>

          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>
            Practice Interview Completed!
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '540px', margin: '0 auto 28px' }}>
            Great job! You have successfully completed your mock practice session.
          </p>

          {/* Session Overview Box */}
          <div style={{
            background: 'var(--bg-body)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            maxWidth: '600px',
            margin: '0 auto 28px',
            textAlign: 'left',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16
          }}>
            <div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Role &amp; Domain</p>
              <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{completedSummary?.job_role || jobRole}</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{completedSummary?.domain || domain}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Interview Configuration</p>
              <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{completedSummary?.interview_type || interviewType}</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{completedSummary?.difficulty || difficulty} Level</p>
            </div>
            <div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Questions Completed</p>
              <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                {completedSummary?.completed_questions ?? numQuestions} of {completedSummary?.total_questions ?? numQuestions}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Practice Duration</p>
              <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{formatSeconds(completedSummary?.duration)}</p>
            </div>
          </div>

          {/* Explicit No Feedback Policy Reminder Box */}
          <div style={{
            background: 'hsla(215, 20%, 15%, 0.4)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            maxWidth: '600px',
            margin: '0 auto 28px',
            fontSize: '0.84rem',
            color: 'var(--text-muted)',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10
          }}>
            <AlertCircle size={18} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ color: 'var(--text-secondary)' }}>Private Practice Policy:</strong> Mock Interviews are strictly self-directed practice sessions. No official AI scores, feedback reports, strength/weakness evaluations, or recruiter reports are generated.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <button
              onClick={() => setActiveTab('setup')}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                border: 'none', borderRadius: 'var(--radius-md)',
                color: '#fff', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer'
              }}
            >
              Start Another Practice Session
            </button>

            <button
              onClick={() => setActiveTab('history')}
              style={{
                padding: '12px 24px',
                background: 'var(--bg-body)',
                border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer'
              }}
            >
              View Practice History
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 4: PRACTICE HISTORY ── */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: '28px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 600, marginBottom: 6 }}>
            Your Private Practice History
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px' }}>
            Review all your past self-directed practice sessions.
          </p>

          {isLoadingHistory ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <div className="auth-loading-spinner" style={{ margin: '0 auto 12px' }} />
              <p>Loading your practice history...</p>
            </div>
          ) : historyList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', background: 'var(--bg-body)', borderRadius: 'var(--radius-md)' }}>
              <History size={36} color="var(--accent-primary)" style={{ margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4 }}>No Practice Sessions Found</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 16 }}>
                You haven't completed any mock practice sessions yet.
              </p>
              <button
                onClick={() => setActiveTab('setup')}
                style={{
                  padding: '10px 20px', background: 'var(--accent-primary)',
                  border: 'none', borderRadius: 'var(--radius-md)', color: '#fff',
                  fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer'
                }}
              >
                Start Your First Practice Session
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                    <th style={{ padding: '12px 16px' }}>Role / Domain</th>
                    <th style={{ padding: '12px 16px' }}>Type</th>
                    <th style={{ padding: '12px 16px' }}>Questions</th>
                    <th style={{ padding: '12px 16px' }}>Duration</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.job_role}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.domain}</div>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                        {item.interview_type} ({item.difficulty})
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                        {item.completed_questions} / {item.num_questions}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                        {formatSeconds(item.duration)}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span className="sidebar-badge" style={{
                          background: item.status === 'completed' ? 'hsla(142,70%,55%,0.12)' : 'hsla(40,90%,55%,0.12)',
                          color: item.status === 'completed' ? 'hsl(142,70%,60%)' : 'hsl(40,90%,60%)',
                          padding: '4px 8px'
                        }}>
                          {item.status === 'completed' ? 'Completed' : item.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => viewHistoryDetail(item.id)}
                          style={{
                            padding: '6px 12px', background: 'var(--bg-body)',
                            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                            color: 'var(--accent-primary)', fontSize: '0.82rem', cursor: 'pointer',
                            fontWeight: 500
                          }}
                        >
                          View Q&amp;A
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
