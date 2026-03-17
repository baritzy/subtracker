import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotificationPrefs } from '@/hooks/useNotificationPrefs';
import { useGmailSync } from '@/hooks/useGmailSync';
import { api } from '@/lib/api';

interface Props {
  onNavigate: (page: 'dashboard') => void;
}

// ─── Reusable sub-components ────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '11px',
      color: '#64748b',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: '12px',
    }}>
      {children}
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '12px',
    }}>
      {children}
    </div>
  );
}

function Row({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 0',
      borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{ fontSize: '14px', color: '#e2e8f0', fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  );
}

// ─── Custom checkbox ─────────────────────────────────────────────────────────

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        border: checked ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
        background: checked ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.04)',
        color: '#a5b4fc',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      {checked && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2.5 7L5.5 10L11.5 4" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const btnBase: React.CSSProperties = {
    padding: '6px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    fontFamily: "'Heebo', sans-serif",
    transition: 'all 0.15s',
  };

  return (
    <div style={{
      display: 'flex',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px',
      padding: '3px',
      gap: '2px',
    }}>
      <button
        onClick={() => theme === 'light' && toggleTheme()}
        style={{
          ...btnBase,
          background: theme === 'dark' ? 'rgba(99,102,241,0.3)' : 'transparent',
          color: theme === 'dark' ? '#a5b4fc' : '#64748b',
        }}
      >
        כהה
      </button>
      <button
        onClick={() => theme === 'dark' && toggleTheme()}
        style={{
          ...btnBase,
          background: theme === 'light' ? 'rgba(99,102,241,0.3)' : 'transparent',
          color: theme === 'light' ? '#a5b4fc' : '#64748b',
        }}
      >
        בהיר
      </button>
    </div>
  );
}

// ─── Gmail section ────────────────────────────────────────────────────────────

// Google "G" logo SVG (official colors)
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function BackupSection() {
  const { status, connectGmail, disconnectGmail } = useGmailSync();
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const connected = status.connected;

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try { await disconnectGmail(); setConfirmDisconnect(false); } finally { setDisconnecting(false); }
  };

  return (
    <Section>
      <SectionTitle>גיבוי נתונים</SectionTitle>

      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: connected && status.email ? '6px' : '16px' }}>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
          background: connected ? '#22c55e' : '#ef4444',
          boxShadow: connected ? '0 0 6px rgba(34,197,94,0.6)' : '0 0 6px rgba(239,68,68,0.6)',
        }} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: connected ? '#4ade80' : '#f87171' }}>
          {connected ? 'מחובר' : 'לא מחובר'}
        </span>
      </div>

      {/* Connected email */}
      {connected && status.email && (
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
          {status.email}
        </div>
      )}

      {/* Google button */}
      <button
        onClick={connectGmail}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          width: '100%', padding: '10px 14px',
          borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.96)', color: '#3c4043',
          fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          fontFamily: "'Roboto', 'Heebo', sans-serif",
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transition: 'box-shadow 0.15s',
          justifyContent: 'flex-start',
        }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)')}
      >
        <GoogleLogo />
        {connected ? 'החלף חשבון Google' : 'חיבור חשבון Google'}
      </button>

      {/* Disconnect — shown only when connected */}
      {connected && !confirmDisconnect && (
        <button
          onClick={() => setConfirmDisconnect(true)}
          style={{
            display: 'block', width: '100%', marginTop: '14px', padding: '0',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '12px', color: '#475569', fontFamily: "'Heebo', sans-serif",
            textAlign: 'center' as const, textDecoration: 'underline',
          }}
        >
          ניתוק חשבון
        </button>
      )}

      {/* Disconnect confirmation */}
      {confirmDisconnect && (
        <div style={{
          marginTop: '14px', padding: '14px', borderRadius: '12px',
          border: '1px solid rgba(239,68,68,0.25)',
          background: 'rgba(239,68,68,0.06)',
        }}>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#fca5a5', lineHeight: 1.6 }}>
            ברגע שתנתק את החשבון, לא יתבצעו יותר גיבויים אוטומטיים. האם לנתק?
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setConfirmDisconnect(false)}
              disabled={disconnecting}
              style={{
                flex: 1, padding: '9px', borderRadius: '9px', border: 'none',
                background: 'rgba(255,255,255,0.07)', color: '#94a3b8',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                fontFamily: "'Heebo', sans-serif",
              }}
            >
              לא
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              style={{
                flex: 1, padding: '9px', borderRadius: '9px', border: 'none',
                background: 'rgba(239,68,68,0.2)', color: '#f87171',
                fontSize: '13px', fontWeight: 700, cursor: disconnecting ? 'wait' : 'pointer',
                fontFamily: "'Heebo', sans-serif", opacity: disconnecting ? 0.6 : 1,
              }}
            >
              {disconnecting ? 'מנתק...' : 'כן, נתק'}
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ─── Test notification button ─────────────────────────────────────────────────

function isAndroid() { return /android/i.test(navigator.userAgent); }
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }

function getPermissionInstructions(): string {
  if (isAndroid()) return 'הגדרות → אפליקציות → Chrome → הרשאות → התראות → אפשר';
  if (isIOS()) return 'הגדרות → Safari → התראות → אפשר';
  return 'לחץ על מנעול/מידע ליד כתובת האתר בדפדפן → התראות → אפשר';
}

