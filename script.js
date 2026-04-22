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

// ─── INDEXEDDB ─────────────────────────────────────────
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

// ─── BASE ─────────────────────────────────────────────
const K_ENC = "MjU4NDU2";
let notes = [];
let pendingAction = { id: null, type: null };
let editingNoteId = null;

const getK = () => atob(K_ENC);

// ─── MODAIS (PADRÃO NOVO) ─────────────────────────────
function fecharTodosModais() {
    document.querySelectorAll('.modal.active')
        .forEach(m => m.classList.remove('active'));
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// ─── LOGIN ────────────────────────────────────────────
function checkLogin() {
    const pwdInput = document.getElementById('main-login-pwd');
    if (pwdInput.value === getK()) {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
    } else {
        alert("SENHA INCORRETA");
    }
}

// ─── SAVE NOTE ────────────────────────────────────────
function saveNote() {
    const nome = document.getElementById('in-nome').value.trim();
    const total = parseFloat(document.getElementById('in-valor2').value);
    const parcelas = parseInt(document.getElementById('in-parcelas').value);

    if (!nome || isNaN(total)) {
        alert('Preencha os campos.');
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
    fecharTodosModais(); // 🔥 CORREÇÃO
}

// ─── EDITAR ───────────────────────────────────────────
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

function saveEdit() {
    if (!editingNoteId) return;

    const idx = notes.findIndex(n => n.id === editingNoteId);
    if (idx === -1) return;

    const nome = document.getElementById('edit-nome').value;
    const total = parseFloat(document.getElementById('edit-total').value);
    const pagas = parseInt(document.getElementById('edit-pagas').value);
    const parcelas = parseInt(document.getElementById('edit-parcelas-total').value);

    notes[idx] = {
        ...notes[idx],
        nome,
        total,
        parcelas,
        pagas
    };

    sync();

    // 🔥 CORREÇÃO PRINCIPAL
    fecharTodosModais();
}

// ─── AUTH ─────────────────────────────────────────────
function askAuth(id, type) {
    pendingAction = { id, type };
    openModal('modal-pwd');
}

function validateAuth() {
    const pwd = document.getElementById('confirm-pwd').value;

    if (pwd === getK()) {

        if (pendingAction.type === 'pay') {
            notes = notes.map(n => {
                if (n.id === pendingAction.id && n.pagas < n.parcelas) {
                    n.pagas++;
                }
                return n;
            });
        } else {
            notes = notes.filter(n => n.id !== pendingAction.id);
        }

        sync();

        // 🔥 FECHA TUDO
        fecharTodosModais();

    } else {
        alert("SENHA INCORRETA");
    }
}

// ─── PARCELAS ─────────────────────────────────────────
function abrirSelecaoParcelas() {
    if (!editingNoteId) return;

    const note = notes.find(n => n.id === editingNoteId);
    if (!note) return;

    const qtd = prompt(`Você tem ${note.pagas} parcelas.\nQuantas remover?`);
    const remover = parseInt(qtd);

    if (isNaN(remover) || remover <= 0) return;

    note.pagas -= remover;

    document.getElementById('edit-pagas').value = note.pagas;

    sync();
}

// ─── RENDER ───────────────────────────────────────────
function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';

    notes.forEach(n => {
        const el = document.createElement('div');
        el.innerHTML = `
            <div>
                <b>${n.nome}</b>
                <div>${n.pagas}/${n.parcelas}</div>
                <button onclick="askAuth(${n.id}, 'pay')">Pagar</button>
                <button onclick="openEditModal(${n.id})">Editar</button>
                <button onclick="askAuth(${n.id}, 'delete')">Excluir</button>
            </div>
        `;
        list.appendChild(el);
    });
}

function sync() {
    localStorage.setItem('finnotes_v12_data', JSON.stringify(notes));
    render();
}

// INIT
if (localStorage.getItem('finnotes_v12_data')) {
    notes = JSON.parse(localStorage.getItem('finnotes_v12_data'));
    render();
}
