'use strict';

const K_ENC = "MjU4NDU2";
let notes = [];
let editingNoteId = null;

const getK = () => atob(K_ENC);

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
}

function checkLogin() {
    const pwd = document.getElementById('main-login-pwd').value;
    if (pwd === getK()) {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        render();
    } else {
        alert("SENHA INCORRETA");
    }
}

function logout() { location.reload(); }

function sync() {
    localStorage.setItem('finnotes_v12_data', JSON.stringify(notes));
    render();
}

function saveNote() {
    const nome = document.getElementById('in-nome').value.trim();
    // CORREÇÃO: Referência ao ID correto 'in-valor'
    const total = parseFloat(document.getElementById('in-valor').value);
    // CORREÇÃO: Referência ao ID correto 'in-parcelas'
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
    document.getElementById('in-nome').value = '';
    // CORREÇÃO: Limpeza do campo correto
    document.getElementById('in-valor').value = '';
    document.getElementById('in-parcelas').value = '1';
}

function openEditModal(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    editingNoteId = id;
    document.getElementById('edit-pagas').value = note.pagas;
    document.getElementById('modal-edit').style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function saveEdit() {
    const idx = notes.findIndex(n => n.id === editingNoteId);
    if (idx === -1) return;
    // CORREÇÃO: Garante que as pagas não ultrapassem o total de parcelas
    const novasPagas = parseInt(document.getElementById('edit-pagas').value);
    notes[idx].pagas = Math.min(novasPagas, notes[idx].parcelas);
    sync();
    closeModal('modal-edit');
}

function deleteNote(id) {
    if(confirm("Deseja excluir?")) {
        notes = notes.filter(n => n.id !== id);
        sync();
    }
}

function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    let totalAberto = 0;

    notes.forEach(n => {
        // CORREÇÃO: Restauração do cálculo matemático das parcelas
        const valorParcela = n.total / n.parcelas;
        const restante = n.total - (n.pagas * valorParcela);
        if (n.pagas < n.parcelas) totalAberto += restante;

        const card = document.createElement('div');
        card.className = 'note-card';
        card.innerHTML = `
            <div class="note-cat-bar cat-${n.cat}"></div>
            <div class="note-body">
                <div class="note-top">
                    <span class="note-name">${n.nome}</span>
                    <span class="note-cat-badge badge-${n.cat}">${n.cat}</span>
                </div>
                <div class="note-financials">
                    <span class="note-parcelas">${n.pagas}/${n.parcelas} parcelas</span>
                    <span class="note-valor-total">Total: R$ ${n.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    <span class="note-valor-parcela">${n.parcelas}x R$ ${valorParcela.toFixed(2)}</span>
                </div>
            </div>
            <div class="note-actions">
                <button onclick="openEditModal(${n.id})" class="btn-delete" style="color:var(--accent); border-color:var(--accent); margin-right:8px;">✎</button>
                <button onclick="deleteNote(${n.id})" class="btn-delete">✕</button>
            </div>
        `;
        list.appendChild(card);
    });

    // CORREÇÃO: Referência ao ID correto 'total-geral'
    document.getElementById('total-geral').innerText = `R$ ${totalAberto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
}

const saved = localStorage.getItem('finnotes_v12_data');
if (saved) {
    notes = JSON.parse(saved);
}
