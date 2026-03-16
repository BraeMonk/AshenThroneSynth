// Ashen Throne — Music Forge · Service Worker
// Strategy: cache-first for all local assets, network-only for Groq API

const CACHE = 'music-forge-v2';

const PRECACHE = [
  './index.html',
  './manifest.json',
  './icon.png',
];

// These origins always go straight to the network — never cache them
const NETWORK_ONLY = [
  'api.groq.com',
];

// ── Install: precache core assets ────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove any old caches ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for local, network-only for external APIs ──────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to the network for API calls and fonts (or other external origins)
  if (NETWORK_ONLY.some(origin => url.hostname.includes(origin))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Only cache valid same-origin responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
