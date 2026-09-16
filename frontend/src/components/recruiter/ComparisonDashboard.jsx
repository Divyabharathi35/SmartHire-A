// ============================================================
// ComparisonDashboard.jsx — Side-by-side Candidate Analytics
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../api/apiClient';

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';

import {
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  AlertCircle,
  Users,
} from 'lucide-react';

import ErrorBoundary from '../common/ErrorBoundary';

// ============================================================
// Delta Badge
// ============================================================

function DeltaBadge({ diff }) {
  if (diff === null || diff === undefined || Number.isNaN(Number(diff))) {
    return (
      <span
        className="badge badge-neutral"
        style={{ opacity: 0.7, display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <Minus size={10} />
        N/A
      </span>
    );
  }

  const numericDiff = Number(diff);

  if (Math.abs(numericDiff) < 0.5) {
    return (
      <span
        className="badge badge-neutral"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <Minus size={10} />
        Tie
      </span>
    );
  }

  if (numericDiff > 0) {
    return (
      <span
        className="badge badge-success"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <ArrowUp size={10} />
        +{numericDiff.toFixed(1)} pts
      </span>
    );
  }

  return (
    <span
      className="badge badge-warning"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      <ArrowDown size={10} />
      {numericDiff.toFixed(1)} pts
    </span>
  );
}

// ============================================================
// Status Badge
// ============================================================

function getStatusBadgeClass(statusStr) {
  if (!statusStr) return 'badge-neutral';

  const lower = String(statusStr).toLowerCase();

  if (
    lower.includes('shortlisted') ||
    lower.includes('recommended') ||
    lower.includes('pass')
  ) {
    return 'badge-success';
  }

  if (
    lower.includes('review') ||
    lower.includes('under')
  ) {
    return 'badge-warning';
  }

  if (
    lower.includes('not') ||
    lower.includes('reject') ||
    lower.includes('fail')
  ) {
    return 'badge-danger';
  }

  return 'badge-neutral';
}

// ============================================================
// Safe Score Formatter
// ============================================================

function formatScore(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'Unavailable';
  }

  return `${Number(value).toFixed(1)}%`;
}

// ============================================================
// Candidate ID Resolver
// ============================================================

function getSessionId(candidate) {
  if (!candidate) return '';

  return String(
    candidate.session_id ||
    candidate.id ||
    ''
  );
}

// ============================================================
// Main Content
// ============================================================

function ComparisonDashboardContent() {
  const [candidates, setCandidates] = useState([]);

  const [sessionA, setSessionA] = useState('');
  const [sessionB, setSessionB] = useState('');

  const [comparisonData, setComparisonData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [compLoading, setCompLoading] = useState(false);

  const [error, setError] = useState(null);
  const [comparisonError, setComparisonError] = useState(null);

  // ==========================================================
  // Fetch Candidate List
  // ==========================================================

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(
        '/api/recruiter/interviews?sort_by=completed_at&sort_order=desc',
        {
          method: 'GET',
        }
      );

      if (!res.ok) {
        const errTxt = await res.text();

        throw new Error(
          `HTTP ${res.status}: ${
            errTxt || 'Failed to load candidate list'
          }`
        );
      }

      const data = await res.json();

      const candidateList = Array.isArray(data)
        ? data
        : Array.isArray(data?.candidates)
          ? data.candidates
          : Array.isArray(data?.items)
            ? data.items
            : [];

      setCandidates(candidateList);

      // --------------------------------------------------------
      // Automatically select first two candidates
      // --------------------------------------------------------

      if (candidateList.length >= 2) {
        const firstId = getSessionId(candidateList[0]);
        const secondId = getSessionId(candidateList[1]);

        setSessionA(firstId);
        setSessionB(secondId);
      } else if (candidateList.length === 1) {
        const firstId = getSessionId(candidateList[0]);

        setSessionA(firstId);
        setSessionB('');
      } else {
        setSessionA('');
        setSessionB('');
        setComparisonData(null);
      }
    } catch (err) {
      console.error(
        '[ComparisonDashboard] Fetch candidates error:',
        err
      );

      setCandidates([]);
      setSessionA('');
      setSessionB('');
      setComparisonData(null);

      setError(
        err?.message ||
        'Unable to load candidate comparison data.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ==========================================================
  // Initial Candidate Load
  // ==========================================================

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // ==========================================================
  // Fetch Comparison
  // ==========================================================

  useEffect(() => {
    let isMounted = true;

    // Need two different candidates for comparison.
    if (!sessionA || !sessionB || sessionA === sessionB) {
      setComparisonData(null);
      setComparisonError(null);
      setCompLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const fetchComparison = async () => {
      setCompLoading(true);
      setComparisonError(null);

      try {
        const params = new URLSearchParams();

        params.set('session_id_a', sessionA);
        params.set('session_id_b', sessionB);

        const endpoint =
          `/api/recruiter/comparison?${params.toString()}`;

        const res = await apiFetch(endpoint, {
          method: 'GET',
        });

        if (!res.ok) {
          const errTxt = await res.text();

          throw new Error(
            `HTTP ${res.status}: ${
              errTxt || 'Failed to load candidate comparison'
            }`
          );
        }

        const data = await res.json();

        if (isMounted) {
          setComparisonData(data || null);
          setComparisonError(null);
        }
      } catch (err) {
        console.error(
          '[ComparisonDashboard] Comparison fetch error:',
          err
        );

        if (isMounted) {
          setComparisonData(null);

          setComparisonError(
            err?.message ||
            'Unable to load comparison data.'
          );
        }
      } finally {
        if (isMounted) {
          setCompLoading(false);
        }
      }
    };

    fetchComparison();

    return () => {
      isMounted = false;
    };
  }, [sessionA, sessionB]);

  // ==========================================================
  // Refresh
  // ==========================================================

  const handleRefresh = async () => {
    await fetchCandidates();
  };

  // ==========================================================
  // Loading
  // ==========================================================

  if (loading) {
    return (
      <div
        className="card text-center"
        style={{ padding: 'var(--space-12)' }}
      >
        <RefreshCw
          size={28}
          className="animate-spin text-accent"
          style={{
            margin: '0 auto var(--space-4)',
          }}
        />

        <p className="text-secondary">
          Loading comparison data from database...
        </p>
      </div>
    );
  }

  // ==========================================================
  // Main Candidate API Error
  // ==========================================================

  if (error) {
    return (
      <div
        className="card text-center"
        style={{
          padding: 'var(--space-8)',
          borderColor: 'hsla(0, 84%, 60%, 0.3)',
        }}
      >
        <AlertCircle
          size={32}
          className="text-danger"
          style={{
            margin: '0 auto var(--space-3)',
          }}
        />

        <h3>Failed to Load Comparison</h3>

        <p
          className="text-muted text-sm"
          style={{
            marginBottom: 'var(--space-4)',
          }}
        >
          {error}
        </p>

        <button
          className="btn btn-secondary"
          onClick={handleRefresh}
          type="button"
        >
          <RefreshCw size={14} style={{ marginRight: 6 }} />
          Retry
        </button>
      </div>
    );
  }

  // ==========================================================
  // No Candidates
  // ==========================================================

  if (candidates.length === 0) {
    return (
      <div className="animate-fade-in-up">
        <div className="page-header">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h1>Comparison Dashboard</h1>

              <p>
                Side-by-side candidate performance analysis to
                make data-driven hiring decisions.
              </p>
            </div>

            <button
              className="btn btn-secondary"
              onClick={handleRefresh}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        <div
          className="card text-center"
          style={{
            padding: 'var(--space-12)',
          }}
        >
          <Users
            size={40}
            className="text-muted"
            style={{
              margin: '0 auto var(--space-4)',
              opacity: 0.5,
            }}
          />

          <h3>
            No completed candidate interviews available
          </h3>

          <p
            className="text-muted text-sm"
            style={{
              marginTop: 8,
            }}
          >
            Candidate comparison requires completed interview
            records with available evaluation results.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // Comparison Data
  // ==========================================================

  const candidateA = comparisonData?.candidate_a;
  const candidateB = comparisonData?.candidate_b;

  const diffs = comparisonData?.comparison;

  const radarData = Array.isArray(comparisonData?.radar_data)
    ? comparisonData.radar_data
    : [];

  const hasComparisonData =
    Boolean(candidateA) || Boolean(candidateB);

  // ==========================================================
  // Metric Definitions
  // ==========================================================

  const comparisonMetrics = [
    {
      label: 'Technical',
      diff: diffs?.technical_difference,
    },
    {
      label: 'Confidence',
      diff: diffs?.confidence_difference,
    },
    {
      label: 'Communication',
      diff: diffs?.communication_difference,
    },
    {
      label: 'Professionalism',
      diff: diffs?.professionalism_difference,
    },
    {
      label: 'Overall',
      diff: diffs?.overall_difference,
    },
  ];

  // ==========================================================
  // Candidate Metric Cards
  // ==========================================================

  const candidateMetricCards = [
    {
      name: candidateA?.name || 'Candidate A',
      metrics: [
        {
          label: 'Technical',
          val: candidateA?.technical_score,
        },
        {
          label: 'Confidence',
          val: candidateA?.confidence_score,
        },
        {
          label: 'Communication',
          val: candidateA?.communication_score,
        },
        {
          label: 'Professionalism',
          val: candidateA?.professionalism_score,
        },
      ],
    },
    {
      name: candidateB?.name || 'Candidate B',
      metrics: [
        {
          label: 'Technical',
          val: candidateB?.technical_score,
        },
        {
          label: 'Confidence',
          val: candidateB?.confidence_score,
        },
        {
          label: 'Communication',
          val: candidateB?.communication_score,
        },
        {
          label: 'Professionalism',
          val: candidateB?.professionalism_score,
        },
      ],
    },
  ];

  // ==========================================================
  // Render
  // ==========================================================

  return (
    <div className="animate-fade-in-up">

      {/* ======================================================
          Header
      ====================================================== */}

      <div className="page-header">
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1>Comparison Dashboard</h1>

            <p>
              Side-by-side candidate performance analysis to make
              data-driven hiring decisions.
            </p>
          </div>

          <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            type="button"
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RefreshCw
              size={14}
              className={loading ? 'animate-spin' : ''}
            />

            Refresh
          </button>
        </div>
      </div>

      {/* ======================================================
          Candidate Selectors
      ====================================================== */}

      <div
        className="comparison-grid"
        style={{
          marginBottom: 'var(--space-8)',
        }}
      >

        {/* Candidate A */}

        <div>
          <label
            className="form-label"
            htmlFor="compare-candidate-1"
            style={{
              marginBottom: 'var(--space-2)',
              display: 'block',
            }}
          >
            Candidate A
          </label>

          <select
            className="form-control"
            id="compare-candidate-1"
            value={sessionA}
            onChange={(e) => {
              setSessionA(e.target.value);
            }}
          >
            <option value="">
              Select Candidate A
            </option>

            {candidates.map((candidate) => {
              const id = getSessionId(candidate);

              const score =
                candidate.overall_score !== null &&
                candidate.overall_score !== undefined
                  ? formatScore(candidate.overall_score)
                  : 'Unavailable';

              return (
                <option
                  key={`a-${id}`}
                  value={id}
                  disabled={
                    id === sessionB &&
                    candidates.length > 1
                  }
                >
                  {candidate.candidate_name || 'Candidate'} —{' '}
                  {candidate.job_role || 'Role'} ({score})
                </option>
              );
            })}
          </select>
        </div>

        {/* VS */}

        <div
          className="vs-divider"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div className="vs-badge">
            VS
          </div>
        </div>

        {/* Candidate B */}

        <div>
          <label
            className="form-label"
            htmlFor="compare-candidate-2"
            style={{
              marginBottom: 'var(--space-2)',
              display: 'block',
            }}
          >
            Candidate B
          </label>

          <select
            className="form-control"
            id="compare-candidate-2"
            value={sessionB}
            onChange={(e) => {
              setSessionB(e.target.value);
            }}
          >
            <option value="">
              Select Candidate B
            </option>

            {candidates.map((candidate) => {
              const id = getSessionId(candidate);

              const score =
                candidate.overall_score !== null &&
                candidate.overall_score !== undefined
                  ? formatScore(candidate.overall_score)
                  : 'Unavailable';

              return (
                <option
                  key={`b-${id}`}
                  value={id}
                  disabled={
                    id === sessionA &&
                    candidates.length > 1
                  }
                >
                  {candidate.candidate_name || 'Candidate'} —{' '}
                  {candidate.job_role || 'Role'} ({score})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* ======================================================
          Comparison Loading
      ====================================================== */}

      {compLoading ? (
        <div
          className="card text-center"
          style={{
            padding: 'var(--space-8)',
          }}
        >
          <RefreshCw
            size={24}
            className="animate-spin text-accent"
            style={{
              margin: '0 auto var(--space-3)',
            }}
          />

          <p className="text-secondary text-sm">
            Comparing candidate data...
          </p>
        </div>
      ) : comparisonError ? (
        <div
          className="card text-center"
          style={{
            padding: 'var(--space-8)',
            borderColor: 'hsla(0, 84%, 60%, 0.3)',
          }}
        >
          <AlertCircle
            size={30}
            className="text-danger"
            style={{
              margin: '0 auto var(--space-3)',
            }}
          />

          <h3>
            Failed to Load Candidate Comparison
          </h3>

          <p
            className="text-muted text-sm"
            style={{
              marginTop: 8,
              marginBottom: 'var(--space-4)',
            }}
          >
            {comparisonError}
          </p>

          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              setSessionA('');
              setSessionB('');

              setTimeout(() => {
                if (candidates.length >= 2) {
                  setSessionA(
                    getSessionId(candidates[0])
                  );

                  setSessionB(
                    getSessionId(candidates[1])
                  );
                }
              }, 0);
            }}
          >
            Retry Comparison
          </button>
        </div>
      ) : !sessionA || !sessionB ? (
        <div
          className="card text-center"
          style={{
            padding: 'var(--space-10)',
          }}
        >
          <Users
            size={32}
            className="text-muted"
            style={{
              margin: '0 auto var(--space-3)',
              opacity: 0.5,
            }}
          />

          <h4>
            Select two candidates to compare
          </h4>

          <p
            className="text-muted text-sm"
            style={{
              marginTop: 4,
            }}
          >
            Choose two completed candidates from the selectors above.
          </p>
        </div>
      ) : !hasComparisonData ? (
        <div
          className="card text-center"
          style={{
            padding: 'var(--space-10)',
          }}
        >
          <AlertCircle
            size={32}
            className="text-muted"
            style={{
              margin: '0 auto var(--space-3)',
              opacity: 0.7,
            }}
          />

          <h4>
            No comparison result available
          </h4>

          <p
            className="text-muted text-sm"
            style={{
              marginTop: 4,
            }}
          >
            The selected interview records do not have
            comparison data available yet.
          </p>
        </div>
      ) : (
        <>
          {/* ==================================================
              Profile Cards
          ================================================== */}

          <div
            className="comparison-grid"
            style={{
              marginBottom: 'var(--space-8)',
            }}
          >

            {/* Candidate A */}

            <div
              className="card"
              style={{
                borderColor:
                  'hsla(252,100%,68%,0.3)',
                textAlign: 'center',
              }}
            >
              {candidateA ? (
                <>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background:
                        'linear-gradient(135deg, hsl(252,80%,50%), hsl(280,80%,60%))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: 'white',
                      fontSize: '1.3rem',
                      margin:
                        '0 auto var(--space-4)',
                    }}
                  >
                    {candidateA.initials ||
                      (candidateA.name || 'A')
                        .charAt(0)
                        .toUpperCase()}
                  </div>

                  <h3
                    style={{
                      marginBottom: 4,
                    }}
                  >
                    {candidateA.name ||
                      'Candidate A'}
                  </h3>

                  <p
                    className="text-secondary text-sm"
                    style={{
                      marginBottom:
                        'var(--space-4)',
                    }}
                  >
                    {candidateA.role ||
                      'Role unavailable'}
                  </p>

                  <div
                    style={{
                      fontSize: '3rem',
                      fontFamily:
                        'var(--font-heading)',
                      fontWeight: 800,
                      color:
                        'var(--accent-primary)',
                      marginBottom: 4,
                    }}
                  >
                    {formatScore(
                      candidateA.overall_score
                    )}
                  </div>

                  <p className="text-xs text-muted">
                    Overall Score
                  </p>

                  <span
                    className={`badge ${getStatusBadgeClass(
                      candidateA.status
                    )}`}
                    style={{
                      marginTop:
                        'var(--space-3)',
                    }}
                  >
                    {candidateA.status ||
                      'Status unavailable'}
                  </span>
                </>
              ) : (
                <p className="text-muted text-sm">
                  Candidate A data unavailable
                </p>
              )}
            </div>

            {/* Key Differences */}

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)',
                justifyContent: 'center',
                padding:
                  '0 var(--space-4)',
              }}
            >
              {comparisonMetrics.map((metric) => (
                <div
                  key={metric.label}
                  style={{
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      fontSize: '0.72rem',
                      color:
                        'var(--text-muted)',
                      textTransform:
                        'uppercase',
                      letterSpacing:
                        '0.06em',
                      marginBottom: 4,
                    }}
                  >
                    {metric.label}
                  </p>

                  <DeltaBadge
                    diff={metric.diff}
                  />
                </div>
              ))}
            </div>

            {/* Candidate B */}

            <div
              className="card"
              style={{
                borderColor:
                  'hsla(174,80%,55%,0.3)',
                textAlign: 'center',
              }}
            >
              {candidateB ? (
                <>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background:
                        'linear-gradient(135deg, hsl(174,80%,40%), hsl(200,80%,50%))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: 'white',
                      fontSize: '1.3rem',
                      margin:
                        '0 auto var(--space-4)',
                    }}
                  >
                    {candidateB.initials ||
                      (candidateB.name || 'B')
                        .charAt(0)
                        .toUpperCase()}
                  </div>

                  <h3
                    style={{
                      marginBottom: 4,
                    }}
                  >
                    {candidateB.name ||
                      'Candidate B'}
                  </h3>

                  <p
                    className="text-secondary text-sm"
                    style={{
                      marginBottom:
                        'var(--space-4)',
                    }}
                  >
                    {candidateB.role ||
                      'Role unavailable'}
                  </p>

                  <div
                    style={{
                      fontSize: '3rem',
                      fontFamily:
                        'var(--font-heading)',
                      fontWeight: 800,
                      color:
                        'hsl(174,80%,55%)',
                      marginBottom: 4,
                    }}
                  >
                    {formatScore(
                      candidateB.overall_score
                    )}
                  </div>

                  <p className="text-xs text-muted">
                    Overall Score
                  </p>

                  <span
                    className={`badge ${getStatusBadgeClass(
                      candidateB.status
                    )}`}
                    style={{
                      marginTop:
                        'var(--space-3)',
                    }}
                  >
                    {candidateB.status ||
                      'Status unavailable'}
                  </span>
                </>
              ) : (
                <p className="text-muted text-sm">
                  Candidate B data unavailable
                </p>
              )}
            </div>
          </div>

          {/* ==================================================
              Radar Chart
          ================================================== */}

          {radarData.length > 0 && (
            <div
              className="card"
              style={{
                marginBottom:
                  'var(--space-6)',
              }}
            >
              <h3 className="section-title">
                Multi-Dimensional Comparison
              </h3>

              <ResponsiveContainer
                width="100%"
                height={360}
              >
                <RadarChart
                  data={radarData}
                  margin={{
                    top: 20,
                    right: 40,
                    bottom: 20,
                    left: 40,
                  }}
                >
                  <PolarGrid
                    stroke="var(--border-subtle)"
                  />

                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{
                      fill:
                        'var(--text-muted)',
                      fontSize: 12,
                      fontFamily:
                        'var(--font-body)',
                    }}
                  />

                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                  />

                  <Radar
                    name={
                      candidateA?.name ||
                      'Candidate A'
                    }
                    dataKey="candidate1"
                    stroke="hsl(252,100%,68%)"
                    fill="hsl(252,100%,68%)"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />

                  <Radar
                    name={
                      candidateB?.name ||
                      'Candidate B'
                    }
                    dataKey="candidate2"
                    stroke="hsl(174,80%,55%)"
                    fill="hsl(174,80%,55%)"
                    fillOpacity={0.12}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />

                  <Legend
                    wrapperStyle={{
                      color:
                        'var(--text-secondary)',
                      fontSize:
                        '0.85rem',
                    }}
                  />

                  <Tooltip
                    contentStyle={{
                      background:
                        'var(--bg-card)',
                      border:
                        '1px solid var(--border-medium)',
                      borderRadius: 8,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ==================================================
              Metric Cards
          ================================================== */}

          <div className="grid-2">
            {candidateMetricCards.map(
              (card, cardIndex) => {
                const cardColor =
                  cardIndex === 0
                    ? 'hsl(252,100%,68%)'
                    : 'hsl(174,80%,55%)';

                return (
                  <div
                    key={`${card.name}-${cardIndex}`}
                    className="card"
                  >
                    <h4
                      style={{
                        marginBottom:
                          'var(--space-5)',
                      }}
                    >
                      {card.name}
                    </h4>

                    {card.metrics.map(
                      (metric) => {
                        const hasValue =
                          metric.val !== null &&
                          metric.val !== undefined &&
                          !Number.isNaN(
                            Number(metric.val)
                          );

                        const numericValue =
                          hasValue
                            ? Math.min(
                                100,
                                Math.max(
                                  0,
                                  Number(
                                    metric.val
                                  )
                                )
                              )
                            : 0;

                        return (
                          <div
                            key={metric.label}
                            style={{
                              marginBottom:
                                'var(--space-4)',
                            }}
                          >
                            <div
                              className="flex justify-between"
                              style={{
                                marginBottom: 6,
                                fontSize:
                                  '0.82rem',
                              }}
                            >
                              <span className="text-secondary">
                                {metric.label}
                              </span>

                              <span
                                style={{
                                  fontWeight: 700,
                                  color: hasValue
                                    ? cardColor
                                    : 'var(--text-muted)',
                                }}
                              >
                                {hasValue
                                  ? `${Number(
                                      metric.val
                                    ).toFixed(1)}%`
                                  : 'Unavailable'}
                              </span>
                            </div>

                            <div
                              className="progress-bar"
                              style={{
                                height: 8,
                              }}
                            >
                              <div
                                style={{
                                  height: '100%',
                                  width: `${numericValue}%`,
                                  background:
                                    hasValue
                                      ? cardColor
                                      : 'var(--border-subtle)',
                                  borderRadius: 99,
                                  transition:
                                    'width 0.8s ease',
                                }}
                              />
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                );
              }
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Export with Error Boundary
// ============================================================

export default function ComparisonDashboard() {
  return (
    <ErrorBoundary componentName="ComparisonDashboard">
      <ComparisonDashboardContent />
    </ErrorBoundary>
  );
}