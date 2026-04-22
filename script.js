'use strict';

// 1. PWA & AUTO-UPDATE
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
}

// 2. Lógica de Instalação (PWA)
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-row').style.display = 'flex';
});

async function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') document.getElementById('install-row').style.display = 'none';
        deferredPrompt = null;
    }
}

// ─── INDEXEDDB ────────────────────────────────────────────────────────────────
function saveNotesToIDB(notes) {
    return new Promise((resolve) => {
        const req = indexedDB.open('finnotes_db', 1);
        req.onupgradeneeded = (e) => { e.target.result.createObjectStore('kv'); };
        req.onsuccess = (e) => {
            const db = e.target.result;
            const tx = db.transaction('kv', 'readwrite');
            tx.objectStore('kv').put(notes, 'notes');
            tx.oncomplete = () => resolve();
        };
        req.onerror = () => resolve();
    });
}

async function notifySwToCheck(notes) {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    if (reg.active) reg.active.postMessage({ type: 'CHECK_ALERTS', notes });
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
    } catch (e) {}
}

// 3. Sistema Base
const K_ENC = "MjU4NDU2";
let notes = [];
let pendingAction = { id: null, type: null };
const getK = () => atob(K_ENC);

function loadNotes() {
    try {
        const raw = localStorage.getItem('finnotes_v12_data');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                notes = parsed;
                return Promise.resolve();
            }
        }
    } catch (e) {}

    return new Promise((resolve) => {
        try {
            const req = indexedDB.open('finnotes_db', 1);
            req.onupgradeneeded = (e) => { e.target.result.createObjectStore('kv'); };
            req.onsuccess = (e) => {
                const get = e.target.result.transaction('kv', 'readonly').objectStore('kv').get('notes');
                get.onsuccess = () => {
                    if (get.result && Array.isArray(get.result) && get.result.length > 0) {
                        notes = get.result;
                        localStorage.setItem('finnotes_v12_data', JSON.stringify(notes));
                    }
                    resolve();
                };
                get.onerror = () => resolve();
            };
            req.onerror = () => resolve();
        } catch (e) { resolve(); }
    });
}

function logout() {
    sessionStorage.removeItem('finnotes_unlocked');
    document.getElementById('app').style.display = 'none';
    document.getElementById('lock-screen').style.display = 'flex';
    document.getElementById('main-login-pwd').value = '';
}

function unlockApp() {
    document.getElementById('lock-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    sessionStorage.setItem('finnotes_unlocked', '1');
    loadNotes().then(() => {
        render();
        saveNotesToIDB(notes);
        registerPeriodicSync();
        setTimeout(() => notifySwToCheck(notes), 1500);
    });
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

if (sessionStorage.getItem('finnotes_unlocked') === '1') {
    unlockApp();
}

document.getElementById('main-login-pwd').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkLogin();
});

// Preencher select de parcelas
const selP = document.getElementById('in-parcelas');
const opcoesParc = [];
for (let i = 1; i <= 48; i++) {
    opcoesParc.push(`<option value="${i}">${i === 1 ? 'À vista' : i + 'x'}</option>`);
}
selP.innerHTML = opcoesParc.join('');

