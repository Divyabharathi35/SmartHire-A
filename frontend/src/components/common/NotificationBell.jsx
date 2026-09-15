import { useState, useEffect, useRef } from 'react';
import { Bell, Check, AlertCircle, Info, FileText, Clock, X } from 'lucide-react';
import { apiFetch } from '../../api/apiClient';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen]                   = useState(false);
  const [loading, setLoading]             = useState(false);
  const dropdownRef                       = useRef(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data || []);
      }
    } catch (err) {
      console.error('[NotificationBell] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id) => {
    try {
      const res = await apiFetch(`/api/notifications/${id}/read`, {
        method: 'PATCH'
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      }
    } catch (err) {
      console.error('[NotificationBell] Mark read error:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getIcon = (type) => {
    switch (type) {
      case 'proctoring_warning':
        return <AlertCircle size={16} color="var(--accent-red)" />;
      case 'report_available':
        return <FileText size={16} color="var(--accent-teal)" />;
      case 'reminder':
        return <Clock size={16} color="var(--accent-amber)" />;
      default:
        return <Info size={16} color="var(--accent-primary)" />;
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        onClick={() => setOpen(!open)}
        title="Notifications"
        style={{ position: 'relative', width: 38, height: 38, padding: 0 }}
      >
        <Bell size={18} color="var(--text-secondary)" />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3, background: 'var(--accent-red)',
            color: '#fff', fontSize: '0.65rem', fontWeight: 700, borderRadius: '50%',
            width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-card)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 48, width: 340, maxHeight: 420,
          background: 'var(--bg-card)', border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
          zIndex: 1000, overflowY: 'auto', display: 'flex', flexDirection: 'column'
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={16} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: n.is_read ? 'transparent' : 'hsla(252,100%,68%,0.05)',
                    display: 'flex', gap: 12, alignItems: 'flex-start'
                  }}
                >
                  <div style={{ marginTop: 2, flexShrink: 0 }}>
                    {getIcon(n.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: n.is_read ? 600 : 700, color: 'var(--text-primary)' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      title="Mark as read"
                      style={{
                        background: 'none', border: 'none', color: 'var(--accent-teal)',
                        cursor: 'pointer', padding: 2
                      }}
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
