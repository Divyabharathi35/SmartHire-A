// ============================================================
//  InterviewSummary.jsx — Candidate Self-Report
//  Shows ONLY: Interview Summary | Score Card | AI Coaching
//
//  NOT shown to candidates (recruiter/admin only):
//  - Emotion detection / facial analysis
//  - Behavior & eye-contact analysis
//  - Speech analytics (WPM, filler words)
//  - Proctoring & integrity events
//  - Recorded video / audio playback
//  - Per-question transcripts
// ============================================================
import { useState, useEffect } from 'react';
import {
  Award, CheckCircle, AlertTriangle, ArrowLeft,
  TrendingUp, BookOpen, Clock, User, Briefcase,
  Target, Star, ChevronDown, ChevronUp, Lightbulb,
  BookMarked, Zap, Download, Loader2
} from 'lucide-react';


import ErrorBoundary from '../common/ErrorBoundary';

// ── Utility helpers ───────────────────────────────────────────
const formatSecs = (secs) => {
  if (secs === undefined || secs === null || isNaN(secs)) return '—';
  const m = Math.floor((secs || 0) / 60);
  const s = (secs || 0) % 60;
  return `${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
};

const parseList = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [p]; }
  catch { return [String(val)]; }
};

const scoreColor = (score) => {
  if (score === null || score === undefined) return 'var(--text-muted)';
  if (score >= 85) return 'var(--accent-green)';
  if (score >= 70) return 'var(--accent-primary)';
  if (score >= 55) return 'var(--accent-amber)';
  return 'var(--accent-rose)';
};

// ── Score Ring SVG ────────────────────────────────────────────
function ScoreRing({ score, size = 110 }) {
  const numeric = score !== null && score !== undefined ? parseFloat(score) : null;
  if (numeric === null || isNaN(numeric)) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: '3px dashed var(--border-medium)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', color: 'var(--text-muted)'
      }}>N/A</div>
    );
  }
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const offset = circ - (numeric / 100) * circ;
  const color = scoreColor(numeric);
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--border-medium)" strokeWidth={7} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={7}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transformOrigin: `${size / 2}px ${size / 2}px`,
          transform: 'rotate(-90deg)',
          transition: 'stroke-dashoffset 1.2s ease'
        }}
      />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle"
        fill={color} fontSize="18" fontFamily="var(--font-heading)" fontWeight="800">
        {Math.round(numeric)}
      </text>
      <text x={size / 2} y={size / 2 + 13} textAnchor="middle"
        fill="var(--text-muted)" fontSize="10" fontFamily="var(--font-heading)">
        / 100
      </text>
    </svg>
  );
}

// ── Mini score card ───────────────────────────────────────────
function MiniScore({ label, score, weight }) {
  const numeric = score !== null && score !== undefined ? Math.round(parseFloat(score)) : null;
  const color = scoreColor(numeric);
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: '16px',
      display: 'flex', flexDirection: 'column', gap: 6
    }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
        {weight && <span style={{ marginLeft: 4, opacity: 0.6 }}>({weight})</span>}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color }}>
        {numeric !== null ? `${numeric}` : '—'}
        {numeric !== null && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 2 }}>/100</span>}
      </div>
      {numeric !== null && (
        <div style={{ height: 4, borderRadius: 2, background: 'var(--border-subtle)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${numeric}%`,
            background: color,
            borderRadius: 2,
            transition: 'width 1.2s ease'
          }} />
        </div>
      )}
    </div>
  );
}

