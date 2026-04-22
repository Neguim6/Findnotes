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

// ─── BANCO ─────────────────────────────────────────
const K_ENC = "MjU4NDU2";
let notes = [];
let pendingAction = { id: null, type: null };
let editingNoteId = null;

const getK = () => atob(K_ENC);

// ─── LOGIN ─────────────────────────────────────────
function checkLogin() {
    const pwdInput = document.getElementById('main-login-pwd');
    if (pwdInput.value === getK()) {
        unlockApp();
    } else {
        alert("SENHA INCORRETA");
        pwdInput.value = '';
    }
}

function unlockApp() {
    document.getElementById('lock-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    render();
}

// ─── MODAIS ────────────────────────────────────────
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// 🔥 FECHAMENTO GLOBAL
function fecharTodosModais() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

// ─── CRUD ──────────────────────────────────────────
function saveNote() {
    const nome = document.getElementById('in-nome').value;
    const total = parseFloat(document.getElementById('in-valor2').value);
    const parcelas = parseInt(document.getElementById('in-parcelas').value);

    if (!nome || isNaN(total)) {
        alert('Preencha os dados');
        return;
    }

    notes.unshift({
        id: Date.now(),
        nome,
        total,
        parcelas,
        pagas: 0
    });

    sync();
    closeModal('modal-add');
}

function openEditModal(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    editingNoteId = id;

    document.getElementById('edit-nome').value = note.nome;
    document.getElementById('edit-total').value = note.total;
    document.getElementById('edit-pagas').value = note.pagas;
    document.getElementById('edit-parcelas-total').value = note.parcelas;

    openModal('modal-edit');
}

// 🔥 SALVAR + FECHAR
function saveEdit() {
    const note = notes.find(n => n.id === editingNoteId);
    if (!note) return;

    note.nome = document.getElementById('edit-nome').value;
    note.total = parseFloat(document.getElementById('edit-total').value);
    note.pagas = parseInt(document.getElementById('edit-pagas').value);
    note.parcelas = parseInt(document.getElementById('edit-parcelas-total').value);

    sync();

    fecharTodosModais(); // 🔥 FECHA TUDO
}

// ─── AUTH ──────────────────────────────────────────
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

        // 🔥 FECHA TODAS TELAS
        fecharTodosModais();

    } else {
        alert("Senha incorreta");
    }
}

// ─── NOVO: SELEÇÃO VISUAL DE PARCELAS ─────────────────
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
        REMOVER SELECIONADAS
    </button>`;

    document.getElementById('edit-info').innerHTML = html;
}

// 🔥 REMOÇÃO MÚLTIPLA REAL
function removerParcelasSelecionadas() {
    const note = notes.find(n => n.id === editingNoteId);
    if (!note) return;

    const checks = document.querySelectorAll('#box-parcelas input:checked');

    if (checks.length === 0) {
        alert("Selecione ao menos uma parcela.");
        return;
    }

    const qtd = checks.length;

    if (qtd > note.pagas) {
        alert("Erro na seleção.");
        return;
    }

    note.pagas -= qtd;

    document.getElementById('edit-pagas').value = note.pagas;

    sync();

    alert(`${qtd} parcela(s) removida(s) com sucesso`);
}

// ─── RENDER ─────────────────────────────────────────
function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';

    notes.forEach(n => {
        const div = document.createElement('div');
        div.className = 'card';

        div.innerHTML = `
            <b>${n.nome}</b><br>
            ${n.pagas}/${n.parcelas}
            <br><br>
            <button onclick="openEditModal(${n.id})">Editar</button>
            <button onclick="askAuth(${n.id}, 'delete')">Excluir</button>
        `;

        list.appendChild(div);
    });
}

// ─── SYNC ───────────────────────────────────────────
function sync() {
    localStorage.setItem('finnotes_v12_data', JSON.stringify(notes));
    render();
}
