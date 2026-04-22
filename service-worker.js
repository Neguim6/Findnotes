const CACHE_NAME = 'finnotes-v14';
const ASSETS = ['./index.html', './script.js', './manifest.json'];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    e.respondWith(
        fetch(e.request)
            .then((res) => {
                const clone = res.clone();
                caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});

// Lógica de Notificação enviada pelo Script principal
self.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'CHECK_ALERTS') {
        // Lógica de envio de notificação push aqui
    }
});
