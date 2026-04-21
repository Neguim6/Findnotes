'use strict';

const STORAGE_KEY = 'finnotes_v4_data';
const MASTER_PASSWORD = "258456";
const RATE = 0.035; // 3,5% Nubank

let notes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let pendingPaymentId = null;

// Preencher parcelas de 1 a 12
const selectParcelas = document.getElementById('in-parcelas');
for (let i = 1; i <= 12; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i === 1 ? 'À vista' : `${i}x`;
    selectParcelas.appendChild(opt);
}

function openMainModal() {
    document.getElementById('modal').classList.add('active');
    document.getElementById('in-nome').focus();
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    if(id === 'pwd-modal') {
        pendingPaymentId = null;
        document.getElementById('confirm-pwd').value = '';
    }
}

function calcJuros() {
    const v = parseFloat(document.getElementById('in-valor').value) || 0;
    const p = parseInt(document.getElementById('in-parcelas').value);
    const total = p === 1 ? v : v * (1 + (RATE * p));
    document.getElementById('in-total').value = total.toFixed(2);
}

function saveNote() {
    const nome = document.getElementById('in-nome').value;
    const valorJuros = parseFloat(document.getElementById('in-total').value);
    const parcelas = parseInt(document.getElementById('in-parcelas').value);
    const categoria = document.getElementById('in-cat').value;

    if (!nome || isNaN(valorJuros)) return alert("Preencha os campos.");

    notes.unshift({ id: Date.now(), nome, valorJuros, parcelas, categoria, pagas: 0 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    render();
    closeModal('modal');
    resetForm();
}

function resetForm() {
    document.getElementById('in-nome').value = '';
    document.getElementById('in-valor').value = '';
    document.getElementById('in-total').value = '';
}

// Lógica de Pagamento com Modal Customizado
function askPassword(id) {
    pendingPaymentId = id;
    document.getElementById('pwd-modal').classList.add('active');
    document.getElementById('confirm-pwd').focus();
}

function validateAndPay() {
    const pwd = document.getElementById('confirm-pwd').value;
    if (pwd === MASTER_PASSWORD) {
        notes = notes.map(n => {
            if (n.id === pendingPaymentId) {
                n.pagas = n.pagas < n.parcelas ? n.pagas + 1 : 0;
                console.log(`[PAID] ${n.nome} - Parcela registrada.`);
            }
            return n;
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        render();
        closeModal('pwd-modal');
    } else {
        alert("Senha incorreta!");
    }
}

function deleteNote(id) {
    if(confirm("Excluir item?")) {
        notes = notes.filter(n => n.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        render();
    }
}

function render() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    let somaTotal = 0, somaPaga = 0;

    notes.forEach(n => {
        const cat = { 'Alimentação': '#f97316', 'Saúde': '#22d3ee', 'Lazer': '#a78bfa', 'Infraestrutura': '#34d399', 'Outros': '#94a3b8' }[n.categoria];
        const valorParcela = n.valorJuros / n.parcelas;
        const progresso = (n.pagas / n.parcelas) * 100;
        const estaPago = n.pagas === n.parcelas;
        
        somaTotal += n.valorJuros;
        somaPaga += (n.pagas * valorParcela);

        const container = document.createElement('div');
        container.className = 'card-container';
        container.innerHTML = `
            <div class="delete-btn" onclick="deleteNote(${n.id})">EXCLUIR</div>
            <div class="card ${estaPago ? 'is-paid' : ''}" id="card-${n.id}" style="--color: ${estaPago ? 'var(--ok)' : cat}">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div style="flex:1">
                        <span style="font-weight:700; font-size:15px;">${n.nome}</span>
                        <div style="font-size:11px; color:var(--t3);">${n.parcelas}x de R$ ${valorParcela.toFixed(2)}</div>
                    </div>
                    <div style="text-align:right; font-weight:800;">R$ ${n.valorJuros.toFixed(2)}</div>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:${progresso}%; background:${estaPago ? 'var(--ok)' : 'var(--ac)'}"></div></div>
            </div>
        `;

        const cardEl = container.querySelector('.card');
        let startX = 0;

        // Swipe para a DIREITA (Invertido conforme pedido)
        cardEl.addEventListener('touchstart', e => { startX = e.touches[0].clientX; cardEl.style.transition = 'none'; }, {passive: true});
        cardEl.addEventListener('touchmove', e => {
            let diff = e.touches[0].clientX - startX;
            if (diff > 0) cardEl.style.transform = `translateX(${Math.min(diff, 100)}px)`;
        }, {passive: true});
        
        cardEl.addEventListener('touchend', e => {
            cardEl.style.transition = 'transform 0.3s ease';
            let diff = e.changedTouches[0].clientX - startX;
            if (diff > 60) {
                cardEl.style.transform = 'translateX(80px)';
            } else {
                cardEl.style.transform = 'translateX(0)';
                if (Math.abs(diff) < 5) askPassword(n.id);
            }
        });

        cardEl.addEventListener('click', () => { if (window.innerWidth > 768) askPassword(n.id); });

        list.appendChild(container);
    });

    document.getElementById('total-geral').innerText = somaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('label-pagas').innerText = `Pagas: ${somaPaga.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    const pct = somaTotal > 0 ? (somaPaga / somaTotal * 100) : 0;
    document.getElementById('label-pct').innerText = `${pct.toFixed(1)}%`;
    document.getElementById('total-progress').style.width = pct + '%';
}

render();
