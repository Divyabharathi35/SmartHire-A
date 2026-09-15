import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api/apiClient';
import './login.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Icons (inline SVG to avoid extra deps)
function IconZap()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>; }
function IconMail()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>; }
function IconLock()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }
function IconUser()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>; }
function IconEye({ open }) {
  return open
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>;
}
function IconAlert()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>; }
function IconCheck()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>; }
function IconArrow()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>; }

// Role definitions
const ROLES = [
  {
    id: 'candidate',
    label: 'Candidate',
    emoji: '🎯',
    color: 'hsl(252,100%,68%)',
    hVar: '252',
    desc: 'Upload resumes & attend interviews',
  },
  {
    id: 'recruiter',
    label: 'Recruiter',
    emoji: '🔍',
    color: 'hsl(174,80%,55%)',
    hVar: '174',
    desc: 'Review & compare candidates',
  },
  {
    id: 'admin',
    label: 'Admin',
    emoji: '⚙️',
    color: 'hsl(38,95%,60%)',
    hVar: '38',
    desc: 'Manage platform & users',
  },
];

// Password strength calculator
function getPasswordStrength(pwd) {
  if (!pwd) return { score: 0, label: '' };
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[@$!%*?&]/.test(pwd)) score++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const classes = ['', 'weak', 'fair', 'good', 'strong'];
  return { score, label: labels[score], cls: classes[score] };
}

// Google icon (official colors)
function IconGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// GitHub icon
function IconGitHub() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
}

