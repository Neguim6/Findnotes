/* ============================================================
   FinNotes — service-worker.js
   Aggressive caching strategy + Skip Waiting for instant updates
   ============================================================ */

const CACHE_NAME    = 'finnotes-v2';
const OFFLINE_URL   = './index.html';

// All app shell assets to pre-cache
const PRECACHE_ASSETS = [
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
];

// ── INSTALL: Pre-cache all shell assets ──────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing version:', CACHE_NAME);

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );

  // Do NOT self.skipWaiting() here automatically.
  // We wait for an explicit SKIP_WAITING message from the client
  // so the user can decide when to activate the update.
});

// ── ACTIVATE: Clean up old caches ────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating version:', CACHE_NAME);

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Take control of all open clients immediately
      return self.clients.claim();
    })
  );
});

// ── FETCH: Cache-first with network fallback ─────────────────
self.addEventListener('fetch', event => {
  // Only handle same-origin GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip cross-origin requests (Google Fonts, etc.)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Cache hit: return cached, then refresh in background (Stale-While-Revalidate)
      if (cachedResponse) {
        const networkFetch = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          }
          return networkResponse;
        }).catch(() => {/* offline — cached version already served */});

        // Return cache immediately while background refresh happens
        return cachedResponse;
      }

      // No cache: fetch from network and cache the result
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const cloned = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        return networkResponse;
      }).catch(() => {
        // Offline and not cached: return the offline fallback
        return caches.match(OFFLINE_URL);
      });
    })
  );
});

// ── MESSAGE: Handle SKIP_WAITING from client ─────────────────
// When the user clicks "Atualizar agora" in the update banner,
// the client sends this message to activate the new SW immediately.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting — activating new version now.');
    self.skipWaiting();
  }
});
