import { useState } from 'react';
import { Plus, Trash2, GripVertical, Clock, Save, ChevronDown, Check } from 'lucide-react';
import ErrorBoundary from '../common/ErrorBoundary';

const ROUND_TYPES = ['Technical', 'HR', 'Behavioral', 'Aptitude'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const DEFAULT_STARTER_QUESTIONS = {
  Technical: [
    { id: 1, text: 'Explain the difference between client-side and server-side rendering.', difficulty: 'Easy' },
    { id: 2, text: 'How does state management differ between local state and global context?', difficulty: 'Medium' },
    { id: 3, text: 'Describe a time you diagnosed and optimized a performance bottleneck in code.', difficulty: 'Hard' }
  ],
  HR: [
    { id: 101, text: 'Walk us through your professional background and key accomplishments.', difficulty: 'Easy' },
    { id: 102, text: 'What environment allows you to produce your best work?', difficulty: 'Easy' },
    { id: 103, text: 'Where do you see your career path progressing over the next 3 years?', difficulty: 'Medium' }
  ],
  Behavioral: [
    { id: 201, text: 'Describe a situation where project priorities changed unexpectedly.', difficulty: 'Medium' },
    { id: 202, text: 'Tell us about a technical disagreement with a colleague and how you resolved it.', difficulty: 'Hard' }
  ],
  Aptitude: [
    { id: 301, text: 'How do you prioritize competing deadlines across multiple high-priority tasks?', difficulty: 'Medium' }
  ]
};

function DifficultyBadge({ diff }) {
  const cls = diff === 'Easy' ? 'difficulty-easy' : diff === 'Medium' ? 'difficulty-medium' : 'difficulty-hard';
  return <span className={`badge ${cls}`} style={{ fontSize: '0.68rem' }}>{diff}</span>;
}

export default function TemplateBuilder() {
  const [activeRound, setActiveRound] = useState('Technical');
  const [questions, setQuestions] = useState(DEFAULT_STARTER_QUESTIONS['Technical']);
  const [newQ, setNewQ] = useState('');
  const [newDiff, setNewDiff] = useState('Medium');
  const [duration, setDuration] = useState(45);
  const [templateName, setTemplateName] = useState('Custom Candidate Interview Template');
  const [saved, setSaved] = useState(false);

  const switchRound = (round) => {
    setActiveRound(round);
    setQuestions(DEFAULT_STARTER_QUESTIONS[round] || []);
  };

  const addQuestion = () => {
    if (!newQ.trim()) return;
    setQuestions(q => [...q, { id: Date.now(), text: newQ, difficulty: newDiff }]);
    setNewQ('');
  };

  const removeQuestion = (id) => setQuestions(q => q.filter(x => x.id !== id));

  const saveTemplate = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <ErrorBoundary>
      <div className="animate-fade-in-up" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
        <div className="page-header" style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
            Interview Template Builder
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
            Design custom interview rounds with specific questions, difficulty levels, and time constraints
          </p>
        </div>

        <div className="grid-2" style={{ gap: '24px', alignItems: 'start', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {/* Builder */}
          <div>
            {/* Template Name */}
            <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-lg, 12px)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', marginBottom: 20 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 16 }}>Template Settings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="form-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Template Name
                  </label>
                  <input
                    id="template-name-input"
                    className="form-control"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    placeholder="e.g. Senior Software Engineer Round"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Target Duration (mins)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Clock size={16} color="var(--text-muted)" />
                      <input
                        id="template-duration-input"
                        type="number"
                        className="form-control"
                        value={duration}
                        onChange={e => setDuration(Number(e.target.value))}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Round Tabs */}
            <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-lg, 12px)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Round Questions</h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  {ROUND_TYPES.map(r => (
                    <button
                      key={r}
                      onClick={() => switchRound(r)}
                      style={{
                        padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', fontWeight: 600,
                        border: activeRound === r ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        background: activeRound === r ? 'hsla(252,100%,68%,0.15)' : 'var(--bg-surface)',
                        color: activeRound === r ? 'var(--accent-primary)' : 'var(--text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Questions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {questions.map((q, i) => (
                  <div
                    key={q.id}
                    style={{
                      padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12
                    }}
                  >
                    <GripVertical size={16} color="var(--text-muted)" style={{ cursor: 'grab' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Q{i + 1}.</span>
                    <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{q.text}</span>
                    <DifficultyBadge diff={q.difficulty} />
                    <button
                      onClick={() => removeQuestion(q.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Question Input */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  id="new-question-input"
                  type="text"
                  placeholder="Type new question text..."
                  value={newQ}
                  onChange={e => setNewQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addQuestion()}
                  style={{ flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                />
                <select
                  id="new-question-difficulty"
                  value={newDiff}
                  onChange={e => setNewDiff(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                >
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <button
                  onClick={addQuestion}
                  style={{
                    padding: '10px 16px', borderRadius: 'var(--radius-md)', background: 'var(--accent-primary)',
                    color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6
                  }}
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>
          </div>

          {/* Action Card */}
          <div>
            <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-lg, 12px)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 14 }}>Template Summary</h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <div><strong>Name:</strong> {templateName}</div>
                <div><strong>Round:</strong> {activeRound}</div>
                <div><strong>Total Questions:</strong> {questions.length}</div>
                <div><strong>Target Duration:</strong> {duration} minutes</div>
              </div>
              <button
                onClick={saveTemplate}
                style={{
                  width: '100%', padding: '12px', borderRadius: 'var(--radius-md)',
                  background: saved ? 'var(--accent-green, #10b981)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s ease'
                }}
              >
                {saved ? <><Check size={18} /> Template Saved!</> : <><Save size={18} /> Save Template</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
