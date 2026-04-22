'use strict';

// PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
}

// ─── CONFIG ────────────────────────────────────────
const K_ENC = "MjU4NDU2";
let notes = [];
let pendingAction = { id: null, type: null };
let editingNoteId = null;

const getK = () => atob(K_ENC);

// ─── UTIL ─────────────────────────────────────────
function fecharTodosModais() {
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
}

// ─── LOGIN ────────────────────────────────────────
function checkLogin() {
    const pwd = document.getElementById('main-login-pwd').value;
    if (pwd === getK()) {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        render();
    } else {
        alert("SENHA INCORRETA");
    }
}

// ─── MODAIS ───────────────────────────────────────
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// ─── STORAGE ──────────────────────────────────────
function sync() {
    localStorage.setItem('finnotes_v12_data', JSON.stringify(notes));
    render();
}

// ─── ADD ──────────────────────────────────────────
function saveNote() {
    const nome = document.getElementById('in-nome').value.trim();
    const total = parseFloat(document.getElementById('in-valor2').value);
    const parcelas = parseInt(document.getElementById('in-parcelas').value);
    const dataVenc = document.getElementById('in-data').value;

    if (!nome || isNaN(total)) {
        alert('Preencha os dados.');
        return;
    }

    notes.unshift({
        id: Date.now(),
        nome,
        total,
        parcelas,
        pagas: 0,
        cat: document.getElementById('in-cat').value,
        dataVenc: dataVenc || null
    });

    sync();
    closeModal('modal-add');
}

// ─── EDIT ─────────────────────────────────────────
function openEditModal(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    editingNoteId = id;

    document.getElementById('edit-nome').value = note.nome;
    document.getElementById('edit-total').value = note.total;
    document.getElementById('edit-pagas').value = note.pagas;
    document.getElementById('edit-parcelas-total').value = note.parcelas;
    document.getElementById('edit-cat').value = note.cat;

    atualizarInfoEdicao(note);
    openModal('modal-edit');
}

function atualizarInfoEdicao(note) {
    const restantes = note.parcelas - note.pagas;
    document.getElementById('edit-info').innerHTML = `
        <div style="margin-top:10px;">
            ✅ ${note.pagas} pagas | 🔄 ${restantes} restantes
        </div>
    `;
}

// 🔥 SALVAR COM FECHAMENTO
function saveEdit() {
    const idx = notes.findIndex(n => n.id === editingNoteId);
    if (idx === -1) return;

    notes[idx].nome = document.getElementById('edit-nome').value;
    notes[idx].total = parseFloat(document.getElementById('edit-total').value);
    notes[idx].pagas = parseInt(document.getElementById('edit-pagas').value);
    notes[idx].parcelas = parseInt(document.getElementById('edit-parcelas-total').value);
    notes[idx].cat = document.getElementById('edit-cat').value;

    sync();
    fecharTodosModais();
}

// ─── AUTH ─────────────────────────────────────────
function askAuth(id, type) {
    pendingAction = { id, type };
    openModal('modal-pwd');
}

function validateAuth() {
    const pwd = document.getElementById('confirm-pwd').value;

    if (pwd === getK()) {

        if (pendingAction.type === 'pay') {
            notes.forEach(n => {
                if (n.id === pendingAction.id && n.pagas < n.parcelas) {
                    n.pagas++;
                }
            });
        }

        if (pendingAction.type === 'delete') {
            notes = notes.filter(n => n.id !== pendingAction.id);
        }

        sync();
        fecharTodosModais();

    } else {
        alert("Senha incorreta");
    }
}

// ─── REMOVER PARCELAS ─────────────────────────────
function abrirSelecaoParcelas() {
    const note = notes.find(n => n.id === editingNoteId);
    if (!note) return;

    if (note.pagas === 0) {
        alert("Nenhuma parcela paga.");
        return;
    }

    let html = `<div id="box-parcelas">`;

    for (let i = 1; i <= note.pagas; i++) {
        html += `
            <label style="display:block; margin:5px 0;">
                <input type="checkbox" value="${i}">
                Parcela ${i}
            </label>
        `;
    }

    html += `</div>
    <button onclick="removerParcelasSelecionadas()" class="btn-primary">
        Remover Selecionadas
    </button>`;

    document.getElementById('edit-info').innerHTML = html;
}

function removerParcelasSelecionadas() {
    const note = notes.find(n => n.id === editingNoteId);
    if (!note) return;

    const checks = document.querySelectorAll('#box-parcelas input:checked');

    if (checks.length === 0) {
        alert("Selecione ao menos uma.");
        return;
    }

    note.pagas -= checks.length;

    document.getElementById('edit-pagas').value = note.pagas;

    atualizarInfoEdicao(note);
    sync();
}

// ─── ALERTAS (RESTAURADO) ─────────────────────────
function getAlertStatus(n) {
    if (!n.dataVenc || n.pagas === n.parcelas) return null;

    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    const [ano, mes, dia] = n.dataVenc.split('-').map(Number);
    const venc = new Date(ano, mes - 1, dia);

    const diff = Math.round((venc - hoje) / 86400000);

    if (diff < 0) return 'vencido';
    if (diff === 0) return 'hoje';
    if (diff <= 3) return 'proximo';

    return null;
}

function checkAlerts() {
    const banner = document.getElementById('alert-banner');
    if (!banner) return;

    banner.innerHTML = '';

    const alertas = notes.filter(n => {
        const s = getAlertStatus(n);
        return s === 'vencido' || s === 'hoje' || s === 'proximo';
    });

    if (alertas.length === 0) {
        banner.style.display = 'none';
        return;
    }

    banner.style.display = 'block';

    alertas.forEach(n => {
        const s = getAlertStatus(n);

        const div = document.createElement('div');
        div.style.marginBottom = '8px';

        const label =
            s === 'vencido' ? '🚨 VENCIDO' :
            s === 'hoje' ? '⚠️ HOJE' :
            '🔔 EM BREVE';

        div.innerHTML = `<b>${label}</b> - ${n.nome}`;
        banner.appendChild(div);
    });
}

// ─── RENDER ───────────────────────────────────────
function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';

    notes.forEach(n => {
        const valorParcela = (n.total / n.parcelas).toFixed(2);

        const div = document.createElement('div');
        div.className = 'card';

        div.innerHTML = `
            <b>${n.nome}</b><br>
            PARCELA ${n.pagas}/${n.parcelas}<br>
            <small>${n.parcelas}x de R$ ${valorParcela}</small>
            <br><br>
            <button onclick="openEditModal(${n.id})">Editar</button>
            <button onclick="askAuth(${n.id}, 'delete')">Excluir</button>
        `;

        list.appendChild(div);
    });

    checkAlerts(); // 🔥 ESSENCIAL
}

// ─── INIT ─────────────────────────────────────────
const saved = localStorage.getItem('finnotes_v12_data');
if (saved) {
    notes = JSON.parse(saved);
    render();
}
