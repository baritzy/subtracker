import { useState, useEffect } from 'react';
import { Plus, ArrowLeft, Settings as SettingsIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Dashboard } from '@/pages/Dashboard';
import { History } from '@/pages/History';
import { Settings } from '@/pages/Settings';
import { Calendar } from '@/pages/Calendar';
import { Trials } from '@/pages/Trials';
import { Login } from '@/pages/Login';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useNotifications } from '@/hooks/useNotifications';
import { api } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';

type Page = 'dashboard' | 'history' | 'settings' | 'calendar' | 'trials';

const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'מעקב מנויים',
  history: 'היסטוריה',
  settings: 'הגדרות',
  calendar: 'יומן חידושים',
  trials: 'ניסיונות חינם',
};

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } },
};

export default function App() {
  const { theme } = useTheme();
  const [authState, setAuthState] = useState<'loading' | 'logged-in' | 'logged-out'>('loading');
  const [page, setPage] = useState<Page>('dashboard');
  const [fabOpen, setFabOpen] = useState(() => sessionStorage.getItem('fabOpen') === 'true');

  function openFab() { sessionStorage.setItem('fabOpen', 'true'); setFabOpen(true); }
  function closeFab() { sessionStorage.removeItem('fabOpen'); setFabOpen(false); }
  const { subscriptions } = useSubscriptions(undefined, authState === 'logged-in');
  useNotifications(subscriptions);

  // Check auth on startup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Handle auth_error from failed OAuth
    if (params.get('auth_error')) {
      window.history.replaceState({}, '', '/');
      setAuthState('logged-out');
      return;
    }

    // Token delivered via redirect from OAuth callback (?token=...)
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('auth_token', urlToken);
      window.history.replaceState({}, '', '/');
      // Desktop popup: close this window so the opener tab takes over
      if (window.opener) { window.close(); return; }
    }

    const token = localStorage.getItem('auth_token');
    if (!token) { setAuthState('logged-out'); return; }

    // Timeout: if server is cold-starting, let user in optimistically after 12s
    const timeout = setTimeout(() => setAuthState('logged-in'), 12000);

    api.auth.me()
      .then(() => { clearTimeout(timeout); setAuthState('logged-in'); })
      .catch(() => {
        clearTimeout(timeout);
        // 401: token removed by api.ts → logged-out. Network error: token still there → optimistic login
        if (!localStorage.getItem('auth_token')) {
          setAuthState('logged-out');
        } else {
          setAuthState('logged-in');
        }
      });
  }, []);

  if (authState === 'loading') {
    return (
      <div style={{
        minHeight: '100dvh', background: '#060b14',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid rgba(99,102,241,0.3)',
          borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (authState === 'logged-out') {
    return <Login onLogin={() => setAuthState('logged-in')} />;
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#060b14',
      backgroundImage: 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(99,102,241,0.14), transparent)',
      filter: theme === 'light' ? 'invert(1) hue-rotate(180deg)' : undefined,
    }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        paddingInlineStart: 'max(20px, env(safe-area-inset-right))',
        paddingInlineEnd: 'max(20px, env(safe-area-inset-left))',
        paddingTop: 'max(0px, env(safe-area-inset-top))',
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(6,11,20,0.88)', backdropFilter: 'blur(16px)',
      }}>
        <div style={{
          maxWidth: '720px', margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '16px', height: '56px',
        }}>
          {page !== 'dashboard' ? (
            <button
              onClick={() => setPage('dashboard')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#818cf8', fontSize: '15px', fontWeight: '600',
                fontFamily: "'Heebo', sans-serif", padding: '8px 0',
              }}
            >
              <ArrowLeft size={18} /> חזרה
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img src="/icons/icon-192.png" alt="SubTracker"
                style={{ width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0 }} />
              <span style={{ fontFamily: "'Heebo', sans-serif", fontWeight: '800',
                fontSize: '17px', color: '#f1f5f9', letterSpacing: '-0.3px' }}>
                SubTracker
              </span>
            </div>
          )}

          {page !== 'dashboard' ? (
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9', fontFamily: "'Heebo', sans-serif" }}>
              {PAGE_TITLES[page]}
            </span>
          ) : (
            <button
              onClick={() => setPage('settings')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px', padding: '8px', cursor: 'pointer', color: '#94a3b8', flexShrink: 0,
              }}
            >
              <SettingsIcon size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="page-content" style={{
        maxWidth: '720px', margin: '0 auto',
        padding: '24px 20px',
        paddingBottom: `calc(90px + env(safe-area-inset-bottom, 0px))`,
      }}>
        <AnimatePresence mode="wait">
          <motion.div key={page} variants={pageVariants} initial="initial" animate="animate" exit="exit">
            {page === 'dashboard' && (
              <Dashboard onOpenAdd={openFab} fabOpen={fabOpen} onFabClose={closeFab} onNavigate={setPage} />
            )}
            {page === 'history' && <History />}
            {page === 'settings' && <Settings onNavigate={setPage} onLogout={async () => {
              localStorage.removeItem('auth_token');
              // After logout, create a guest session so user stays in the app
              try {
                const res = await fetch('/api/auth/anonymous', { method: 'POST' });
                const data = await res.json();
                if (data.token) {
                  localStorage.setItem('auth_token', data.token);
                  setPage('dashboard');
                  return;
                }
              } catch {}
              setAuthState('logged-out');
            }} />}
            {page === 'calendar' && <Calendar />}
            {page === 'trials' && <Trials />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* FAB */}
      {page === 'dashboard' && (
        <button
          onClick={openFab}
          style={{
            position: 'fixed',
            bottom: `calc(20px + env(safe-area-inset-bottom, 0px))`,
            insetInlineEnd: '20px', zIndex: 50,
            width: '56px', height: '56px', borderRadius: '50%', border: 'none',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(99,102,241,0.45)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.93)')}
          onPointerUp={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  );
}
