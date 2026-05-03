// Caprisun service worker — offline cache for the daily ritual app.
// Bump CACHE_VERSION whenever the app shell changes so stale assets get evicted.
const CACHE_VERSION = 'caprisun-v6';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './Pics/Meaple_Leaf_of_Canada.svg.png',
  './Pics/720x480.png',
  './Pics/pngtree-beautiful-flying-kingfisher-on-transparent-background-png-image_14645995.png',
  './Pics/icons/icon-192.png',
  './Pics/icons/icon-512.png',
  './Pics/icons/icon-maskable-512.png',
  './Pics/icons/apple-touch-icon.png',
  './quiz-questions.json',
  './exercises.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Strategy:
//  - Navigations (HTML): network-first, fall back to cache, then to cached index.
//  - Same-origin static assets: stale-while-revalidate.
//  - Cross-origin (Supabase API, fonts CDN): network-only.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  if (sameOrigin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Cross-origin: don't cache, but fall through cleanly.
});
