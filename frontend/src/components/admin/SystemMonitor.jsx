// ============================================================
//  SystemMonitor.jsx — Real-time System Monitoring & Logs
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { Activity, Server, Cpu, Database, ShieldCheck, Terminal, RefreshCw, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../api/apiClient';

export default function SystemMonitor() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMonitoring = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/monitoring', {
        method: 'GET',
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (_err) {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitoring();
  }, [fetchMonitoring]);

  const health = data?.system_health || {
    status: data?.status || 'Operational',
    uptime: data?.uptime || '—',
    cpu_usage: data?.cpu_usage || '—',
    memory_usage: data?.memory_usage || '—',
    db_pool_active: data?.db_pool_active ?? 0,
    db_pool_max: data?.db_pool_max ?? 0
  };

  const metrics = data?.api_usage_metrics || {
    total_requests_24h: data?.total_requests_24h ?? 0,
    ai_generation_calls: data?.ai_generation_calls ?? 0,
    evaluations_performed: data?.evaluations_performed ?? 0,
    avg_response_time_ms: data?.avg_response_time_ms ?? 0
  };

  const logs = data?.logs || [];

  return (
    <div className="animate-fade-in-up" style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 700 }}>
            System Monitoring &amp; Telemetry
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Real-time server metrics, database connection pool, API throughput &amp; system audit logs.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchMonitoring} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* System Health Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-green)', marginBottom: 6 }}>
            <Server size={18} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Server Status</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-green)' }}>{health.status}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>Uptime: {health.uptime}</div>
        </div>

        <div className="card" style={{ padding: 20, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary)', marginBottom: 6 }}>
            <Cpu size={18} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>CPU Load</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{health.cpu_usage}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>RAM Usage: {health.memory_usage}</div>
        </div>

        <div className="card" style={{ padding: 20, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-teal)', marginBottom: 6 }}>
            <Database size={18} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Database Pool</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-teal)' }}>{health.db_pool_active} / {health.db_pool_max}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>Active AsyncPG connections</div>
        </div>

        <div className="card" style={{ padding: 20, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-amber)', marginBottom: 6 }}>
            <Activity size={18} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Avg Latency</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-amber)' }}>{metrics.avg_response_time_ms} ms</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>24h Requests: {metrics.total_requests_24h}</div>
        </div>
      </div>

      {/* Audit Log Terminal Stream */}
      <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Terminal size={20} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-heading)' }}>
            Live System &amp; API Event Logs
          </h3>
        </div>

        <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {logs.map(log => (
            <div key={log.id} style={{ display: 'flex', gap: 12, borderBottom: '1px dashed var(--border-subtle)', paddingBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)', minWidth: 140 }}>[{new Date().toLocaleTimeString()}]</span>
              <span style={{
                color: log.level === 'SUCCESS' ? 'var(--accent-green)' : log.level === 'WARNING' ? 'var(--accent-amber)' : 'var(--accent-primary)',
                fontWeight: 700, minWidth: 70
              }}>
                {log.level}
              </span>
              <span style={{ color: 'var(--accent-teal)', minWidth: 90 }}>[{log.source}]</span>
              <span style={{ color: 'var(--text-primary)' }}>{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
