// Self-destruct: notifications moved to native Android app via FCM.
// This SW unregisters itself and clears all caches.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))),
      self.registration.unregister(),
    ])
  );
});
