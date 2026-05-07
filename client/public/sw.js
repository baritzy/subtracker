const CACHE = 'sub-tracker-v10';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Don't cache API calls
  if (e.request.url.includes('/api/')) return;

  // Navigation requests (HTML pages): always network-first so new deploys load immediately
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/'))
    );
    return;
  }

  // Static assets (JS, CSS, images): cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      });
      return cached || network;
    })
  );
});

// ── Web Push (server-sent, works when app is closed) ─────────────────────────

self.addEventListener('push', e => {
  let title = 'SubTracker';
  let body = '';
  try {
    const data = e.data?.json();
    title = data.title ?? title;
    body  = data.body  ?? body;
  } catch {
    body = e.data?.text() ?? '';
  }
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: '/' },
    })
  );
});

// ── Notification logic (local, while app is in recent apps) ───────────────────

let storedSubscriptions = [];
const sentNotifications = new Set();

const OFFSETS = [
  { key: '7d', hours: 168, label: 'בעוד 7 ימים' },
  { key: '24h', hours: 24,  label: 'מחר' },
  { key: '3h',  hours: 3,   label: 'בעוד 3 שעות' },
];

function checkRenewals() {
  const now = Date.now();

  for (const sub of storedSubscriptions) {
    if (sub.status !== 'active') continue;

    const renewalTs = new Date(sub.renewal_date).getTime();

    for (const offset of OFFSETS) {
      const notifKey = `${sub.id}-${offset.key}`;
      if (sentNotifications.has(notifKey)) continue;

      const windowMs = offset.hours * 60 * 60 * 1000;
      const diff = renewalTs - now;

      // Fire when renewal is within the window but still in the future
      // window: (hours - 30min) to (hours + 30min)
      const halfHour = 30 * 60 * 1000;
      if (diff > 0 && diff <= windowMs + halfHour && diff >= windowMs - halfHour) {
        sentNotifications.add(notifKey);
        self.registration.showNotification('SubTracker', {
          body: `${sub.company_name} מתחדש ${offset.label}`,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: notifKey,
          data: { url: '/' },
        });
      }
    }
  }
}

// Check every 30 minutes
setInterval(checkRenewals, 30 * 60 * 1000);

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_NOTIFICATIONS') {
    storedSubscriptions = e.data.subscriptions || [];
    // Immediate check on receiving new data
    checkRenewals();
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
