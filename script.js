'use strict';

// 258456 -> MjU4NDU2
// solosagradot@gmail.com -> c29sb3NhZ3JhZG90QGdtYWlsLmNvbQ==
const K_ENC = "MjU4NDU2"; 
const M_ENC = "c29sb3NhZ3JhZG90QGdtYWlsLmNvbQ=="; 

let notes = JSON.parse(localStorage.getItem('finnotes_v8_data') || '[]');
let pendingAction = { id: null, type: null };

const getK = () => atob(K_ENC);
const getM = () => atob(M_ENC);

// DISPARO DE E-MAIL (Web3Forms - Mais robusto)
async function enviarNotificacao(item, atual) {
    const payload = {
        access_key: "05260126-7788-449e-b91d-6e792c3066a5", // Chave pública de teste
        subject: `FINNOTES: Pagamento de ${item.nome}`,
        from_name: "Sistema FinNotes",
        to_email: getM(),
        message: `
            Item: ${item.nome}
            Parcela: ${atual} de ${item.parcelas}
            Valor Final: R$ ${item.total.toFixed(2)}
            Data: ${new Date().toLocaleString('pt-BR')}
        `
    };

    try {
        await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload)
        });
        addLog("Notificação de segurança enviada ao admin.");
    } catch (e) {
        addLog("Falha na rota de e-mail.");
    }
}

function checkLogin() {
    if(document.getElementById('main-login-pwd').value === getK()) {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        render();
    } else {
        alert("ACESSO NEGADO");
    }
}

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
        label.textContent = `Taxa: ${(((v2 - v1) / v1) * 100).toFixed(2)}%`;
    } else { label.textContent = "Taxa: 0.00%"; }
}

function saveNote() {
    const nome = document.getElementById('in-nome').value;
    const total = parseFloat(document.getElementById('in-valor2').value);
    if(!nome || isNaN(total)) return;

    notes.unshift({ id: Date.now(), nome, total, parcelas: parseInt(document.getElementById('in-parcelas').value), cat: document.getElementById('in-cat').value, pagas: 0 });
    sync();
    closeModal('modal-add');
    addLog(`Criado: ${nome}`);
    document.getElementById('in-nome').value = '';
    document.getElementById('in-valor1').value = '';
    document.getElementById('in-valor2').value = '';
}

function askAuth(id, type) {
    pendingAction = { id, type };
    document.getElementById('pwd-title').textContent = type === 'pay' ? "Confirmar Baixa" : "Confirmar Exclusão";
    document.getElementById('pwd-confirm-btn').style.background = type === 'pay' ? "var(--ok)" : "var(--err)";
    document.getElementById('pwd-confirm-btn').onclick = validateAuth;
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
    } else { alert("SENHA INCORRETA"); }
}

function sync() {
    localStorage.setItem('finnotes_v8_data', JSON.stringify(notes));
    render();
}

function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    let soma = 0;
    notes.forEach(n => {
        soma += n.total;
        const isDone = n.pagas === n.parcelas;
        const color = { 'Infraestrutura': '#34d399', 'Alimentação': '#f97316' }[n.cat] || '#3b82f6';
        const container = document.createElement('div');
        container.className = 'card-container';
        container.innerHTML = `
            <div class="delete-btn-bg" onclick="askAuth(${n.id}, 'delete')">APAGAR</div>
            <div class="card ${isDone ? 'completed' : ''}" id="card-${n.id}" style="--color:${isDone ? 'var(--ok)' : color}">
                <div style="display:flex; justify-content:space-between">
                    <div>
                        <b>${n.nome} ${isDone ? '✓' : ''}</b>
                        <div style="font-size:11px; color:var(--t3); margin-top:4px;">
                            ${isDone ? 'LIQUIDADO' : `Parcela ${n.pagas}/${n.parcelas}`}
                        </div>
                    </div>
                    <div style="text-align:right"><b>R$ ${n.total.toFixed(2)}</b></div>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:${(n.pagas/n.parcelas)*100}%"></div></div>
            </div>
        `;
        const el = container.querySelector('.card');
        let sX = 0;
        el.ontouchstart = e => { sX = e.touches[0].clientX; el.style.transition = 'none'; };
        el.ontouchend = e => {
            el.style.transition = '0.3s';
            let d = e.changedTouches[0].clientX - sX;
            if(d > 80) { askAuth(n.id, 'delete'); }
            else if(Math.abs(d) < 5 && !isDone) askAuth(n.id, 'pay');
            el.style.transform = 'translateX(0)';
        };
        el.onclick = () => { if(window.innerWidth > 768 && !isDone) askAuth(n.id, 'pay'); };
        list.appendChild(container);
    });
    document.getElementById('total-geral').innerText = soma.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
