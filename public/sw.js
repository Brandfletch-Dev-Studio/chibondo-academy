// Chibondo Academy — Service Worker
// Robust PWA: caching, offline support, push notifications

const CACHE_NAME = 'chibondo-v1';
const STATIC_CACHE = 'chibondo-static-v1';
const API_CACHE = 'chibondo-api-v1';

// Assets to precache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png',
  '/apple-touch-icon.png',
];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Fetch Strategy ─────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Supabase API — Network first, fallback to cache
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(request, API_CACHE, 5000));
    return;
  }

  // Navigation requests — Network first, fallback to index.html (SPA), then offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful navigations
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match('/index.html').then(cached => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  // Static assets — Cache first, fallback to network
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Default: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
});

// ─── Cache Strategies ───────────────────────────────────────────────────────
async function networkFirst(request, cacheName, timeout = 5000) {
  const cache = await caches.open(cacheName);
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(id);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return cache.match(request) || new Response('Offline', { status: 503 });
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || fetchPromise;
}

// ─── Push Notifications ─────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: 'Chibondo Academy', body: event.data?.text() ?? 'You have a new notification.' };
  }

  const title = data.title || 'Chibondo Academy';
  const options = {
    body: data.body || 'You have a new notification.',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    image: data.image || undefined,
    data: {
      url: data.url || '/',
      notificationId: data.notificationId || null,
    },
    actions: data.actions || [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    tag: data.tag || 'chibondo-default',
    renotify: true,
    timestamp: Date.now(),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification Click ─────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          return;
        }
      }
      // Open new window
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ─── Push Subscription Change ───────────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.VAPID_PUBLIC_KEY,
    }).then((subscription) => {
      // Notify app to re-save subscription
      return clients.matchAll().then((clientList) => {
        clientList.forEach((client) =>
          client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', subscription })
        );
      });
    })
  );
});

// ─── Background Sync ────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  const clients_ = await clients.matchAll();
  clients_.forEach((client) => client.postMessage({ type: 'SYNC_NOTIFICATIONS' }));
}

// ─── Message Handler ────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'SET_VAPID_KEY') {
    self.VAPID_PUBLIC_KEY = event.data.key;
  }
});
