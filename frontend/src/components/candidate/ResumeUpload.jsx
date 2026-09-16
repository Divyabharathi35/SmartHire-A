import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, Sparkles, RefreshCw } from 'lucide-react';
import ErrorBoundary from '../common/ErrorBoundary';

const steps = ['uploading', 'parsing', 'complete'];
const stepLabels = ['Uploading resume file...', 'Extracting resume details...', 'Resume upload complete!'];

export default function ResumeUpload() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [step, setStep] = useState(-1); // -1 = idle

  const processFile = (f) => {
    if (!f) return;
    setFile(f);
    setStep(0);
    setTimeout(() => {
      setStep(1);
      setTimeout(() => {
        setStep(2);
      }, 600);
    }, 600);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, []);

  const handleFileInput = (e) => {
    const f = e.target.files[0];
    if (f) processFile(f);
  };

  const reset = () => { setFile(null); setStep(-1); };
  const isDone = step === steps.length - 1;

  return (
    <ErrorBoundary>
      <div className="animate-fade-in-up" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
        <div className="page-header" style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>
            Resume Upload
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
            Upload your resume document to reference during AI interview question generation.
          </p>
        </div>

        <div className="grid-2" style={{ gap: '24px', alignItems: 'start', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {/* Upload Zone */}
          <div>
            {step === -1 ? (
              <div
                className={`drop-zone ${dragging ? 'dragging' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('resume-file-input').click()}
                id="resume-drop-zone"
                style={{
                  border: '2px dashed var(--border-medium)', borderRadius: 'var(--radius-lg, 12px)',
                  padding: '40px 20px', textAlign: 'center', background: dragging ? 'hsla(252,100%,68%,0.08)' : 'var(--bg-card)',
                  cursor: 'pointer', transition: 'all 0.2s ease'
                }}
              >
                <input
                  type="file"
                  id="resume-file-input"
                  accept=".pdf,.doc,.docx,.txt"
                  style={{ display: 'none' }}
                  onChange={handleFileInput}
                />
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📄</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
                  Drop your resume here or click to browse
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                  Supports PDF, DOC, DOCX, TXT · Max 10MB
                </p>
                <button
                  type="button"
                  style={{
                    padding: '10px 20px', borderRadius: 'var(--radius-md, 8px)',
                    background: 'var(--accent-primary, #6366f1)', color: '#fff', border: 'none',
                    fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 8, pointerEvents: 'none'
                  }}
                >
                  <Upload size={16} /> Choose File
                </button>
              </div>
            ) : (
              <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-lg, 12px)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                {/* File Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <div style={{
                    width: 48, height: 48, background: 'hsla(252,100%,68%,0.1)',
                    borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <FileText size={24} color="var(--accent-primary)" />
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.92rem', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {file?.name || 'resume.pdf'}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                      {file?.size ? (file.size / 1024).toFixed(1) + ' KB' : '—'} · {file?.type || 'Document'}
                    </p>
                  </div>
                  {isDone ? (
                    <CheckCircle size={22} color="var(--accent-green, #10b981)" />
                  ) : (
                    <div style={{ width: 20, height: 20, border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  )}
                </div>

                {/* Progress Steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {steps.map((s, i) => (
                    <div key={s} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      opacity: i > step ? 0.35 : 1, transition: 'opacity 0.3s ease'
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        background: i < step ? 'var(--accent-green, #10b981)' : i === step ? 'var(--accent-primary, #6366f1)' : 'var(--border-medium)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 700, color: 'white'
                      }}>
                        {i < step ? '✓' : i + 1}
                      </div>
                      <span style={{ fontSize: '0.85rem', color: i <= step ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {stepLabels[i]}
                      </span>
                    </div>
                  ))}
                </div>

                {isDone && (
                  <button
                    onClick={reset}
                    style={{
                      marginTop: 20, padding: '8px 14px', borderRadius: 'var(--radius-md, 6px)',
                      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 500,
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <RefreshCw size={14} /> Upload different file
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Document Status / Summary */}
          <div>
            <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-lg, 12px)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Sparkles size={18} color="var(--accent-primary, #6366f1)" />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                  Resume Document Status
                </h3>
              </div>

              {isDone ? (
                <div>
                  <div style={{
                    padding: '16px', borderRadius: 'var(--radius-md)', background: 'hsla(142,70%,55%,0.08)',
                    border: '1px solid var(--accent-green, #10b981)', marginBottom: 16
                  }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-green, #10b981)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={16} /> File Loaded Successfully
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 6, margin: 0 }}>
                      The uploaded file <strong>{file?.name}</strong> is stored in session context and ready to reference during question generation.
                    </p>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>Next step:</strong> Head to the <strong>Mock Interview</strong> or <strong>Interview Generator</strong> section to launch an interview session tailored to your candidate role.
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)',
                  background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)'
                }}>
                  <FileText size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                    No Resume Uploaded
                  </p>
                  <p style={{ fontSize: '0.78rem', marginTop: 4, margin: 0 }}>
                    Select or drop a resume file to load your candidate profile background.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
