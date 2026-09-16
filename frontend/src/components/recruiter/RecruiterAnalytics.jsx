// ============================================================
// RecruiterAnalytics.jsx — Recruiter Performance & Analytics
//
// Layout:
// 1. Performance Trends
// 2. Skill-wise Analytics
// 3. Shortlisting Insights
// 4. Shortlisted Candidates List
//
// Production rules:
// - Real PostgreSQL/API data only
// - No mock/random/fallback business data
// - No localhost API
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../api/apiClient';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';

import {
  BarChart2,
  TrendingUp,
  Award,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';

import ErrorBoundary from '../common/ErrorBoundary';

// ============================================================
// Custom Tooltip
// ============================================================

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        fontSize: '0.8rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <p
        style={{
          color: 'var(--text-secondary)',
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        {label || payload[0]?.name || 'Value'}
      </p>

      {payload.map((item, index) => {
        const numericValue =
          typeof item.value === 'number'
            ? item.value
            : Number(item.value);

        const isNumeric =
          item.value !== null &&
          item.value !== undefined &&
          !Number.isNaN(numericValue);

        const labelText = String(
          item.name || 'Value'
        );

        const displayValue =
          isNumeric &&
          (
            labelText.toLowerCase().includes('score') ||
            labelText.toLowerCase().includes('rate') ||
            labelText.toLowerCase().includes('percentage')
          )
            ? `${numericValue.toFixed(1)}%`
            : item.value ?? 'Unavailable';

        return (
          <p
            key={index}
            style={{
              color:
                item.color ||
                item.fill ||
                'var(--text-primary)',
              fontWeight: 700,
              margin: 0,
            }}
          >
            {labelText}: {displayValue}
          </p>
        );
      })}
    </div>
  );
};

// ============================================================
// Safe Number
// ============================================================

function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

// ============================================================
// Score Formatter
// ============================================================

function formatScore(value) {
  const numeric = toNumber(value);

  if (numeric === null) {
    return 'Unavailable';
  }

  return `${numeric.toFixed(1)}%`;
}

// ============================================================
// Percentage Formatter
// ============================================================

function formatPercentage(value) {
  const numeric = toNumber(value);

  if (numeric === null) {
    return '0%';
  }

  return `${numeric.toFixed(1)}%`;
}

// ============================================================
// Main Component
// ============================================================

export default function RecruiterAnalytics({
  onTabChange,
}) {
  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState(null);

  // ==========================================================
  // Fetch Analytics
  // ==========================================================

  const fetchAnalytics = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const response = await apiFetch(
          '/api/recruiter/analytics',
          {
            method: 'GET',
          }
        );

        if (!response.ok) {
          const errorText =
            await response.text();

          throw new Error(
            `HTTP ${response.status}: ${
              errorText ||
              'Failed to fetch recruiter analytics'
            }`
          );
        }

        const json = await response.json();

        if (!json || typeof json !== 'object') {
          throw new Error(
            'Invalid analytics response from server.'
          );
        }

        setData(json);
      } catch (err) {
        console.error(
          '[RecruiterAnalytics] Fetch error:',
          err
        );

        setError(
          err?.message ||
          'Network error loading recruiter analytics.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  // ==========================================================
  // Initial Load
  // ==========================================================

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // ==========================================================
  // Loading State
  // ==========================================================

  if (loading) {
    return (
      <div
        className="card text-center"
        style={{
          padding: '60px 20px',
          maxWidth: '1100px',
          margin: '0 auto',
        }}
      >
        <RefreshCw
          className="animate-spin"
          size={32}
          style={{
            color: 'var(--accent-primary)',
            margin: '0 auto 14px',
          }}
        />

        <p
          style={{
            color: 'var(--text-muted)',
          }}
        >
          Loading recruiter performance analytics...
        </p>
      </div>
    );
  }

  // ==========================================================
  // Error State
  // ==========================================================

  if (error) {
    return (
      <div
        className="card"
        style={{
          borderColor:
            'var(--accent-rose, #ef4444)',
          padding: '24px',
          maxWidth: '1100px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color:
              'var(--accent-rose, #ef4444)',
            marginBottom: 8,
          }}
        >
          <AlertTriangle size={22} />

          <h3
            style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              margin: 0,
            }}
          >
            Unable to Load Analytics
          </h3>
        </div>

        <p
          style={{
            fontSize: '0.88rem',
            color: 'var(--text-muted)',
            marginBottom: 0,
          }}
        >
          {error}
        </p>

        <button
          onClick={() =>
            fetchAnalytics({
              isRefresh: true,
            })
          }
          type="button"
          disabled={refreshing}
          style={{
            marginTop: 16,
            padding: '8px 16px',
            borderRadius:
              'var(--radius-md, 6px)',
            background:
              'var(--bg-elevated)',
            border:
              '1px solid var(--border-medium)',
            color:
              'var(--text-primary)',
            cursor: refreshing
              ? 'not-allowed'
              : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            opacity: refreshing ? 0.7 : 1,
          }}
        >
          <RefreshCw
            size={14}
            className={
              refreshing
                ? 'animate-spin'
                : ''
            }
          />

          Retry
        </button>
      </div>
    );
  }

  // ==========================================================
  // Real API Data
  // ==========================================================

  const trends = Array.isArray(
    data?.performance_trends
  )
    ? data.performance_trends
    : [];

  const skillAnalytics = Array.isArray(
    data?.skill_analytics
  )
    ? data.skill_analytics
    : [];

  const shortlisting =
    data?.shortlisting_insights &&
    typeof data.shortlisting_insights ===
      'object'
      ? data.shortlisting_insights
      : {};

  const shortlistedList = Array.isArray(
    data?.shortlisted_candidates
  )
    ? data.shortlisted_candidates
    : [];

  // ==========================================================
  // Shortlisting Metrics
  // ==========================================================

  const totalEvaluated =
    toNumber(
      shortlisting.total_evaluated
    ) ?? 0;

  const recCount =
    toNumber(
      shortlisting.recommended
    ) ?? 0;

  const recPct =
    toNumber(
      shortlisting.recommended_pct
    ) ?? 0;

  const reviewCount =
    toNumber(
      shortlisting.review_required
    ) ?? 0;

  const reviewPct =
    toNumber(
      shortlisting.review_required_pct
    ) ?? 0;

  const notRecommendedCount =
    toNumber(
      shortlisting.not_recommended
    ) ?? 0;

  const notRecommendedPct =
    toNumber(
      shortlisting.not_recommended_pct
    ) ?? 0;

  const shortlistingRateValue =
    shortlisting.shortlisting_rate;

  const shortlistingRate =
    shortlistingRateValue !== null &&
    shortlistingRateValue !== undefined
      ? typeof shortlistingRateValue ===
        'string'
        ? shortlistingRateValue
        : formatPercentage(
            shortlistingRateValue
          )
      : formatPercentage(recPct);

  const avgShortlistedScore =
    shortlisting.avg_shortlisted_score;

  const topScore =
    shortlisting.top_score;

  // ==========================================================
  // Donut Data
  // ==========================================================

  const donutData =
    totalEvaluated > 0
      ? [
          {
            name:
              'Recommended / Shortlisted',
            value: recCount,
            pct: recPct,
          },
          {
            name: 'Review Required',
            value: reviewCount,
            pct: reviewPct,
          },
          {
            name: 'Not Recommended',
            value:
              notRecommendedCount,
            pct: notRecommendedPct,
          },
        ]
      : [];

  // ==========================================================
  // Render
  // ==========================================================

  return (
    <ErrorBoundary>
      <div
        className="animate-fade-in-up"
        style={{
          padding: '24px',
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily:
                  'var(--font-heading)',
                fontSize: '1.6rem',
                fontWeight: 700,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <BarChart2
                size={24}
                color={
                  'var(--accent-primary, #6366f1)'
                }
              />

              Performance &amp; Analytics
            </h1>

            <p
              style={{
                color:
                  'var(--text-secondary)',
                fontSize: '0.88rem',
                marginTop: 4,
                marginBottom: 0,
              }}
            >
              Candidate performance trends,
              skill analytics, and shortlisting
              insights from completed interviews.
            </p>
          </div>

          <button
            onClick={() =>
              fetchAnalytics({
                isRefresh: true,
              })
            }
            disabled={refreshing}
            type="button"
            style={{
              padding: '9px 18px',
              borderRadius:
                'var(--radius-md, 8px)',
              background:
                'var(--bg-card)',
              border:
                '1px solid var(--border-medium)',
              color:
                'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: refreshing
                ? 'not-allowed'
                : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow:
                '0 2px 6px rgba(0,0,0,0.15)',
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            <RefreshCw
              size={14}
              className={
                refreshing
                  ? 'animate-spin'
                  : ''
              }
            />

            {refreshing
              ? 'Refreshing...'
              : 'Refresh Data'}
          </button>
        </div>

        {/* ====================================================
            SECTION 1 — PERFORMANCE TRENDS
        ==================================================== */}

        <div
          className="card"
          style={{
            padding: '24px',
            borderRadius:
              'var(--radius-lg, 12px)',
            background:
              'var(--bg-card)',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <TrendingUp
              size={20}
              color={
                'var(--accent-green, #10b981)'
              }
            />

            <h2
              style={{
                fontFamily:
                  'var(--font-heading)',
                fontSize: '1.2rem',
                fontWeight: 700,
                margin: 0,
              }}
            >
              Performance Trends
            </h2>
          </div>

          <p
            style={{
              fontSize: '0.82rem',
              color:
                'var(--text-muted)',
              marginBottom: 20,
            }}
          >
            Chronological overall-score
            progression across completed
            candidate interview sessions.
          </p>

          {trends.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height={280}
            >
              <LineChart
                data={trends}
                margin={{
                  top: 20,
                  right: 30,
                  left: -10,
                  bottom: 16,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={
                    'var(--border-subtle)'
                  }
                  vertical={false}
                />

                <XAxis
                  dataKey="date"
                  tick={{
                    fill:
                      'var(--text-secondary)',
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  domain={[0, 100]}
                  tick={{
                    fill:
                      'var(--text-muted)',
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                  ticks={[
                    0,
                    25,
                    50,
                    75,
                    100,
                  ]}
                  unit="%"
                />

                <Tooltip
                  content={
                    <CustomTooltip />
                  }
                />

                <Line
                  type="monotone"
                  dataKey="overall_score"
                  stroke={
                    'var(--accent-green, #10b981)'
                  }
                  strokeWidth={3}
                  dot={{
                    r: 6,
                    fill:
                      'var(--accent-green, #10b981)',
                  }}
                  activeDot={{
                    r: 8,
                  }}
                  name="Overall Score"
                >
                  <LabelList
                    dataKey="overall_score"
                    position="top"
                    fill={
                      'var(--accent-green, #10b981)'
                    }
                    fontSize={11}
                    fontWeight={700}
                    formatter={(value) =>
                      `${Math.round(
                        Number(value)
                      )}%`
                    }
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                height: 200,
                display: 'flex',
                flexDirection:
                  'column',
                alignItems: 'center',
                justifyContent:
                  'center',
                background:
                  'var(--bg-surface)',
                borderRadius:
                  'var(--radius-md)',
                color:
                  'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              <TrendingUp
                size={32}
                style={{
                  opacity: 0.3,
                  marginBottom: 8,
                }}
              />

              <p
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color:
                    'var(--text-secondary)',
                  margin: 0,
                }}
              >
                No performance trend data
              </p>

              <p
                style={{
                  fontSize: '0.8rem',
                  marginTop: 4,
                  marginBottom: 0,
                }}
              >
                Completed interview evaluations
                will appear here when available.
              </p>
            </div>
          )}
        </div>

        {/* ====================================================
            SECTION 2 — SKILL-WISE ANALYTICS
        ==================================================== */}

        <div
          className="card"
          style={{
            padding: '24px',
            borderRadius:
              'var(--radius-lg, 12px)',
            background:
              'var(--bg-card)',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Award
              size={20}
              color={
                'var(--accent-primary, #6366f1)'
              }
            />

            <h2
              style={{
                fontFamily:
                  'var(--font-heading)',
                fontSize: '1.2rem',
                fontWeight: 700,
                margin: 0,
              }}
            >
              Skill-wise Analytics
            </h2>
          </div>

          <p
            style={{
              fontSize: '0.82rem',
              color:
                'var(--text-muted)',
              marginBottom: 20,
            }}
          >
            Average performance across
            Technical Relevance, Communication,
            Confidence, and Professionalism.
          </p>

          {skillAnalytics.length > 0 ? (
            <ResponsiveContainer
              width="100%"
              height={280}
            >
              <BarChart
                data={skillAnalytics}
                margin={{
                  top: 20,
                  right: 30,
                  left: -10,
                  bottom: 20,
                }}
                barSize={42}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={
                    'var(--border-subtle)'
                  }
                  vertical={false}
                />

                <XAxis
                  dataKey="skill"
                  tick={{
                    fill:
                      'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  domain={[0, 100]}
                  tick={{
                    fill:
                      'var(--text-muted)',
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                  ticks={[
                    0,
                    25,
                    50,
                    75,
                    100,
                  ]}
                  unit="%"
                />

                <Tooltip
                  content={
                    <CustomTooltip />
                  }
                />

                <Bar
                  dataKey="score"
                  radius={[
                    6,
                    6,
                    0,
                    0,
                  ]}
                  name="Skill Score"
                >
                  <LabelList
                    dataKey="score"
                    position="top"
                    fill={
                      'var(--text-primary)'
                    }
                    fontSize={12}
                    fontWeight={700}
                    formatter={(value) =>
                      `${Math.round(
                        Number(value)
                      )}%`
                    }
                  />

                  {skillAnalytics.map(
                    (entry, index) => {
                      const score =
                        toNumber(
                          entry?.score
                        );

                      return (
                        <Cell
                          key={`skill-${index}`}
                          fill={
                            score !== null &&
                            score < 70
                              ? 'var(--accent-amber, #f59e0b)'
                              : 'var(--accent-primary, #6366f1)'
                          }
                        />
                      );
                    }
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div
              style={{
                height: 200,
                display: 'flex',
                flexDirection:
                  'column',
                alignItems: 'center',
                justifyContent:
                  'center',
                background:
                  'var(--bg-surface)',
                borderRadius:
                  'var(--radius-md)',
                color:
                  'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              <Award
                size={32}
                style={{
                  opacity: 0.3,
                  marginBottom: 8,
                }}
              />

              <p
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color:
                    'var(--text-secondary)',
                  margin: 0,
                }}
              >
                No skill analytics available
              </p>

              <p
                style={{
                  fontSize: '0.8rem',
                  marginTop: 4,
                  marginBottom: 0,
                }}
              >
                Evaluated skill scores will
                appear here when available.
              </p>
            </div>
          )}
        </div>

        {/* ====================================================
            SECTION 3 — SHORTLISTING INSIGHTS
        ==================================================== */}

        <div
          className="card"
          style={{
            padding: '24px',
            borderRadius:
              'var(--radius-lg, 12px)',
            background:
              'var(--bg-card)',
            border:
              '1px solid var(--border-medium)',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                'space-between',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Sparkles
                size={20}
                color={
                  'var(--accent-amber, #f59e0b)'
                }
              />

              <h2
                style={{
                  fontFamily:
                    'var(--font-heading)',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                Shortlisting Insights
              </h2>
            </div>
          </div>

          <p
            style={{
              fontSize: '0.85rem',
              color:
                'var(--text-muted)',
              marginBottom: 24,
            }}
          >
            Candidate recommendations derived
            from completed interview evaluation
            scores.
          </p>

          {totalEvaluated === 0 ? (
            <div
              style={{
                padding:
                  '36px 20px',
                display: 'flex',
                flexDirection:
                  'column',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                background:
                  'var(--bg-surface)',
                borderRadius:
                  'var(--radius-md)',
                border:
                  '1px dashed var(--border-subtle)',
                color:
                  'var(--text-muted)',
                textAlign:
                  'center',
              }}
            >
              <Sparkles
                size={32}
                style={{
                  opacity: 0.3,
                  marginBottom: 8,
                }}
              />

              <p
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color:
                    'var(--text-secondary)',
                  margin: 0,
                }}
              >
                No shortlisting data available
              </p>

              <p
                style={{
                  fontSize: '0.8rem',
                  marginTop: 4,
                  marginBottom: 0,
                }}
              >
                Completed interview evaluations
                will populate these insights.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection:
                  'column',
                gap: 24,
              }}
            >

              {/* Summary Metrics */}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 16,
                }}
              >
                <div
                  style={{
                    padding:
                      '14px 18px',
                    background:
                      'var(--bg-surface)',
                    borderRadius:
                      'var(--radius-md)',
                    border:
                      '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        '0.75rem',
                      color:
                        'var(--text-muted)',
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        '0.5px',
                    }}
                  >
                    Total Evaluated
                  </div>

                  <div
                    style={{
                      fontSize:
                        '1.5rem',
                      fontWeight: 800,
                      color:
                        'var(--text-primary)',
                      marginTop: 4,
                    }}
                  >
                    {totalEvaluated}
                  </div>
                </div>

                <div
                  style={{
                    padding:
                      '14px 18px',
                    background:
                      'var(--bg-surface)',
                    borderRadius:
                      'var(--radius-md)',
                    border:
                      '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        '0.75rem',
                      color:
                        'var(--text-muted)',
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        '0.5px',
                    }}
                  >
                    Shortlisted Rate
                  </div>

                  <div
                    style={{
                      fontSize:
                        '1.5rem',
                      fontWeight: 800,
                      color:
                        'var(--accent-green, #10b981)',
                      marginTop: 4,
                    }}
                  >
                    {shortlistingRate}
                  </div>
                </div>

                <div
                  style={{
                    padding:
                      '14px 18px',
                    background:
                      'var(--bg-surface)',
                    borderRadius:
                      'var(--radius-md)',
                    border:
                      '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        '0.75rem',
                      color:
                        'var(--text-muted)',
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        '0.5px',
                    }}
                  >
                    Avg Shortlisted Score
                  </div>

                  <div
                    style={{
                      fontSize:
                        '1.5rem',
                      fontWeight: 800,
                      color:
                        'var(--accent-amber, #f59e0b)',
                      marginTop: 4,
                    }}
                  >
                    {formatScore(
                      avgShortlistedScore
                    )}
                  </div>
                </div>

                <div
                  style={{
                    padding:
                      '14px 18px',
                    background:
                      'var(--bg-surface)',
                    borderRadius:
                      'var(--radius-md)',
                    border:
                      '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        '0.75rem',
                      color:
                        'var(--text-muted)',
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        '0.5px',
                    }}
                  >
                    Top Score
                  </div>

                  <div
                    style={{
                      fontSize:
                        '1.5rem',
                      fontWeight: 800,
                      color:
                        'var(--accent-primary, #6366f1)',
                      marginTop: 4,
                    }}
                  >
                    {formatScore(
                      topScore
                    )}
                  </div>
                </div>
              </div>

              {/* Donut + Breakdown */}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: 24,
                  alignItems:
                    'center',
                }}
              >
                <div
                  style={{
                    height: 220,
                    position:
                      'relative',
                  }}
                >
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {donutData.map(
                          (
                            entry,
                            index
                          ) => (
                            <Cell
                              key={`donut-${index}`}
                              fill={
                                index ===
                                0
                                  ? 'var(--accent-green, #10b981)'
                                  : index ===
                                      1
                                    ? 'var(--accent-amber, #f59e0b)'
                                    : 'var(--accent-rose, #ef4444)'
                              }
                              stroke="var(--bg-card)"
                              strokeWidth={2}
                            />
                          )
                        )}
                      </Pie>

                      <Tooltip
                        content={
                          <CustomTooltip />
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div
                    style={{
                      position:
                        'absolute',
                      top: '50%',
                      left: '50%',
                      transform:
                        'translate(-50%, -50%)',
                      textAlign:
                        'center',
                      pointerEvents:
                        'none',
                    }}
                  >
                    <div
                      style={{
                        fontSize:
                          '1.5rem',
                        fontWeight: 800,
                        color:
                          'var(--text-primary)',
                      }}
                    >
                      {totalEvaluated}
                    </div>

                    <div
                      style={{
                        fontSize:
                          '0.7rem',
                        color:
                          'var(--text-muted)',
                        textTransform:
                          'uppercase',
                        letterSpacing:
                          '0.5px',
                      }}
                    >
                      Evaluated
                    </div>
                  </div>
                </div>

                {/* Breakdown */}

                <div
                  style={{
                    display: 'flex',
                    flexDirection:
                      'column',
                    gap: 14,
                  }}
                >
                  {/* Recommended */}

                  <div
                    style={{
                      padding:
                        '12px 16px',
                      borderRadius:
                        'var(--radius-md, 8px)',
                      background:
                        'var(--bg-surface)',
                      border:
                        '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems:
                        'center',
                      justifyContent:
                        'space-between',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display:
                          'flex',
                        alignItems:
                          'center',
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 3,
                          background:
                            'var(--accent-green, #10b981)',
                        }}
                      />

                      <span
                        style={{
                          fontSize:
                            '0.9rem',
                          fontWeight: 600,
                          color:
                            'var(--text-primary)',
                        }}
                      >
                        Recommended /
                        Shortlisted
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize:
                          '0.9rem',
                        fontWeight: 700,
                        color:
                          'var(--accent-green, #10b981)',
                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      {recCount} (
                      {formatPercentage(
                        recPct
                      )}
                      )
                    </span>
                  </div>

                  {/* Review */}

                  <div
                    style={{
                      padding:
                        '12px 16px',
                      borderRadius:
                        'var(--radius-md, 8px)',
                      background:
                        'var(--bg-surface)',
                      border:
                        '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems:
                        'center',
                      justifyContent:
                        'space-between',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display:
                          'flex',
                        alignItems:
                          'center',
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 3,
                          background:
                            'var(--accent-amber, #f59e0b)',
                        }}
                      />

                      <span
                        style={{
                          fontSize:
                            '0.9rem',
                          fontWeight: 600,
                          color:
                            'var(--text-primary)',
                        }}
                      >
                        Review Required
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize:
                          '0.9rem',
                        fontWeight: 700,
                        color:
                          'var(--accent-amber, #f59e0b)',
                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      {reviewCount} (
                      {formatPercentage(
                        reviewPct
                      )}
                      )
                    </span>
                  </div>

                  {/* Not Recommended */}

                  <div
                    style={{
                      padding:
                        '12px 16px',
                      borderRadius:
                        'var(--radius-md, 8px)',
                      background:
                        'var(--bg-surface)',
                      border:
                        '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems:
                        'center',
                      justifyContent:
                        'space-between',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display:
                          'flex',
                        alignItems:
                          'center',
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 3,
                          background:
                            'var(--accent-rose, #ef4444)',
                        }}
                      />

                      <span
                        style={{
                          fontSize:
                            '0.9rem',
                          fontWeight: 600,
                          color:
                            'var(--text-primary)',
                        }}
                      >
                        Not Recommended
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize:
                          '0.9rem',
                        fontWeight: 700,
                        color:
                          'var(--accent-rose, #ef4444)',
                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      {notRecommendedCount} (
                      {formatPercentage(
                        notRecommendedPct
                      )}
                      )
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ====================================================
            SECTION 4 — SHORTLISTED CANDIDATES LIST
        ==================================================== */}

        <div
          className="card"
          style={{
            padding: '24px',
            borderRadius:
              'var(--radius-lg, 12px)',
            background:
              'var(--bg-card)',
            border:
              '1px solid var(--border-medium)',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                'space-between',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <UserCheck
                size={20}
                color={
                  'var(--accent-green, #10b981)'
                }
              />

              <h2
                style={{
                  fontFamily:
                    'var(--font-heading)',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                Shortlisted Candidates List
              </h2>
            </div>

            {shortlistedList.length >
              0 && (
              <span
                className="badge badge-success"
                style={{
                  padding:
                    '4px 10px',
                  fontSize:
                    '0.8rem',
                  display:
                    'inline-flex',
                  alignItems:
                    'center',
                  gap: 4,
                }}
              >
                <ShieldCheck
                  size={12}
                />

                {shortlistedList.length}{' '}
                Qualified
              </span>
            )}
          </div>

          <p
            style={{
              fontSize: '0.85rem',
              color:
                'var(--text-muted)',
              marginBottom: 20,
            }}
          >
            Candidates meeting the configured
            shortlisting criteria based on
            completed interview evaluation data.
          </p>

          {shortlistedList.length ===
          0 ? (
            <div
              style={{
                padding:
                  '36px 20px',
                display: 'flex',
                flexDirection:
                  'column',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                background:
                  'var(--bg-surface)',
                borderRadius:
                  'var(--radius-md)',
                border:
                  '1px dashed var(--border-subtle)',
                color:
                  'var(--text-muted)',
                textAlign:
                  'center',
              }}
            >
              <UserCheck
                size={32}
                style={{
                  opacity: 0.3,
                  marginBottom: 8,
                }}
              />

              <p
                style={{
                  fontSize:
                    '0.95rem',
                  fontWeight: 600,
                  color:
                    'var(--text-secondary)',
                  margin: 0,
                }}
              >
                No shortlisted candidates
              </p>

              <p
                style={{
                  fontSize:
                    '0.8rem',
                  marginTop: 4,
                  marginBottom: 0,
                }}
              >
                Candidates meeting the
                shortlisting criteria will
                appear here.
              </p>
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  'auto',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse:
                    'collapse',
                  fontSize:
                    '0.88rem',
                  textAlign:
                    'left',
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom:
                        '1px solid var(--border-medium)',
                      color:
                        'var(--text-muted)',
                    }}
                  >
                    <th
                      style={{
                        padding:
                          '12px 14px',
                        fontWeight:
                          600,
                      }}
                    >
                      Candidate Name
                    </th>

                    <th
                      style={{
                        padding:
                          '12px 14px',
                        fontWeight:
                          600,
                      }}
                    >
                      Job / Role
                    </th>

                    <th
                      style={{
                        padding:
                          '12px 14px',
                        fontWeight:
                          600,
                        textAlign:
                          'center',
                      }}
                    >
                      Overall Score
                    </th>

                    <th
                      style={{
                        padding:
                          '12px 14px',
                        fontWeight:
                          600,
                        textAlign:
                          'center',
                      }}
                    >
                      Technical
                    </th>

                    <th
                      style={{
                        padding:
                          '12px 14px',
                        fontWeight:
                          600,
                        textAlign:
                          'center',
                      }}
                    >
                      Communication
                    </th>

                    <th
                      style={{
                        padding:
                          '12px 14px',
                        fontWeight:
                          600,
                        textAlign:
                          'center',
                      }}
                    >
                      Confidence
                    </th>

                    <th
                      style={{
                        padding:
                          '12px 14px',
                        fontWeight:
                          600,
                        textAlign:
                          'center',
                      }}
                    >
                      Professionalism
                    </th>

                    <th
                      style={{
                        padding:
                          '12px 14px',
                        fontWeight:
                          600,
                        textAlign:
                          'center',
                      }}
                    >
                      Shortlist Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {shortlistedList.map(
                    (candidate, index) => {
                      const sessionId =
                        candidate.session_id ||
                        candidate.id ||
                        `candidate-${index}`;

                      return (
                        <tr
                          key={
                            sessionId
                          }
                          style={{
                            borderBottom:
                              '1px solid var(--border-subtle)',
                            transition:
                              'background 0.2s ease',
                          }}
                        >
                          <td
                            style={{
                              padding:
                                '14px',
                              fontWeight:
                                600,
                              color:
                                'var(--text-primary)',
                            }}
                          >
                            {candidate.candidate_name ||
                              'Name unavailable'}

                            {candidate.candidate_email && (
                              <div
                                style={{
                                  fontSize:
                                    '0.75rem',
                                  color:
                                    'var(--text-muted)',
                                  fontWeight:
                                    400,
                                  marginTop:
                                    2,
                                }}
                              >
                                {
                                  candidate.candidate_email
                                }
                              </div>
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                '14px',
                              color:
                                'var(--text-secondary)',
                            }}
                          >
                            {candidate.job_role ||
                              'Role unavailable'}
                          </td>

                          <td
                            style={{
                              padding:
                                '14px',
                              textAlign:
                                'center',
                              fontWeight:
                                800,
                              color:
                                'var(--accent-green, #10b981)',
                              fontSize:
                                '1rem',
                            }}
                          >
                            {formatScore(
                              candidate.overall_score
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                '14px',
                              textAlign:
                                'center',
                              color:
                                candidate.technical_score !==
                                null &&
                                candidate.technical_score !==
                                undefined
                                  ? 'var(--text-primary)'
                                  : 'var(--text-muted)',
                            }}
                          >
                            {formatScore(
                              candidate.technical_score
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                '14px',
                              textAlign:
                                'center',
                              color:
                                candidate.communication_score !==
                                null &&
                                candidate.communication_score !==
                                undefined
                                  ? 'var(--text-primary)'
                                  : 'var(--text-muted)',
                            }}
                          >
                            {formatScore(
                              candidate.communication_score
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                '14px',
                              textAlign:
                                'center',
                              color:
                                candidate.confidence_score !==
                                null &&
                                candidate.confidence_score !==
                                undefined
                                  ? 'var(--text-primary)'
                                  : 'var(--text-muted)',
                            }}
                          >
                            {formatScore(
                              candidate.confidence_score
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                '14px',
                              textAlign:
                                'center',
                              color:
                                candidate.professionalism_score !==
                                null &&
                                candidate.professionalism_score !==
                                undefined
                                  ? 'var(--text-primary)'
                                  : 'var(--text-muted)',
                            }}
                          >
                            {formatScore(
                              candidate.professionalism_score
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                '14px',
                              textAlign:
                                'center',
                            }}
                          >
                            <span
                              className="badge badge-success"
                              style={{
                                padding:
                                  '4px 10px',
                                fontSize:
                                  '0.78rem',
                              }}
                            >
                              {candidate.shortlist_status ||
                                'Shortlisted'}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}