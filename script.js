'use strict';

// 1. PWA & AUTO-UPDATE
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) { 
            window.location.reload(); 
            refreshing = true; 
        }
    });
}

// 2. Lógica de Instalação (PWA)
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-row').style.display = 'flex';
});

async function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') document.getElementById('install-row').style.display = 'none';
        deferredPrompt = null;
    }
}

// 3. Sistema Base
const K_ENC = "MjU4NDU2"; 
let notes = JSON.parse(localStorage.getItem('finnotes_v12_data') || '[]');
let pendingAction = { id: null, type: null };
const getK = () => atob(K_ENC);

function logout() {
    sessionStorage.removeItem('finnotes_unlocked');
    document.getElementById('app').style.display = 'none';
    document.getElementById('lock-screen').style.display = 'flex';
    document.getElementById('main-login-pwd').value = '';
}

function unlockApp() {
    document.getElementById('lock-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    sessionStorage.setItem('finnotes_unlocked', '1');
    render();
}

function checkLogin() {
    const pwdInput = document.getElementById('main-login-pwd');
    if (pwdInput.value === getK()) {
        unlockApp();
    } else { 
        alert("SENHA INCORRETA"); 
        pwdInput.value = '';
        pwdInput.focus();
    }
}

// Se já estava logado antes do reload (ex: atualização do SW), pula a tela de login
if (sessionStorage.getItem('finnotes_unlocked') === '1') {
    unlockApp();
}

// Permitir Enter para login
document.getElementById('main-login-pwd').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkLogin();
});

// Preencher select de parcelas
const selP = document.getElementById('in-parcelas');
for (let i = 1; i <= 48; i++) { 
    selP.innerHTML += `<option value="${i}">${i === 1 ? 'À vista' : i + 'x'}</option>`; 
}

