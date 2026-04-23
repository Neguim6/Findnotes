'use strict';

// ─── 0. PERSISTÊNCIA DE ARMAZENAMENTO ────────────────────────────────────────
// Solicita ao navegador que mantenha os dados mesmo sob pressão de memória
if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(granted => {
        console.log(granted ? '✅ Armazenamento persistente garantido' : '⚠️ Sem persistência garantida');
    });
}

// ─── 1. PWA & SERVICE WORKER ─────────────────────────────────────────────────
// Usa apenas um SW unificado (sw.js) — evita conflito entre os dois arquivos
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Notifica o usuário que há uma atualização disponível
                    if (confirm('Nova versão disponível! Atualizar agora?')) {
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                        window.location.reload();
                    }
                }
            });
        });
    }).catch(err => console.warn('SW não registrado:', err));
}

// ─── 2. INSTALAÇÃO PWA ───────────────────────────────────────────────────────
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-row').style.display = 'flex';
});

async function installApp() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') document.getElementById('install-row').style.display = 'none';
    deferredPrompt = null;
}

// ─── 3. INDEXEDDB — CAMADA PRIMÁRIA DE PERSISTÊNCIA ──────────────────────────
// CORREÇÃO PRINCIPAL: IDB é a fonte de verdade. localStorage é apenas cache rápido.
const DB_NAME = 'finnotes_db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const LS_KEY = 'finnotes_v12_data';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveNotesToIDB(data) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(data, 'notes');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn('IDB save falhou:', e);
    }
}

async function loadNotesFromIDB() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get('notes');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch (e) {
        console.warn('IDB read falhou:', e);
        return null;
    }
}

// ─── 4. CARREGAMENTO DE DADOS ─────────────────────────────────────────────────
// CORREÇÃO: Sempre consulta IDB. localStorage é fallback secundário.
// iOS Safari pode limpar localStorage sem avisar — IDB é muito mais confiável.
async function loadNotes() {
    // 1. Tenta IDB primeiro (fonte primária e mais confiável)
    const idbData = await loadNotesFromIDB();
    if (Array.isArray(idbData) && idbData.length > 0) {
        notes = idbData;
        // Atualiza o cache do localStorage com os dados do IDB
        try { localStorage.setItem(LS_KEY, JSON.stringify(notes)); } catch (_) {}
        return;
    }

    // 2. Fallback: localStorage (pode ter sido apagado pelo SO, mas tentamos)
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                notes = parsed;
                // Migra os dados do localStorage para o IDB imediatamente
                await saveNotesToIDB(notes);
                return;
            }
        }
    } catch (e) {
        console.warn('localStorage read falhou:', e);
    }

    // 3. Sem dados encontrados
    notes = [];
}

// ─── 5. ESTADO GLOBAL ─────────────────────────────────────────────────────────
const K_ENC = "MjU4NDU2";
let notes = [];
let pendingAction = { id: null, type: null };
let editingNoteId = null;

const getK = () => atob(K_ENC);

// ─── 6. AUTH & SESSÃO ─────────────────────────────────────────────────────────
function logout() {
    sessionStorage.removeItem('finnotes_unlocked');
    document.getElementById('app').style.display = 'none';
    document.getElementById('lock-screen').style.display = 'flex';
    document.getElementById('main-login-pwd').value = '';
    document.getElementById('main-login-pwd').focus();
}

async function unlockApp() {
    document.getElementById('lock-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    sessionStorage.setItem('finnotes_unlocked', '1');

    await loadNotes();
    render();
    // Persiste em ambas as camadas ao desbloquear
    await saveNotesToIDB(notes);
    registerPeriodicSync();
    setTimeout(() => notifySwToCheck(notes), 1500);
}

function checkLogin() {
    const pwdInput = document.getElementById('main-login-pwd');
    if (pwdInput.value === getK()) {
        unlockApp();
    } else {
        alert("SENHA INCORRETA");
        pwdInput.value = '';
        pwdInput.focus();
    }
}

// Auto-unlock se a sessão já estava ativa
if (sessionStorage.getItem('finnotes_unlocked') === '1') {
    unlockApp();
}

document.getElementById('main-login-pwd').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkLogin();
});

