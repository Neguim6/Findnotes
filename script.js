'use strict';

const MASTER_PASSWORD = "258456";
const RATE = 0.035;
let notes = JSON.parse(localStorage.getItem('finnotes_data_v5') || '[]');
let pendingAction = { id: null, type: null }; // type: 'pay' ou 'delete'

// Setup
const sel = document.getElementById('in-parcelas');
for(let i=1; i<=12; i++) {
    sel.innerHTML += `<option value="${i}">${i === 1 ? 'À vista' : i+'x'}</option>`;
}

function openModal(id) { 
    document.getElementById(id).classList.add('active'); 
    if(id === 'modal-pwd') setTimeout(() => document.getElementById('confirm-pwd').focus(), 150);
}
function closeModal(id) { 
    document.getElementById(id).classList.remove('active'); 
    document.getElementById('confirm-pwd').value = '';
}

function addLog(msg) {
    const logs = document.getElementById('logs');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `> /temp/log_${Date.now()}.txt: ${msg.toUpperCase()}`;
    logs.prepend(entry);
}

function calcJuros() {
    const v = parseFloat(document.getElementById('in-valor').value) || 0;
    const p = parseInt(document.getElementById('in-parcelas').value);
    document.getElementById('in-total').value = (p === 1 ? v : v * (1 + (RATE * p))).toFixed(2);
}

function saveNote() {
    const nome = document.getElementById('in-nome').value;
    const total = parseFloat(document.getElementById('in-total').value);
    if(!nome || isNaN(total)) return;

    notes.unshift({ id: Date.now(), nome, total, parcelas: parseInt(document.getElementById('in-parcelas').value), cat: document.getElementById('in-cat').value, pagas: 0 });
    sync();
    closeModal('modal-add');
    addLog(`Arquivo criado: ${nome}`);
}

// Lógica Unificada de Senha
function askAuth(id, type) {
    pendingAction = { id, type };
    const title = document.getElementById('pwd-title');
    const desc = document.getElementById('pwd-desc');
    const btn = document.getElementById('pwd-confirm-btn');

    if(type === 'pay') {
        title.textContent = "Confirmar Pagamento";
        desc.textContent = "Aumentar contador de parcelas pagas.";
        btn.style.background = "var(--ok)";
    } else {
        title.textContent = "Confirmar Exclusão";
        desc.textContent = "ESTA AÇÃO APAGARÁ O REGISTRO PERMANENTEMENTE.";
        btn.style.background = "var(--err)";
    }

    btn.onclick = validateAuth;
    openModal('modal-pwd');
}

function validateAuth() {
    const p = document.getElementById('confirm-pwd').value;
    if(p === MASTER_PASSWORD) {
        if(pendingAction.type === 'pay') {
            notes = notes.map(n => {
                if(n.id === pendingAction.id) {
                    n.pagas = n.pagas < n.parcelas ? n.pagas + 1 : 0;
                    addLog(`Pagamento validado: ${n.nome}`);
                }
                return n;
            });
        } else {
            const item = notes.find(n => n.id === pendingAction.id);
            addLog(`Registro deletado: ${item.nome}`);
            notes = notes.filter(n => n.id !== pendingAction.id);
        }
        sync();
        closeModal('modal-pwd');
    } else {
        alert("SENHA INCORRETA");
        document.getElementById('confirm-pwd').value = '';
    }
}

function sync() {
    localStorage.setItem('finnotes_data_v5', JSON.stringify(notes));
    render();
}

function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    let somaTotal = 0;

    notes.forEach(n => {
        somaTotal += n.total;
        const prog = (n.pagas / n.parcelas) * 100;
        const color = { 'Infraestrutura': '#34d399', 'Alimentação': '#f97316', 'Saúde': '#22d3ee', 'Lazer': '#a78bfa', 'Outros': '#94a3b8' }[n.cat];

        const container = document.createElement('div');
        container.className = 'card-container';
        container.innerHTML = `
            <div class="delete-btn-bg" onclick="askAuth(${n.id}, 'delete')">EXCLUIR</div>
            <div class="card" style="--color:${color}">
                <button class="pc-delete" onclick="event.stopPropagation(); askAuth(${n.id}, 'delete')">APAGAR</button>
                <div style="display:flex; justify-content:space-between">
                    <b>${n.nome}</b>
                    <b style="color:var(--ac)">R$ ${n.total.toFixed(2)}</b>
                </div>
                <div style="font-size:11px; color:var(--t3); margin-top:5px;">Parcela: ${n.pagas} de ${n.parcelas}</div>
                <div class="progress-bg"><div class="progress-fill" style="width:${prog}%"></div></div>
            </div>
        `;

        const cardEl = container.querySelector('.card');
        let startX = 0;
        
        // Mobile Swipe
        cardEl.ontouchstart = e => { startX = e.touches[0].clientX; cardEl.style.transition = 'none'; };
        cardEl.ontouchmove = e => {
            let diff = e.touches[0].clientX - startX;
            if(diff > 0 && diff < 120) cardEl.style.transform = `translateX(${diff}px)`;
        };
        cardEl.ontouchend = e => {
            cardEl.style.transition = 'transform 0.3s ease';
            let diff = e.changedTouches[0].clientX - startX;
            if(diff > 80) {
                askAuth(n.id, 'delete'); // Senha para excluir via swipe
                cardEl.style.transform = 'translateX(0)';
            } else {
                cardEl.style.transform = 'translateX(0)';
                if(Math.abs(diff) < 5) askAuth(n.id, 'pay'); // Senha para pagar
            }
        };

        // Desktop
        cardEl.onclick = () => { if(window.innerWidth > 768) askAuth(n.id, 'pay'); };

        list.appendChild(container);
    });
    document.getElementById('total-geral').innerText = somaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
render();
