import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotificationPrefs } from '@/hooks/useNotificationPrefs';
import { api } from '@/lib/api';

interface Props {
  onNavigate: (page: 'dashboard') => void;
  onLogout: () => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '11px', color: '#64748b', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px',
    }}>
      {children}
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px', padding: '20px', marginBottom: '12px',
    }}>
      {children}
    </div>
  );
}

function Row({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{ fontSize: '14px', color: '#e2e8f0', fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: '28px', height: '28px', borderRadius: '50%',
        border: checked ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
        background: checked ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.04)',
        color: '#a5b4fc', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s', flexShrink: 0,
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

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const btnBase: React.CSSProperties = {
    padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
    cursor: 'pointer', border: 'none', fontFamily: "'Heebo', sans-serif", transition: 'all 0.15s',
  };
  return (
    <div style={{
      display: 'flex', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px', padding: '3px', gap: '2px',
    }}>
      <button onClick={() => theme === 'light' && toggleTheme()} style={{
        ...btnBase,
        background: theme === 'dark' ? 'rgba(99,102,241,0.3)' : 'transparent',
        color: theme === 'dark' ? '#a5b4fc' : '#64748b',
      }}>כהה</button>
      <button onClick={() => theme === 'dark' && toggleTheme()} style={{
        ...btnBase,
        background: theme === 'light' ? 'rgba(99,102,241,0.3)' : 'transparent',
        color: theme === 'light' ? '#a5b4fc' : '#64748b',
      }}>בהיר</button>
    </div>
  );
}

function isAndroid() { return /android/i.test(navigator.userAgent); }
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function getPermissionInstructions() {
  if (isAndroid()) return 'הגדרות → אפליקציות → Chrome → הרשאות → התראות → אפשר';
  if (isIOS()) return 'הגדרות → Safari → התראות → אפשר';
  return 'לחץ על מנעול/מידע ליד כתובת האתר בדפדפן → התראות → אפשר';
}

function TestNotificationButton() {
  const [status, setStatus] = useState<'idle' | 'sent' | 'denied' | 'unsupported'>('idle');

  async function handleTest() {
    if (!('Notification' in window) || !window.isSecureContext) { setStatus('unsupported'); return; }
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') { setStatus('denied'); return; }

    try {
      // Use SW showNotification — works on all platforms including Android
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('SubTracker — בדיקה ✓', {
        body: 'ההתראות עובדות! Netflix מתחדש מחר.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'test-notification',
      });
    } catch {
      // Fallback for desktop browsers without SW
      new Notification('SubTracker — בדיקה ✓', { body: 'ההתראות עובדות! Netflix מתחדש מחר.', icon: '/icons/icon-192.png' });
    }
    setStatus('sent');
    setTimeout(() => setStatus('idle'), 3000);
  }

  return (
    <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px' }}>
      <button onClick={handleTest} style={{
        width: '100%', padding: '10px', borderRadius: '10px',
        background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
        color: '#818cf8', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
        fontFamily: "'Heebo', sans-serif",
      }}>
        שלח התראת בדיקה
      </button>
      {status === 'sent' && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#4ade80', textAlign: 'center' }}>
          ✓ ההתראה נשלחה — ההתראות עובדות!
        </div>
      )}
      {status === 'denied' && (
        <div style={{ marginTop: '10px', padding: '12px', borderRadius: '10px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fca5a5', marginBottom: '6px' }}>הרשאות התראות חסומות לאתר זה</div>
          <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.7 }}>{getPermissionInstructions()}</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
            לאחר שינוי ההגדרות — רענן את הדף ונסה שוב
          </div>
        </div>
      )}
      {status === 'unsupported' && (
        <div style={{ marginTop: '10px', padding: '12px', borderRadius: '10px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fca5a5' }}>
            {!window.isSecureContext ? 'נדרש חיבור מאובטח (HTTPS)' : 'הדפדפן לא תומך בהתראות'}
          </div>
        </div>
      )}
    </div>
  );
}

export function Settings({ onNavigate, onLogout }: Props) {
  const [prefs, setPrefs] = useNotificationPrefs();
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    api.auth.me().then(u => setUserEmail(u.email)).catch(() => {});
  }, []);

  async function handleReset() {
    setResetting(true);
    try {
      await api.subscriptions.deleteAll();
      onNavigate('dashboard');
    } catch {
      setResetting(false);
      setResetConfirm(false);
    }
  }

  return (
    <div style={{ direction: 'rtl', fontFamily: "'Heebo', sans-serif" }}>

      {/* Display */}
      <Section>
        <SectionTitle>מצב תצוגה</SectionTitle>
        <Row label="ערכת נושא" last><ThemeToggle /></Row>
      </Section>

      {/* Notifications */}
      <Section>
        <SectionTitle>התראות חידוש</SectionTitle>
        <Row label="7 ימים לפני">
          <Checkbox checked={prefs.d7} onChange={() => setPrefs({ ...prefs, d7: !prefs.d7 })} />
        </Row>
        <Row label="24 שעות לפני">
          <Checkbox checked={prefs.h24} onChange={() => setPrefs({ ...prefs, h24: !prefs.h24 })} />
        </Row>
        <Row label="3 שעות לפני" last>
          <Checkbox checked={prefs.h3} onChange={() => setPrefs({ ...prefs, h3: !prefs.h3 })} />
        </Row>
        <TestNotificationButton />
      </Section>

      {/* Account */}
      <Section>
        <SectionTitle>חשבון</SectionTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
            background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px',
          }}>G</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>מחובר עם Google</div>
            {userEmail && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{userEmail}</div>}
          </div>
        </div>
        {!logoutConfirm ? (
          <button onClick={() => setLogoutConfirm(true)} style={{
            width: '100%', padding: '10px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            fontFamily: "'Heebo', sans-serif",
          }}>
            יציאה מהחשבון
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setLogoutConfirm(false)} style={{
              flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
              background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Heebo', sans-serif",
            }}>לא</button>
            <button onClick={onLogout} style={{
              flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
              background: 'rgba(239,68,68,0.15)', color: '#f87171',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Heebo', sans-serif",
            }}>יציאה</button>
          </div>
        )}
      </Section>

      {/* Danger zone */}
      <Section>
        <SectionTitle>אזור מסוכן</SectionTitle>
        {resetConfirm ? (
          <div>
            <p style={{ fontSize: '13px', color: '#fca5a5', marginBottom: '16px', lineHeight: 1.6 }}>
              האם אתה בטוח? כל המנויים יימחקו לצמיתות.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setResetConfirm(false)} disabled={resetting} style={{
                padding: '10px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', cursor: 'pointer', fontFamily: "'Heebo', sans-serif",
              }}>לא, קח אותי אחורה</button>
              <button onClick={handleReset} disabled={resetting} style={{
                padding: '10px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)',
                color: '#f87171', cursor: resetting ? 'wait' : 'pointer',
                fontFamily: "'Heebo', sans-serif", opacity: resetting ? 0.6 : 1,
              }}>{resetting ? 'מוחק...' : 'אפס נתונים'}</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setResetConfirm(true)} style={{
            width: '100%', padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 700,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171', cursor: 'pointer', fontFamily: "'Heebo', sans-serif",
          }}>אפס את כל הנתונים</button>
        )}
      </Section>
    </div>
  );
}
