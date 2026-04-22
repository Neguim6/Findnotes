const CACHE = 'finnotes-v14';
const ASSETS = ['./index.html', './script.js', './manifest.json'];

// Instala: cacheia arquivos novos em background SEM interromper o app atual
self.addEventListener('install', (e) => {
  // NÃO chama skipWaiting() aqui — deixa o SW antigo continuar rodando
  // O novo SW só assume quando o usuário fechar e reabrir o app
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS))
  );
});

// Ativa: limpa caches antigos e assume o controle
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network first com fallback cache:
// - Sempre tenta buscar versão atualizada do servidor
// - Se offline ou falhar, usa o cache
// - Dados do usuário (localStorage/IDB) nunca são tocados pelo SW
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isAppFile = ASSETS.some((a) =>
    url.pathname.endsWith(a.replace('./', '/')) || url.pathname.endsWith('/')
  );

  if (isAppFile) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          // Atualiza o cache com a versão nova silenciosamente
          if (res.ok) {
            caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(e.request)) // offline: usa cache
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request))
    );
  }
});

// ─── NOTIFICAÇÕES EM BACKGROUND ──────────────────────────────────────────────
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'CHECK_ALERTS') checkAndNotify(e.data.notes);
});

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'finnotes-check') e.waitUntil(checkFromStorage());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes('index.html') || c.url.endsWith('/')) return c.focus();
      }
      return clients.openWindow('./index.html');
    })
  );
});

async function checkFromStorage() {
  try { const n = await getNotesFromIDB(); if (n) checkAndNotify(n); } catch (e) {}
}

function getDiffDias(dataVenc) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const [ano,mes,dia] = dataVenc.split('-').map(Number);
  const venc = new Date(ano, mes-1, dia); venc.setHours(0,0,0,0);
  return Math.round((venc - hoje) / 86400000);
}

async function checkAndNotify(notes) {
  if (!Array.isArray(notes)) return;
  for (const n of notes) {
    if (!n.dataVenc || n.pagas === n.parcelas) continue;
    const diff = getDiffDias(n.dataVenc);
    const [ano,mes,dia] = n.dataVenc.split('-');
    const dataFmt = `${dia}/${mes}/${ano}`;
    const vp = `R$ ${(n.total/n.parcelas).toFixed(2)}`;
    const hoje = new Date().toISOString().slice(0,10);
    const tag = `finnotes-${n.id}-${hoje}`;
    let titulo = null, corpo = null;
    if (diff < 0)        { titulo='🚨 Conta Vencida!';                       corpo=`"${n.nome}" venceu em ${dataFmt}. Valor: ${vp}`; }
    else if (diff === 0) { titulo='⚠️ Vence Hoje!';                          corpo=`"${n.nome}" vence hoje. Valor: ${vp}`; }
    else if (diff <= 3)  { titulo=`🔔 Vence em ${diff} dia${diff>1?'s':''}`; corpo=`"${n.nome}" vence em ${dataFmt}. Valor: ${vp}`; }
    if (titulo) {
      const ex = await self.registration.getNotifications({ tag });
      if (ex.length === 0) {
        await self.registration.showNotification(titulo, {
          body: corpo, tag,
          icon: 'https://cdn-icons-png.flaticon.com/512/552/552791.png',
          vibrate: [200,100,200], requireInteraction: diff <= 0,
          data: { noteId: n.id }
        });
      }
    }
  }
}

function getNotesFromIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('finnotes_db', 1);
    req.onupgradeneeded = (e) => { e.target.result.createObjectStore('kv'); };
    req.onsuccess = (e) => {
      const get = e.target.result.transaction('kv','readonly').objectStore('kv').get('notes');
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => reject(get.error);
    };
    req.onerror = () => reject(req.error);
  });
}
