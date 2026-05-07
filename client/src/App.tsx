import { useState, useEffect, useRef } from 'react';
import { Plus, ArrowLeft, Settings as SettingsIcon, Camera, FolderOpen, PenLine } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { CreateSubscriptionPayload } from '@/types';
import { api } from '@/lib/api';
import { Dashboard } from '@/pages/Dashboard';
import { History } from '@/pages/History';
import { Settings } from '@/pages/Settings';
import { Calendar } from '@/pages/Calendar';
import { Trials } from '@/pages/Trials';
import { Login } from '@/pages/Login';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useNotifications } from '@/hooks/useNotifications';

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
  const [authState, setAuthState] = useState<'loading' | 'logged-in' | 'logged-out'>('loading');
  const [page, setPage] = useState<Page>('dashboard');
  const [fabOpen, setFabOpen] = useState(() => sessionStorage.getItem('fabOpen') === 'true');
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [scanPrefill, setScanPrefill] = useState<Partial<CreateSubscriptionPayload> | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openFab() { sessionStorage.setItem('fabOpen', 'true'); setFabOpen(true); }
  function closeFab() { sessionStorage.removeItem('fabOpen'); setFabOpen(false); setScanPrefill(null); }

  async function handleFileSelected(file: File) {
    setFabMenuOpen(false);
    setScanning(true);
    setScanError('');
    try {
      const data = await api.receipt.scan(file);
      if (data.success) {
        const cycleMap: Record<string, 'monthly' | 'yearly' | 'custom'> = {
          monthly: 'monthly', yearly: 'yearly', quarterly: 'custom',
        };
        const billingCycle = cycleMap[data.billing_cycle ?? ''] ?? 'monthly';
        const cost = typeof data.cost === 'number' ? data.cost : 0;
        setScanPrefill({
          company_name: data.company_name ?? '',
          service_name: data.service_name ?? '',
          cost: billingCycle === 'yearly' ? parseFloat((cost / 12).toFixed(2)) : cost,
          cost_per_cycle: cost,
          billing_cycle: billingCycle,
          custom_cycle_months: billingCycle === 'custom' ? 3 : undefined,
          currency: (data.currency === 'ILS' ? 'ILS' : 'USD') as 'ILS' | 'USD',
          renewal_date: data.renewal_date ?? '',
          notes: data.notes ?? '',
        });
        openFab();
      } else {
        setScanError('לא נמצאו פרטים ליצירת מנוי חדש');
        setTimeout(() => setScanError(''), 4000);
      }
    } catch {
      setScanError('שגיאה בסריקה, נסה שנית');
      setTimeout(() => setScanError(''), 4000);
    } finally {
      setScanning(false);
    }
  }
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
        minHeight: '100dvh', background: 'var(--bg-page)',
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
      backgroundColor: 'var(--bg-page)',
      backgroundImage: 'var(--bg-gradient)',
    }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border-header)',
        paddingInlineStart: 'max(20px, env(safe-area-inset-right))',
        paddingInlineEnd: 'max(20px, env(safe-area-inset-left))',
        paddingTop: 'max(0px, env(safe-area-inset-top))',
        position: 'sticky', top: 0, zIndex: 40,
        background: 'var(--bg-header)', backdropFilter: 'blur(16px)',
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
                fontSize: '17px', color: 'var(--text-logo)', letterSpacing: '-0.3px' }}>
                SubTracker
              </span>
            </div>
          )}

          {page !== 'dashboard' ? (
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-1)', fontFamily: "'Heebo', sans-serif" }}>
              {PAGE_TITLES[page]}
            </span>
          ) : (
            <button
              onClick={() => setPage('settings')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--btn-icon-bg)', border: '1px solid var(--btn-icon-border)',
                borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'var(--text-3)', flexShrink: 0,
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
              <Dashboard onOpenAdd={openFab} fabOpen={fabOpen} onFabClose={closeFab} onNavigate={setPage} scanPrefill={scanPrefill} />
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

      {/* Hidden file inputs for scan */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = ''; }} />
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
        style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = ''; }} />

      {/* FAB + menu */}
      {page === 'dashboard' && (
        <div style={{ position: 'fixed', bottom: `calc(20px + env(safe-area-inset-bottom, 0px))`, insetInlineEnd: '20px', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>

          {/* Scan error toast */}
          <AnimatePresence>
            {scanError && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                style={{ position: 'fixed', bottom: `calc(90px + env(safe-area-inset-bottom, 0px))`, insetInlineEnd: '20px', insetInlineStart: '20px', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '12px 16px', color: '#f1f5f9', fontSize: '14px', textAlign: 'center', fontFamily: "'Heebo', sans-serif" }}
              >
                {scanError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scanning overlay */}
          <AnimatePresence>
            {scanning && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
                <div style={{ width: '36px', height: '36px', border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ color: '#f1f5f9', fontSize: '15px', fontFamily: "'Heebo', sans-serif" }}>סורק קבלה...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mini action buttons */}
          <AnimatePresence>
            {fabMenuOpen && (
              <>
                {[
                  { icon: <Camera size={20} />, label: 'מצלמה', onClick: () => cameraInputRef.current?.click() },
                  { icon: <FolderOpen size={20} />, label: 'קובץ / PDF', onClick: () => fileInputRef.current?.click() },
                  { icon: <PenLine size={20} />, label: 'ידני', onClick: () => { setFabMenuOpen(false); openFab(); } },
                ].map((item, i) => (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, scale: 0.7, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0, transition: { delay: i * 0.06, duration: 0.18, ease: [0.4, 0, 0.2, 1] } }}
                    exit={{ opacity: 0, scale: 0.7, y: 12, transition: { delay: (2 - i) * 0.04 } }}
                    onClick={item.onClick}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '28px', padding: '10px 18px 10px 14px', color: 'var(--text-1)', fontSize: '14px', fontWeight: 600, fontFamily: "'Heebo', sans-serif", cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', whiteSpace: 'nowrap' }}
                  >
                    {item.icon} {item.label}
                  </motion.button>
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Backdrop */}
          <AnimatePresence>
            {fabMenuOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setFabMenuOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: -1 }} />
            )}
          </AnimatePresence>

          {/* Main FAB */}
          <motion.button
            animate={{ rotate: fabMenuOpen ? 45 : 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            onClick={() => setFabMenuOpen(v => !v)}
            style={{ width: '56px', height: '56px', borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(99,102,241,0.45)', flexShrink: 0 }}
          >
            <Plus size={24} />
          </motion.button>
        </div>
      )}
    </div>
  );
}
