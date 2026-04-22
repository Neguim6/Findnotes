'use strict';

const K_ENC = "MjU4NDU2";
let notes = [];
let editingNoteId = null;

const getK = () => atob(K_ENC);

function checkLogin() {
    const pwd = document.getElementById('main-login-pwd').value;
    if (pwd === getK()) {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        render();
    } else { alert("SENHA INCORRETA"); }
}

function logout() { location.reload(); }

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function sync() {
    localStorage.setItem('finnotes_v12_data', JSON.stringify(notes));
    render();
}

function saveNote() {
    const nome = document.getElementById('in-nome').value.trim();
    // CORREÇÃO: Capturando o valor com taxas (in-valor2) conforme seu HTML
    const total = parseFloat(document.getElementById('in-valor2').value);
    const parcelas = parseInt(document.getElementById('in-parcelas').value) || 1;
    const dataVenc = document.getElementById('in-data').value;

    if (!nome || isNaN(total)) {
        alert('Preencha os campos obrigatórios.');
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

function saveEdit() {
    const idx = notes.findIndex(n => n.id === editingNoteId);
    if (idx === -1) return;
    
    notes[idx].pagas = parseInt(document.getElementById('edit-pagas').value);
    notes[idx].parcelas = parseInt(document.getElementById('edit-parcelas-total').value);
    
    sync();
    closeModal('modal-edit');
}

function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    let totalAberto = 0;

    notes.forEach(n => {
        // CORREÇÃO: Lógica de cálculo proporcional para parcelas
        const valorParcela = n.total / n.parcelas;
        const restante = n.total - (n.pagas * valorParcela);
        if (n.pagas < n.parcelas) totalAberto += restante;

        const container = document.createElement('div');
        container.className = 'card-container';
        container.innerHTML = `
            <div class="card" style="--color: var(--ac)">
                <div style="display:flex; justify-content:space-between;">
                    <div>
                        <b style="font-size:16px">${n.nome}</b><br>
                        <small style="color:var(--t3)">PARCELA ${n.pagas}/${n.parcelas}</small>
                    </div>
                    <div style="text-align:right">
                        <b>R$ ${restante.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</b><br>
                        <small style="color:var(--t3)">${n.parcelas}x R$ ${valorParcela.toFixed(2)}</small>
                    </div>
                </div>
                <div class="progress-bg">
                    <div class="progress-fill" style="width:${(n.pagas / n.parcelas) * 100}%"></div>
                </div>
                <div style="margin-top:10px; display:flex; gap:10px">
                   <button onclick="editingNoteId=${n.id}; openModal('modal-edit')" style="background:none; border:1px solid var(--z4); color:var(--t2); padding:4px 8px; border-radius:6px; font-size:10px">EDITAR</button>
                </div>
            </div>
        `;
        list.appendChild(container);
    });

    document.getElementById('total-geral').innerText = `R$ ${totalAberto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
}

// Inicialização
const saved = localStorage.getItem('finnotes_v12_data');
if (saved) notes = JSON.parse(saved);
