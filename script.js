/* ============================================================
   FinNotes Pro — script.js
   Correção: Login Mobile + Gestão de Notas
   ============================================================ */

// --- LÓGICA DE ACESSO ---
function checkLogin() {
    const input = document.getElementById('main-login-pwd');
    // .trim() remove espaços automáticos de teclados mobile
    const senhaDigitada = input.value.trim(); 
    
    // Senha padrão '1234' ou a definida no sistema
    const senhaCorreta = localStorage.getItem('finnotes_password') || '1234';

    if (senhaDigitada === senhaCorreta) {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        
        // Esconde o teclado no celular
        input.blur(); 
        
        // Inicializa o sistema
        initApp();
    } else {
        alert("Senha Incorreta!");
        input.value = "";
    }
}

// Atalho: tecla Enter no teclado do celular dispara o login
document.getElementById('main-login-pwd')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        checkLogin();
        if (typeof requestNotifPermission === 'function') requestNotifPermission();
    }
});

function logout() {
    location.reload();
}

// --- GESTÃO DE DADOS & INTERFACE ---
let db;
const request = indexedDB.open('finnotes_db', 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
};

function initApp() {
    renderNotes();
    updateDashboard();
}

// (Insira aqui suas funções renderNotes, saveNote, saveEdit, deleteNote, etc.)
// Elas devem seguir a lógica de manipulação do indexedDB e atualização do DOM
// conforme os IDs definidos no seu index.html.

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function requestNotifPermission() {
    if ('Notification' in window) {
        Notification.requestPermission();
    }
}
