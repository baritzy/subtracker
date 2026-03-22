import { useEffect, useRef } from 'react';
import type { Subscription } from '@/types';
import type { NotifPrefs } from './useNotificationPrefs';
import { api } from '@/lib/api';

const OFFSETS = [
  { key: '7d',  prefKey: 'd7',  hours: 168, label: 'בעוד 7 ימים' },
  { key: '24h', prefKey: 'h24', hours: 24,  label: 'מחר' },
  { key: '3h',  prefKey: 'h3',  hours: 3,   label: 'בעוד 3 שעות' },
] as const;

function getPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem('notif-prefs');
    if (!raw) return { d7: true, h24: true, h3: true };
    const parsed = JSON.parse(raw) as Partial<NotifPrefs>;
    return {
      d7: parsed.d7 ?? true,
      h24: parsed.h24 ?? true,
      h3: parsed.h3 ?? true,
    };
  } catch {
    return { d7: true, h24: true, h3: true };
  }
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function localNotifKey(id: number, offsetKey: string): string {
  return `notif-${id}-${offsetKey}-${getTodayDateString()}`;
}

// Convert a base64 VAPID public key string to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

// Subscribe to Web Push and send subscription to server
export async function subscribeToPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;

    const { key } = await api.push.vapidKey();
    if (!key) return;

    // Get existing subscription or create a new one
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }

    const json = sub.toJSON();
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!p256dh || !auth) return;

    // Always sync to server — handles re-login after JWT change
    await api.push.subscribe({ endpoint: sub.endpoint, p256dh, auth });
    console.log('[Push] Push subscription synced to server.');
  } catch (err) {
    console.warn('[Push] Subscribe failed:', err);
  }
}

async function showImmediateNotification(sub: Subscription, label: string, offsetKey: string) {
  if (Notification.permission !== 'granted') return;
  const tag = `imm-${sub.id}-${offsetKey}`;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('SubTracker', {
      body: `${sub.company_name} מתחדש ${label}`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag,
      data: { url: '/' },
    });
  } catch {
    new Notification('SubTracker', {
      body: `${sub.company_name} מתחדש ${label}`,
      icon: '/icons/icon-192.png',
      tag,
    });
  }
}

function runImmediateCheck(subscriptions: Subscription[]) {
  if (Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;

  const now = Date.now();
  const prefs = getPrefs();

  for (const sub of subscriptions) {
    if (sub.status !== 'active') continue;

    const renewalTs = new Date(sub.renewal_date).getTime();

    for (const offset of OFFSETS) {
      if (!prefs[offset.prefKey]) continue;

      const storageKey = localNotifKey(sub.id, offset.key);
      if (localStorage.getItem(storageKey)) continue;

      const windowMs = offset.hours * 60 * 60 * 1000;
      const diff = renewalTs - now;

      if (diff > 0 && diff <= windowMs) {
        localStorage.setItem(storageKey, '1');
        void showImmediateNotification(sub, offset.label, offset.key);
      }
    }
  }
}

export function useNotifications(subscriptions: Subscription[]) {
  const permissionRequested = useRef(false);

  // Request permission on mount, then subscribe to Web Push
  useEffect(() => {
    if (permissionRequested.current) return;
    permissionRequested.current = true;

    if (!('Notification' in window)) return;

    async function requestAndSubscribe() {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission === 'granted') {
        await subscribeToPush();
      }
    }
    void requestAndSubscribe();
  }, []);

  // Send subscriptions to SW and run immediate check when subscriptions change
  useEffect(() => {
    if (!subscriptions.length) return;

    const prefs = getPrefs();

    // Send to service worker for background checks while app is in recent apps
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.ready.then(reg => {
        reg.active?.postMessage({
          type: 'SCHEDULE_NOTIFICATIONS',
          subscriptions,
          prefs,
        });
      });
    }

    // Immediate local check (for when app is opened)
    runImmediateCheck(subscriptions);
  }, [subscriptions]);
}
