'use strict';

const NUBANK_RATE = 0.035; // 3,5% ao mês
const STORAGE_KEY = 'finnotes_v4_data';
const CATS = {
    'Alimentação': { icon: '🍽', color: '#f97316', bg: '#431407' },
    'Saúde': { icon: '💊', color: '#22d3ee', bg: '#083344' },
    'Lazer': { icon: '🎮', color: '#a78bfa', bg: '#2e1065' },
    'Infraestrutura': { icon: '🏠', color: '#34d399', bg: '#052e16' },
    'Outros': { icon: '📦', color: '#94a3b8', bg: '#1e293b' }
};

let notes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

function toggleModal(show) {
    const modal = document.getElementById('modal');
    modal.classList.toggle('active', show);
    if(show) document.getElementById('in-nome').focus();
}

function calcJuros() {
    const v = parseFloat(document.getElementById('in-valor').value) || 0;
    const p = parseInt(document.getElementById('in-parcelas').value);
    const total = p === 1 ? v : v * (1 + (NUBANK_RATE * p));
    document.getElementById('in-total').value = total.toFixed(2);
}

function saveNote() {
    const nome = document.getElementById('in-nome').value;
    const valorJuros = parseFloat(document.getElementById('in-total').value); 
    const parcelas = parseInt(document.getElementById('in-parcelas').value);
    const categoria = document.getElementById('in-cat').value;

    if (!nome || isNaN(valorJuros)) return;

    notes.unshift({ id: Date.now(), nome, valorJuros, parcelas, categoria, pagas: 0 });
    update();
    toggleModal(false);
    
    document.getElementById('in-nome').value = '';
    document.getElementById('in-valor').value = '';
    document.getElementById('in-total').value = '';
}

function toggleParcela(id) {
    notes = notes.map(n => {
        if (n.id === id) n.pagas = n.pagas < n.parcelas ? n.pagas + 1 : 0;
        return n;
    });
    update();
}

function deleteNote(id) {
    if(confirm("Excluir este item?")) {
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
    let somaTotal = 0, somaPaga = 0;

    notes.forEach(n => {
        const cat = CATS[n.categoria] || CATS['Outros'];
        const valorParcela = n.valorJuros / n.parcelas;
        const progresso = (n.pagas / n.parcelas) * 100;
        const estaPago = n.pagas === n.parcelas;
        
        somaTotal += n.valorJuros;
        somaPaga += (n.pagas * valorParcela);

        const container = document.createElement('div');
        container.className = 'card-container';
        container.innerHTML = `
            <div class="delete-btn" onclick="deleteNote(${n.id})">APAGAR</div>
            <div class="card ${estaPago ? 'is-paid' : ''}" id="card-${n.id}" style="--color: ${estaPago ? 'var(--ok)' : cat.color}">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div style="flex:1">
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                            <span style="font-weight:700; font-size:15px;">${n.nome}</span>
                            ${estaPago ? '<span class="paid-stamp">PAGO</span>' : `<span class="badge" style="background:${cat.bg}; color:${cat.color}">${cat.icon}</span>`}
                        </div>
                        <div style="font-size:11px; color:var(--t3); font-family:monospace;">${n.parcelas}x de R$ ${valorParcela.toFixed(2)}</div>
                    </div>
                    <div style="text-align:right; font-weight:800; font-size:16px;">R$ ${n.valorJuros.toFixed(2)}</div>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:${progresso}%; background:${estaPago ? 'var(--ok)' : 'var(--ac)'}"></div></div>
            </div>
        `;

        const cardEl = container.querySelector('.card');
        let startX = 0;

        // Lógica de Deslizar (Mobile)
        cardEl.addEventListener('touchstart', e => { startX = e.touches[0].clientX; cardEl.style.transition = 'none'; }, {passive: true});
        cardEl.addEventListener('touchmove', e => {
            let diff = startX - e.touches[0].clientX;
            if (diff > 0) cardEl.style.transform = `translateX(-${Math.min(diff, 100)}px)`;
        }, {passive: true});
        cardEl.addEventListener('touchend', e => {
            cardEl.style.transition = 'transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
            let diff = startX - e.changedTouches[0].clientX;
            if (diff > 60) {
                cardEl.style.transform = 'translateX(-80px)';
            } else {
                cardEl.style.transform = 'translateX(0)';
                if (Math.abs(diff) < 5) toggleParcela(n.id); // Trata como clique se não deslizou
            }
        });

        // Clique para desktop
        cardEl.addEventListener('click', (e) => {
            if (window.innerWidth > 768) toggleParcela(n.id);
        });

        list.appendChild(container);
    });

    // Atualiza Dashboard
    document.getElementById('total-geral').innerText = somaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('label-pagas').innerText = `Pagas: ${somaPaga.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    const pct = somaTotal > 0 ? (somaPaga / somaTotal * 100) : 0;
    document.getElementById('label-pct').innerText = `${pct.toFixed(1)}%`;
    document.getElementById('total-progress').style.width = pct + '%';
}

render();
