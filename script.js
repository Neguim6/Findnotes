'use strict';

// --- LÓGICA DE INSTALAÇÃO PWA ---
let deferredPrompt;
const installRow = document.getElementById('install-row');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(err => console.log("SW error", err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installRow.style.display = 'flex';
});

async function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') installRow.style.display = 'none';
        deferredPrompt = null;
    }
}

// --- LÓGICA DO SISTEMA ---
const K_ENC = "MjU4NDU2"; // Senha: 258456
let notes = JSON.parse(localStorage.getItem('finnotes_v10_data') || '[]');
let pendingAction = { id: null, type: null };
const getK = () => atob(K_ENC);

function checkLogin() {
    if(document.getElementById('main-login-pwd').value === getK()) {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        render();
    } else { 
        alert("SENHA INCORRETA"); 
        document.getElementById('main-login-pwd').value = '';
    }
}

// Popular Parcelas
const selP = document.getElementById('in-parcelas');
if(selP) {
    selP.innerHTML = '';
    for(let i=1; i<=12; i++) { 
        selP.innerHTML += `<option value="${i}">${i === 1 ? 'À vista' : i+'x'}</option>`; 
    }
}

function openModal(id) { 
    document.getElementById(id).classList.add('active'); 
    if(id === 'modal-pwd') {
        document.getElementById('confirm-pwd').value = '';
        setTimeout(() => document.getElementById('confirm-pwd').focus(), 150);
    }
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

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
    document.getElementById('in-nome').value = '';
    document.getElementById('in-valor2').value = '';
}

function askAuth(id, type) {
    pendingAction = { id, type };
    document.getElementById('pwd-title').textContent = type === 'pay' ? "Validar Baixa" : "Validar Exclusão";
    const btn = document.getElementById('pwd-confirm-btn');
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
        } else { 
            notes = notes.filter(n => n.id !== pendingAction.id); 
        }
        sync(); 
        closeModal('modal-pwd');
    } else { alert("SENHA INCORRETA"); }
}

function sync() { 
    localStorage.setItem('finnotes_v10_data', JSON.stringify(notes)); 
    render(); 
}

function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    let soma = 0;
    
    notes.forEach(n => {
        soma += n.total;
        const isDone = n.pagas === n.parcelas;
        const color = { 'Infraestrutura': '#34d399', 'Hardware': '#f97316', 'Serviços': '#ac94f1' }[n.cat] || '#3b82f6';
        
        // Lógica de Data Subsequente: Mês atual + (parcelas pagas + 1)
        const dataRef = new Date();
        dataRef.setMonth(dataRef.getMonth() + (n.pagas + 1));
        const mesVenc = dataRef.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();

        const container = document.createElement('div');
        container.className = 'card-container';
        container.innerHTML = `
            <div class="card ${isDone ? 'completed' : ''}" id="card-${n.id}" style="--color:${isDone ? 'var(--ok)' : color}">
                <div class="btn-del-fixo" onclick="event.stopPropagation(); askAuth(${n.id}, 'delete')">APAGAR</div>
                <div style="display:flex; justify-content:space-between">
                    <div>
                        <b style="font-size:16px">${n.nome}</b><br>
                        <span style="font-size:11px; color:var(--t3); font-weight:bold">
                            ${isDone ? 'LIQUIDADO ✓' : `PARCELA ${n.pagas}/${n.parcelas} • VENC: ${mesVenc}`}
                        </span>
                    </div>
                    <div style="text-align:right; margin-right:20px;">
                        <b style="font-size:16px">R$ ${n.total.toFixed(2)}</b>
                    </div>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:${(n.pagas/n.parcelas)*100}%"></div></div>
            </div>`;
        
        const el = container.querySelector('.card');

        // GESTO MOBILE: Deslizar para a direita para apagar
        let startX = 0;
        el.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
            el.style.transition = 'none';
        }, {passive: true});

        el.addEventListener('touchmove', e => {
            let moveX = e.touches[0].clientX - startX;
            if (moveX > 0) { 
                el.style.transform = `translateX(${moveX}px)`;
                if (moveX > 100) el.style.filter = 'brightness(0.7)';
            }
        }, {passive: true});

        el.addEventListener('touchend', e => {
            el.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            let finalX = e.changedTouches[0].clientX - startX;
            
            if (finalX > 150) { 
                el.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    askAuth(n.id, 'delete');
                    el.style.transform = 'translateX(0)';
                    el.style.filter = 'none';
                }, 200);
            } else {
                el.style.transform = 'translateX(0)';
                el.style.filter = 'none';
                // Se for apenas um toque (clique)
                if (Math.abs(finalX) < 5 && !isDone) askAuth(n.id, 'pay');
            }
        });

        // Clique para Desktop
        el.onclick = () => {
            if (window.innerWidth > 1024 && !isDone) askAuth(n.id, 'pay');
        };

        list.appendChild(container);
    });
    
    document.getElementById('total-geral').innerText = soma.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Inicialização
if(localStorage.getItem('finnotes_v10_data')) render();
