'use strict';

// DADOS CRIPTOGRAFADOS (Base64)
const K_ENC = "MjU4NDU2"; // 258456
const M_ENC = "c29sb3NhZ3JhZG90QGdtYWlsLmNvbQ=="; // solosagradot@gmail.com

let notes = JSON.parse(localStorage.getItem('finnotes_v7_data') || '[]');
let pendingAction = { id: null, type: null };

// Decodificadores
const getK = () => atob(K_ENC);
const getM = () => atob(M_ENC);

async function enviarNotificacao(item, atual) {
    const payload = {
        _subject: `FinNotes: Pagamento Confirmado - ${item.nome}`,
        item: item.nome,
        parcela: `${atual} de ${item.parcelas}`,
        valor: `R$ ${item.total.toFixed(2)}`,
        data: new Date().toLocaleString('pt-BR')
    };
    try {
        await fetch(`https://formsubmit.co/ajax/${getM()}`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        addLog("Notificação de segurança enviada.");
    } catch (e) {
        addLog("Erro na rede ao enviar e-mail.");
    }
}

function checkLogin() {
    const val = document.getElementById('main-login-pwd').value;
    if(val === getK()) {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        addLog("Acesso autorizado");
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
    entry.textContent = `> /sys/log_${Date.now()}: ${msg.toUpperCase()}`;
    logs.prepend(entry);
}

function analisarPorcentagem() {
    const v1 = parseFloat(document.getElementById('in-valor1').value) || 0;
    const v2 = parseFloat(document.getElementById('in-valor2').value) || 0;
    const label = document.getElementById('label-percent');
    if (v1 > 0 && v2 >= v1) {
        label.textContent = `Taxa: ${(((v2 - v1) / v1) * 100).toFixed(2)}%`;
    } else {
        label.textContent = "Taxa: 0.00%";
    }
}

function saveNote() {
    const nome = document.getElementById('in-nome').value;
    const total = parseFloat(document.getElementById('in-valor2').value);
    if(!nome || isNaN(total)) return;

    notes.unshift({ id: Date.now(), nome, total, parcelas: parseInt(document.getElementById('in-parcelas').value), cat: document.getElementById('in-cat').value, pagas: 0 });
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
    document.getElementById('pwd-title').textContent = type === 'pay' ? "Validar Pagamento" : "Validar Exclusão";
    btn.style.background = type === 'pay' ? "var(--ok)" : "var(--err)";
    btn.onclick = validateAuth;
    openModal('modal-pwd');
}

function validateAuth() {
    if(document.getElementById('confirm-pwd').value === getK()) {
        if(pendingAction.type === 'pay') {
            notes = notes.map(n => {
                if(n.id === pendingAction.id && n.pagas < n.parcelas) {
                    n.pagas += 1;
                    enviarNotificacao(n, n.pagas);
                }
                return n;
            });
        } else {
            notes = notes.filter(n => n.id !== pendingAction.id);
        }
        sync();
        closeModal('modal-pwd');
    } else {
        alert("SENHA INCORRETA");
    }
}

function sync() {
    localStorage.setItem('finnotes_v7_data', JSON.stringify(notes));
    render();
}

function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    let total = 0;

    notes.forEach(n => {
        total += n.total;
        const prog = (n.pagas / n.parcelas) * 100;
        const isDone = n.pagas === n.parcelas;
        const color = { 'Infraestrutura': '#34d399', 'Alimentação': '#f97316' }[n.cat] || '#3b82f6';

        const container = document.createElement('div');
        container.className = 'card-container';
        container.innerHTML = `
            <div class="delete-btn-bg" onclick="askAuth(${n.id}, 'delete')">APAGAR</div>
            <div class="card ${isDone ? 'completed' : ''}" id="card-${n.id}" style="--color:${isDone ? 'var(--ok)' : color}">
                <button class="pc-delete" onclick="event.stopPropagation(); askAuth(${n.id}, 'delete')">APAGAR</button>
                <div style="display:flex; justify-content:space-between">
                    <div>
                        <b>${n.nome} ${isDone ? '✓' : ''}</b>
                        <div style="font-size:11px; color:var(--t3); margin-top:4px;">
                            ${isDone ? 'FINALIZADO' : `Parcela ${n.pagas} de ${n.parcelas}`}
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
            el.style.transition = '0.3s';
            let d = e.changedTouches[0].clientX - sX;
            if(d > 80) { askAuth(n.id, 'delete'); el.style.transform = 'translateX(0)'; }
            else { el.style.transform = 'translateX(0)'; if(Math.abs(d) < 5 && !isDone) askAuth(n.id, 'pay'); }
        };
        el.onclick = () => { if(window.innerWidth > 768 && !isDone) askAuth(n.id, 'pay'); };
        list.appendChild(container);
    });
    document.getElementById('total-geral').innerText = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
