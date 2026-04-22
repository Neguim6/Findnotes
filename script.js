/* ============================================================
   FinNotes Pro — script.js (GE Festas & HGP Edition)
   ============================================================ */

let db;

// 1. Banco de Dados Protegido
const request = indexedDB.open('finnotes_db', 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
    console.log("Banco pronto.");
};

// 2. Login Mobile (Corrigido para teclados de Palmas/Android/iOS)
function checkLogin() {
    const input = document.getElementById('main-login-pwd');
    const pwd = input.value.trim(); // Remove espaços que o celular coloca sozinho
    const correct = localStorage.getItem('finnotes_password') || '1234';

    if (pwd === correct) {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        input.blur(); // Esconde o teclado
        renderNotes();
        updateDashboard();
    } else {
        alert("Senha Incorreta!");
        input.value = "";
    }
}

// 3. Função de Gravação Blindada (Agora Grava!)
function saveNote() {
    const nome = document.getElementById('in-nome').value;
    const valor2 = document.getElementById('in-valor2').value;
    const parcelas = document.getElementById('in-parcelas').value;
    const cat = document.getElementById('in-cat').value;
    const data = document.getElementById('in-data').value;

    if (!nome || !valor2) {
        alert("Preencha Descrição e Valor!");
        return;
    }

    const transaction = db.transaction(['notes'], 'readwrite');
    const store = transaction.objectStore('notes');
    
    const novaNota = {
        nome: nome,
        total: parseFloat(valor2),
        parcelas: parseInt(parcelas),
        pagas: 0,
        cat: cat,
        data: data
    };

    const addReq = store.add(novaNota);

    addReq.onsuccess = () => {
        closeModal('modal-add');
        renderNotes();
        updateDashboard();
        alert("Gravado com sucesso!");
    };
}

// 4. Interface (Botão + e Categorias Completas)
function openModal(id) {
    document.getElementById(id).classList.add('active');
    if (id === 'modal-add') resetAddForm();
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function resetAddForm() {
    document.getElementById('in-nome').value = "";
    document.getElementById('in-valor2').value = "";
    
    // TODAS AS SUAS CATEGORIAS DE VOLTA
    const catSel = document.getElementById('in-cat');
    const categorias = [
        { v: 'Alimentação', t: '🍔 Alimentação' },
        { v: 'Saúde', t: '💊 Saúde' },
        { v: 'Lazer', t: '🎡 Lazer' },
        { v: 'Infraestrutura', t: '🏠 Infraestrutura' },
        { v: 'Transporte', t: '🚗 Transporte' },
        { v: 'Hardware', t: '💻 Hardware' },
        { v: 'Outros', t: '📦 Outros' }
    ];
    catSel.innerHTML = categorias.map(c => `<option value="${c.v}">${c.t}</option>`).join('');

    // PARCELAS DE 1 a 48
    const parcSel = document.getElementById('in-parcelas');
    parcSel.innerHTML = "";
    for (let i = 1; i <= 48; i++) {
        let opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i === 1 ? 'À vista' : i + 'x';
        parcSel.appendChild(opt);
    }
}

function renderNotes() {
    const transaction = db.transaction(['notes'], 'readonly');
    const store = transaction.objectStore('notes');
    const req = store.getAll();

    req.onsuccess = () => {
        const list = document.getElementById('notes-list');
        list.innerHTML = "";
        req.result.sort((a,b) => b.id - a.id).forEach(n => {
            const card = document.createElement('div');
            card.className = 'card-container';
            list.appendChild(card);
            card.innerHTML = `<div class="card"><b>${n.nome}</b><br><small>${n.cat}</small> <span style="float:right">R$ ${n.total.toFixed(2)}</span></div>`;
        });
    };
}

function updateDashboard() {
    const transaction = db.transaction(['notes'], 'readonly');
    const store = transaction.objectStore('notes');
    store.getAll().onsuccess = (e) => {
        const total = e.target.result.reduce((acc, n) => acc + n.total, 0);
        document.getElementById('total-geral').textContent = `R$ ${total.toFixed(2)}`;
    };
}
