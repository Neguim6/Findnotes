'use strict';

const STORAGE_KEY   = 'finnotes_v2_data';
const INTEREST_RATE = 0.02; 

const CATEGORY_SLUG = {
  'Alimentação':    'alimentacao',
  'Saúde':          'saude',
  'Lazer':          'lazer',
  'Infraestrutura': 'infraestrutura',
  'Outros':         'outros',
};

let notes = [];
let activeFilter = 'todas';

// DOM refs
const $nome        = document.getElementById('nome');
const $data        = document.getElementById('data');
const $descricao   = document.getElementById('descricao');
const $parcelas    = document.getElementById('parcelas');
const $valorReal   = document.getElementById('valor-real');
const $valorJuros  = document.getElementById('valor-juros');
const $categoria   = document.getElementById('categoria');
const $jurosBadge  = document.getElementById('juros-badge');
const $parcelaHint = document.getElementById('parcela-hint');
const $notesList   = document.getElementById('notes-list');
const $emptyState  = document.getElementById('empty-state');
const $totalGeral  = document.getElementById('total-geral');
const $totalSub    = document.getElementById('total-sub');
const $noteCount   = document.getElementById('note-count');
const $toast       = document.getElementById('toast');
const $btnSave     = document.getElementById('btn-save');
const $btnClear    = document.getElementById('btn-clear');

function init() {
  if (!$nome) return; // Fail-safe contra tela preta
  setDefaultDate();
  loadNotes();
  renderAll();
  bindEvents();
  registerSW();
}

function setDefaultDate() {
  const today = new Date();
  $data.value = today.toISOString().split('T')[0];
}

function loadNotes() {
  const raw = localStorage.getItem(STORAGE_KEY);
  notes = raw ? JSON.parse(raw) : [];
}

function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function updateJurosField() {
  const vr = parseFloat($valorReal.value);
  const np = parseInt($parcelas.value, 10);

  if (!vr) {
    $valorJuros.value = '';
    $jurosBadge.style.display = 'none';
    $parcelaHint.textContent = '';
    return;
  }

  const vt = np === 1 ? vr : vr * (1 + INTEREST_RATE * np);
  $valorJuros.value = vt.toFixed(2);

  if (np > 1) {
    const percentTotal = ((vt - vr) / vr * 100).toFixed(0);
    $jurosBadge.textContent = `+${percentTotal}% Juros`;
    $jurosBadge.style.display = 'inline';
    $parcelaHint.textContent = `→ ${np}x de ${formatCurrency(vt/np)}`;
  } else {
    $jurosBadge.style.display = 'none';
    $parcelaHint.textContent = '';
  }
}

function saveNote() {
  const nome = $nome.value.trim();
  const vr = parseFloat($valorReal.value);
  const vj = parseFloat($valorJuros.value);

  if (!nome || !vr || !vj) {
    showToast('⚠ Preencha os campos obrigatórios!');
    return;
  }

  const note = {
    id: Date.now().toString(36),
    nome,
    data: $data.value,
    descricao: $descricao.value,
    parcelas: parseInt($parcelas.value),
    valorReal: vr,
    valorJuros: vj,
    categoria: $categoria.value
  };

  notes.unshift(note);
  saveNotes();
  renderAll();
  clearForm();
  showToast('✓ Salvo com sucesso!');
}

function renderAll() {
  const total = notes.reduce((s, n) => s + n.valorJuros, 0);
  $totalGeral.textContent = formatCurrency(total);
  $noteCount.textContent = `${notes.length} notas`;
  
  // Update category stats
  Object.keys(CATEGORY_SLUG).forEach(cat => {
    const slug = CATEGORY_SLUG[cat];
    const sum = notes.filter(n => n.categoria === cat).reduce((s, n) => s + n.valorJuros, 0);
    const el = document.getElementById(`val-${slug}`);
    if (el) el.textContent = formatCurrency(sum);
  });

  renderNotes();
}

function renderNotes() {
  const filtered = activeFilter === 'todas' ? notes : notes.filter(n => n.categoria === activeFilter);
  document.querySelectorAll('.note-card').forEach(el => el.remove());

  if (filtered.length === 0) {
    $emptyState.style.display = 'block';
    return;
  }
  $emptyState.style.display = 'none';

  filtered.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.innerHTML = `
      <div class="note-cat-bar cat-${CATEGORY_SLUG[note.categoria]}"></div>
      <div class="note-body">
        <div class="note-top">
          <span class="note-name">${note.nome}</span>
          <span class="note-cat-badge badge-${CATEGORY_SLUG[note.categoria]}">${note.categoria}</span>
        </div>
        <div class="note-financials">
          <span>${note.parcelas}x</span>
          <strong>${formatCurrency(note.valorJuros)}</strong>
        </div>
      </div>
      <button class="btn-delete" onclick="deleteNote('${note.id}')">✕</button>
    `;
    $notesList.appendChild(card);
  });
}

window.deleteNote = (id) => {
  notes = notes.filter(n => n.id !== id);
  saveNotes();
  renderAll();
};

function clearForm() {
  $nome.value = '';
  $valorReal.value = '';
  $valorJuros.value = '';
  $descricao.value = '';
  updateJurosField();
}

function formatCurrency(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function showToast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  setTimeout(() => $toast.classList.remove('show'), 3000);
}

function bindEvents() {
  $btnSave.addEventListener('click', saveNote);
  $valorReal.addEventListener('input', updateJurosField);
  $parcelas.addEventListener('change', updateJurosField);
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('.filter-tab.active').classList.remove('active');
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderNotes();
    });
  });
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js');
  }
}

document.addEventListener('DOMContentLoaded', init);
