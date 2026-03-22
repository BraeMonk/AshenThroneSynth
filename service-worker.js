// Ashen Throne — Music Forge · Service Worker
// Strategy: cache-first for local assets + fonts, network-only for APIs
// Bump CACHE version string whenever you deploy a new index.html build.

const CACHE = ‘music-forge-v62’;
const FONT_CACHE = ‘music-forge-fonts-v1’; // separate so fonts survive app updates

const PRECACHE = [
‘./index.html’,
‘./manifest.json’,
‘./icon.png’,
];

// These hostnames always go straight to the network — never cache them
const NETWORK_ONLY_HOSTS = [
‘api.groq.com’,
‘api.anthropic.com’,
];

// ── Install: precache core assets ────────────────────────────────────────────
self.addEventListener(‘install’, event => {
event.waitUntil(
caches.open(CACHE)
.then(cache => cache.addAll(PRECACHE))
.then(() => self.skipWaiting()) // take control immediately, don’t wait for old SW to die
);
});

// ── Activate: remove any old app caches (but keep font cache) ────────────────
self.addEventListener(‘activate’, event => {
event.waitUntil(
caches.keys()
.then(keys => Promise.all(
keys
.filter(k => k !== CACHE && k !== FONT_CACHE)
.map(k => caches.delete(k))
))
.then(() => self.clients.claim()) // take control of already-open pages
);
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener(‘fetch’, event => {
const url = new URL(event.request.url);

// 1. API calls — always network, never cache
if (NETWORK_ONLY_HOSTS.some(h => url.hostname.includes(h))) {
event.respondWith(fetch(event.request));
return;
}

// 2. Google Fonts CSS — stale-while-revalidate so font changes eventually
//    propagate but the app never blocks on a font network request
if (url.hostname === ‘fonts.googleapis.com’) {
event.respondWith(
caches.open(FONT_CACHE).then(cache =>
cache.match(event.request).then(cached => {
const networkFetch = fetch(event.request).then(response => {
if (response && response.status === 200) {
cache.put(event.request, response.clone());
}
return response;
}).catch(() => cached); // offline: serve stale
return cached || networkFetch;
})
)
);
return;
}

// 3. Google Fonts files (gstatic) — cache-first, they’re immutable by URL
if (url.hostname === ‘fonts.gstatic.com’) {
event.respondWith(
caches.open(FONT_CACHE).then(cache =>
cache.match(event.request).then(cached => {
if (cached) return cached;
return fetch(event.request).then(response => {
if (response && response.status === 200) {
cache.put(event.request, response.clone());
}
return response;
});
})
)
);
return;
}

// 4. Everything else (local assets) — cache-first, fall back to network
event.respondWith(
caches.match(event.request).then(cached => {
if (cached) return cached;
return fetch(event.request).then(response => {
if (!response || response.status !== 200 || response.type === ‘opaque’) {
return response;
}
const clone = response.clone();
caches.open(CACHE).then(cache => cache.put(event.request, clone));
return response;
});
})
);
});
