/* ============================================================
   FinNotes Pro — script.js
   ============================================================ */

let db;

// 1. Inicialização do Banco de Dados (IndexedDB)
const request = indexedDB.open('finnotes_db', 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
    console.log("Banco de dados pronto.");
};

request.onerror = (e) => console.error("Erro no IndexedDB", e);

// 2. Lógica de Login Corrigida para Mobile
function checkLogin() {
    const input = document.getElementById('main-login-pwd');
    const senhaDigitada = input.value.trim(); // Remove espaços automáticos
    const senhaCorreta = localStorage.getItem('finnotes_password') || '1234';

    if (senhaDigitada === senhaCorreta) {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        input.blur(); // Fecha o teclado
        renderNotes(); // Carrega as notas ao entrar
    } else {
        alert("Senha Incorreta!");
        input.value = "";
    }
}

// Suporte para tecla Enter no login
document.getElementById('main-login-pwd')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') checkLogin();
});

// 3. Funções dos Modais (Faz o botão + e outros funcionarem)
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        // Se for o modal de adicionar, limpa os campos antes
        if (id === 'modal-add') resetAddForm();
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

function resetAddForm() {
    document.getElementById('in-nome').value = "";
    document.getElementById('in-valor2').value = "";
    // Preenche o seletor de parcelas (1 a 48)
    const sel = document.getElementById('in-parcelas');
    sel.innerHTML = "";
    for (let i = 1; i <= 48; i++) {
        let opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i === 1 ? 'À vista' : i + 'x';
        sel.appendChild(opt);
    }
}

// 4. Lógica de Renderização e Dashboard (Exemplo básico para o HGP)
function renderNotes() {
    const transaction = db.transaction(['notes'], 'readonly');
    const store = transaction.objectStore('notes');
    const request = store.getAll();

    request.onsuccess = () => {
        const notes = request.result;
        const list = document.getElementById('notes-list');
        list.innerHTML = "";
        
        let totalGeral = 0;

        notes.forEach(note => {
            totalGeral += parseFloat(note.total);
            const card = document.createElement('div');
            card.className = 'card-container';
            card.innerHTML = `
                <div class="card" onclick="editNote(${note.id})">
                    <strong>${note.nome}</strong><br>
                    <small>${note.cat} - ${note.pagas}/${note.parcelas}</small>
                    <div style="float:right">R$ ${parseFloat(note.total).toFixed(2)}</div>
                </div>
            `;
            list.appendChild(card);
        });

        document.getElementById('total-geral').textContent = 
            totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };
}

function logout() {
    location.reload();
}
