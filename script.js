'use strict';

const MASTER_PASSWORD = "258456";
const NUBANK_RATE = 0.035; // 3.5%
let notes = JSON.parse(localStorage.getItem('finnotes_pro_v49') || '[]');
let pendingId = null;

// Popular Parcelas 1 a 12
const selectP = document.getElementById('in-parcelas');
for(let i=1; i<=12; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i === 1 ? 'À vista' : `${i} parcelas`;
    selectP.appendChild(opt);
}

// Controle de Modais
function openModal(id) { 
    document.getElementById(id).classList.add('active'); 
    if(id === 'modal-add') document.getElementById('in-nome').focus();
    if(id === 'modal-pwd') {
        setTimeout(() => document.getElementById('confirm-pwd').focus(), 100);
    }
}

function closeModal(id) { 
    document.getElementById(id).classList.remove('active'); 
    if(id === 'modal-pwd') pendingId = null;
}

// Logs de Atividade na Tela
function writeLog(text) {
    const logContainer = document.getElementById('logs');
    const time = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `> [${time}] ${text.toUpperCase()}`;
    logContainer.prepend(entry);
}

// Cálculos
function calcJuros() {
    const v = parseFloat(document.getElementById('in-valor').value) || 0;
    const p = parseInt(document.getElementById('in-parcelas').value);
    const total = p === 1 ? v : v * (1 + (NUBANK_RATE * p));
    document.getElementById('in-total').value = total.toFixed(2);
}

function saveNote() {
    const nome = document.getElementById('in-nome').value;
    const total = parseFloat(document.getElementById('in-total').value);
    const parcelas = parseInt(document.getElementById('in-parcelas').value);
    const cat = document.getElementById('in-cat').value;

    if(!nome || isNaN(total)) return alert("Dados inválidos");

    const newNote = { id: Date.now(), nome, total, parcelas, cat, pagas: 0 };
    notes.unshift(newNote);
    sync();
    closeModal('modal-add');
    writeLog(`Cadastrado: ${nome}`);
    
    // Limpar campos
    document.getElementById('in-nome').value = '';
    document.getElementById('in-valor').value = '';
    document.getElementById('in-total').value = '';
}

// Pagamento Seguro
function triggerPay(id) {
    pendingId = id;
    document.getElementById('confirm-pwd').value = '';
    openModal('modal-pwd');
}

function validateAndPay() {
    const inputPwd = document.getElementById('confirm-pwd').value;
    if(inputPwd === MASTER_PASSWORD) {
        notes = notes.map(n => {
            if(n.id === pendingId) {
                n.pagas = n.pagas < n.parcelas ? n.pagas + 1 : 0;
                writeLog(`PAGAMENTO: ${n.nome} (${n.pagas}/${n.parcelas})`);
            }
            return n;
        });
        sync();
        closeModal('modal-pwd');
    } else {
        alert("Senha incorreta!");
        document.getElementById('confirm-pwd').value = '';
    }
}

// Exclusão
function deleteNote(id) {
    if(confirm("Confirmar exclusão?")) {
        const item = notes.find(n => n.id === id);
        writeLog(`Removido: ${item.nome}`);
        notes = notes.filter(n => n.id !== id);
        sync();
    }
}

function sync() {
    localStorage.setItem('finnotes_pro_v49', JSON.stringify(notes));
    render();
}

function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    let totalGeral = 0;

    notes.forEach(n => {
        totalGeral += n.total;
        const prog = (n.pagas / n.parcelas) * 100;
        const color = { 'Infraestrutura': '#34d399', 'Alimentação': '#f97316', 'Saúde': '#22d3ee', 'Lazer': '#a78bfa', 'Outros': '#94a3b8' }[n.cat];

        const container = document.createElement('div');
        container.className = 'card-container';
        container.innerHTML = `
            <div class="delete-btn-bg">EXCLUIR</div>
            <div class="card" id="card-${n.id}" style="--color: ${color}">
                <button class="pc-delete" onclick="event.stopPropagation(); deleteNote(${n.id})">APAGAR</button>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:800; font-size:16px;">${n.nome}</div>
                        <div style="font-size:11px; color:var(--t3);">${n.pagas} de ${n.parcelas} parcelas</div>
                    </div>
                    <div style="text-align:right; font-weight:800; color:var(--ac);">R$ ${n.total.toFixed(2)}</div>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:${prog}%"></div></div>
            </div>
        `;

        const cardEl = container.querySelector('.card');
        
        // Mobile Swipe (Direita)
        let startX = 0;
        cardEl.addEventListener('touchstart', e => { 
            startX = e.touches[0].clientX; 
            cardEl.style.transition = 'none'; 
        }, {passive: true});

        cardEl.addEventListener('touchmove', e => {
            let diff = e.touches[0].clientX - startX;
            if(diff > 0 && diff < 120) cardEl.style.transform = `translateX(${diff}px)`;
        }, {passive: true});

        cardEl.addEventListener('touchend', e => {
            cardEl.style.transition = 'transform 0.3s ease';
            let diff = e.changedTouches[0].clientX - startX;
            if(diff > 80) {
                deleteNote(n.id);
                cardEl.style.transform = 'translateX(0)';
            } else {
                cardEl.style.transform = 'translateX(0)';
                if(Math.abs(diff) < 5) triggerPay(n.id);
            }
        });

        // Desktop Click
        cardEl.addEventListener('click', () => {
            if(window.innerWidth > 768) triggerPay(n.id);
        });

        list.appendChild(container);
    });

    document.getElementById('total-geral').innerText = totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW fail', err));
    });
}

render();
