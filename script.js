/* ============================================================
   FinNotes Pro — script.js
   ============================================================ */

let db;

// 1. Inicialização do Banco de Dados
const request = indexedDB.open('finnotes_db', 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
    console.log("Banco de dados conectado.");
};

// 2. Login Mobile (Correção para teclado do celular)
function checkLogin() {
    const input = document.getElementById('main-login-pwd');
    const pwd = input.value.trim();
    const correct = localStorage.getItem('finnotes_password') || '1234';

    if (pwd === correct) {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        input.blur();
        renderNotes();
        updateDashboard();
    } else {
        alert("Senha Incorreta!");
        input.value = "";
    }
}

// 3. Funções de Interface (Botão + e Modais)
function openModal(id) {
    const m = document.getElementById(id);
    if (m) {
        m.classList.add('active');
        if (id === 'modal-add') resetAddForm();
    }
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
}

function resetAddForm() {
    // Limpa campos básicos
    document.getElementById('in-nome').value = "";
    document.getElementById('in-valor1').value = "";
    document.getElementById('in-valor2').value = "";
    document.getElementById('in-data').value = new Date().toISOString().slice(0, 10);

    // RESTAURAÇÃO DAS CATEGORIAS (Lista completa)
    const catSel = document.getElementById('in-cat');
    const categorias = [
        { v: 'Alimentação', t: '🍔 Alimentação' },
        { v: 'Saúde', t: '💊 Saúde' },
        { v: 'Lazer', t: '🎡 Lazer' },
        { v: 'Infraestrutura', t: '🏠 Infraestrutura' },
        { v: 'Educação', t: '📚 Educação' },
        { v: 'Transporte', t: '🚗 Transporte' },
        { v: 'Hardware', t: '💻 Hardware' },
        { v: 'Outros', t: '📦 Outros' }
    ];
    catSel.innerHTML = categorias.map(c => `<option value="${c.v}">${c.t}</option>`).join('');

    // RESTAURAÇÃO DAS PARCELAS (1x até 48x)
    const parcSel = document.getElementById('in-parcelas');
    parcSel.innerHTML = "";
    for (let i = 1; i <= 48; i++) {
        let opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i === 1 ? 'À vista' : i + 'x';
        parcSel.appendChild(opt);
    }
}

// 4. Renderização da Lista com Cores por Categoria
function renderNotes() {
    const transaction = db.transaction(['notes'], 'readonly');
    const store = transaction.objectStore('notes');
    const req = store.getAll();

    req.onsuccess = () => {
        const notes = req.result;
        const list = document.getElementById('notes-list');
        list.innerHTML = "";
        
        notes.forEach(n => {
            const card = document.createElement('div');
            card.className = 'card-container';
            
            // Cores baseadas nas variáveis do seu style.css
            const colors = {
                'Alimentação': '#f97316',
                'Saúde': '#22d3ee',
                'Lazer': '#a78bfa',
                'Infraestrutura': '#34d399',
                'Hardware': '#3b82f6',
                'Outros': '#94a3b8'
            };
            const cardColor = colors[n.cat] || '#94a3b8';

            card.innerHTML = `
                <div class="card" onclick="editNote(${n.id})" style="--color: ${cardColor}">
                    <div style="display:flex; justify-content:space-between;">
                        <div>
                            <div style="font-weight:800; font-size:15px;">${n.nome}</div>
                            <div style="font-size:10px; color:var(--t3); margin-top:4px; font-weight:700;">
                                ${n.cat.toUpperCase()} • ${n.pagas}/${n.parcelas} PARCELAS
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-weight:800; color:var(--ac);">R$ ${parseFloat(n.total).toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    };
}

function updateDashboard() {
    // Lógica de soma e progresso aqui
}

function logout() { location.reload(); }
