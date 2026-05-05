// D-OS Service Worker — network-first with offline fallback + push relay
const CACHE = 'dos-v4';

const PRECACHE = [
  '/',
  '/css/style.css',
  '/data/seed.js',
  '/js/migration.js',
  '/js/character.js',
  '/js/app.js',
  '/js/finances.js',
  '/js/health.js',
  '/js/intelligence.js',
  '/js/work.js',
  '/js/ai.js',
  '/js/google-api.js',
  '/manifest.json',
  '/assets/icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

// Install — pre-cache all static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[D-OS SW] Precache partial failure:', err))
  );
});

// Activate — purge old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch — network-first for HTML and API, cache-first for static assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept API or external auth requests
  if (url.pathname.startsWith('/api/') || (url.hostname !== self.location.hostname && !url.hostname.includes('cdnjs.cloudflare.com'))) {
    return;
  }

  const isNavigation = e.request.mode === 'navigate';
  const isStatic     = /\.(js|css|svg|png|ico|json|woff2?)$/.test(url.pathname) || url.hostname !== self.location.hostname;

  if (isStatic && !isNavigation) {
    // Cache-first for static assets — fast loads, update in background
    e.respondWith(
      caches.match(e.request).then(cached => {
        const networkFetch = fetch(e.request).then(resp => {
          if (resp.ok) caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          return resp;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
  } else {
    // Network-first for HTML — always fresh, fall back to cache offline
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          if (resp.ok && e.request.method === 'GET') {
            caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          }
          return resp;
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('/')))
    );
  }
});

// Push notification handler (for future server-sent pushes)
self.addEventListener('push', e => {
  let data = { title: 'D-OS', body: 'You have an update.' };
  try { data = e.data.json(); } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'D-OS', {
      body:    data.body  || '',
      icon:    '/assets/icon.svg',
      badge:   '/assets/icon.svg',
      tag:     data.tag   || 'dos-push',
      vibrate: [200, 100, 200]
    })
  );
});

// Relay local notifications posted from the main thread
self.addEventListener('message', e => {
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = e.data;
    self.registration.showNotification(title || 'D-OS', {
      body:    body  || '',
      icon:    '/assets/icon.svg',
      badge:   '/assets/icon.svg',
      tag:     tag   || 'dos-local',
      vibrate: [200, 100, 200]
    });
  }
});

// Notification click — focus or open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow('/');
    })
  );
});
