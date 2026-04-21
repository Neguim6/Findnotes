'use strict';

const RATE = 0.035; // Atualizado para 3,5% (Nubank médio)
const STORAGE_KEY = 'finnotes_v4_data';
const CATS = {
    'Alimentação': { icon: '🍽', color: '#f97316', bg: '#431407' },
    'Saúde': { icon: '💊', color: '#22d3ee', bg: '#083344' },
    'Lazer': { icon: '🎮', color: '#a78bfa', bg: '#2e1065' },
    'Infraestrutura': { icon: '🏠', color: '#34d399', bg: '#052e16' },
    'Outros': { icon: '📦', color: '#94a3b8', bg: '#1e293b' }
};

let notes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let deferredPrompt;

// --- GESTÃO DO MODAL ---
function toggleModal(show) {
    const modal = document.getElementById('modal');
    if (show) {
        modal.classList.add('active');
        document.getElementById('in-nome').focus();
    } else {
        modal.classList.remove('active');
    }
}

// --- CÁLCULOS ---
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

    if (!nome || isNaN(valorJuros)) return alert("Dados incompletos.");

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
    notes = notes.filter(n => n.id !== id);
    update();
}

function update() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    render();
}

// --- RENDERIZAÇÃO COM SWIPE ---
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
            <div class="delete-action" onclick="deleteNote(${n.id})">EXCLUIR</div>
            <div class="card ${estaPago ? 'is-paid' : ''}" id="card-${n.id}" style="--color: ${estaPago ? 'var(--ok)' : cat.color}">
                <div style="display:flex; justify-content:space-between; align-items:start; gap: 10px;">
                    <div style="flex:1">
                        <div style="display:flex; align-items:center; flex-wrap: wrap; gap:6px; margin-bottom:4px;">
                            <span style="font-weight:700; font-size:15px;">${n.nome}</span>
                            ${estaPago ? '<span class="paid-stamp">PAGO</span>' : `<span class="badge" style="background:${cat.bg}; color:${cat.color}">${cat.icon}</span>`}
                        </div>
                        <div style="font-size:12px; color:var(--t3); font-family:monospace;">${n.parcelas}x de R$ ${valorParcela.toFixed(2)}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:800; font-size:16px;">R$ ${n.valorJuros.toFixed(2)}</div>
                    </div>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:${progresso}%; background:${estaPago ? 'var(--ok)' : 'var(--ac)'}"></div></div>
            </div>
        `;

        const cardEl = container.querySelector('.card');
        
        // Lógica de Swipe (Arrastar)
        let startX = 0;
        cardEl.addEventListener('touchstart', e => startX = e.touches[0].clientX);
        cardEl.addEventListener('touchmove', e => {
            let diff = startX - e.touches[0].clientX;
            if (diff > 0 && diff < 100) cardEl.style.transform = `translateX(-${diff}px)`;
        });
        cardEl.addEventListener('touchend', e => {
            let diff = startX - e.changedTouches[0].clientX;
            if (diff > 50) {
                cardEl.style.transform = 'translateX(-80px)';
            } else {
                cardEl.style.transform = 'translateX(0)';
                if (diff < 5) toggleParcela(n.id); // Clique simples
            }
        });

        // Clique para computador
        cardEl.onclick = (e) => {
            if (window.innerWidth > 768) toggleParcela(n.id);
        };

        list.appendChild(container);
    });

    document.getElementById('total-geral').innerText = somaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('label-pagas').innerText = `Pagas: ${somaPaga.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    const pctGeral = somaTotal > 0 ? (somaPaga / somaTotal * 100) : 0;
    document.getElementById('label-pct').innerText = `${pctGeral.toFixed(1)}%`;
    document.getElementById('total-progress').style.width = pctGeral + '%';
}

// PWA Install
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-btn').style.display = 'block';
});

render();