function TestNotificationButton() {
  const [status, setStatus] = useState<'idle' | 'sent' | 'denied' | 'unsupported'>('idle');

  async function handleTest() {
    if (!('Notification' in window) || !window.isSecureContext) { setStatus('unsupported'); return; }

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') { setStatus('denied'); return; }

    new Notification('SubTracker — בדיקה', {
      body: 'ההתראות עובדות! Netflix מתחדש מחר.',
      icon: '/icons/icon-192.png',
    });
    setStatus('sent');
    setTimeout(() => setStatus('idle'), 3000);
  }

  return (
    <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px' }}>
      <button
        onClick={handleTest}
        style={{
          width: '100%', padding: '10px', borderRadius: '10px',
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          color: '#818cf8', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
          fontFamily: "'Heebo', sans-serif", transition: 'background 0.15s',
        }}
        onPointerEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.15)')}
        onPointerLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
      >
        שלח התראת בדיקה
      </button>

      {status === 'sent' && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#4ade80', textAlign: 'center', fontFamily: "'Heebo', sans-serif" }}>
          ✓ ההתראה נשלחה — ההתראות עובדות!
        </div>
      )}

      {status === 'denied' && (
        <div style={{
          marginTop: '10px', padding: '12px', borderRadius: '10px',
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
          fontFamily: "'Heebo', sans-serif",
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fca5a5', marginBottom: '6px' }}>
            הרשאות התראות חסומות
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>
            כדי לאפשר התראות, לך ל:
          </div>
          <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px', lineHeight: 1.7, direction: 'ltr', textAlign: 'left' }}>
            {getPermissionInstructions()}
          </div>
        </div>
      )}

      {status === 'unsupported' && (
        <div style={{
          marginTop: '10px', padding: '12px', borderRadius: '10px',
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
          fontFamily: "'Heebo', sans-serif",
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fca5a5', marginBottom: '6px' }}>
            {!window.isSecureContext ? 'נדרש חיבור מאובטח' : 'הדפדפן לא תומך בהתראות'}
          </div>
          {!window.isSecureContext && (
            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.7 }}>
              התראות עובדות רק על HTTPS או localhost.<br />
              כרגע האפליקציה רצה על IP מקומי (HTTP) — זה בסדר לפיתוח.<br />
              <span style={{ color: '#818cf8' }}>ברגע שתעלה לשרת אמיתי, ההתראות יעבדו אוטומטית.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Settings page ───────────────────────────────────────────────────────

export function Settings({ onNavigate }: Props) {
  const [prefs, setPrefs] = useNotificationPrefs();
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  async function handleReset() {
    setResetting(true);
    try {
      await api.subscriptions.deleteAll();
      onNavigate('dashboard');
    } catch (err) {
      console.error('Reset failed:', err);
      setResetting(false);
      setResetConfirm(false);
    }
  }

  return (
    <div style={{ direction: 'rtl', fontFamily: "'Heebo', sans-serif" }}>

      {/* Section A: Display mode */}
      <Section>
        <SectionTitle>מצב תצוגה</SectionTitle>
        <Row label="ערכת נושא" last>
          <ThemeToggle />
        </Row>
      </Section>

      {/* Section B: Notifications */}
      <Section>
        <SectionTitle>התראות חידוש</SectionTitle>
        <Row label="7 ימים לפני">
          <Checkbox
            checked={prefs.d7}
            onChange={() => setPrefs({ ...prefs, d7: !prefs.d7 })}
          />
        </Row>
        <Row label="24 שעות לפני">
          <Checkbox
            checked={prefs.h24}
            onChange={() => setPrefs({ ...prefs, h24: !prefs.h24 })}
          />
        </Row>
        <Row label="3 שעות לפני" last>
          <Checkbox
            checked={prefs.h3}
            onChange={() => setPrefs({ ...prefs, h3: !prefs.h3 })}
          />
        </Row>
        <TestNotificationButton />
      </Section>

      {/* Section C: Backup */}
      <BackupSection />

      {/* Section D: Danger zone */}
      <Section>
        <SectionTitle style={{ color: '#ef4444' } as React.CSSProperties}>אזור מסוכן</SectionTitle>

        {resetConfirm ? (
          <div>
            <p style={{
              fontSize: '13px',
              color: '#fca5a5',
              marginBottom: '16px',
              lineHeight: 1.6,
            }}>
              האם אתה בטוח? כל המנויים יימחקו לצמיתות ולא ניתן לשחזרם.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setResetConfirm(false)}
                disabled={resetting}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontFamily: "'Heebo', sans-serif",
                }}
              >
                לא, קח אותי אחורה
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 700,
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.5)',
                  color: '#f87171',
                  cursor: resetting ? 'wait' : 'pointer',
                  fontFamily: "'Heebo', sans-serif",
                  opacity: resetting ? 0.6 : 1,
                }}
              >
                {resetting ? 'מוחק...' : 'אפס נתונים'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setResetConfirm(true)}
            style={{
              width: '100%',
              padding: '12px 20px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 700,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171',
              cursor: 'pointer',
              fontFamily: "'Heebo', sans-serif",
              textAlign: 'center',
            }}
          >
            אפס את כל הנתונים
          </button>
        )}
      </Section>
    </div>
  );
}
