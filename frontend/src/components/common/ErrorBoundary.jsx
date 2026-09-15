import React from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[SmartHire ErrorBoundary] Caught component crash:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
      const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred.';

      return (
        <div style={{
          padding: '32px 24px',
          margin: '20px 0',
          background: 'var(--bg-card, #121826)',
          border: '1px solid var(--accent-rose, #ef4444)',
          borderRadius: 'var(--radius-lg, 12px)',
          color: 'var(--text-primary, #f3f4f6)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          maxWidth: '800px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              padding: '12px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertCircle size={28} color="var(--accent-rose, #ef4444)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 6px 0', color: '#f87171' }}>
                Unable to display this report
              </h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary, #9ca3af)', lineHeight: 1.5 }}>
                {this.props.customTitle || 'A runtime rendering error occurred while loading this section. The application shell remains stable.'}
              </p>
            </div>
          </div>

          {isDev && this.state.error && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-subtle, #1f2937)',
              borderRadius: 'var(--radius-sm, 6px)',
              padding: '12px 16px',
              marginBottom: '20px',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              color: '#f87171',
              overflowX: 'auto',
              maxHeight: '160px'
            }}>
              <strong>Error Details:</strong> {errorMessage}
              {this.state.error.stack && (
                <pre style={{ margin: '8px 0 0 0', opacity: 0.85, whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>
                  {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                </pre>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleReset}
              className="btn btn-primary btn-sm flex items-center gap-2"
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md, 8px)',
                background: 'linear-gradient(135deg, var(--accent-primary, #6366f1), var(--accent-secondary, #8b5cf6))',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              <RefreshCw size={15} /> Retry Loading
            </button>

            {this.props.onBack && (
              <button
                onClick={this.props.onBack}
                className="btn btn-secondary btn-sm flex items-center gap-2"
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: 'var(--bg-elevated, #1e293b)',
                  border: '1px solid var(--border-medium, #334155)',
                  color: 'var(--text-primary, #f3f4f6)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                <ArrowLeft size={15} /> Back to Candidate Reports
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
