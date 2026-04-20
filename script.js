/* ============================================================
   FinNotes — script.js
   Full financial notes logic with interest, localStorage, PWA
   ============================================================ */

'use strict';

// ── Constants ────────────────────────────────────────────────
const STORAGE_KEY   = 'finnotes_v2_data';
const INTEREST_RATE = 0.02; // 2% ao mês (juros simples)

const CATEGORY_SLUG = {
  'Alimentação':    'alimentacao',
  'Saúde':          'saude',
  'Lazer':          'lazer',
  'Infraestrutura': 'infraestrutura',
  'Outros':         'outros',
};

// ── State ─────────────────────────────────────────────────────
let notes       = [];
let activeFilter = 'todas';

// ── DOM refs ──────────────────────────────────────────────────
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

// ── Init ──────────────────────────────────────────────────────
function init() {
  setDefaultDate();
  loadNotes();
  renderAll();
  bindEvents();
  registerSW();
}

function setDefaultDate() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  $data.value = `${y}-${m}-${d}`;
}

// ── Storage ───────────────────────────────────────────────────
function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    notes = raw ? JSON.parse(raw) : [];
  } catch {
    notes = [];
  }
}

function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// ── Interest Calculation ──────────────────────────────────────
function calcInterest(valorReal, numParcelas) {
  if (!valorReal || numParcelas <= 1) return valorReal;
  // Juros simples: VT = VP × (1 + i × n)
  return valorReal * (1 + INTEREST_RATE * numParcelas);
}

function updateJurosField() {
  const vr = parseFloat($valorReal.value);
  const np = parseInt($parcelas.value, 10);

  if (!vr || isNaN(vr)) {
    $valorJuros.value = '';
    $jurosBadge.style.display = 'none';
    $parcelaHint.textContent = '';
    return;
  }

  if (np === 1) {
    $valorJuros.value = vr.toFixed(2);
    $jurosBadge.style.display = 'none';
    $parcelaHint.textContent = '';
    return;
  }

  const vt = calcInterest(vr, np);
  $valorJuros.value = vt.toFixed(2);

  const percentTotal = ((vt - vr) / vr * 100).toFixed(1);
  $jurosBadge.textContent = `+${percentTotal}% (${np * INTEREST_RATE * 100}% juros s.)`;
  $jurosBadge.style.display = 'inline';

  const parcMensal = vt / np;
  $parcelaHint.textContent = `→ ${np}x de ${formatCurrency(parcMensal)} · Total sugerido com 2%/mês`;
}

// ── Save Note ─────────────────────────────────────────────────
function saveNote() {
  const nome       = $nome.value.trim();
  const data       = $data.value;
  const descricao  = $descricao.value.trim();
  const parcelas   = parseInt($parcelas.value, 10);
  const valorReal  = parseFloat($valorReal.value);
  const valorJuros = parseFloat($valorJuros.value);
  const categoria  = $categoria.value;

  if (!nome) { shake($nome); showToast('⚠ Informe o nome da nota.'); return; }
  if (!data) { shake($data); showToast('⚠ Informe a data.'); return; }
  if (!valorReal || isNaN(valorReal) || valorReal <= 0) {
    shake($valorReal); showToast('⚠ Informe o valor real.'); return;
  }
  if (!valorJuros || isNaN(valorJuros) || valorJuros <= 0) {
    shake($valorJuros); showToast('⚠ Informe o valor total.'); return;
  }

  const note = {
    id:          Date.now().toString(36) + Math.random().toString(36).slice(2),
    nome,
    data,
    descricao,
    parcelas,
    valorReal,
    valorJuros,
    categoria,
    criadoEm:   new Date().toISOString(),
  };

  notes.unshift(note);
  saveNotes();
  renderAll();
  clearForm();
  showToast('✓ Anotação salva!');
}

// ── Delete Note ───────────────────────────────────────────────
function deleteNote(id) {
  const card = document.querySelector(`[data-id="${id}"]`);
  if (card) {
    card.classList.add('removing');
    card.addEventListener('animationend', () => {
      notes = notes.filter(n => n.id !== id);
      saveNotes();
      renderAll();
    }, { once: true });
  }
}

// ── Render ────────────────────────────────────────────────────
function renderAll() {
  renderDashboard();
  renderNotes();
}

function renderDashboard() {
  const total = notes.reduce((s, n) => s + (n.valorJuros || 0), 0);
  $totalGeral.textContent = formatCurrency(total);

  const cats = ['Alimentação','Saúde','Lazer','Infraestrutura','Outros'];
  let catTexts = [];
  cats.forEach(cat => {
    const slug = CATEGORY_SLUG[cat];
    const sum  = notes.filter(n => n.categoria === cat).reduce((s,n) => s + n.valorJuros, 0);
    const el   = document.getElementById(`val-${slug}`);
    if (el) el.textContent = formatCurrencyShort(sum);
    if (sum > 0) catTexts.push(cat);
  });

  const count = notes.length;
  $noteCount.textContent = count === 1 ? '1 nota' : `${count} notas`;
  $totalSub.textContent = count === 0
    ? 'nenhuma anotação ainda'
    : `em ${count} anotaç${count === 1 ? 'ão' : 'ões'}`;
}

