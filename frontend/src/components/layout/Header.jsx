// ============================================================
//  Header — Authenticated user header (no free role switch)
// ============================================================
import { useState } from 'react';
import { Zap, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../common/NotificationBell';

const roleConfig = {
  candidate: { color: 'hsl(252,100%,68%)', label: 'Candidate', emoji: '🎯' },
  recruiter:  { color: 'hsl(174,80%,55%)', label: 'Recruiter',  emoji: '🔍' },
  admin:      { color: 'hsl(38,95%,60%)',  label: 'Admin',      emoji: '⚙️' },
};

export default function Header({ activeRole }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const effectiveRole = (activeRole || user?.role || '').toLowerCase().trim();
  const rc = roleConfig[effectiveRole] || roleConfig.candidate;

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
  }

  return (
    <header className="app-header">
      {/* Logo */}
      <div className="header-logo">
        <div className="header-logo-icon">
          <Zap size={20} color="white" strokeWidth={2.5} />
        </div>
        <span className="header-logo-text">SmartHire</span>
        <span className="header-logo-badge">AI</span>
      </div>

      {/* Role badge (display only — role is from auth token) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 20,
          background: `${rc.color}18`,
          border: `1px solid ${rc.color}40`,
          fontSize: 13, fontWeight: 500, color: rc.color,
          userSelect: 'none',
        }}>
          <span>{rc.emoji}</span>
          <span>{rc.label}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="header-actions">
        {/* Notification bell */}
        <NotificationBell />

        {/* Settings */}
        <div style={{ cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          <Settings size={18} />
        </div>

        {/* User avatar + dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            id="header-user-menu-btn"
            onClick={() => setMenuOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <div className="header-avatar" title={user?.name} style={{ background: `linear-gradient(135deg, ${rc.color}, hsl(280,90%,65%))` }}>
              {initials}
            </div>
            <ChevronDown size={14} color="var(--text-muted)" style={{ transition: 'transform 0.2s', transform: menuOpen ? 'rotate(180deg)' : 'none' }} />
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div
              id="header-user-dropdown"
              style={{
                position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                background: 'hsl(224,40%,8%)',
                border: '1px solid hsl(228,25%,18%)',
                borderRadius: 12, padding: '8px',
                minWidth: 200, zIndex: 1000,
                boxShadow: '0 8px 32px hsla(222,47%,2%,0.7)',
                animation: 'card-in 0.15s ease both',
              }}
            >
              {/* User info */}
              <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid hsl(228,25%,16%)', marginBottom: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'hsl(220,20%,90%)', marginBottom: 2 }}>
                  {user?.name || 'User'}
                </div>
                <div style={{ fontSize: 12, color: 'hsl(220,15%,50%)' }}>{user?.email}</div>
                <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: rc.color,
                  background: `${rc.color}18`, borderRadius: 5, padding: '2px 7px',
                }}>
                  {rc.emoji} {rc.label}
                </div>
              </div>

              {/* Logout */}
              <button
                id="header-logout-btn"
                onClick={handleLogout}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 10px', borderRadius: 8, border: 'none',
                  background: 'none', color: 'hsl(350,90%,65%)', cursor: 'pointer',
                  fontSize: 14, fontWeight: 500, transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'hsla(350,90%,65%,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <LogOut size={15} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
