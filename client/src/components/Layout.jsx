import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  async function loadNotifications() {
    try {
      const data = await api.listNotifications();
      setNotifications(data);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 8000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function handleMarkAllRead() {
    await api.markAllRead();
    loadNotifications();
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const navItem = ({ isActive }) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition ${
      isActive ? 'bg-surface2 text-ink' : 'text-muted hover:text-ink'
    }`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border sticky top-0 bg-bg/95 backdrop-blur z-20">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="font-display font-semibold tracking-tight">Signal</span>
            </div>
            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={navItem}>Board</NavLink>
              <NavLink to="/analytics" className={navItem}>Analytics</NavLink>
              <NavLink to="/new" className={navItem}>New Bug</NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowNotifs((s) => !s)}
                className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface2 transition"
              >
                <BellIcon />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-bg text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-sm font-medium">Notifications</span>
                    <button onClick={handleMarkAllRead} className="text-xs text-accent hover:underline">
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto scrollbar-thin">
                    {notifications.length === 0 && (
                      <p className="text-sm text-muted px-3 py-6 text-center">You're all caught up.</p>
                    )}
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`px-3 py-2.5 border-b border-border/50 text-sm cursor-pointer hover:bg-surface2 transition ${
                          !n.is_read ? 'bg-surface2/40' : ''
                        }`}
                        onClick={() => {
                          api.markNotificationRead(n.id).then(loadNotifications);
                          if (n.bug_id) navigate(`/bugs/${n.bug_id}`);
                          setShowNotifs(false);
                        }}
                      >
                        <p className="text-ink/90">{n.message}</p>
                        <p className="text-xs text-muted mt-0.5">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pl-3 border-l border-border">
              <div className="w-7 h-7 rounded-full bg-surface2 border border-border flex items-center justify-center text-xs font-semibold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-medium leading-tight">{user?.name}</p>
                <p className="text-[11px] text-muted leading-tight capitalize">{user?.role}</p>
              </div>
              <button onClick={handleLogout} className="text-xs text-muted hover:text-critical transition ml-2">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
