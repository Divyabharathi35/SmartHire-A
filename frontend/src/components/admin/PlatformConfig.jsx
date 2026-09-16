// ============================================================
// PlatformConfig.jsx — Platform, Security & Auth Settings
// ============================================================
import { useState, useEffect } from 'react';
import {
  Settings,
  Mail,
  Key,
  CheckCircle,
  Save,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

import { apiFetch } from '../../api/apiClient';

export default function PlatformConfig() {
  const [siteName, setSiteName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [allowRegistration, setAllowRegistration] = useState(true);

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');

  const [jwtExpiry, setJwtExpiry] = useState('');
  const [enableGoogle, setEnableGoogle] = useState(false);
  const [enableGithub, setEnableGithub] = useState(false);

  const [rateLimit, setRateLimit] = useState('');
  const [strongPasswords, setStrongPasswords] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  // ============================================================
  // LOAD PLATFORM CONFIG
  // ============================================================
  const fetchConfig = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await apiFetch('/api/admin/config', {
        method: 'GET',
      });

      if (!res.ok) {
        let message = `Failed to load platform configuration (${res.status})`;

        try {
          const errorData = await res.json();

          message =
            errorData?.detail ||
            errorData?.message ||
            message;
        } catch {
          // Keep default error message
        }

        throw new Error(message);
      }

      const data = await res.json();

      if (data.site_name !== undefined) {
        setSiteName(data.site_name || '');
      }

      if (data.support_email !== undefined) {
        setSupportEmail(data.support_email || '');
      }

      if (data.allow_self_registration !== undefined) {
        setAllowRegistration(
          Boolean(data.allow_self_registration)
        );
      }

      if (data.smtp_host !== undefined) {
        setSmtpHost(data.smtp_host || '');
      }

      if (data.smtp_port !== undefined) {
        setSmtpPort(data.smtp_port ?? '');
      }

      if (data.smtp_user !== undefined) {
        setSmtpUser(data.smtp_user || '');
      }

      if (data.jwt_expiry_days !== undefined) {
        setJwtExpiry(data.jwt_expiry_days ?? '');
      }

      if (data.enable_google_oauth !== undefined) {
        setEnableGoogle(
          Boolean(data.enable_google_oauth)
        );
      }

      if (data.enable_github_oauth !== undefined) {
        setEnableGithub(
          Boolean(data.enable_github_oauth)
        );
      }

      if (data.rate_limit_per_min !== undefined) {
        setRateLimit(data.rate_limit_per_min ?? '');
      }

      if (data.enforce_strong_passwords !== undefined) {
        setStrongPasswords(
          Boolean(data.enforce_strong_passwords)
        );
      }
    } catch (err) {
      console.error(
        '[PlatformConfig] Failed to load configuration:',
        err
      );

      setErrorMsg(
        err?.message ||
        'Unable to load platform configuration.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // SAVE PLATFORM CONFIG
  // ============================================================
  const handleSave = async (e) => {
    e.preventDefault();

    setSaving(true);
    setStatusMsg('');
    setErrorMsg('');

    try {
      const payload = {
        site_name: siteName,
        support_email: supportEmail,
        allow_self_registration: allowRegistration,

        smtp_host: smtpHost,
        smtp_port: parseInt(smtpPort, 10),
        smtp_user: smtpUser,

        jwt_expiry_days: parseInt(jwtExpiry, 10),

        enable_google_oauth: enableGoogle,
        enable_github_oauth: enableGithub,

        rate_limit_per_min: parseInt(rateLimit, 10),
        enforce_strong_passwords: strongPasswords,
      };

      const res = await apiFetch('/api/admin/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = 'Failed to save platform configuration';

        try {
          const errorData = await res.json();

          message =
            errorData?.detail ||
            errorData?.message ||
            message;
        } catch {
          // Keep default message
        }

        throw new Error(message);
      }

      setStatusMsg(
        'Platform Settings saved successfully!'
      );

      setTimeout(() => {
        setStatusMsg('');
      }, 3000);
    } catch (err) {
      console.error(
        '[PlatformConfig] Failed to save configuration:',
        err
      );

      setErrorMsg(
        err?.message ||
        'Error saving platform settings.'
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (loading) {
    return (
      <div
        className="animate-fade-in-up"
        style={{
          padding: '24px',
          maxWidth: '1000px',
          margin: '0 auto',
        }}
      >
        <div
          className="card"
          style={{
            padding: 40,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            textAlign: 'center',
          }}
        >
          <RefreshCw
            size={24}
            style={{
              animation: 'spin 1s linear infinite',
              marginBottom: 12,
            }}
          />

          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            Loading platform configuration...
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // ERROR STATE
  // ============================================================
  if (errorMsg) {
    return (
      <div
        className="animate-fade-in-up"
        style={{
          padding: '24px',
          maxWidth: '1000px',
          margin: '0 auto',
        }}
      >
        <div
          className="card"
          style={{
            padding: 24,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: 'var(--accent-rose)',
              marginBottom: 14,
            }}
          >
            <AlertCircle size={20} />

            <strong>
              Unable to Load Platform Configuration
            </strong>
          </div>

          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              marginBottom: 18,
            }}
          >
            {errorMsg}
          </p>

          <button
            type="button"
            onClick={fetchConfig}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <RefreshCw size={15} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // UI
  // ============================================================
  return (
    <div
      className="animate-fade-in-up"
      style={{
        padding: '24px',
        maxWidth: '1000px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.6rem',
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Platform Settings &amp; Configuration
        </h1>

        <p
          style={{
            color: 'var(--text-muted)',
            margin: 0,
          }}
        >
          Manage global application parameters, email SMTP,
          authentication policies &amp; security rules.
        </p>
      </div>

      {/* Success Message */}
      {statusMsg && (
        <div
          style={{
            background: 'hsla(142,70%,55%,0.1)',
            border: '1px solid var(--accent-green)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            marginBottom: 20,
            color: 'var(--accent-green)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle size={16} />
          {statusMsg}
        </div>
      )}

      <form
        onSubmit={handleSave}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* ======================================================
            GENERAL SETTINGS
        ======================================================= */}
        <div
          className="card"
          style={{
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <Settings
              size={20}
              color="var(--accent-primary)"
            />

            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                fontFamily: 'var(--font-heading)',
                margin: 0,
              }}
            >
              General Application Settings
            </h3>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 20,
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                Platform Name
              </label>

              <input
                className="input"
                value={siteName}
                onChange={(e) =>
                  setSiteName(e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-input)',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                Support Email Address
              </label>

              <input
                className="input"
                type="email"
                value={supportEmail}
                onChange={(e) =>
                  setSupportEmail(e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-input)',
                }}
              />
            </div>
          </div>
        </div>

        {/* ======================================================
            SMTP
        ======================================================= */}
        <div
          className="card"
          style={{
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <Mail
              size={20}
              color="var(--accent-teal)"
            />

            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                fontFamily: 'var(--font-heading)',
                margin: 0,
              }}
            >
              Email SMTP Configuration
            </h3>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 20,
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                SMTP Server Host
              </label>

              <input
                className="input"
                value={smtpHost}
                onChange={(e) =>
                  setSmtpHost(e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-input)',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                Port Number
              </label>

              <input
                className="input"
                type="number"
                value={smtpPort}
                onChange={(e) =>
                  setSmtpPort(e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-input)',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                Sender Email Account
              </label>

              <input
                className="input"
                type="email"
                value={smtpUser}
                onChange={(e) =>
                  setSmtpUser(e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-input)',
                }}
              />
            </div>
          </div>
        </div>

        {/* ======================================================
            AUTHENTICATION & SECURITY
        ======================================================= */}
        <div
          className="card"
          style={{
            padding: '24px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <Key
              size={20}
              color="var(--accent-amber)"
            />

            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                fontFamily: 'var(--font-heading)',
                margin: 0,
              }}
            >
              Authentication &amp; Security Policies
            </h3>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 20,
            }}
          >
            {/* JWT */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                JWT Token Expiry (Days)
              </label>

              <input
                className="input"
                type="number"
                min="1"
                value={jwtExpiry}
                onChange={(e) =>
                  setJwtExpiry(e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-input)',
                }}
              />
            </div>

            {/* Rate Limit */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: 8,
                }}
              >
                API Rate Limit (Reqs / min)
              </label>

              <input
                className="input"
                type="number"
                min="1"
                value={rateLimit}
                onChange={(e) =>
                  setRateLimit(e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-input)',
                }}
              />
            </div>
          </div>
        </div>

        {/* ======================================================
            SAVE BUTTON
        ======================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary"
            style={{
              padding: '12px 26px',
              fontSize: '0.95rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: saving ? 0.7 : 1,
              cursor: saving
                ? 'not-allowed'
                : 'pointer',
            }}
          >
            {saving ? (
              <RefreshCw
                size={16}
                style={{
                  animation:
                    'spin 1s linear infinite',
                }}
              />
            ) : (
              <Save size={16} />
            )}

            <span>
              {saving
                ? 'Saving...'
                : 'Save Settings'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}