// ── List Section card ─────────────────────────────────────────
function FeedbackSection({ title, icon: Icon, items, accentColor, borderColor }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: `1px solid ${borderColor || 'var(--border-subtle)'}`,
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden'
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', color: accentColor || 'var(--text-primary)'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', fontWeight: 700 }}>
          {Icon && <Icon size={16} />}
          {title}
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px' }}>
          {items && items.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.75, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              None recorded for this session.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Summary metadata row ──────────────────────────────────────
function MetaRow({ icon: Icon, label, value }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0', borderBottom: '1px solid var(--border-subtle)'
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.87rem', color: 'var(--text-muted)' }}>
        {Icon && <Icon size={14} />} {label}
      </span>
      <strong style={{ fontSize: '0.87rem', color: 'var(--text-primary)' }}>{value || '—'}</strong>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function InterviewSummary({ session: sessionProp, onBack }) {
  const session = sessionProp || {};
  const {
    id: sessionId, job_role, domain, interview_type, difficulty,
    score, duration, questions = [], started_at, ended_at,
    auto_expired, status, created_at,
  } = session;
  const id = sessionId || session.session_id;

  const [fetchedResult, setFetchedResult] = useState(null);
  const [loadingResult, setLoadingResult] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchResults = async () => {
      setLoadingResult(true);
      try {
        const res = await apiFetch(`/api/interviews/sessions/${id}/results`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.result) {
            setFetchedResult(data.result);
          }
        }
      } catch (err) {
        console.error('[InterviewSummary] Error fetching results:', err);
      } finally {
        setLoadingResult(false);
      }
    };

    fetchResults();
  }, [id, API_BASE]);

  // ── Derive duration ───────────────────────────────────────
  let totalDurationSecs = duration || 0;
  if (!totalDurationSecs && started_at && ended_at) {
    const s = new Date(started_at).getTime();
    const e = new Date(ended_at).getTime();
    if (!isNaN(s) && !isNaN(e)) totalDurationSecs = Math.max(0, Math.floor((e - s) / 1000));
  }

  // ── Scores from session.result or fetchedResult ────────────
  const resultData = fetchedResult || session?.result;
  const rawOverall = resultData?.overall_score ?? score;
  const overallScore = rawOverall !== null && rawOverall !== undefined ? Math.round(parseFloat(rawOverall)) : null;
  const commScore = resultData?.communication_score !== undefined && resultData?.communication_score !== null
    ? Math.round(parseFloat(resultData.communication_score)) : null;
  const confScore = resultData?.confidence_score !== undefined && resultData?.confidence_score !== null
    ? Math.round(parseFloat(resultData.confidence_score)) : null;
  const techScore = resultData?.technical_relevance_score !== undefined && resultData?.technical_relevance_score !== null
    ? Math.round(parseFloat(resultData.technical_relevance_score)) : null;
  const profScore = resultData?.professionalism_score !== undefined && resultData?.professionalism_score !== null
    ? Math.round(parseFloat(resultData.professionalism_score)) : null;

  const rating = resultData?.performance_rating
    || session?.recommendation
    || (overallScore >= 90 ? 'Excellent' : overallScore >= 75 ? 'Good' : overallScore >= 60 ? 'Average' : overallScore >= 40 ? 'Needs Improvement' : overallScore !== null ? 'Poor' : 'Under Review');

  // ── AI Feedback lists ─────────────────────────────────────
  const strengths            = parseList(resultData?.strengths);
  const weaknesses           = parseList(resultData?.weaknesses);
  const improvementSuggestions = parseList(resultData?.improvement_suggestions);
  const practiceRecommendations = parseList(resultData?.practice_recommendations);
  const learningResources    = parseList(resultData?.learning_resources);

  const hasAiFeedback = resultData && (
    strengths.length > 0 || weaknesses.length > 0 ||
    improvementSuggestions.length > 0 || practiceRecommendations.length > 0 || learningResources.length > 0
  );

  // ── Questions answered ────────────────────────────────────
  const totalQuestions  = questions.length;
  const answeredQuestions = questions.filter(q => q.user_answer && q.user_answer.trim() !== '').length;

  const assessmentDate = ended_at
    ? new Date(ended_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : created_at
    ? new Date(created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  const handleDownloadPdf = async () => {
    if (downloadingPdf || !id) return;
    setDownloadingPdf(true);
    setPdfError(null);
    try {
      const res = await apiFetch(`/api/candidate/interviews/${id}/report.pdf`, {
        method: 'GET'
      });

      if (!res.ok) {
        const errTxt = await res.text().catch(() => '');
        let detail = 'Failed to generate PDF report.';
        try {
          const jsonErr = JSON.parse(errTxt);
          detail = jsonErr.detail || detail;
        } catch {
          if (errTxt) detail = errTxt;
        }
        throw new Error(detail);
      }

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
    } catch (err) {
      console.error('[Download PDF] Error:', err);
      setPdfError(err.message || 'Error generating PDF report. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <ErrorBoundary onBack={onBack}>
      <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>

        {/* Top Header Controls */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12, marginBottom: 20
        }}>
          <button
            id="btn-back-to-dashboard"
            onClick={onBack}
            style={{
              background: 'none', border: 'none', color: 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.85rem', padding: 0
            }}
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>

          <button
            id="btn-download-report-pdf"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 18px',
              borderRadius: 'var(--radius-md, 8px)',
              background: downloadingPdf ? 'var(--bg-card, #334155)' : 'linear-gradient(135deg, var(--accent-primary, #6366F1), #4F46E5)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              cursor: downloadingPdf ? 'not-allowed' : 'pointer',
              opacity: downloadingPdf ? 0.75 : 1,
              boxShadow: '0 2px 10px rgba(99,102,241,0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            {downloadingPdf ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Generating PDF…
              </>
            ) : (
              <>
                <Download size={16} /> Download Report PDF
              </>
            )}
          </button>
        </div>

        {/* PDF Error Alert */}
        {pdfError && (
          <div style={{
            background: 'hsla(0,84%,60%,0.12)', border: '1px solid var(--accent-rose, #ef4444)',
            borderRadius: 'var(--radius-md, 8px)', padding: '12px 16px', marginBottom: 20,
            color: 'var(--accent-rose, #ef4444)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} />
              <span>{pdfError}</span>
            </div>
            <button onClick={() => setPdfError(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}>✕</button>
          </div>
        )}


        {/* Auto-expiry notice */}
        {auto_expired && (
          <div style={{
            background: 'hsla(38,95%,60%,0.12)', border: '1px solid var(--accent-amber)',
            borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: 20,
            color: 'var(--accent-amber)', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 10
          }}>
            <AlertTriangle size={20} />
            <div>
              <strong>Interview time has ended.</strong>
              <p style={{ fontSize: '0.82rem', margin: 0, opacity: 0.85 }}>
                The session timer reached zero. All recorded answers and timing data were saved.
              </p>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────
            SECTION 1 — INTERVIEW SUMMARY
        ──────────────────────────────────────────────────── */}
        <section id="candidate-interview-summary" style={{ marginBottom: 28 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14
          }}>
            <Briefcase size={18} color="var(--accent-primary)" />
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
              Interview Summary
            </h2>
          </div>

          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)', padding: '20px 24px'
          }}>
            <MetaRow icon={User}      label="Interview Status"  value={
              <span style={{
                padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem',
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                background: status?.toLowerCase() === 'completed' ? 'hsla(142,70%,55%,0.12)' : 'hsla(38,95%,60%,0.12)',
                color: status?.toLowerCase() === 'completed' ? 'var(--accent-green)' : 'var(--accent-amber)'
              }}>
                {status || 'Unknown'}
              </span>
            } />
            <MetaRow icon={Clock}     label="Assessment Date"   value={assessmentDate} />
            <MetaRow icon={Briefcase} label="Target Role"       value={job_role || '—'} />
            <MetaRow icon={Target}    label="Domain"            value={domain || '—'} />
            <MetaRow icon={Star}      label="Interview Type"    value={interview_type || '—'} />
            <MetaRow icon={Zap}       label="Difficulty"        value={difficulty || '—'} />
            <MetaRow icon={Clock}     label="Total Duration"    value={formatSecs(totalDurationSecs)} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, fontSize: '0.87rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                <CheckCircle size={14} /> Questions Completed
              </span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {answeredQuestions} / {totalQuestions || '—'}
              </strong>
            </div>
          </div>
        </section>

        {/* ────────────────────────────────────────────────────
            SECTION 2 — SCORE CARD & EXECUTIVE ASSESSMENT
        ──────────────────────────────────────────────────── */}
        <section id="candidate-scorecard" style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Award size={18} color="var(--accent-primary)" />
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
              Candidate Score Card &amp; Executive Assessment
            </h2>
          </div>

          {/* Overall score hero */}
          <div style={{
            background: 'linear-gradient(135deg, hsla(252,100%,68%,0.12), hsla(280,90%,65%,0.12))',
            border: '1px solid var(--border-accent)',
            borderRadius: 'var(--radius-lg)', padding: '24px 28px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 24, marginBottom: 18
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Overall Final Score
              </div>
              <div style={{ fontSize: '2.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: overallScore !== null ? scoreColor(overallScore) : 'var(--text-muted)', lineHeight: 1 }}>
                {overallScore !== null ? overallScore : '—'}
                {overallScore !== null && <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginLeft: 4 }}>/100</span>}
              </div>
              <div style={{ marginTop: 8 }}>
                <span style={{
                  display: 'inline-block', padding: '4px 14px', borderRadius: 'var(--radius-full)',
                  fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: 'hsla(252,100%,68%,0.18)', color: 'var(--accent-primary)'
                }}>
                  Recommendation: {rating}
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 10, maxWidth: 380 }}>
                Weighted score: Communication 30% + Confidence 25% + Technical Relevance 30% + Professionalism 15%
              </p>
            </div>
            <ScoreRing score={overallScore} size={120} />
          </div>

          {/* Category breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <MiniScore label="Communication"      score={commScore} weight="30%" />
            <MiniScore label="Confidence"         score={confScore} weight="25%" />
            <MiniScore label="Technical Relevance" score={techScore} weight="30%" />
            <MiniScore label="Professionalism"    score={profScore} weight="15%" />
          </div>
        </section>

        {/* ────────────────────────────────────────────────────
            SECTION 3 — GROUNDED AI CANDIDATE EVALUATION
        ──────────────────────────────────────────────────── */}
        <section id="candidate-ai-coaching" style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Lightbulb size={18} color="var(--accent-amber)" />
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
              Grounded AI Candidate Evaluation &amp; Coaching
            </h2>
          </div>

          {resultData?.ai_provider || resultData?.ai_model || resultData?.feedback_generated_at ? (
            <div style={{
              display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.78rem',
              color: 'var(--text-muted)', marginBottom: 14,
              background: 'var(--bg-elevated)', padding: '10px 14px',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)'
            }}>
              {resultData?.ai_provider && (
                <span>🤖 Provider: <strong style={{ color: 'var(--text-secondary)' }}>{resultData.ai_provider}</strong></span>
              )}
              {resultData?.ai_model && (
                <span>📦 Model: <strong style={{ color: 'var(--text-secondary)' }}>{resultData.ai_model}</strong></span>
              )}
              {resultData?.feedback_generated_at && (
                <span>🕐 Generated: <strong style={{ color: 'var(--text-secondary)' }}>
                  {new Date(resultData.feedback_generated_at).toLocaleString()}
                </strong></span>
              )}
            </div>
          ) : null}

          {!hasAiFeedback ? (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)', padding: '24px',
              textAlign: 'center', color: 'var(--text-muted)'
            }}>
              <Lightbulb size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                AI Evaluation is being generated…
              </p>
              <p style={{ fontSize: '0.82rem', marginTop: 4 }}>
                AI feedback will appear here once your session has been fully evaluated.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FeedbackSection
                title="Key Candidate Strengths"
                icon={TrendingUp}
                items={strengths}
                accentColor="var(--accent-green)"
                borderColor="rgba(16,185,129,0.25)"
              />
              <FeedbackSection
                title="Weaknesses &amp; Areas for Improvement"
                icon={AlertTriangle}
                items={weaknesses}
                accentColor="var(--accent-amber)"
                borderColor="rgba(245,158,11,0.25)"
              />
              <FeedbackSection
                title="Improvement Suggestions"
                icon={Lightbulb}
                items={improvementSuggestions}
                accentColor="var(--accent-primary)"
                borderColor="rgba(99,102,241,0.25)"
              />
              <FeedbackSection
                title="Practice Recommendations"
                icon={BookOpen}
                items={practiceRecommendations}
                accentColor="var(--accent-teal)"
                borderColor="rgba(20,184,166,0.25)"
              />
              <FeedbackSection
                title="Learning Resources"
                icon={BookMarked}
                items={learningResources}
                accentColor="var(--accent-secondary)"
                borderColor="rgba(139,92,246,0.25)"
              />
            </div>
          )}
        </section>

      </div>
    </ErrorBoundary>
  );
}