function calcParcela() {
    const total = parseFloat(document.getElementById('in-valor2').value);
    const parcelas = parseInt(document.getElementById('in-parcelas').value);
    const parcelaEl = document.getElementById('in-parcela-calc');
    if (!isNaN(total) && parcelas > 0) {
        const valorParcela = total / parcelas;
        parcelaEl.textContent = `Parcela: R$ ${valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        parcelaEl.style.display = 'block';
    } else {
        parcelaEl.style.display = 'none';
    }
}

document.getElementById('in-valor2').addEventListener('input', calcParcela);
document.getElementById('in-parcelas').addEventListener('change', calcParcela);

// Calcula parcelas já pagas com base na data de início
function calcPagas() {
    const inicioVal = document.getElementById('in-inicio').value;
    const parcelas = parseInt(document.getElementById('in-parcelas').value);
    const infoEl = document.getElementById('in-inicio-info');

    if (!inicioVal || isNaN(parcelas)) { infoEl.style.display = 'none'; return; }

    const [anoI, mesI] = inicioVal.split('-').map(Number);
    const hoje = new Date();
    // Meses completos decorridos desde o mês de início até o mês anterior ao atual
    const mesesDecorridos = (hoje.getFullYear() - anoI) * 12 + (hoje.getMonth() + 1 - mesI);
    const pagas = Math.max(0, Math.min(mesesDecorridos, parcelas));

    infoEl.textContent = `✅ ${pagas} parcela${pagas !== 1 ? 's' : ''} já paga${pagas !== 1 ? 's' : ''} (início em ${mesI.toString().padStart(2,'0')}/${anoI})`;
    infoEl.style.display = 'block';
}

document.getElementById('in-inicio').addEventListener('change', calcPagas);
document.getElementById('in-parcelas').addEventListener('change', calcPagas);

function openModal(id) {
    document.getElementById(id).classList.add('active');
    if (id === 'modal-pwd') document.getElementById('confirm-pwd').focus();
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    if (id === 'modal-add') {
        document.getElementById('in-nome').value = '';
        document.getElementById('in-valor1').value = '';
        document.getElementById('in-valor2').value = '';
        document.getElementById('in-parcelas').value = '1';
        document.getElementById('in-data').value = '';
        document.getElementById('in-inicio').value = '';
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

function saveNote() {
    const nome = document.getElementById('in-nome').value.trim();
    const valorOriginal = parseFloat(document.getElementById('in-valor1').value);
    const total = parseFloat(document.getElementById('in-valor2').value);
    const dataVenc = document.getElementById('in-data').value;
    const inicioVal = document.getElementById('in-inicio').value;
    const parcelas = parseInt(document.getElementById('in-parcelas').value);

    if (!nome || isNaN(total)) {
        alert('Preencha ao menos a descrição e o total com taxas.');
        return;
    }

    // Calcula parcelas já pagas se o usuário informou data de início
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

// ─── EDITAR PARCELAS ──────────────────────────────────────────────────────────
let editingNoteId = null;

// Retorna lista de parcelas com vencimento retroativo ainda não pagas
function getParcelasRetroativas(note) {
    if (!note.dataVenc || note.pagas >= note.parcelas) return [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const [ano, mes, dia] = note.dataVenc.split('-').map(Number);
    const retroativas = [];
    // A dataVenc é a data da próxima parcela (pagas+1).
    // Calculamos cada parcela ainda não paga e verificamos se já venceu.
    for (let i = 0; i < (note.parcelas - note.pagas); i++) {
        const venc = new Date(ano, mes - 1 + i, dia);
        venc.setHours(0, 0, 0, 0);
        if (venc < hoje) {
            retroativas.push({ numero: note.pagas + i + 1, data: new Date(venc) });
        } else {
            break; // parcelas são sequenciais: para quando encontra uma ainda não vencida
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

    // Processa parcelas retroativas em seguida (não bloqueia a abertura do modal)
    await processarParcelasRetroativas(noteId);
}

function atualizarInfoEdicao(note) {
    const restantes = note.parcelas - note.pagas;
    const valorParcela = note.total / note.parcelas;
    document.getElementById('edit-info').innerHTML = `
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
            <span style="background:rgba(34,197,94,0.12); border:1px solid #22c55e; border-radius:8px; padding:5px 10px; font-size:11px; font-weight:700; color:#22c55e;">✅ ${note.pagas} pagas</span>
            <span style="background:rgba(59,130,246,0.12); border:1px solid #3b82f6; border-radius:8px; padding:5px 10px; font-size:11px; font-weight:700; color:#3b82f6;">🔄 ${restantes} restantes</span>
            <span style="background:rgba(161,161,170,0.12); border:1px solid var(--z4); border-radius:8px; padding:5px 10px; font-size:11px; font-weight:700; color:var(--t2);">💰 R$ ${valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/parcela</span>
        </div>`;
}

// Processa retroativas: pergunta ao usuário parcela a parcela
async function processarParcelasRetroativas(noteId) {
    let note = notes.find(n => n.id === noteId);
    if (!note) return;

    const retroativas = getParcelasRetroativas(note);
    if (retroativas.length === 0) return;

    for (const parcela of retroativas) {
        // Recarrega o note a cada iteração para refletir pagas atualizadas
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
                // Atualiza campos do modal
                document.getElementById('edit-pagas').value = notes[idx].pagas;
                atualizarInfoEdicao(notes[idx]);
            }
        } else {
            break; // Para de perguntar se o usuário disse que não pagou
        }
    }

    // Persiste as confirmações feitas
    sync();
}

// Dialog customizado (promise-based) para confirmação de parcela retroativa
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

    if (!nome || isNaN(total) || isNaN(parcelas) || parcelas < 1) {
        alert('Verifique os campos: descrição, total e parcelas são obrigatórios.');
        return;
    }
    if (pagas > parcelas) {
        alert('Parcelas pagas não pode ser maior que o total de parcelas.');
        return;
    }

    notes[idx] = {
        ...notes[idx],
        nome,
        total,
        parcelas,
        pagas: Math.max(0, Math.min(pagas, parcelas)),
        dataVenc: dataVenc || null,
        cat
    };

    sync();
    closeModal('modal-edit');
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
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
            notes = notes.map(n => {
                if (n.id === pendingAction.id && n.pagas < n.parcelas) n.pagas += 1;
                return n;
            });
        } else {
            notes = notes.filter(n => n.id !== pendingAction.id);
        }

        sync();

        // 🔥 FECHAMENTO GARANTIDO DE TODAS AS TELAS
        document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));

    } else {
        alert("SENHA INCORRETA");
        document.getElementById('confirm-pwd').value = '';
        document.getElementById('confirm-pwd').focus();
    }
}
function sync() {
    localStorage.setItem('finnotes_v12_data', JSON.stringify(notes));
    saveNotesToIDB(notes);
    notifySwToCheck(notes);
    render();
}

// ─── ALERTAS ──────────────────────────────────────────────────────────────────
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

        const notifKey = `notif_sent_${n.id}_${n.dataVenc}`;
        if (!sessionStorage.getItem(notifKey)) {
            const msgs = {
                'vencido': [`FinNotes — CONTA VENCIDA`, `"${n.nome}" venceu em ${dataFmt}. Regularize agora!`],
                'hoje':    [`FinNotes — VENCE HOJE`, `"${n.nome}" vence hoje (${dataFmt}). Não esqueça!`],
                'proximo': [`FinNotes — Lembrete`, `"${n.nome}" vence em ${dataFmt}. Faltam poucos dias!`]
            };
            sendNotif(msgs[s][0], msgs[s][1]);
            sessionStorage.setItem(notifKey, '1');
        }
    });
}

const CAT_COLORS = {
    'Infraestrutura': '#34d399',
    'Hardware':       '#f97316',
    'Empréstimo':     '#f43f5e',
    'Assinatura':     '#a78bfa',
    'Saúde':          '#38bdf8',
    'Veículo':        '#fbbf24',
    'Educação':       '#4ade80',
    'Alimentação':    '#fb923c',
    'Lazer':          '#c084fc',
    'Outros':         '#94a3b8'
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
            if (alertStatus === 'vencido')      { dataDisplay = `• ⚠ VENCIDO ${dia}/${mes}`; dataColor = '#ef4444'; }
            else if (alertStatus === 'hoje')    { dataDisplay = `• ⚠ VENCE HOJE`; dataColor = '#f97316'; }
            else if (alertStatus === 'proximo') { dataDisplay = `• 🔔 VENCE ${dia}/${mes}`; dataColor = '#fbbf24'; }
        } else {
            const dataRef = new Date();
            dataRef.setMonth(dataRef.getMonth() + (n.pagas + 1));
            const mesVenc = dataRef.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();
            dataDisplay = `• VENC: ${mesVenc}`;
        }

        const container = document.createElement('div');
        container.className = 'card-container';

        const valorOriginalHTML = n.valorOriginal
            ? `<span style="color:var(--t3); font-size:11px;">Orig: ${n.valorOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} → </span>`
            : '';

        const alertBorder = alertStatus && !isDone
            ? `box-shadow: 0 0 0 2px ${alertStatus === 'vencido' ? '#ef4444' : alertStatus === 'hoje' ? '#f97316' : '#fbbf24'};`
            : '';

        container.innerHTML = `
            <div class="card ${isDone ? 'completed' : ''} ${alertStatus && !isDone ? 'card-alert' : ''}" style="--color:${color}; ${alertBorder} padding-right: 100px;">
                <div style="position:absolute; right:10px; top:50%; transform:translateY(-50%); display:flex; flex-direction:column; gap:5px; z-index:10;">
                    <button class="btn-action btn-edit" style="background:rgba(59,130,246,0.15); color:#3b82f6; border:1px solid rgba(59,130,246,0.3); padding:7px 8px; border-radius:8px; font-size:9px; font-weight:900; cursor:pointer; letter-spacing:0.03em;">EDITAR</button>
                    <button class="btn-action btn-del" style="background:rgba(239,68,68,0.15); color:var(--err); border:1px solid rgba(239,68,68,0.3); padding:7px 8px; border-radius:8px; font-size:9px; font-weight:900; cursor:pointer; letter-spacing:0.03em;">APAGAR</button>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="flex:1; min-width:0;">
                        <b style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${n.nome}</b>
                        <small style="color:${dataColor}; font-weight:${alertStatus ? '700' : '400'};">PARCELA ${n.pagas}/${n.parcelas} ${dataDisplay}</small>
                    </div>
                    <div style="text-align:right; flex-shrink:0; margin-right:8px;">
                        <div>${valorOriginalHTML}<b>R$ ${n.total.toFixed(2)}</b></div>
                        ${n.parcelas > 1 ? `<small style="color:var(--t2);">${n.parcelas}x de ${valorParcela}</small>` : ''}
                    </div>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:${(n.pagas / n.parcelas) * 100}%"></div></div>
            </div>`;

        const el = container.querySelector('.card');
        const delBtn = container.querySelector('.btn-del');
        const editBtn = container.querySelector('.btn-edit');

        delBtn.addEventListener('click', (e) => { e.stopPropagation(); askAuth(n.id, 'delete'); });
        editBtn.addEventListener('click', (e) => { e.stopPropagation(); openEditModal(n.id); });
        el.addEventListener('click', (e) => {
            if (e.target.closest('.btn-action')) return;
            if (!isDone) askAuth(n.id, 'pay');
        });

        list.appendChild(container);
    });

    document.getElementById('total-geral').innerText = soma.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    checkAlerts();
}

if (localStorage.getItem('finnotes_v12_data')) render();
