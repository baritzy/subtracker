import { useEffect, useRef } from 'react';
import type { Subscription } from '@/types';
import type { NotifPrefs } from './useNotificationPrefs';

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

async function showImmediateNotification(sub: Subscription, label: string, offsetKey: string) {
  if (Notification.permission !== 'granted') return;
  const tag = `imm-${sub.id}-${offsetKey}`;
  try {
    // Service worker showNotification — required on Android
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('SubTracker', {
      body: `${sub.company_name} מתחדש ${label}`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag,
      data: { url: '/' },
    });
  } catch {
    // Desktop fallback
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
      // Skip if this notification type is disabled
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

  // Request permission on mount
  useEffect(() => {
    if (permissionRequested.current) return;
    permissionRequested.current = true;

    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  // Send subscriptions to SW and run immediate check when subscriptions change
  useEffect(() => {
    if (!subscriptions.length) return;

    const prefs = getPrefs();

    // Send to service worker (include prefs so SW can also filter)
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.ready.then(reg => {
        reg.active?.postMessage({
          type: 'SCHEDULE_NOTIFICATIONS',
          subscriptions,
          prefs,
        });
      });
    }

    // Immediate local check
    runImmediateCheck(subscriptions);
  }, [subscriptions]);
}
