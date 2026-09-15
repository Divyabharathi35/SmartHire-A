// ============================================================
//  InterviewGenerator.jsx — Recruiter/Admin AI Interview Question Generator
// ============================================================
import { useState, useEffect } from 'react';
import { Sparkles, Cpu, BookOpen, Layers, Target, FileText, CheckCircle, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';
import QuestionPreview from './QuestionPreview';
import InterviewSession from './InterviewSession';

const INTERVIEW_TYPES = [
  { id: 'Technical Interview', label: 'Technical Interview', desc: 'Core engineering concepts, coding logic, system design & algorithms' },
  { id: 'HR Interview',        label: 'HR Interview',        desc: 'Cultural fit, career background, motivation & workplace expectations' },
  { id: 'Behavioral Interview',  label: 'Behavioral Interview',  desc: 'STAR-format questions on leadership, conflict & adaptability' },
  { id: 'Aptitude Interview',   label: 'Aptitude Interview',   desc: 'Quantitative reasoning, problem solving & logical deduction' },
];

const DIFFICULTY_LEVELS = [
  { id: 'Easy',   label: 'Easy',   color: 'hsl(142,70%,55%)' },
  { id: 'Medium', label: 'Medium', color: 'hsl(38,95%,60%)' },
  { id: 'Hard',   label: 'Hard',   color: 'hsl(350,90%,65%)' },
  { id: 'Expert', label: 'Expert', color: 'hsl(280,90%,65%)' },
];

const EXPERIENCE_LEVELS = ['Entry Level (0-2 yrs)', 'Mid Level (3-5 yrs)', 'Senior Level (5+ yrs)', 'Lead / Executive'];

const DOMAINS = [
  'Software Development',
  'AI/ML',
  'Data Science',
  'Cloud',
  'Cyber Security',
  'DevOps',
  'UI/UX',
  'Finance',
  'Healthcare',
  'Marketing',
  'HR',
  'Other',
];

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function InterviewGenerator({ onSessionStart }) {
  const [jobRole, setJobRole]               = useState('Senior Full Stack Developer');
  const [domain, setDomain]                 = useState('Software Development');
  const [interviewType, setInterviewType]   = useState('Technical Interview');
  const [difficulty, setDifficulty]         = useState('Medium');
  const [experienceLevel, setExperienceLevel] = useState('Mid Level (3-5 yrs)');
  const [numQuestions, setNumQuestions]     = useState(5);
  const [userSkills, setUserSkills]         = useState('React, Node.js, TypeScript, PostgreSQL, REST APIs');
  const [jobDescription, setJobDescription] = useState('Looking for an experienced engineer to lead modern web app architecture.');
  const [resumeText, setResumeText]         = useState('5+ years full stack engineering experience building scalable microservices.');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');

  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState(null);
  const [activeSession, setActiveSession]           = useState(null);

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/candidates`, {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCandidates(data);
      }
    } catch (_e) {
      /* ignore */
    }
  };

  const handleGenerateQuestions = async (e) => {
    e?.preventDefault();
    if (!jobRole.trim()) {
      setError('Please provide a Job Role');
      return;
    }
    setError('');
    setLoading(true);

    const payload = {
      job_role: jobRole,
      domain,
      interview_type: interviewType,
      difficulty,
      experience_level: experienceLevel,
      num_questions: parseInt(numQuestions, 10),
      user_skills: userSkills,
      job_description: jobDescription,
      resume_text: resumeText,
      generation_seed: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };

    console.log('[AI Question Generator] Sending payload to /api/questions/generate:', payload);

    try {
      const res = await fetch(`${API_BASE}/api/questions/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned ${res.status}: Failed to generate AI questions`);
      }

      let questions = await res.json();

      // Frontend validation for HR Interview type
      const isHr = interviewType === 'HR Interview' || interviewType.toLowerCase().includes('hr');
      if (isHr && Array.isArray(questions)) {
        const techKeywords = [
          'coding', 'programming', 'algorithm', 'data structure', 'system design',
          'sql', 'database', 'api', 'react', 'javascript', 'python', 'memory leak',
          'memory management', 'debugging', 'microservice', 'architecture', 'restful',
          'async i/o', 'concurrency', 'thread', 'process', 'compiler', 'query optimization'
        ];
        const hrFallbacks = [
          "Tell us about your professional background and why you are interested in this role.",
          "What are your key professional strengths, and what is one area you are actively working to improve?",
          "Where do you see your career progressing over the next 3 to 5 years?",
          "How do you maintain work-life balance and handle tight project deadlines under pressure?",
          "Describe a conflict you handled at work or a disagreement with a team member. How was it resolved?",
          "Why should SmartHire hire you for this position, and what unique value do you bring to our team culture?"
        ];
        let fallbackIdx = 0;
        questions = questions.map((q, idx) => {
          const qText = (q.question_text || '').toLowerCase();
          const isTech = techKeywords.some(kw => qText.includes(kw));
          if (isTech) {
            const replacementText = hrFallbacks[fallbackIdx % hrFallbacks.length];
            fallbackIdx++;
            return {
              ...q,
              question_number: idx + 1,
              question_text: replacementText,
              interview_type: 'HR Interview',
              category: 'HR & Interpersonal',
              expected_answer_points: ['Career background', 'Alignment with team culture', 'Clear communication'],
              sample_answer: 'A comprehensive HR response highlighting professional experience, personal values, and growth goals.'
            };
          }
          return { ...q, interview_type: 'HR Interview' };
        });
      }

      console.log('[AI Question Generator] Successfully received fresh questions:', questions);
      setGeneratedQuestions(questions);
      return questions;
    } catch (err) {
      console.error('[AI Question Generator] Error during question generation:', err);
      let friendlyMsg = err.message || 'Error generating questions';
      if (err.message === 'Failed to fetch') {
        friendlyMsg = `Failed to connect to backend AI server (${API_BASE}). Please check if FastAPI server is running.`;
      }
      // The backend now returns specific, safe error categories in the detail field.
      // Display the backend message directly — it never contains secrets.
      // No longer override with a generic "AI service temporarily unavailable" message.
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (finalQuestions, assignedCandidateId) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          job_role: jobRole,
          domain,
          interview_type: interviewType,
          difficulty,
          experience_level: experienceLevel,
          num_questions: parseInt(numQuestions, 10),
          user_skills: userSkills,
          job_description: jobDescription,
          resume_text: resumeText,
          candidate_id: assignedCandidateId || selectedCandidateId || null,
          questions: finalQuestions || generatedQuestions,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to create interview session');
      }

      const session = await res.json();
      setActiveSession(session);
      if (onSessionStart) onSessionStart(session);
    } catch (err) {
      setError(err.message || 'Error creating session');
    } finally {
      setLoading(false);
    }
  };

  if (activeSession) {
    return <InterviewSession session={activeSession} onBackToGenerator={() => setActiveSession(null)} />;
  }

  if (generatedQuestions) {
    return (
      <QuestionPreview
        initialQuestions={generatedQuestions}
        jobRole={jobRole}
        domain={domain}
        interviewType={interviewType}
        difficulty={difficulty}
        experienceLevel={experienceLevel}
        candidates={candidates}
        selectedCandidateId={selectedCandidateId}
        onRegenerate={handleGenerateQuestions}
        onConfirm={handleCreateSession}
        onBack={() => setGeneratedQuestions(null)}
        loading={loading}
      />
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, hsla(252,100%,68%,0.15), hsla(280,90%,65%,0.15))',
        border: '1px solid var(--border-accent)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px',
        marginBottom: '28px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
          }}>
            <Sparkles size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Recruiter &amp; Admin AI Interview Generator
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Design customized interview sessions, generate AI questions via Gemini, edit questions, and assign directly to candidates.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'hsla(350,90%,65%,0.1)',
          border: '1px solid var(--accent-rose)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: 10,
          color: 'var(--accent-rose)', fontSize: '0.9rem'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleGenerateQuestions} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Step 1: Target Role, Domain & Candidate Assignment */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Cpu size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
              1. Role, Domain &amp; Candidate Assignment
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Target Job Role *
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Senior Frontend Engineer, Data Scientist"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                required
                style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Domain Customization
              </label>
              <select
                className="input"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: '#fff' }}
              >
                {DOMAINS.map((d) => (
                  <option key={d} value={d} style={{ background: 'var(--bg-card)' }}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Assign to Candidate (Optional)
              </label>
              <select
                className="input"
                value={selectedCandidateId}
                onChange={(e) => setSelectedCandidateId(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: '#fff' }}
              >
                <option value="" style={{ background: 'var(--bg-card)' }}>-- Select Candidate --</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id} style={{ background: 'var(--bg-card)' }}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Step 2: Interview Type, Difficulty & Experience Level */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Layers size={20} color="var(--accent-teal)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
              2. Type, Difficulty &amp; Experience Expectations
            </h3>
          </div>

          {/* Type Selection Grid */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Select Interview Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              {INTERVIEW_TYPES.map((t) => {
                const selected = interviewType === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setInterviewType(t.id)}
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      background: selected ? 'hsla(252,100%,68%,0.12)' : 'var(--bg-surface)',
                      border: selected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'var(--transition-fast)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: selected ? 'var(--accent-primary)' : 'var(--text-primary)', fontSize: '0.95rem' }}>
                        {t.label}
                      </span>
                      {selected && <CheckCircle size={18} color="var(--accent-primary)" />}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {t.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Difficulty & Experience & Question Count */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Difficulty Selection
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {DIFFICULTY_LEVELS.map((d) => {
                  const selected = difficulty === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficulty(d.id)}
                      style={{
                        flex: 1,
                        padding: '10px 4px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        border: selected ? `2px solid ${d.color}` : '1px solid var(--border-subtle)',
                        background: selected ? 'var(--bg-elevated)' : 'var(--bg-input)',
                        color: selected ? d.color : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Experience Expectation
              </label>
              <select
                className="input"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: '#fff' }}
              >
                {EXPERIENCE_LEVELS.map(exp => (
                  <option key={exp} value={exp} style={{ background: 'var(--bg-card)' }}>{exp}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Number of Questions
              </label>
              <select
                className="input"
                value={numQuestions}
                onChange={(e) => setNumQuestions(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: '#fff' }}
              >
                <option value={3}>3 Questions</option>
                <option value={5}>5 Questions (Standard)</option>
                <option value={8}>8 Questions</option>
                <option value={10}>10 Questions</option>
              </select>
            </div>
          </div>
        </div>

        {/* Step 3: Context & Resume / Job Description */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <FileText size={20} color="var(--accent-amber)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
              3. Required Skills, Resume &amp; Job Description Context
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Required Candidate Skills
              </label>
              <input
                type="text"
                className="input"
                placeholder="Comma separated skills (e.g., Python, Kubernetes, System Design)"
                value={userSkills}
                onChange={(e) => setUserSkills(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: '#fff' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Job Description Context
                </label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Paste relevant job description requirements or responsibilities..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: '#fff', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Candidate Resume / Profile Summary (Optional)
                </label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Paste resume experience or key project highlights..."
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: '#fff', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14 }}>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              padding: '14px 28px',
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              border: 'none',
              color: '#fff',
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            {loading ? (
              <>
                <div className="auth-loading-spinner" style={{ width: 18, height: 18, borderTopColor: '#fff' }} />
                <span>Generating AI Questions...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>Generate &amp; Review Questions</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
