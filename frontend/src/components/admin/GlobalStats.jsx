// ============================================================
// GlobalStats.jsx — Recharts Analytics & Platform Metrics
// ============================================================
import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Globe,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

import { apiFetch } from '../../api/apiClient';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-medium)',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: '0.8rem',
        }}
      >
        <p
          style={{
            color: 'var(--text-muted)',
            marginBottom: 6,
          }}
        >
          {label}
        </p>

        {payload.map((p, i) => (
          <p
            key={i}
            style={{
              color: p.color || p.stroke,
              fontWeight: 600,
              margin: '3px 0',
            }}
          >
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }

  return null;
};

export default function GlobalStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // ============================================================
  // LOAD REAL ADMIN ANALYTICS
  // ============================================================
  const fetchAnalytics = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await apiFetch('/api/admin/analytics', {
        method: 'GET',
      });

      if (!res.ok) {
        let message = `Failed to load analytics (${res.status})`;

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

      const json = await res.json();

      setData(json);
    } catch (err) {
      console.error(
        '[GlobalStats] Failed to load analytics:',
        err
      );

      setData(null);

      setErrorMsg(
        err?.message ||
        'Unable to load platform analytics.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // REAL DATA ONLY
  // ============================================================
  const summary = data?.summary || {};

  const trendData = Array.isArray(data?.trends)
    ? data.trends
    : [];

  const distribution = Array.isArray(
    data?.domain_distribution
  )
    ? data.domain_distribution
    : [];

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (loading) {
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
              animation:
                'spin 1s linear infinite',
              marginBottom: 12,
            }}
          />

          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            Loading platform analytics...
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
          maxWidth: '1100px',
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
              Unable to Load Platform Analytics
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
            onClick={fetchAnalytics}
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
  // SAFE REAL VALUES
  // ============================================================
  const totalInterviewsCreated =
    summary.total_interviews_created ??
    summary.total_interviews ??
    '—';

  const completedInterviews =
    summary.completed_interviews ??
    summary.completed_interview_sessions ??
    '—';

  const totalAIQuestions =
    summary.total_ai_questions ??
    summary.ai_questions_generated ??
    '—';

  const completionRate =
    summary.completion_rate ??
    '—';

  // ============================================================
  // UI
  // ============================================================
  return (
    <div
      className="animate-fade-in-up"
      style={{
        padding: '24px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}
    >
      {/* ======================================================
          HEADER
      ======================================================= */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          gap: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.6rem',
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Platform Analytics &amp; Intelligence
          </h1>

          <p
            style={{
              color: 'var(--text-muted)',
              margin: 0,
            }}
          >
            System-wide interview metrics, candidate and
            recruiter activities, and AI usage statistics.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          <Globe
            size={16}
            color="var(--accent-primary)"
          />

          Live Database Telemetry
        </div>
      </div>

      {/* ======================================================
          KPI ROW
      ======================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        {/* Total Interviews */}
        <div
          className="card"
          style={{
            padding: 20,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            TOTAL INTERVIEWS CREATED
          </div>

          <div
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              fontFamily: 'var(--font-heading)',
            }}
          >
            {totalInterviewsCreated}
          </div>
        </div>

        {/* Completed */}
        <div
          className="card"
          style={{
            padding: 20,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            COMPLETED INTERVIEWS
          </div>

          <div
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              fontFamily: 'var(--font-heading)',
              color: 'var(--accent-green)',
            }}
          >
            {completedInterviews}
          </div>
        </div>

        {/* AI Questions */}
        <div
          className="card"
          style={{
            padding: 20,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            AI QUESTIONS GENERATED
          </div>

          <div
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              fontFamily: 'var(--font-heading)',
              color: 'var(--accent-secondary)',
            }}
          >
            {totalAIQuestions}
          </div>
        </div>

        {/* Completion Rate */}
        <div
          className="card"
          style={{
            padding: 20,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            COMPLETION RATE
          </div>

          <div
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              fontFamily: 'var(--font-heading)',
              color: 'var(--accent-amber)',
            }}
          >
            {completionRate}
          </div>
        </div>
      </div>

      {/* ======================================================
          WEEKLY TREND
      ======================================================= */}
      <div
        className="card"
        style={{
          padding: '24px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)',
          marginBottom: 28,
        }}
      >
        <h3
          style={{
            fontSize: '1.1rem',
            fontWeight: 600,
            fontFamily: 'var(--font-heading)',
            marginBottom: 16,
          }}
        >
          Interview &amp; AI Generation Activity
        </h3>

        {trendData.length === 0 ? (
          <div
            style={{
              height: 260,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
            }}
          >
            No interview activity recorded yet.
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              height: 300,
            }}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <AreaChart
                data={trendData}
                margin={{
                  top: 10,
                  right: 30,
                  left: 0,
                  bottom: 0,
                }}
              >
                <defs>
                  <linearGradient
                    id="globalStatsCreated"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="hsl(252,100%,68%)"
                      stopOpacity={0.4}
                    />

                    <stop
                      offset="95%"
                      stopColor="hsl(252,100%,68%)"
                      stopOpacity={0}
                    />
                  </linearGradient>

                  <linearGradient
                    id="globalStatsCompleted"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="hsl(174,80%,55%)"
                      stopOpacity={0.4}
                    />

                    <stop
                      offset="95%"
                      stopColor="hsl(174,80%,55%)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-subtle)"
                />

                <XAxis
                  dataKey="name"
                  stroke="var(--text-muted)"
                  fontSize={12}
                />

                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={12}
                />

                <Tooltip
                  content={<CustomTooltip />}
                />

                <Area
                  type="monotone"
                  dataKey="created"
                  name="Interviews Created"
                  stroke="hsl(252,100%,68%)"
                  fillOpacity={1}
                  fill="url(#globalStatsCreated)"
                />

                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Completed Interviews"
                  stroke="hsl(174,80%,55%)"
                  fillOpacity={1}
                  fill="url(#globalStatsCompleted)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ======================================================
          DOMAIN DISTRIBUTION
      ======================================================= */}
      <div
        className="card"
        style={{
          padding: '24px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-card)',
        }}
      >
        <h3
          style={{
            fontSize: '1.1rem',
            fontWeight: 600,
            fontFamily: 'var(--font-heading)',
            marginBottom: 16,
          }}
        >
          Interview Distribution by Technical Domain
        </h3>

        {distribution.length === 0 ? (
          <div
            style={{
              height: 220,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
            }}
          >
            No domain interview data recorded yet.
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              height: 260,
            }}
          >
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={distribution}
                margin={{
                  top: 10,
                  right: 30,
                  left: 0,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border-subtle)"
                />

                <XAxis
                  dataKey="name"
                  stroke="var(--text-muted)"
                  fontSize={12}
                />

                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={12}
                />

                <Tooltip
                  content={<CustomTooltip />}
                />

                <Bar
                  dataKey="value"
                  name="Sessions"
                  fill="var(--accent-primary)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}