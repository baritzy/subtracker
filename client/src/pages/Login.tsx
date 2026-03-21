import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  onLogin: () => void;
}

export function Login({ onLogin }: Props) {
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      const { url } = await api.auth.googleUrl();

      if (isMobile) {
        // Open in Chrome Custom Tab (window.open) — avoids Android showing a
        // "Open with Gmail/Chrome" chooser that happens with direct navigation.
        // When OAuth completes, the callback redirects to /?token= which the TWA
        // intercepts (verified origin) and loads in the main window.
        window.open(url, '_blank');
        return;
      }

      // Desktop: open popup. Callback redirects to /?token=, popup stores token
      // and closes itself. We detect completion via the storage event.
      const popup = window.open(url, 'google-auth', 'width=500,height=600,scrollbars=yes');
      if (!popup) {
        window.location.href = url;
        return;
      }

      const storageHandler = (e: StorageEvent) => {
        if (e.key === 'auth_token' && e.newValue) {
          window.removeEventListener('storage', storageHandler);
          onLogin();
        }
      };
      window.addEventListener('storage', storageHandler);
    } catch {
      setError('שגיאה בהתחברות. נסה שוב.');
      setLoading(false);
    }
  }

  async function handleContinueAsGuest() {
    setGuestLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/anonymous', { method: 'POST' });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        onLogin();
      } else {
        setError('שגיאה בהתחברות. נסה שוב.');
      }
    } catch {
      setError('שגיאה בהתחברות. נסה שוב.');
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-page)',
      backgroundImage: 'var(--bg-gradient)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      fontFamily: "'Heebo', sans-serif",
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
        <img
          src="/icons/icon-192.png"
          alt="SubTracker"
          style={{ width: '56px', height: '56px', borderRadius: '16px' }}
        />
        <span style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-logo)', letterSpacing: '-0.5px' }}>
          SubTracker
        </span>
      </div>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: '360px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '24px',
        padding: '40px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-1)', margin: 0 }}>
            שלום 👋
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '8px', lineHeight: 1.6 }}>
            התחבר עם Google כדי לשמור את המנויים שלך ולגשת אליהם מכל מכשיר.
          </p>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '14px 24px',
            background: loading ? 'var(--bg-card-hover)' : '#fff',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '15px',
            fontWeight: '600',
            color: loading ? 'var(--text-4)' : '#1e293b',
            fontFamily: "'Heebo', sans-serif",
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? (
            <span style={{ color: 'var(--text-4)' }}>מתחבר...</span>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              המשך עם Google
            </>
          )}
        </button>

        {error && (
          <p style={{ fontSize: '13px', color: '#ef4444', margin: 0, textAlign: 'center' }}>
            {error}
          </p>
        )}

        <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: 0, textAlign: 'center', lineHeight: 1.6 }}>
          אנחנו שומרים רק את האימייל ושם שלך. לא קוראים מיילים.
        </p>

        <div style={{ width: '100%', height: '1px', background: 'var(--border-faint)' }} />

        <button
          onClick={handleContinueAsGuest}
          disabled={guestLoading || loading}
          style={{
            width: '100%',
            padding: '12px 24px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            cursor: (guestLoading || loading) ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            color: 'var(--text-3)',
            fontFamily: "'Heebo', sans-serif",
            transition: 'color 0.15s',
          }}
        >
          {guestLoading ? 'מתחבר...' : 'המשך ללא גיבוי נתונים'}
        </button>
      </div>
    </div>
  );
}
