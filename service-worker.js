/* ============================================================
   FinNotes Pro — service-worker.js
   Gestão de Cache e Notificações de Vencimento
   ============================================================ */

const CACHE_NAME = 'finnotes-v14';
const ASSETS = [
  './',
  './index.html',
  './script.js',
  './manifest.json',
  'https://cdn-icons-png.flaticon.com/512/552/552791.png'
];

// Instalação e Cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Ativação e Limpeza de Cache Antigo
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estratégia: Network First (Tenta rede, se falhar usa cache)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Verificação de Alertas (Recebe mensagens do script.js)
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'CHECK_ALERTS') {
    checkAndNotify(e.data.notes);
  }
});

async function checkAndNotify(notes) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  for (const n of notes) {
    if (n.pagas >= n.parcelas) continue;

    const dataVenc = new Date(n.data);
    const diffTime = dataVenc - hoje;
    const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const valorParc = (n.total / n.parcelas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const tag = `finnotes-${n.id}-${dataVenc.toISOString().slice(0,10)}`;

    let titulo = null;
    let corpo = null;

    if (diffDias < 0) {
      titulo = '🚨 Conta Vencida!';
      corpo = `"${n.nome}" venceu. Parcela: ${valorParc}`;
    } else if (diffDias === 0) {
      titulo = '⚠️ Vence Hoje!';
      corpo = `"${n.nome}" vence hoje no valor de ${valorParc}`;
    } else if (diffDias <= 3) {
      titulo = `🔔 Vence em ${diffDias} dias`;
      corpo = `"${n.nome}" está próximo: ${valorParc}`;
    }

    if (titulo) {
      const notifications = await self.registration.getNotifications({ tag });
      if (notifications.length === 0) {
        await self.registration.showNotification(titulo, {
          body: corpo,
          tag: tag,
          icon: 'https://cdn-icons-png.flaticon.com/512/552/552791.png',
          vibrate: [200, 100, 200],
          data: { noteId: n.id }
        });
      }
    }
  }
}

// Clique na Notificação: Abre ou foca no App
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('index.html') || client.url.endsWith('/')) {
          return client.focus();
        }
      }
      return clients.openWindow('./');
    })
  );
});
