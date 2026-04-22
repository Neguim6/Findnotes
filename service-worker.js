'use strict';

const CACHE = 'finnotes-v14';
const ASSETS = [
  './index.html',
  './script.js',
  './manifest.json',
  './style.css' // Adicionei o style.css que estava faltando nos ASSETS
];

// Instala: cacheia arquivos novos
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS))
  );
});

// Ativa: limpa caches antigos e assume controle
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Estratégia de Fetch
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  // Simplificação da detecção de arquivos estáticos do app
  const isAppFile = ASSETS.some((a) => url.pathname.endsWith(a.replace('./', ''))) || url.pathname.endsWith('/');

  if (isAppFile) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          // Se a rede respondeu OK, atualiza o cache e retorna
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
            return res;
          }
          // Se a rede falhou (ex: 404), tenta o cache como fallback imediato
          return caches.match(e.request);
        })
        .catch(() => caches.match(e.request)) // Offline total
    );
  } else {
    // Para outros recursos: Cache First
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request))
    );
  }
});

// ─── NOTIFICAÇÕES ────────────────────────────────────────────────────────────

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'CHECK_ALERTS') {
    // Adicionado e.waitUntil para garantir que o SW não durma durante o processamento
    e.waitUntil(checkAndNotify(e.data.notes));
  }
});

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'finnotes-check') e.waitUntil(checkFromStorage());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        // Verifica se a aba já está aberta
        if (c.url.includes('index.html') || new URL(c.url).pathname === '/') {
          return c.focus();
        }
      }
      // Corrigido: self.clients para abrir nova janela
      return self.clients.openWindow('./index.html');
    })
  );
});

async function checkFromStorage() {
  try {
    const n = await getNotesFromIDB();
    if (n) await checkAndNotify(n);
  } catch (err) {
    console.error("Erro ao verificar storage:", err);
  }
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
    if (!n.dataVenc || n.pagas >= n.parcelas) continue;

    const diff = getDiffDias(n.dataVenc);
    const [ano, mes, dia] = n.dataVenc.split('-');
    const dataFmt = `${dia}/${mes}/${ano}`;
    const valorParcela = (n.total / n.parcelas).toFixed(2);
    const vp = `R$ ${valorParcela}`;
    
    const hojeStr = new Date().toISOString().slice(0, 10);
    const tag = `finnotes-${n.id}-${hojeStr}`;

    let titulo = null, corpo = null;

    if (diff < 0) {
      titulo = '🚨 Conta Vencida!';
      corpo = `"${n.nome}" venceu em ${dataFmt}. Valor: ${vp}`;
    } else if (diff === 0) {
      titulo = '⚠️ Vence Hoje!';
      corpo = `"${n.nome}" vence hoje. Valor: ${vp}`;
    } else if (diff <= 3) {
      titulo = `🔔 Vence em ${diff} dia${diff > 1 ? 's' : ''}`;
      corpo = `"${n.nome}" vence em ${dataFmt}. Valor: ${vp}`;
    }

    if (titulo) {
      const ex = await self.registration.getNotifications({ tag });
      if (ex.length === 0) {
        await self.registration.showNotification(titulo, {
          body: corpo,
          tag,
          icon: 'https://cdn-icons-png.flaticon.com/512/552/552791.png',
          vibrate: [200, 100, 200],
          requireInteraction: diff <= 0,
          data: { noteId: n.id }
        });
      }
    }
  }
}

function getNotesFromIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('finnotes_db', 1);
    req.onsuccess = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('kv')) {
        return resolve(null);
      }
      const tx = db.transaction('kv', 'readonly');
      const store = tx.objectStore('kv');
      const get = store.get('notes');
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => reject(get.error);
    };
    req.onerror = () => reject(req.error);
  });
}