// ─── 7. SERVICE WORKER — NOTIFICAÇÕES ────────────────────────────────────────
async function notifySwToCheck(data) {
    if (!('serviceWorker' in navigator)) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        if (reg.active) reg.active.postMessage({ type: 'CHECK_ALERTS', notes: data });
    } catch (e) {}
}

async function registerPeriodicSync() {
    if (!('serviceWorker' in navigator)) return;
    try {
        const reg = await navigator.serviceWorker.ready;
        if ('periodicSync' in reg) {
            const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
            if (status.state === 'granted') {
                await reg.periodicSync.register('finnotes-check', { minInterval: 12 * 60 * 60 * 1000 });
            }
        }
    } catch (_) {}
}

// ─── 8. SELECT DE PARCELAS ───────────────────────────────────────────────────
const selP = document.getElementById('in-parcelas');
selP.innerHTML = Array.from({ length: 48 }, (_, i) =>
    `<option value="${i + 1}">${i === 0 ? 'À vista' : (i + 1) + 'x'}</option>`
).join('');

// ─── 9. CÁLCULO DE PARCELA (MODAL ADD) ───────────────────────────────────────
function calcParcela() {
    const total = parseFloat(document.getElementById('in-valor2').value);
    const parcelas = parseInt(document.getElementById('in-parcelas').value);
    const el = document.getElementById('in-parcela-calc');
    if (!isNaN(total) && total > 0 && parcelas > 0) {
        el.textContent = `Parcela: R$ ${(total / parcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

document.getElementById('in-valor2').addEventListener('input', calcParcela);
document.getElementById('in-parcelas').addEventListener('change', calcParcela);

// ─── 10. CÁLCULO DE PARCELAS PAGAS (DATA DE INÍCIO) ──────────────────────────
function calcPagas() {
    const inicioVal = document.getElementById('in-inicio').value;
    const parcelas = parseInt(document.getElementById('in-parcelas').value);
    const infoEl = document.getElementById('in-inicio-info');

    if (!inicioVal || isNaN(parcelas)) { infoEl.style.display = 'none'; return; }

    const [anoI, mesI] = inicioVal.split('-').map(Number);
    const hoje = new Date();
    const mesesDecorridos = (hoje.getFullYear() - anoI) * 12 + (hoje.getMonth() + 1 - mesI);
    const pagas = Math.max(0, Math.min(mesesDecorridos, parcelas));

    infoEl.textContent = `✅ ${pagas} parcela${pagas !== 1 ? 's' : ''} já paga${pagas !== 1 ? 's' : ''} (início em ${String(mesI).padStart(2, '0')}/${anoI})`;
    infoEl.style.display = 'block';
}

document.getElementById('in-inicio').addEventListener('change', calcPagas);
document.getElementById('in-parcelas').addEventListener('change', calcPagas);

// ─── 11. MODAIS ───────────────────────────────────────────────────────────────
function openModal(id) {
    document.getElementById(id).classList.add('active');
    if (id === 'modal-pwd') {
        setTimeout(() => document.getElementById('confirm-pwd').focus(), 100);
    }
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    if (id === 'modal-add') {
        ['in-nome', 'in-valor1', 'in-valor2', 'in-data', 'in-inicio'].forEach(f => {
            document.getElementById(f).value = '';
        });
        document.getElementById('in-parcelas').value = '1';
        document.getElementById('in-cat').value = 'Infraestrutura';
        document.getElementById('in-parcela-calc').style.display = 'none';
        document.getElementById('in-inicio-info').style.display = 'none';
    }
    if (id === 'modal-pwd') {
        document.getElementById('confirm-pwd').value = '';
    }
    if (id === 'modal-edit') {
        editingNoteId = null;
    }
}

// ─── 12. SALVAR NOVO REGISTRO ─────────────────────────────────────────────────
function saveNote() {
    const nome = document.getElementById('in-nome').value.trim();
    const valorOriginal = parseFloat(document.getElementById('in-valor1').value);
    const total = parseFloat(document.getElementById('in-valor2').value);
    const dataVenc = document.getElementById('in-data').value;
    const inicioVal = document.getElementById('in-inicio').value;
    const parcelas = parseInt(document.getElementById('in-parcelas').value);

    if (!nome || isNaN(total) || total <= 0) {
        alert('Preencha ao menos a descrição e o total com taxas.');
        return;
    }
    if (isNaN(parcelas) || parcelas < 1) {
        alert('Número de parcelas inválido.');
        return;
    }

    let pagas = 0;
    if (inicioVal) {
        const [anoI, mesI] = inicioVal.split('-').map(Number);
        const hoje = new Date();
        const mesesDecorridos = (hoje.getFullYear() - anoI) * 12 + (hoje.getMonth() + 1 - mesI);
        pagas = Math.max(0, Math.min(mesesDecorridos, parcelas));
    }

    notes.unshift({
        id: Date.now(),
        nome,
        valorOriginal: isNaN(valorOriginal) ? null : valorOriginal,
        total,
        parcelas,
        cat: document.getElementById('in-cat').value,
        pagas,
        dataVenc: dataVenc || null
    });

    sync();
    closeModal('modal-add');
}

// ─── 13. EDIÇÃO ───────────────────────────────────────────────────────────────
function getParcelasRetroativas(note) {
    if (!note.dataVenc || note.pagas >= note.parcelas) return [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const [ano, mes, dia] = note.dataVenc.split('-').map(Number);
    const retroativas = [];
    for (let i = 0; i < (note.parcelas - note.pagas); i++) {
        const venc = new Date(ano, mes - 1 + i, dia);
        venc.setHours(0, 0, 0, 0);
        if (venc < hoje) {
            retroativas.push({ numero: note.pagas + i + 1, data: new Date(venc) });
        } else {
            break;
        }
    }
    return retroativas;
}

async function openEditModal(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    editingNoteId = noteId;
    document.getElementById('edit-nome').value = note.nome;
    document.getElementById('edit-total').value = note.total;
    document.getElementById('edit-pagas').value = note.pagas;
    document.getElementById('edit-parcelas-total').value = note.parcelas;
    document.getElementById('edit-data').value = note.dataVenc || '';
    document.getElementById('edit-cat').value = note.cat || 'Outros';

    atualizarInfoEdicao(note);
    openModal('modal-edit');
    await processarParcelasRetroativas(noteId);
}

function atualizarInfoEdicao(note) {
    const restantes = note.parcelas - note.pagas;
    const valorParcela = (note.total / note.parcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById('edit-info').innerHTML = `
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
            <span style="background:rgba(34,197,94,0.12); border:1px solid #22c55e; border-radius:8px; padding:5px 10px; font-size:11px; font-weight:700; color:#22c55e;">✅ ${note.pagas} pagas</span>
            <span style="background:rgba(59,130,246,0.12); border:1px solid #3b82f6; border-radius:8px; padding:5px 10px; font-size:11px; font-weight:700; color:#3b82f6;">🔄 ${restantes} restantes</span>
            <span style="background:rgba(161,161,170,0.12); border:1px solid var(--z4); border-radius:8px; padding:5px 10px; font-size:11px; font-weight:700; color:var(--t2);">💰 R$ ${valorParcela}/parcela</span>
        </div>`;
}

async function processarParcelasRetroativas(noteId) {
    let note = notes.find(n => n.id === noteId);
    if (!note) return;
    const retroativas = getParcelasRetroativas(note);
    if (retroativas.length === 0) return;

    for (const parcela of retroativas) {
        note = notes.find(n => n.id === noteId);
        if (!note || note.pagas >= note.parcelas) break;

        const dataFmt = parcela.data.toLocaleDateString('pt-BR');
        const valorParcela = (note.total / note.parcelas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const confirmado = await showRetroConfirm(
            `Parcela ${parcela.numero}/${note.parcelas} — ${valorParcela}\nVencimento: ${dataFmt}\n\nEste pagamento já foi realizado?`
        );

        if (confirmado) {
            const idx = notes.findIndex(n => n.id === noteId);
            if (idx !== -1 && notes[idx].pagas < notes[idx].parcelas) {
                notes[idx].pagas += 1;
                document.getElementById('edit-pagas').value = notes[idx].pagas;
                atualizarInfoEdicao(notes[idx]);
            }
        } else {
            break;
        }
    }
    sync();
}

function showRetroConfirm(mensagem) {
    return new Promise((resolve) => {
        document.getElementById('retro-msg').textContent = mensagem;
        document.getElementById('modal-retro').classList.add('active');

        const btnSim = document.getElementById('retro-sim');
        const btnNao = document.getElementById('retro-nao');

        function cleanup() {
            document.getElementById('modal-retro').classList.remove('active');
            btnSim.removeEventListener('click', onSim);
            btnNao.removeEventListener('click', onNao);
        }
        function onSim() { cleanup(); resolve(true); }
        function onNao() { cleanup(); resolve(false); }

        btnSim.addEventListener('click', onSim);
        btnNao.addEventListener('click', onNao);
    });
}

function saveEdit() {
    if (!editingNoteId) return;
    const idx = notes.findIndex(n => n.id === editingNoteId);
    if (idx === -1) return;

    const nome = document.getElementById('edit-nome').value.trim();
    const total = parseFloat(document.getElementById('edit-total').value);
    const pagas = parseInt(document.getElementById('edit-pagas').value);
    const parcelas = parseInt(document.getElementById('edit-parcelas-total').value);
    const dataVenc = document.getElementById('edit-data').value;
    const cat = document.getElementById('edit-cat').value;

    if (!nome || isNaN(total) || total <= 0 || isNaN(parcelas) || parcelas < 1) {
        alert('Verifique os campos: descrição, total e parcelas são obrigatórios.');
        return;
    }
    if (!isNaN(pagas) && pagas > parcelas) {
        alert('Parcelas pagas não pode ser maior que o total de parcelas.');
        return;
    }

    notes[idx] = {
        ...notes[idx],
        nome,
        total,
        parcelas,
        pagas: Math.max(0, Math.min(isNaN(pagas) ? 0 : pagas, parcelas)),
        dataVenc: dataVenc || null,
        cat
    };

    sync();
    closeModal('modal-edit');
}

// ─── 14. AUTENTICAÇÃO PARA AÇÕES ─────────────────────────────────────────────
function askAuth(id, type) {
    pendingAction = { id, type };
    document.getElementById('pwd-title').textContent = type === 'pay' ? "Validar Baixa" : "Validar Exclusão";
    document.getElementById('pwd-confirm-btn').onclick = validateAuth;
    openModal('modal-pwd');
}

document.getElementById('confirm-pwd').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') validateAuth();
});

function validateAuth() {
    const pwd = document.getElementById('confirm-pwd').value;
    if (pwd === getK()) {
        if (pendingAction.type === 'pay') {
            const idx = notes.findIndex(n => n.id === pendingAction.id);
            if (idx !== -1 && notes[idx].pagas < notes[idx].parcelas) {
                notes[idx].pagas += 1;
            }
        } else if (pendingAction.type === 'delete') {
            notes = notes.filter(n => n.id !== pendingAction.id);
        }
        sync();
        closeModal('modal-pwd');
    } else {
        alert("SENHA INCORRETA");
        document.getElementById('confirm-pwd').value = '';
        document.getElementById('confirm-pwd').focus();
    }
}

// ─── 15. BACKUP / RESTAURAÇÃO ────────────────────────────────────────────────
function exportarBackup() {
    if (notes.length === 0) {
        alert('Nenhum registro para exportar.');
        return;
    }
    const payload = JSON.stringify({ version: 'v12', exported: new Date().toISOString(), notes }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finnotes_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

async function importarBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        // Suporta tanto o formato novo { version, notes } quanto o antigo (array direto)
        const imported = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.notes) ? parsed.notes : null);

        if (!imported || imported.length === 0) {
            alert('Arquivo de backup inválido ou vazio.');
            return;
        }

        if (!confirm(`Restaurar ${imported.length} registro(s)? Os dados atuais serão substituídos.`)) return;

        notes = imported;
        sync();
        alert(`✅ ${imported.length} registro(s) restaurado(s) com sucesso!`);
    } catch (e) {
        alert('Erro ao ler o arquivo de backup. Verifique se é um arquivo .json válido.');
    } finally {
        // Limpa o input para permitir importar o mesmo arquivo novamente
        event.target.value = '';
    }
}

// ─── 16. SINCRONIZAÇÃO ────────────────────────────────────────────────────────
// CORREÇÃO: sync() agora salva em IDB E localStorage de forma confiável
function sync() {
    // Salva em IDB (fonte primária)
    saveNotesToIDB(notes);
    // Salva em localStorage (cache rápido, pode ser apagado pelo iOS)
    try { localStorage.setItem(LS_KEY, JSON.stringify(notes)); } catch (e) {
        console.warn('localStorage cheio ou bloqueado:', e);
    }
    notifySwToCheck(notes);
    render();
}

// ─── 17. ALERTAS ─────────────────────────────────────────────────────────────
function getAlertStatus(n) {
    if (!n.dataVenc || n.pagas === n.parcelas) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const [ano, mes, dia] = n.dataVenc.split('-').map(Number);
    const venc = new Date(ano, mes - 1, dia);
    venc.setHours(0, 0, 0, 0);
    const diff = Math.round((venc - hoje) / 86400000);
    if (diff === 0) return 'hoje';
    if (diff > 0 && diff <= 3) return 'proximo';
    if (diff < 0) return 'vencido';
    return null;
}

function requestNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function sendNotif(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: 'https://cdn-icons-png.flaticon.com/512/552/552791.png' });
    }
}

function checkAlerts() {
    const alertas = notes.filter(n => {
        const s = getAlertStatus(n);
        return s === 'hoje' || s === 'proximo' || s === 'vencido';
    });

    const banner = document.getElementById('alert-banner');
    if (!banner) return;

    if (alertas.length === 0) { banner.style.display = 'none'; return; }

    banner.style.display = 'block';
    banner.innerHTML = '';

    alertas.forEach(n => {
        const s = getAlertStatus(n);
        const [ano, mes, dia] = n.dataVenc.split('-');
        const dataFmt = `${dia}/${mes}/${ano}`;
        const colors = {
            'vencido': { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', icon: '🚨', label: 'VENCIDO' },
            'hoje':    { bg: 'rgba(239,68,68,0.10)', border: '#f97316', icon: '⚠️', label: 'VENCE HOJE' },
            'proximo': { bg: 'rgba(251,191,36,0.10)', border: '#fbbf24', icon: '🔔', label: 'VENCE EM BREVE' }
        };
        const c = colors[s];
        const item = document.createElement('div');
        item.style.cssText = `background:${c.bg}; border:1px solid ${c.border}; border-left:4px solid ${c.border}; border-radius:12px; padding:12px 16px; margin-bottom:8px; display:flex; align-items:center; gap:12px; animation:pulseAlert 2s ease-in-out infinite;`;
        item.innerHTML = `
            <span style="font-size:20px;">${c.icon}</span>
            <div style="flex:1; min-width:0;">
                <div style="font-size:10px; font-weight:900; color:${c.border}; letter-spacing:0.08em;">${c.label}</div>
                <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${n.nome}</div>
                <div style="font-size:11px; color:var(--t3);">Vencimento: ${dataFmt} • R$ ${(n.total / n.parcelas).toFixed(2)}/parcela</div>
            </div>`;
        banner.appendChild(item);

        // Envia notificação uma vez por sessão
        const notifKey = `notif_sent_${n.id}_${n.dataVenc}`;
        if (!sessionStorage.getItem(notifKey)) {
            const msgs = {
                'vencido': [`FinNotes — CONTA VENCIDA`, `"${n.nome}" venceu em ${dataFmt}. Regularize agora!`],
                'hoje':    [`FinNotes — VENCE HOJE`,    `"${n.nome}" vence hoje (${dataFmt}). Não esqueça!`],
                'proximo': [`FinNotes — Lembrete`,      `"${n.nome}" vence em ${dataFmt}. Faltam poucos dias!`]
            };
            sendNotif(msgs[s][0], msgs[s][1]);
            sessionStorage.setItem(notifKey, '1');
        }
    });
}

// ─── 18. RENDER ───────────────────────────────────────────────────────────────
const CAT_COLORS = {
    'Infraestrutura': '#34d399', 'Hardware': '#f97316', 'Empréstimo': '#f43f5e',
    'Assinatura': '#a78bfa', 'Saúde': '#38bdf8', 'Veículo': '#fbbf24',
    'Educação': '#4ade80', 'Alimentação': '#fb923c', 'Lazer': '#c084fc', 'Outros': '#94a3b8'
};

function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    let soma = 0;

    notes.forEach(n => {
        soma += n.total;
        const isDone = n.pagas === n.parcelas;
        const alertStatus = getAlertStatus(n);
        const color = isDone
            ? 'var(--ok)'
            : alertStatus === 'vencido' ? '#ef4444'
            : alertStatus === 'hoje' ? '#f97316'
            : (CAT_COLORS[n.cat] || '#3b82f6');

        const valorParcela = (n.total / n.parcelas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        let dataDisplay = '';
        let dataColor = 'var(--t3)';
        if (n.dataVenc) {
            const [ano, mes, dia] = n.dataVenc.split('-');
            dataDisplay = `• PAGAR: ${dia}/${mes}/${ano}`;
            if (alertStatus === 'vencido')      { dataDisplay = `• ⚠ VENCIDO ${dia}/${mes}`;  dataColor = '#ef4444'; }
            else if (alertStatus === 'hoje')    { dataDisplay = `• ⚠ VENCE HOJE`;              dataColor = '#f97316'; }
            else if (alertStatus === 'proximo') { dataDisplay = `• 🔔 VENCE ${dia}/${mes}`;    dataColor = '#fbbf24'; }
        } else {
            // Estima a data de vencimento da próxima parcela
            const dataRef = new Date();
            dataRef.setMonth(dataRef.getMonth() + (n.pagas + 1));
            const mesVenc = dataRef.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();
            dataDisplay = `• VENC: ${mesVenc}`;
        }

        const alertBorder = alertStatus && !isDone
            ? `box-shadow: 0 0 0 2px ${alertStatus === 'vencido' ? '#ef4444' : alertStatus === 'hoje' ? '#f97316' : '#fbbf24'};`
            : '';

        const valorOriginalHTML = n.valorOriginal
            ? `<span style="color:var(--t3); font-size:11px;">Orig: ${n.valorOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} → </span>`
            : '';

        const container = document.createElement('div');
        container.className = 'card-container';
        container.innerHTML = `
            <div class="card ${isDone ? 'completed' : ''} ${alertStatus && !isDone ? 'card-alert' : ''}"
                 style="--color:${color}; ${alertBorder} padding-right: 100px;">
                <div style="position:absolute; right:10px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:5px; z-index:10;">
                    <button class="btn-action btn-edit"
                        style="background:rgba(59,130,246,0.15); color:#3b82f6; border:1px solid rgba(59,130,246,0.3);
                               padding:7px 8px; border-radius:8px; font-size:9px; font-weight:900; cursor:pointer;">EDITAR</button>
                    <button class="btn-action btn-del"
                        style="background:rgba(239,68,68,0.15); color:var(--err); border:1px solid rgba(239,68,68,0.3);
                               padding:7px 8px; border-radius:8px; font-size:9px; font-weight:900; cursor:pointer;">APAGAR</button>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="flex:1; min-width:0;">
                        <b style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${n.nome}</b>
                        <small style="color:${dataColor}; font-weight:${alertStatus ? '700' : '400'};">
                            PARCELA ${n.pagas}/${n.parcelas} ${dataDisplay}
                        </small>
                    </div>
                    <div style="text-align:right; flex-shrink:0; margin-right:8px;">
                        <div>${valorOriginalHTML}<b>R$ ${n.total.toFixed(2)}</b></div>
                        ${n.parcelas > 1 ? `<small style="color:var(--t2);">${n.parcelas}x de ${valorParcela}</small>` : ''}
                    </div>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:${(n.pagas / n.parcelas) * 100}%"></div></div>
            </div>`;

        const el = container.querySelector('.card');
        container.querySelector('.btn-del').addEventListener('click', (e) => {
            e.stopPropagation();
            askAuth(n.id, 'delete');
        });
        container.querySelector('.btn-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(n.id);
        });
        el.addEventListener('click', (e) => {
            if (e.target.closest('.btn-action')) return;
            if (!isDone) askAuth(n.id, 'pay');
        });

        list.appendChild(container);
    });

    document.getElementById('total-geral').innerText = soma.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Atualiza barra de progresso (percentual do total já pago em valor)
    const totalPago = notes.reduce((acc, n) => acc + (n.total * n.pagas / n.parcelas), 0);
    const pct = soma > 0 ? Math.min((totalPago / soma) * 100, 100) : 0;
    const progressEl = document.getElementById('total-progress');
    if (progressEl) progressEl.style.width = `${pct}%`;

    checkAlerts();
}

// Render inicial caso já haja cache no localStorage (melhora velocidade percebida)
try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw && sessionStorage.getItem('finnotes_unlocked') !== '1') {
        // Não renderiza sem autenticação; aguarda unlockApp()
    }
} catch (_) {}
