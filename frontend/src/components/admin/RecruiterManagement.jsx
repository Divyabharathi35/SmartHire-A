import { useEffect, useState } from 'react';
import { UserCheck, UserX, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { apiFetch } from '../../api/apiClient';

export default function RecruiterManagement() {
  const [recruiters, setRecruiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    fetchRecruiters();
  }, []);

  const fetchRecruiters = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await apiFetch('/api/admin/recruiters', {
        method: 'GET',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.detail || `Failed to load recruiters (${res.status})`
        );
      }

      const data = await res.json();
      setRecruiters(Array.isArray(data) ? data : []);
    } catch (err) {
      setRecruiters([]);
      setErrorMsg(err.message || 'Failed to load recruiters');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (recruiter) => {
    setErrorMsg('');

    try {
      const res = await apiFetch(
        `/api/admin/recruiters/${recruiter.id}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            is_active: !recruiter.is_active,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.detail || 'Failed to update recruiter status'
        );
      }

      setStatusMsg(
        `Status updated for ${recruiter.name || recruiter.email}`
      );

      setTimeout(() => {
        setStatusMsg('');
      }, 3000);

      await fetchRecruiters();
    } catch (err) {
      setErrorMsg(
        err.message || 'Failed to update recruiter status'
      );
    }
  };

  return (
    <div
      className="animate-fade-in-up"
      style={{
        padding: '24px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.6rem',
              fontWeight: 700,
            }}
          >
            Recruiter Management
          </h1>

          <p style={{ color: 'var(--text-muted)' }}>
            Manage recruiter accounts and access status
          </p>
        </div>

        <button
          className="btn btn-ghost"
          onClick={fetchRecruiters}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <RefreshCw
            size={16}
            style={{
              animation: loading ? 'spin 1s linear infinite' : 'none',
            }}
          />
          Refresh
        </button>
      </div>

      {statusMsg && (
        <div
          style={{
            background: 'hsla(142,70%,55%,0.1)',
            border: '1px solid var(--accent-green)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            marginBottom: 16,
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

      {errorMsg && (
        <div
          style={{
            background: 'hsla(350,90%,65%,0.1)',
            border: '1px solid var(--accent-rose)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            marginBottom: 16,
            color: 'var(--accent-rose)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} />
          {errorMsg}
        </div>
      )}

      <div
        className="card"
        style={{
          padding: 0,
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          background: 'var(--bg-card)',
        }}
      >
        {loading ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            Loading recruiters...
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '0.88rem',
            }}
          >
            <thead>
              <tr
                style={{
                  background: 'var(--bg-surface)',
                  borderBottom: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                }}
              >
                <th style={{ padding: '14px 18px' }}>Recruiter</th>
                <th style={{ padding: '14px 18px' }}>Email</th>
                <th style={{ padding: '14px 18px' }}>Status</th>
                <th style={{ padding: '14px 18px' }}>
                  Joined Date
                </th>
                <th
                  style={{
                    padding: '14px 18px',
                    textAlign: 'right',
                  }}
                >
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {recruiters.map((recruiter) => (
                <tr
                  key={recruiter.id}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <td style={{ padding: '14px 18px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--bg-elevated)',
                          color: 'var(--accent-teal)',
                        }}
                      >
                        <UserCheck size={17} />
                      </div>

                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {recruiter.name || '—'}
                        </div>

                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          Recruiter
                        </div>
                      </div>
                    </div>
                  </td>

                  <td
                    style={{
                      padding: '14px 18px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {recruiter.email || '—'}
                  </td>

                  <td style={{ padding: '14px 18px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: recruiter.is_active
                          ? 'var(--accent-green)'
                          : 'var(--accent-rose)',
                      }}
                    >
                      {recruiter.is_active
                        ? '● Active'
                        : '○ Inactive'}
                    </span>
                  </td>

                  <td
                    style={{
                      padding: '14px 18px',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {recruiter.created_at
                      ? new Date(
                        recruiter.created_at
                      ).toLocaleDateString()
                      : '—'}
                  </td>

                  <td
                    style={{
                      padding: '14px 18px',
                      textAlign: 'right',
                    }}
                  >
                    <button
                      onClick={() =>
                        handleToggleStatus(recruiter)
                      }
                      className="btn btn-ghost"
                      style={{
                        padding: '5px 10px',
                        fontSize: '0.78rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {recruiter.is_active ? (
                        <>
                          <UserX size={14} />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck size={14} />
                          Activate
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}

              {recruiters.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    style={{
                      padding: 40,
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                    }}
                  >
                    No recruiters found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}