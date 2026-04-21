'use strict';

const RATE = 0.02; // Sugestão base de 2%
const STORAGE_KEY = 'finnotes_v4_data';
const CATS = {
    'Alimentação': { icon: '🍽', color: '#f97316', bg: '#431407' },
    'Saúde': { icon: '💊', color: '#22d3ee', bg: '#083344' },
    'Lazer': { icon: '🎮', color: '#a78bfa', bg: '#2e1065' },
    'Infraestrutura': { icon: '🏠', color: '#34d399', bg: '#052e16' },
    'Outros': { icon: '📦', color: '#94a3b8', bg: '#1e293b' }
};

let notes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let deferredPrompt;

// --- INSTALAÇÃO PWA ---
const installBtn = document.getElementById('install-btn');
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'block';
    installBtn.addEventListener('click', async () => {
        installBtn.style.display = 'none';
        deferredPrompt.prompt();
        deferredPrompt = null;
    });
});

// --- LÓGICA DO SISTEMA ---
function toggleModal(show) {
    document.getElementById('modal').classList.toggle('active', show);
    if(show) document.getElementById('in-nome').focus();
}

function calcJuros() {
    const v = parseFloat(document.getElementById('in-valor').value) || 0;
    const p = parseInt(document.getElementById('in-parcelas').value);
    // Sugere cálculo automático, mas o usuário pode editar no campo 'in-total'
    const total = p === 1 ? v : v * (1 + (RATE * p));
    document.getElementById('in-total').value = total.toFixed(2);
}

function saveNote() {
    const nome = document.getElementById('in-nome').value;
    const valorJuros = parseFloat(document.getElementById('in-total').value); 
    const parcelas = parseInt(document.getElementById('in-parcelas').value);
    const categoria = document.getElementById('in-cat').value;

    if (!nome || isNaN(valorJuros)) return alert("Preencha os campos obrigatórios.");

    const note = {
        id: Date.now(),
        nome, valorJuros, parcelas, categoria,
        pagas: 0
    };

    notes.unshift(note);
    update();
    toggleModal(false);
    
    // Reset campos
    document.getElementById('in-nome').value = '';
    document.getElementById('in-valor').value = '';
    document.getElementById('in-total').value = '';
}

function toggleParcela(id) {
    notes = notes.map(n => {
        if (n.id === id) {
            n.pagas = n.pagas < n.parcelas ? n.pagas + 1 : 0;
        }
        return n;
    });
    update();
}

function deleteNote(id, event) {
    event.stopPropagation();
    if(confirm("Deseja apagar permanentemente?")) {
        notes = notes.filter(n => n.id !== id);
        update();
    }
}

function update() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    render();
}

function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    
    let somaTotal = 0;
    let somaPaga = 0;

    notes.forEach(n => {
        const cat = CATS[n.categoria] || CATS['Outros'];
        const valorParcela = n.valorJuros / n.parcelas;
        const progresso = (n.pagas / n.parcelas) * 100;
        const estaPago = n.pagas === n.parcelas;
        
        somaTotal += n.valorJuros;
        somaPaga += (n.pagas * valorParcela);

        const card = document.createElement('div');
        card.className = `card ${estaPago ? 'is-paid' : ''}`;
        card.style.setProperty('--color', estaPago ? 'var(--ok)' : cat.color);
        card.onclick = () => toggleParcela(n.id);
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start; gap: 10px;">
                <div style="flex:1">
                    <div style="display:flex; align-items:center; flex-wrap: wrap; gap:6px; margin-bottom:4px;">
                        <span style="font-weight:700; font-size:15px; color:var(--t1)">${n.nome}</span>
                        ${estaPago ? '<span class="paid-stamp">PAGO</span>' : `<span class="badge" style="--bg:${cat.bg}; --color:${cat.color}">${cat.icon}</span>`}
                    </div>
                    <div style="font-size:12px; color:var(--t3); font-family:monospace;">${n.parcelas}x de R$ ${valorParcela.toFixed(2)}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:800; color:var(--t1); font-size:16px;">R$ ${n.valorJuros.toFixed(2)}</div>
                    <button onclick="deleteNote(${n.id}, event)" style="background:none; border:none; color:var(--z5); cursor:pointer; font-size:10px; margin-top:8px; font-weight:bold;">EXCLUIR</button>
                </div>
            </div>
            <div style="margin-top:14px; display:flex; justify-content:space-between; font-size:10px; font-weight:700; color:var(--t3); text-transform:uppercase;">
                <span>Progresso: ${n.pagas}/${n.parcelas}</span>
                <span>${progresso.toFixed(0)}%</span>
            </div>
            <div class="progress-bg">
                <div class="progress-fill" style="width: ${progresso}%; background: ${estaPago ? 'var(--ok)' : 'var(--ac)'}"></div>
            </div>
        `;
        list.appendChild(card);
    });

    document.getElementById('total-geral').innerText = somaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('label-pagas').innerText = `Pagas: ${somaPaga.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    const pctGeral = somaTotal > 0 ? (somaPaga / somaTotal * 100) : 0;
    document.getElementById('label-pct').innerText = `${pctGeral.toFixed(1)}%`;
    document.getElementById('total-progress').style.width = pctGeral + '%';
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
}

render();
