'use strict';

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────
const CACHE_NAME = 'finnotes-v52';
const ASSETS = [
    './index.html',
    './style.css',
    './script.js',
    './manifest.json'
];

// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => {
                // NÃO chama skipWaiting() aqui automaticamente.
                // O script.js vai perguntar ao usuário antes de atualizar.
            })
    );
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// ─── FETCH — Stale-While-Revalidate ──────────────────────────────────────────
// Responde do cache imediatamente (app parece rápido), atualiza em background
self.addEventListener('fetch', (e) => {
    // Ignora requisições não-GET e cross-origin que não sejam assets do app
    if (e.request.method !== 'GET') return;

    e.respondWith(
        caches.match(e.request).then((cached) => {
            const networkFetch = fetch(e.request)
                .then((res) => {
                    // Só cacheia respostas bem-sucedidas de origens mesmas-origem
                    if (res && res.status === 200 && res.type !== 'opaque') {
                        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, res.clone()));
                    }
                    return res;
                })
                .catch(() => null);

            // Retorna o cache imediatamente enquanto revalida em background
            return cached || networkFetch;
        })
    );
});

// ─── MENSAGENS ────────────────────────────────────────────────────────────────
self.addEventListener('message', (e) => {
    if (!e.data) return;

    // Comando para pular espera (enviado pelo script.js após confirmação do usuário)
    if (e.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        return;
    }

    // Verificação de alertas vinda da página
    if (e.data.type === 'CHECK_ALERTS') {
        e.waitUntil(checkAndNotify(e.data.notes));
    }
});

// ─── PERIODIC SYNC ────────────────────────────────────────────────────────────
self.addEventListener('periodicsync', (e) => {
    if (e.tag === 'finnotes-check') {
        e.waitUntil(checkFromIDB());
    }
});

// ─── CLIQUE EM NOTIFICAÇÃO ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    e.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            // Tenta focar numa aba já aberta
            for (const client of list) {
                if ('focus' in client) return client.focus();
            }
            // Abre nova aba se não houver nenhuma aberta
            return self.clients.openWindow('./index.html');
        })
    );
});

// ─── FUNÇÕES DE NOTIFICAÇÃO ───────────────────────────────────────────────────
async function checkFromIDB() {
    try {
        const notes = await getNotesFromIDB();
        if (notes) await checkAndNotify(notes);
    } catch (err) {
        console.error('SW: Erro ao verificar IDB:', err);
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
        const valorParcela = `R$ ${(n.total / n.parcelas).toFixed(2)}`;
        const hojeStr = new Date().toISOString().slice(0, 10);
        const tag = `finnotes-${n.id}-${hojeStr}`;

        let titulo = null, corpo = null;

        if (diff < 0) {
            titulo = '🚨 Conta Vencida!';
            corpo = `"${n.nome}" venceu em ${dataFmt}. Valor: ${valorParcela}`;
        } else if (diff === 0) {
            titulo = '⚠️ Vence Hoje!';
            corpo = `"${n.nome}" vence hoje. Valor: ${valorParcela}`;
        } else if (diff <= 3) {
            titulo = `🔔 Vence em ${diff} dia${diff > 1 ? 's' : ''}`;
            corpo = `"${n.nome}" vence em ${dataFmt}. Valor: ${valorParcela}`;
        }

        if (titulo) {
            // Evita duplicar notificações com a mesma tag no mesmo dia
            const existentes = await self.registration.getNotifications({ tag });
            if (existentes.length === 0) {
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

// ─── IDB NO SERVICE WORKER ────────────────────────────────────────────────────
function getNotesFromIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('finnotes_db', 1);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('kv')) {
                db.createObjectStore('kv');
            }
        };

        req.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('kv')) {
                return resolve(null);
            }
            const tx = db.transaction('kv', 'readonly');
            const get = tx.objectStore('kv').get('notes');
            get.onsuccess = () => resolve(get.result || null);
            get.onerror = () => reject(get.error);
        };

        req.onerror = () => reject(req.error);
    });
}
