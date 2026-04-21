'use strict';

// 258456 -> MjU4NDU2
const K_ENC = "MjU4NDU2"; 

let notes = JSON.parse(localStorage.getItem('finnotes_v9_data') || '[]');
let pendingAction = { id: null, type: null };

const getK = () => atob(K_ENC);

function checkLogin() {
    if(document.getElementById('main-login-pwd').value === getK()) {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        addLog("Sessão iniciada.");
        render();
    } else {
        alert("SENHA INCORRETA");
        document.getElementById('main-login-pwd').value = '';
    }
}

// Popular Parcelas
const selP = document.getElementById('in-parcelas');
for(let i=1; i<=12; i++) {
    selP.innerHTML += `<option value="${i}">${i === 1 ? 'À vista' : i+'x'}</option>`;
}

function openModal(id) { 
    document.getElementById(id).classList.add('active'); 
    if(id === 'modal-pwd') setTimeout(() => document.getElementById('confirm-pwd').focus(), 150);
}
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function addLog(msg) {
    const logs = document.getElementById('logs');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `> ${new Date().toLocaleTimeString()}: ${msg.toUpperCase()}`;
    logs.prepend(entry);
}

function analisarPorcentagem() {
    const v1 = parseFloat(document.getElementById('in-valor1').value) || 0;
    const v2 = parseFloat(document.getElementById('in-valor2').value) || 0;
    const label = document.getElementById('label-percent');
    if (v1 > 0 && v2 >= v1) {
        label.textContent = `Custo Detectado: ${(((v2 - v1) / v1) * 100).toFixed(2)}%`;
    } else { label.textContent = "Custo: 0.00%"; }
}

function saveNote() {
    const nome = document.getElementById('in-nome').value;
    const total = parseFloat(document.getElementById('in-valor2').value);
    if(!nome || isNaN(total)) return;

    notes.unshift({ 
        id: Date.now(), 
        nome, 
        total, 
        parcelas: parseInt(document.getElementById('in-parcelas').value), 
        cat: document.getElementById('in-cat').value, 
        pagas: 0 
    });
    sync();
    closeModal('modal-add');
    addLog(`Salvo: ${nome}`);
    document.getElementById('in-nome').value = '';
    document.getElementById('in-valor1').value = '';
    document.getElementById('in-valor2').value = '';
}

function askAuth(id, type) {
    pendingAction = { id, type };
    const btn = document.getElementById('pwd-confirm-btn');
    document.getElementById('pwd-title').textContent = type === 'pay' ? "Validar Baixa" : "Validar Exclusão";
    btn.style.background = type === 'pay' ? "var(--ok)" : "var(--err)";
    btn.onclick = validateAuth;
    openModal('modal-pwd');
}

function validateAuth() {
    if(document.getElementById('confirm-pwd').value === getK()) {
        if(pendingAction.type === 'pay') {
            notes = notes.map(n => {
                if(n.id === pendingAction.id && n.pagas < n.parcelas) n.pagas += 1;
                return n;
            });
            addLog("Baixa de parcela confirmada.");
        } else {
            notes = notes.filter(n => n.id !== pendingAction.id);
            addLog("Registro removido.");
        }
        sync();
        closeModal('modal-pwd');
    } else { alert("SENHA INCORRETA"); }
}

function sync() {
    localStorage.setItem('finnotes_v9_data', JSON.stringify(notes));
    render();
}

function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    let somaTotal = 0;

    notes.forEach(n => {
        somaTotal += n.total;
        const isDone = n.pagas === n.parcelas;
        const color = { 'Infraestrutura': '#34d399', 'Hardware': '#f97316' }[n.cat] || '#3b82f6';

        const container = document.createElement('div');
        container.className = 'card-container';
        container.innerHTML = `
            <div class="card ${isDone ? 'completed' : ''}" id="card-${n.id}" style="--color:${isDone ? 'var(--ok)' : color}">
                <div class="btn-del-fixo" onclick="event.stopPropagation(); askAuth(${n.id}, 'delete')">APAGAR</div>
                <div style="display:flex; justify-content:space-between">
                    <div>
                        <b>${n.nome} ${isDone ? '✓' : ''}</b>
                        <div style="font-size:11px; color:var(--t3); margin-top:4px;">
                            ${isDone ? 'LIQUIDADO' : `Parcela ${n.pagas}/${n.parcelas}`}
                        </div>
                    </div>
                    <div style="text-align:right; margin-right: 15px;">
                        <b>R$ ${n.total.toFixed(2)}</b>
                    </div>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:${(n.pagas/n.parcelas)*100}%"></div></div>
            </div>
        `;

        const el = container.querySelector('.card');
        el.onclick = () => { if(!isDone) askAuth(n.id, 'pay'); };
        list.appendChild(container);
    });
    document.getElementById('total-geral').innerText = somaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
