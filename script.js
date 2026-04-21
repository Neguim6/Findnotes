'use strict';

const MASTER_PASSWORD = "258456";
const RATE = 0.035; // Taxa padrão 3.5%
let notes = JSON.parse(localStorage.getItem('finnotes_data_v53') || '[]');
let pendingAction = { id: null, type: null };

// Preencher parcelas
const sel = document.getElementById('in-parcelas');
for(let i=1; i<=12; i++) {
    sel.innerHTML += `<option value="${i}">${i === 1 ? 'À vista' : i+'x'}</option>`;
}

function openModal(id) { 
    document.getElementById(id).classList.add('active'); 
    if(id === 'modal-pwd') {
        document.getElementById('confirm-pwd').value = '';
        setTimeout(() => document.getElementById('confirm-pwd').focus(), 150);
    }
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function addLog(msg) {
    const logs = document.getElementById('logs');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `> /temp/sys_log_${Date.now()}.bin: ${msg.toUpperCase()}`;
    logs.prepend(entry);
}

// NOVO: Cálculo de juros detalhado
function calcJuros() {
    const v1 = parseFloat(document.getElementById('in-valor').value) || 0;
    const p = parseInt(document.getElementById('in-parcelas').value);
    
    const v2 = (p === 1 ? v1 : v1 * (1 + (RATE * p)));
    const jurosReais = v2 - v1;

    document.getElementById('in-total').value = v2.toFixed(2);
    document.getElementById('label-juros').textContent = `Juros: R$ ${jurosReais.toFixed(2)}`;
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

function askAuth(id, type) {
    pendingAction = { id, type };
    const btn = document.getElementById('pwd-confirm-btn');
    document.getElementById('pwd-title').textContent = type === 'pay' ? "Confirmar Pagamento" : "Confirmar Exclusão";
    document.getElementById('pwd-desc').textContent = type === 'pay' ? "Baixa de parcela no sistema." : "DELETAR REGISTRO PERMANENTEMENTE.";
    btn.style.background = type === 'pay' ? "var(--ok)" : "var(--err)";
    btn.onclick = validateAuth;
    openModal('modal-pwd');
}

function validateAuth() {
    if(document.getElementById('confirm-pwd').value === MASTER_PASSWORD) {
        if(pendingAction.type === 'pay') {
            notes = notes.map(n => {
                if(n.id === pendingAction.id && n.pagas < n.parcelas) {
                    n.pagas += 1;
                    addLog(`Pagamento: ${n.nome} (${n.pagas}/${n.parcelas})`);
                }
                return n;
            });
        } else {
            notes = notes.filter(n => n.id !== pendingAction.id);
            addLog("Exclusão realizada.");
        }
        sync();
        closeModal('modal-pwd');
    } else {
        alert("SENHA INCORRETA");
    }
}

function sync() {
    localStorage.setItem('finnotes_data_v53', JSON.stringify(notes));
    render();
}

function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    let soma = 0;

    notes.forEach(n => {
        soma += n.total;
        const prog = (n.pagas / n.parcelas) * 100;
        const isDone = n.pagas === n.parcelas;
        const color = { 'Infraestrutura': '#34d399', 'Alimentação': '#f97316', 'Outros': '#94a3b8' }[n.cat] || '#3b82f6';

        const container = document.createElement('div');
        container.className = 'card-container';
        container.innerHTML = `
            <div class="delete-btn-bg" onclick="askAuth(${n.id}, 'delete')">APAGAR</div>
            <div class="card ${isDone ? 'completed' : ''}" id="card-${n.id}" style="--color:${isDone ? 'var(--ok)' : color}">
                <button class="pc-delete" onclick="event.stopPropagation(); askAuth(${n.id}, 'delete')">APAGAR</button>
                <div style="display:flex; justify-content:space-between">
                    <div style="flex:1">
                        <b>${n.nome}</b>
                        <div style="font-size:11px; color:var(--t3); margin-top:3px;">
                            ${isDone ? '✓ FINALIZADO' : `Parcela: ${n.pagas} de ${n.parcelas}`}
                        </div>
                    </div>
                    <div style="text-align:right"><b>R$ ${n.total.toFixed(2)}</b></div>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:${prog}%"></div></div>
            </div>
        `;

        const el = container.querySelector('.card');
        let sX = 0;
        el.ontouchstart = e => { sX = e.touches[0].clientX; el.style.transition = 'none'; };
        el.ontouchmove = e => {
            let d = e.touches[0].clientX - sX;
            if(d > 0 && d < 120) el.style.transform = `translateX(${d}px)`;
        };
        el.ontouchend = e => {
            el.style.transition = 'all 0.3s ease';
            let d = e.changedTouches[0].clientX - sX;
            if(d > 80) { askAuth(n.id, 'delete'); el.style.transform = 'translateX(0)'; }
            else { el.style.transform = 'translateX(0)'; if(Math.abs(d) < 5 && !isDone) askAuth(n.id, 'pay'); }
        };
        el.onclick = () => { if(window.innerWidth > 768 && !isDone) askAuth(n.id, 'pay'); };
        list.appendChild(container);
    });
    document.getElementById('total-geral').innerText = soma.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
render();