export default function LoginPage({ onSuccess }) {
  const { login, register } = useAuth();

  const [tab,         setTab]         = useState('signin'); // 'signin' | 'signup'
  const [role,        setRole]        = useState('candidate');
  const [name,        setName]        = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Password Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep,       setResetStep]       = useState(1); // 1: Email, 2: Token + New Password
  const [resetEmail,      setResetEmail]      = useState('');
  const [resetToken,      setResetToken]      = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [isResetting,     setIsResetting]     = useState(false);
  const [resetMsg,        setResetMsg]        = useState('');
  const [resetErr,        setResetErr]        = useState('');

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setResetErr('');
    setResetMsg('');
    setIsResetting(true);
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.reset_token) {
          setResetToken(data.reset_token);
          setResetMsg('Reset token generated successfully!');
        } else {
          setResetMsg(data.message);
        }
        setResetStep(2);
      } else {
        setResetErr(data.detail || data.message || 'Failed to request password reset.');
      }
    } catch (err) {
      setResetErr(err.message || 'Network error requesting password reset.');
    } finally {
      setIsResetting(false);
    }
  };

  const handlePerformReset = async (e) => {
    e.preventDefault();
    setResetErr('');
    setResetMsg('');
    setIsResetting(true);
    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken.trim(), new_password: newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetMsg('Password reset successfully! You can now log in.');
        setEmail(resetEmail);
        setTimeout(() => {
          setShowResetModal(false);
          setResetStep(1);
          setResetMsg('');
        }, 2000);
      } else {
        setResetErr(data.detail || data.message || 'Failed to reset password.');
      }
    } catch (err) {
      setResetErr(err.message || 'Network error resetting password.');
    } finally {
      setIsResetting(false);
    }
  };

  // Pick up OAuth error from sessionStorage (set by AuthContext on redirect)
  useEffect(() => {
    const oauthErr = sessionStorage.getItem('oauth_error');
    if (oauthErr) {
      setError(oauthErr);
      sessionStorage.removeItem('oauth_error');
    }
  }, []);

  const pwdStrength = getPasswordStrength(password);

  // ── Client-side validation ──
  function validate() {
    const errs = {};
    if (tab === 'signup' && !name.trim()) errs.name = 'Full name is required';
    if (!email.trim()) errs.email = 'Email address is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email address';
    if (!password) errs.password = 'Password is required';
    if (tab === 'signup' && password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (tab === 'signup' && !/[@$!%*?&]/.test(password)) errs.password = 'Add a special character (@$!%*?&)';
    return errs;
  }

  // ── Submit handler ──
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const errs = validate();
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }

    setIsLoading(true);
    try {
      let user;
      if (tab === 'signin') {
        user = await login(email.trim(), password);
      } else {
        user = await register(name.trim(), email.trim(), password, role);
      }
      onSuccess(user.role);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function switchTab(t) {
    setTab(t);
    setError('');
    setFieldErrors({});
    setPassword('');
  }

  const selectedRole = ROLES.find(r => r.id === role);

  return (
    <div className="auth-page">
      {/* Background effects */}
      <div className="auth-bg-orb auth-bg-orb-1" />
      <div className="auth-bg-orb auth-bg-orb-2" />
      <div className="auth-bg-orb auth-bg-orb-3" />
      <div className="auth-grid" />

      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <IconZap />
          </div>
          <span className="auth-logo-text">SmartHire</span>
          <span className="auth-logo-badge">AI</span>
        </div>

        {/* Heading */}
        <h1 className="auth-heading">
          {tab === 'signin' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="auth-subheading">
          {tab === 'signin'
            ? 'Sign in to your SmartHire workspace'
            : 'Join SmartHire and start your journey'}
        </p>

        {/* Tab switcher */}
        <div className="auth-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'signin'}
            className={`auth-tab ${tab === 'signin' ? 'active' : ''}`}
            onClick={() => switchTab('signin')}
            id="tab-signin"
          >
            Sign In
          </button>
          <button
            role="tab"
            aria-selected={tab === 'signup'}
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => switchTab('signup')}
            id="tab-signup"
          >
            Sign Up
          </button>
        </div>

        {/* Role selector — only on signup */}
        {tab === 'signup' && (
          <div className="role-selector" role="group" aria-label="Select your role">
            {ROLES.map(r => (
              <button
                key={r.id}
                type="button"
                className={`role-option ${role === r.id ? 'selected' : ''}`}
                onClick={() => setRole(r.id)}
                id={`role-option-${r.id}`}
                style={{
                  '--role-color': r.color,
                  '--role-color-h': r.hVar,
                }}
                title={r.desc}
              >
                <div className="role-option-icon">{r.emoji}</div>
                {r.label}
              </button>
            ))}
          </div>
        )}

        {/* Alert */}
        {error && (
          <div className="auth-alert error" role="alert">
            <IconAlert />{error}
          </div>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>

          {/* Name — signup only */}
          {tab === 'signup' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-name">Full Name</label>
              <div className="form-input-wrap">
                <span className="form-input-icon"><IconUser /></span>
                <input
                  id="auth-name"
                  type="text"
                  className={`form-input ${fieldErrors.name ? 'error' : ''}`}
                  placeholder="John Doe"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="name"
                  disabled={isLoading}
                />
              </div>
              {fieldErrors.name && <span className="field-error"><IconAlert />{fieldErrors.name}</span>}
            </div>
          )}

          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="auth-email">Email Address</label>
            <div className="form-input-wrap">
              <span className="form-input-icon"><IconMail /></span>
              <input
                id="auth-email"
                type="email"
                className={`form-input ${fieldErrors.email ? 'error' : ''}`}
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                disabled={isLoading}
              />
            </div>
            {fieldErrors.email && <span className="field-error"><IconAlert />{fieldErrors.email}</span>}
          </div>

          {/* Password */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="auth-password" style={{ marginBottom: 0 }}>Password</label>
              {tab === 'signin' && (
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <div className="form-input-wrap" style={{ marginTop: 6 }}>
              <span className="form-input-icon"><IconLock /></span>
              <input
                id="auth-password"
                type={showPwd ? 'text' : 'password'}
                className={`form-input ${fieldErrors.password ? 'error' : ''}`}
                placeholder={tab === 'signup' ? 'Min. 8 chars + symbol' : 'Enter your password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                disabled={isLoading}
              />
              <button
                type="button"
                className="input-eye-btn"
                onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                <IconEye open={showPwd} />
              </button>
            </div>
            {fieldErrors.password && <span className="field-error"><IconAlert />{fieldErrors.password}</span>}

            {/* Strength meter — signup only */}
            {tab === 'signup' && password && (
              <div className="pwd-strength">
                <div className="pwd-strength-bars">
                  {[1,2,3,4].map(i => (
                    <div
                      key={i}
                      className={`pwd-bar ${i <= pwdStrength.score ? `filled-${pwdStrength.cls}` : ''}`}
                    />
                  ))}
                </div>
                <span className="pwd-strength-label">{pwdStrength.label} password</span>
              </div>
            )}
          </div>

          {/* Role reminder on signin */}
          {tab === 'signin' && (
            <div style={{ fontSize: 12, color: 'hsl(220,15%,50%)', marginTop: -4 }}>
              🔒 Your role is determined by your account settings
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="auth-submit-btn"
            id="auth-submit-btn"
            disabled={isLoading}
            style={tab === 'signup' ? { background: `linear-gradient(135deg, ${selectedRole?.color}, hsl(280,90%,65%))` } : {}}
          >
            {isLoading
              ? <><div className="btn-spinner" /> {tab === 'signin' ? 'Signing in…' : 'Creating account…'}</>
              : tab === 'signin'
                ? <><IconArrow /> Sign In</>
                : <><IconCheck /> Create Account</>
            }
          </button>
        </form>

        {/* Social login divider & buttons */}
        <div className="auth-divider">or continue with</div>

        <div className="social-buttons">
          <button
            type="button"
            className="social-btn social-btn-google"
            id="btn-google-login"
            onClick={() => { window.location.href = `${API_BASE}/api/auth/google`; }}
            disabled={isLoading}
          >
            <IconGoogle />
            Google
          </button>
          <button
            type="button"
            className="social-btn social-btn-github"
            id="btn-github-login"
            onClick={() => { window.location.href = `${API_BASE}/api/auth/github`; }}
            disabled={isLoading}
          >
            <IconGitHub />
            GitHub
          </button>
        </div>

        {/* Footer */}
        <div className="auth-footer">
          {tab === 'signin'
            ? <>Don't have an account? <a onClick={() => switchTab('signup')} role="button" tabIndex={0}>Sign up free</a></>
            : <>Already have an account? <a onClick={() => switchTab('signin')} role="button" tabIndex={0}>Sign in</a></>
          }
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: 16
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 440, padding: 28,
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)', position: 'relative'
          }}>
            <button
              onClick={() => { setShowResetModal(false); setResetStep(1); setResetMsg(''); setResetErr(''); }}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
            >
              ✕
            </button>

            <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
              {resetStep === 1 ? '🔑 Reset Your Password' : '🔒 Set New Password'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              {resetStep === 1
                ? 'Enter your registered email address to receive password reset instructions.'
                : 'Enter your reset token and new password.'}
            </p>

            {resetErr && (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'hsla(0,84%,60%,0.12)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', fontSize: '0.82rem', marginBottom: 16 }}>
                {resetErr}
              </div>
            )}
            {resetMsg && (
              <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'hsla(142,70%,55%,0.12)', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', fontSize: '0.82rem', marginBottom: 16 }}>
                {resetMsg}
              </div>
            )}

            {resetStep === 1 ? (
              <form onSubmit={handleRequestReset}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={isResetting}
                  style={{ marginTop: 12 }}
                >
                  {isResetting ? 'Requesting Token...' : 'Generate Reset Token'}
                </button>
              </form>
            ) : (
              <form onSubmit={handlePerformReset}>
                <div className="form-group">
                  <label className="form-label">Reset Token</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Paste reset token here"
                    value={resetToken}
                    onChange={e => setResetToken(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Min 8 chars, 1 uppercase, 1 symbol"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={isResetting}
                  style={{ marginTop: 12 }}
                >
                  {isResetting ? 'Resetting Password...' : 'Confirm Reset Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
