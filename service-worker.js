const CACHE_NAME = 'finnotes-v10-pro';
const ASSETS = [
  './',
  './index.html',
  './script.js',
  './manifest.json',
  'https://cdn-icons-png.flaticon.com/512/552/552791.png'
];

// Instalação: Salva os arquivos no cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Cache de ativos configurado');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting(); // Força a atualização imediata do Service Worker
});

// Ativação: Limpa caches antigos de versões anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('SW: Removendo cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim(); // Assume o controle das abas abertas imediatamente
});

// Estratégia: Network First, falling back to Cache
// Tenta buscar na rede, se falhar (offline), pega do cache.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