function renderNotes() {
  const filtered = activeFilter === 'todas'
    ? notes
    : notes.filter(n => n.categoria === activeFilter);

  // Remove existing cards (keep empty state)
  document.querySelectorAll('.note-card').forEach(el => el.remove());

  if (filtered.length === 0) {
    $emptyState.style.display = 'block';
    return;
  }
  $emptyState.style.display = 'none';

  filtered.forEach(note => {
    const card = buildNoteCard(note);
    $notesList.appendChild(card);
  });
}

function buildNoteCard(note) {
  const slug    = CATEGORY_SLUG[note.categoria] || 'outros';
  const fData   = formatDate(note.data);
  const hasJuro = note.valorJuros > note.valorReal;
  const parcVal = (note.valorJuros / note.parcelas);

  const card = document.createElement('div');
  card.className = 'note-card';
  card.dataset.id = note.id;

  card.innerHTML = `
    <div class="note-cat-bar cat-${slug}"></div>
    <div class="note-body">
      <div class="note-top">
        <span class="note-name">${escapeHtml(note.nome)}</span>
        <span class="note-cat-badge badge-${slug}">${note.categoria}</span>
        <span class="note-date">${fData}</span>
      </div>
      ${note.descricao ? `<div class="note-desc">${escapeHtml(note.descricao)}</div>` : ''}
      <div class="note-financials">
        <span class="note-parcelas">${note.parcelas === 1 ? 'À vista' : `${note.parcelas}x`}</span>
        ${hasJuro
          ? `<span class="note-valor-real">${formatCurrency(note.valorReal)}</span>`
          : ''}
        <span class="note-valor-total">${formatCurrency(note.valorJuros)}</span>
        ${note.parcelas > 1
          ? `<span class="note-valor-parcela">${note.parcelas}x de ${formatCurrency(parcVal)}</span>`
          : ''}
      </div>
    </div>
    <div class="note-actions">
      <button class="btn-delete" title="Excluir nota" aria-label="Excluir nota">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  `;

  card.querySelector('.btn-delete').addEventListener('click', () => deleteNote(note.id));
  return card;
}

// ── Form ──────────────────────────────────────────────────────
function clearForm() {
  $nome.value       = '';
  $descricao.value  = '';
  $parcelas.value   = '1';
  $valorReal.value  = '';
  $valorJuros.value = '';
  $jurosBadge.style.display = 'none';
  $parcelaHint.textContent  = '';
  setDefaultDate();
  $nome.focus();
}

function shake(el) {
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = 'shake 0.35s ease';
  el.addEventListener('animationend', () => el.style.animation = '', { once: true });
}

// ── Filters ───────────────────────────────────────────────────
function setFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderNotes();
}

// ── Events ────────────────────────────────────────────────────
function bindEvents() {
  $btnSave.addEventListener('click', saveNote);
  $btnClear.addEventListener('click', () => { clearForm(); showToast('Formulário limpo.'); });

  $valorReal.addEventListener('input', updateJurosField);
  $parcelas.addEventListener('change', updateJurosField);

  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  // Enter on nome field triggers save
  $nome.addEventListener('keydown', e => { if (e.key === 'Enter') $valorReal.focus(); });
}

// ── Toast ─────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 2800);
}

// ── Formatters ────────────────────────────────────────────────
function formatCurrency(val) {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatCurrencyShort(val) {
  if (!val) return 'R$ 0';
  if (val >= 1000) return `R$ ${(val / 1000).toFixed(1)}k`;
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Shake animation (injected) ────────────────────────────────
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shake {
  0%,100%{ transform: translateX(0); }
  20%    { transform: translateX(-6px); }
  40%    { transform: translateX(6px); }
  60%    { transform: translateX(-4px); }
  80%    { transform: translateX(4px); }
}`;
document.head.appendChild(shakeStyle);

// ── Service Worker Registration ───────────────────────────────
function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./service-worker.js').then(reg => {
    // Listen for a new SW waiting
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(newWorker);
        }
      });
    });
  }).catch(err => {
    console.warn('SW registration failed:', err);
  });

  // When the new SW takes control, reload
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

function showUpdateBanner(worker) {
  const banner = document.getElementById('update-banner');
  const btn    = document.getElementById('update-btn');
  banner.classList.remove('hidden');
  btn.addEventListener('click', () => {
    worker.postMessage({ type: 'SKIP_WAITING' });
  }, { once: true });
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
