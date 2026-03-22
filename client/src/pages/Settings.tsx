import { useState, useEffect } from 'react';
import { useNotificationPrefs } from '@/hooks/useNotificationPrefs';
import { subscribeToPush } from '@/hooks/useNotifications';
import { api } from '@/lib/api';

interface Props {
  onNavigate: (page: 'dashboard') => void;
  onLogout: () => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '11px', color: 'var(--text-4)', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px',
    }}>
      {children}
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
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
      padding: '10px 0', borderBottom: last ? 'none' : '1px solid var(--border-faint)',
    }}>
      <span style={{ fontSize: '14px', color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
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



export function Settings({ onNavigate, onLogout }: Props) {
  const [prefs, setPrefs] = useNotificationPrefs();
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [testPushResult, setTestPushResult] = useState<'sent' | 'no_sub' | 'error' | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [activating, setActivating] = useState(false);
  const [activateResult, setActivateResult] = useState<'ok' | 'denied' | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    api.auth.me().then(u => setUserEmail(u.email)).catch(() => {});
    if (!('Notification' in window)) {
      setNotifPermission('unsupported');
    } else {
      setNotifPermission(Notification.permission);
    }
  }, []);

  async function handleDebug() {
    const lines: string[] = [];
    lines.push(`permission: ${('Notification' in window) ? Notification.permission : 'NO API'}`);
    lines.push(`SW: ${'serviceWorker' in navigator ? 'yes' : 'no'}`);
    lines.push(`PushMgr: ${'PushManager' in window ? 'yes' : 'no'}`);
    try {
      const reg = await navigator.serviceWorker.ready;
      lines.push(`SW ready: yes`);
      const sub = await reg.pushManager.getSubscription();
      lines.push(`subscription: ${sub ? sub.endpoint.slice(-20) : 'none'}`);
    } catch (e) {
      lines.push(`SW error: ${e}`);
    }
    try {
      const { key } = await api.push.vapidKey();
      lines.push(`VAPID: ${key ? key.slice(0, 10) + '...' : 'missing'}`);
    } catch {
      lines.push(`VAPID: error`);
    }
    setDebugInfo(lines.join('\n'));
  }

  async function handleActivateNotifications() {
    setActivating(true);
    setActivateResult(null);
    try {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      setNotifPermission(permission);
      if (permission === 'granted') {
        await subscribeToPush();
        setActivateResult('ok');
      } else {
        setActivateResult('denied');
      }
    } catch {
      setActivateResult('denied');
    } finally {
      setActivating(false);
      setTimeout(() => setActivateResult(null), 5000);
    }
  }

  async function handleTestPush() {
    setTestingPush(true);
    setTestPushResult(null);
    try {
      await api.push.test();
      setTestPushResult('sent');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? (err as { message: string }).message : '';
      setTestPushResult(msg.includes('no_subscription') ? 'no_sub' : 'error');
    } finally {
      setTestingPush(false);
      setTimeout(() => setTestPushResult(null), 5000);
    }
  }

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

      {/* Debug */}
      <Section>
        <button onClick={handleDebug} style={{
          width: '100%', padding: '10px', borderRadius: '10px',
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
          color: '#6366f1', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
          fontFamily: "'Heebo', sans-serif",
        }}>🔍 בדוק מצב התראות</button>
        {debugInfo && (
          <pre style={{
            marginTop: '10px', padding: '10px', borderRadius: '8px',
            background: 'rgba(0,0,0,0.15)', fontSize: '11px', color: '#94a3b8',
            whiteSpace: 'pre-wrap', fontFamily: 'monospace', direction: 'ltr',
          }}>{debugInfo}</pre>
        )}
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
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Activate / status button */}
          {notifPermission !== 'unsupported' && (
            <>
              <button
                onClick={handleActivateNotifications}
                disabled={activating}
                style={{
                  width: '100%', padding: '10px', borderRadius: '10px',
                  background: notifPermission === 'granted' && !activateResult ? 'rgba(16,185,129,0.08)' : activateResult === 'ok' ? 'rgba(16,185,129,0.12)' : activateResult === 'denied' || notifPermission === 'denied' ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.08)',
                  border: notifPermission === 'granted' && !activateResult ? '1px solid rgba(16,185,129,0.2)' : activateResult === 'ok' ? '1px solid rgba(16,185,129,0.3)' : activateResult === 'denied' || notifPermission === 'denied' ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(99,102,241,0.15)',
                  color: notifPermission === 'granted' && !activateResult ? '#10b981' : activateResult === 'ok' ? '#10b981' : activateResult === 'denied' || notifPermission === 'denied' ? '#f87171' : '#6366f1',
                  cursor: activating ? 'wait' : 'pointer',
                  fontSize: '13px', fontWeight: 600, fontFamily: "'Heebo', sans-serif", opacity: activating ? 0.6 : 1,
                }}
              >
                {activating ? 'מפעיל...' :
                 activateResult === 'ok' ? '✓ התראות הופעלו!' :
                 notifPermission === 'granted' ? '✓ התראות מופעלות — לחץ לרענון' :
                 notifPermission === 'denied' ? '⛔ התראות חסומות בדפדפן — לחץ לפתרון' :
                 'הפעל התראות'}
              </button>
              {notifPermission === 'denied' && (
                <div style={{
                  background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                  borderRadius: '10px', padding: '12px 14px', fontSize: '12px',
                  color: '#94a3b8', lineHeight: 1.7, direction: 'rtl',
                }}>
                  <div style={{ fontWeight: 700, color: '#f87171', marginBottom: '6px' }}>כיצד לאפשר:</div>
                  <div>1. פתח את אפליקציית <strong>כרום</strong></div>
                  <div>2. תפריט (⋮) ← הגדרות ← הגדרות אתר</div>
                  <div>3. התראות ← מצא את האתר הזה ← <strong>אפשר</strong></div>
                  <div style={{ marginTop: '6px', color: '#64748b' }}>לאחר מכן חזור לאפליקציה ולחץ שוב</div>
                </div>
              )}
            </>
          )}
          {/* Test push button — only when granted */}
          {notifPermission === 'granted' && (
            <button
              onClick={handleTestPush}
              disabled={testingPush}
              style={{
                width: '100%', padding: '10px', borderRadius: '10px',
                background: testPushResult === 'sent' ? 'rgba(16,185,129,0.12)' : testPushResult === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.08)',
                border: testPushResult === 'sent' ? '1px solid rgba(16,185,129,0.3)' : testPushResult === 'error' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(99,102,241,0.15)',
                color: testPushResult === 'sent' ? '#10b981' : testPushResult === 'error' ? '#f87171' : '#6366f1',
                cursor: testingPush ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 600,
                fontFamily: "'Heebo', sans-serif", opacity: testingPush ? 0.6 : 1,
              }}
            >
              {testingPush ? 'שולח...' : testPushResult === 'sent' ? '✓ ההתראה נשלחה!' : testPushResult === 'no_sub' ? '⚠ לחץ "הפעל התראות" קודם' : testPushResult === 'error' ? 'שגיאה — נסה שוב' : 'שלח התראה ניסיון'}
            </button>
          )}
        </div>
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
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)' }}>מחובר עם Google</div>
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
