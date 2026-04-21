const CACHE_NAME = 'finnotes-v13';
const ASSETS = ['./', './index.html', './script.js', './manifest.json'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => k !== CACHE_NAME && caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// ─── NOTIFICAÇÕES EM BACKGROUND ──────────────────────────────────────────────
// Recebe mensagem do app pedindo para checar alertas
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'CHECK_ALERTS') {
    checkAndNotify(e.data.notes);
  }
});

// Periodic Background Sync (Android Chrome com PWA instalado)
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'finnotes-check') {
    e.waitUntil(checkFromStorage());
  }
});

// Notification click — abre o app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('index.html') || client.url.endsWith('/')) {
          return client.focus();
        }
      }
      return clients.openWindow('./index.html');
    })
  );
});

// Lê as notas do IndexedDB (salvas pelo app) e verifica alertas
async function checkFromStorage() {
  try {
    const notes = await getNotesFromIDB();
    if (notes) checkAndNotify(notes);
  } catch (e) { /* silencioso */ }
}

function getDiffDias(dataVenc) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [ano, mes, dia] = dataVenc.split('-').map(Number);
  const venc = new Date(ano, mes - 1, dia);
  venc.setHours(0, 0, 0, 0);
  return Math.round((venc - hoje) / 86400000);
}

async function checkAndNotify(notes) {
  if (!Array.isArray(notes)) return;

  for (const n of notes) {
    if (!n.dataVenc || n.pagas === n.parcelas) continue;

    const diff = getDiffDias(n.dataVenc);
    const [ano, mes, dia] = n.dataVenc.split('-');
    const dataFmt = `${dia}/${mes}/${ano}`;
    const valorParcela = `R$ ${(n.total / n.parcelas).toFixed(2)}`;

    // Chave única para não repetir notificação no mesmo dia
    const hoje = new Date().toISOString().slice(0, 10);
    const notifTag = `finnotes-${n.id}-${hoje}`;

    let titulo = null;
    let corpo = null;
    let icone = '🔔';

    if (diff < 0) {
      titulo = '🚨 Conta Vencida!';
      corpo = `"${n.nome}" venceu em ${dataFmt}. Valor: ${valorParcela}`;
    } else if (diff === 0) {
      titulo = '⚠️ Vence Hoje!';
      corpo = `"${n.nome}" vence hoje (${dataFmt}). Valor: ${valorParcela}`;
    } else if (diff <= 3) {
      titulo = `🔔 Vence em ${diff} dia${diff > 1 ? 's' : ''}`;
      corpo = `"${n.nome}" vence em ${dataFmt}. Valor: ${valorParcela}`;
    }

    if (titulo) {
      // Evita notificação duplicada no mesmo dia para a mesma nota
      const existing = await self.registration.getNotifications({ tag: notifTag });
      if (existing.length === 0) {
        await self.registration.showNotification(titulo, {
          body: corpo,
          tag: notifTag,
          icon: 'https://cdn-icons-png.flaticon.com/512/552/552791.png',
          badge: 'https://cdn-icons-png.flaticon.com/512/552/552791.png',
          vibrate: [200, 100, 200],
          requireInteraction: diff <= 0, // Fica na tela até tocar se vencido/hoje
          data: { noteId: n.id }
        });
      }
    }
  }
}

// ─── INDEXEDDB HELPER ────────────────────────────────────────────────────────
function getNotesFromIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('finnotes_db', 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('kv');
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('kv', 'readonly');
      const store = tx.objectStore('kv');
      const get = store.get('notes');
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => reject(get.error);
    };
    req.onerror = () => reject(req.error);
  });
}