// Calcular parcela automaticamente
function calcParcela() {
    const total = parseFloat(document.getElementById('in-valor2').value);
    const parcelas = parseInt(document.getElementById('in-parcelas').value);
    const parcelaEl = document.getElementById('in-parcela-calc');
    if (!isNaN(total) && parcelas > 0) {
        const valorParcela = total / parcelas;
        parcelaEl.textContent = `Parcela: R$ ${valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        parcelaEl.style.display = 'block';
    } else {
        parcelaEl.style.display = 'none';
    }
}

document.getElementById('in-valor2').addEventListener('input', calcParcela);
document.getElementById('in-parcelas').addEventListener('change', calcParcela);

function openModal(id) { 
    document.getElementById(id).classList.add('active'); 
    if (id === 'modal-pwd') document.getElementById('confirm-pwd').focus(); 
}

function closeModal(id) { 
    document.getElementById(id).classList.remove('active'); 
    if (id === 'modal-add') {
        // Limpar campos ao fechar
        document.getElementById('in-nome').value = '';
        document.getElementById('in-valor1').value = '';
        document.getElementById('in-valor2').value = '';
        document.getElementById('in-parcelas').value = '1';
        document.getElementById('in-data').value = '';
        document.getElementById('in-parcela-calc').style.display = 'none';
    }
    if (id === 'modal-pwd') {
        document.getElementById('confirm-pwd').value = '';
    }
}

function saveNote() {
    const nome = document.getElementById('in-nome').value.trim();
    const valorOriginal = parseFloat(document.getElementById('in-valor1').value);
    const total = parseFloat(document.getElementById('in-valor2').value);
    const dataVenc = document.getElementById('in-data').value;
    
    if (!nome || isNaN(total)) {
        alert('Preencha ao menos a descrição e o total com taxas.');
        return;
    }

    notes.unshift({ 
        id: Date.now(), 
        nome, 
        valorOriginal: isNaN(valorOriginal) ? null : valorOriginal,
        total, 
        parcelas: parseInt(document.getElementById('in-parcelas').value), 
        cat: document.getElementById('in-cat').value, 
        pagas: 0,
        dataVenc: dataVenc || null
    });
    sync(); 
    closeModal('modal-add');
}

function askAuth(id, type) {
    pendingAction = { id, type };
    document.getElementById('pwd-title').textContent = type === 'pay' ? "Validar Baixa" : "Validar Exclusão";
    document.getElementById('pwd-confirm-btn').onclick = validateAuth;
    openModal('modal-pwd');
}

// Enter para confirmar senha
document.getElementById('confirm-pwd').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') validateAuth();
});

function validateAuth() {
    if (document.getElementById('confirm-pwd').value === getK()) {
        if (pendingAction.type === 'pay') {
            notes = notes.map(n => { 
                if (n.id === pendingAction.id && n.pagas < n.parcelas) n.pagas += 1; 
                return n; 
            });
        } else { 
            notes = notes.filter(n => n.id !== pendingAction.id); 
        }
        sync(); 
        closeModal('modal-pwd');
    } else { 
        alert("SENHA INCORRETA"); 
        document.getElementById('confirm-pwd').value = '';
        document.getElementById('confirm-pwd').focus();
    }
}

function sync() { 
    localStorage.setItem('finnotes_v12_data', JSON.stringify(notes)); 
    render(); 
}

// ─── SISTEMA DE ALERTAS ───────────────────────────────────────────────────────

// Retorna o status de alerta de uma nota: 'hoje', 'proximo' (≤3 dias), ou null
function getAlertStatus(n) {
    if (!n.dataVenc || n.pagas === n.parcelas) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const [ano, mes, dia] = n.dataVenc.split('-').map(Number);
    const venc = new Date(ano, mes - 1, dia);
    venc.setHours(0, 0, 0, 0);
    const diff = Math.round((venc - hoje) / 86400000); // dias
    if (diff === 0) return 'hoje';
    if (diff > 0 && diff <= 3) return 'proximo';
    if (diff < 0) return 'vencido';
    return null;
}

// Solicitar permissão de notificação push
function requestNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// Dispara notificação nativa se permitido
function sendNotif(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: 'https://cdn-icons-png.flaticon.com/512/552/552791.png' });
    }
}

// Verifica e exibe o banner de alertas no topo do app
function checkAlerts() {
    const alertas = notes.filter(n => {
        const s = getAlertStatus(n);
        return s === 'hoje' || s === 'proximo' || s === 'vencido';
    });

    let banner = document.getElementById('alert-banner');
    if (!banner) return;

    if (alertas.length === 0) {
        banner.style.display = 'none';
        return;
    }

    banner.style.display = 'block';
    banner.innerHTML = '';

    alertas.forEach(n => {
        const s = getAlertStatus(n);
        const [ano, mes, dia] = n.dataVenc.split('-');
        const dataFmt = `${dia}/${mes}/${ano}`;

        const colors = {
            'vencido': { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', icon: '🚨', label: 'VENCIDO' },
            'hoje':    { bg: 'rgba(239,68,68,0.10)', border: '#f97316', icon: '⚠️', label: 'VENCE HOJE' },
            'proximo': { bg: 'rgba(251,191,36,0.10)', border: '#fbbf24', icon: '🔔', label: 'VENCE EM BREVE' }
        };
        const c = colors[s];

        const item = document.createElement('div');
        item.style.cssText = `
            background: ${c.bg};
            border: 1px solid ${c.border};
            border-left: 4px solid ${c.border};
            border-radius: 12px;
            padding: 12px 16px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: pulseAlert 2s ease-in-out infinite;
        `;
        item.innerHTML = `
            <span style="font-size:20px;">${c.icon}</span>
            <div style="flex:1; min-width:0;">
                <div style="font-size:10px; font-weight:900; color:${c.border}; letter-spacing:0.08em;">${c.label}</div>
                <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${n.nome}</div>
                <div style="font-size:11px; color:var(--t3);">Vencimento: ${dataFmt} • R$ ${(n.total / n.parcelas).toFixed(2)}/parcela</div>
            </div>
        `;
        banner.appendChild(item);

        // Notificação push (só uma vez por sessão por nota)
        const notifKey = `notif_sent_${n.id}_${n.dataVenc}`;
        if (!sessionStorage.getItem(notifKey)) {
            const msgs = {
                'vencido': [`FinNotes — CONTA VENCIDA`, `"${n.nome}" venceu em ${dataFmt}. Regularize agora!`],
                'hoje':    [`FinNotes — VENCE HOJE`, `"${n.nome}" vence hoje (${dataFmt}). Não esqueça!`],
                'proximo': [`FinNotes — Lembrete`, `"${n.nome}" vence em ${dataFmt}. Faltam poucos dias!`]
            };
            sendNotif(msgs[s][0], msgs[s][1]);
            sessionStorage.setItem(notifKey, '1');
        }
    });
}

const CAT_COLORS = {
    'Infraestrutura': '#34d399',
    'Hardware':       '#f97316',
    'Empréstimo':     '#f43f5e',
    'Assinatura':     '#a78bfa',
    'Saúde':          '#38bdf8',
    'Veículo':        '#fbbf24',
    'Educação':       '#4ade80',
    'Outros':         '#94a3b8'
};

function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    let soma = 0;
    
    notes.forEach(n => {
        soma += n.total;
        const isDone = n.pagas === n.parcelas;
        const alertStatus = getAlertStatus(n);
        const color = isDone ? 'var(--ok)' : (alertStatus === 'vencido' ? '#ef4444' : alertStatus === 'hoje' ? '#f97316' : (CAT_COLORS[n.cat] || '#3b82f6'));
        const valorParcela = (n.total / n.parcelas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        // Data de vencimento
        let dataDisplay = '';
        let dataColor = 'var(--t3)';
        if (n.dataVenc) {
            const [ano, mes, dia] = n.dataVenc.split('-');
            dataDisplay = `• PAGAR: ${dia}/${mes}/${ano}`;
            if (alertStatus === 'vencido') { dataDisplay = `• ⚠ VENCIDO ${dia}/${mes}`; dataColor = '#ef4444'; }
            else if (alertStatus === 'hoje') { dataDisplay = `• ⚠ VENCE HOJE`; dataColor = '#f97316'; }
            else if (alertStatus === 'proximo') { dataDisplay = `• 🔔 VENCE ${dia}/${mes}`; dataColor = '#fbbf24'; }
        } else {
            const dataRef = new Date();
            dataRef.setMonth(dataRef.getMonth() + (n.pagas + 1));
            const mesVenc = dataRef.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();
            dataDisplay = `• VENC: ${mesVenc}`;
        }

        const container = document.createElement('div');
        container.className = 'card-container';

        const valorOriginalHTML = n.valorOriginal 
            ? `<span style="color:var(--t3); font-size:11px;">Orig: ${n.valorOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} → </span>`
            : '';

        // Borda pulsante para alertas
        const alertBorder = alertStatus && !isDone
            ? `box-shadow: 0 0 0 2px ${alertStatus === 'vencido' ? '#ef4444' : alertStatus === 'hoje' ? '#f97316' : '#fbbf24'};`
            : '';

        container.innerHTML = `
            <div class="card ${isDone ? 'completed' : ''} ${alertStatus && !isDone ? 'card-alert' : ''}" style="--color:${color}; ${alertBorder}">
                <div class="btn-del-fixo" data-action="delete">APAGAR</div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="flex:1; min-width:0; padding-right:8px;">
                        <b style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${n.nome}</b>
                        <small style="color:${dataColor}; font-weight:${alertStatus ? '700' : '400'};">PARCELA ${n.pagas}/${n.parcelas} ${dataDisplay}</small>
                    </div>
                    <div style="text-align:right; flex-shrink:0; margin-right:70px;">
                        <div>${valorOriginalHTML}<b>R$ ${n.total.toFixed(2)}</b></div>
                        ${n.parcelas > 1 ? `<small style="color:var(--t2);">${n.parcelas}x de ${valorParcela}</small>` : ''}
                    </div>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:${(n.pagas / n.parcelas) * 100}%"></div></div>
            </div>`;
        
        const el = container.querySelector('.card');
        const delBtn = container.querySelector('.btn-del-fixo');

        // Botão apagar fixo
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            askAuth(n.id, 'delete');
        });

        // GESTO MOBILE — swipe direita para apagar, com zona morta no botão
        let startX = 0;
        let startY = 0;
        let isSwipingCard = false;
        let touchStartedOnButton = false;

        el.addEventListener('touchstart', (e) => {
            // Detectar se o toque iniciou no botão apagar
            const target = e.target.closest('.btn-del-fixo');
            touchStartedOnButton = !!target;
            if (touchStartedOnButton) return;

            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isSwipingCard = false;
            el.style.transition = 'none';
        }, { passive: true });

        el.addEventListener('touchmove', (e) => {
            if (touchStartedOnButton) return;
            const moveX = e.touches[0].clientX - startX;
            const moveY = e.touches[0].clientY - startY;

            // Verificar se é horizontal (não scroll vertical)
            if (!isSwipingCard && Math.abs(moveX) > Math.abs(moveY) && Math.abs(moveX) > 8) {
                isSwipingCard = true;
            }

            if (isSwipingCard && moveX > 0) {
                el.style.transform = `translateX(${moveX}px)`;
            }
        }, { passive: true });

        el.addEventListener('touchend', (e) => {
            if (touchStartedOnButton) return;
            el.style.transition = '0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            const diffX = e.changedTouches[0].clientX - startX;
            const diffY = e.changedTouches[0].clientY - startY;

            // Swipe para apagar: mínimo 200px horizontal, pouco vertical
            if (isSwipingCard && diffX > 200 && Math.abs(diffY) < 80) { 
                el.style.transform = 'translateX(100%)'; 
                setTimeout(() => { 
                    askAuth(n.id, 'delete'); 
                    el.style.transform = 'translateX(0)'; 
                }, 250);
            } else { 
                el.style.transform = 'translateX(0)'; 
                // Tap (sem swipe) em desktop ou mobile faz baixa
                const isTap = Math.abs(diffX) < 10 && Math.abs(diffY) < 10;
                if (isTap && !isDone) askAuth(n.id, 'pay');
            }
        });

        // Desktop: click para baixa
        el.onclick = (e) => { 
            if (!e.target.closest('.btn-del-fixo') && window.innerWidth > 1024 && !isDone) {
                askAuth(n.id, 'pay'); 
            }
        };

        list.appendChild(container);
    });

    document.getElementById('total-geral').innerText = soma.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    checkAlerts();
}

if (localStorage.getItem('finnotes_v12_data')) render();
