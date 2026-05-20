// ═══════════════════════════════════════════════════════════════
// historial.js — Persistencia en localStorage y UI del historial
// ═══════════════════════════════════════════════════════════════
// HISTORIAL (localStorage)
// ═══════════════════════════════════════════════════════════════
const HIST_KEY = 'transportes_historial';

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getHistorial() {
  try {
    const raw = localStorage.getItem(HIST_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveHistorial(data) {
  try { localStorage.setItem(HIST_KEY, JSON.stringify(data)); } catch {}
}

function addToHistorial(entry) {
  const hist = getHistorial();
  const day = getTodayKey();
  if (!hist[day]) hist[day] = [];
  hist[day].unshift(entry); // newest first
  if (hist[day].length > 50) hist[day] = hist[day].slice(0, 50);
  saveHistorial(hist);
  updateHistorialUI();
}

function updateHistorialUI() {
  const hist = getHistorial();
  const day = getTodayKey();
  const items = hist[day] || [];

  // Badge
  const badge = document.getElementById('hist-count-badge');
  badge.textContent = items.length > 0 ? `(${items.length})` : '';

  // Stats
  document.getElementById('stat-total').textContent = items.length;
  const totalAhorro = items.reduce((s, i) => s + (i.ahorro || 0), 0);
  document.getElementById('stat-ahorro').textContent = fmt(totalAhorro);
  const pwWins = items.filter(i => i.winner === 'Palletways').length;
  const cevaWins = items.filter(i => i.winner === 'CEVA').length;
  const winnerText = pwWins > cevaWins ? `PW (${pwWins})` : cevaWins > pwWins ? `CEVA (${cevaWins})` : '—';
  document.getElementById('stat-winner').textContent = winnerText;
  document.getElementById('stat-winner').style.color = pwWins > cevaWins ? 'var(--pw-light)' : cevaWins > pwWins ? 'var(--ceva-light)' : 'var(--muted)';

  // List
  const list = document.getElementById('historial-list');
  if (!items.length) {
    list.innerHTML = '<div class="historial-empty">No hay cálculos registrados hoy.</div>';
    return;
  }
  list.innerHTML = items.map((it, idx) => `
    <div class="hist-item" onclick="cargarDesdeHistorial(${idx})">
      <div class="hist-item-top">
        <span class="hist-item-dest">📍 ${it.provincia} <span style="color:var(--dim);font-size:0.72rem">Zona ${it.zona}</span></span>
        <span class="hist-item-time">${it.hora}</span>
      </div>
      <div class="hist-item-detail">${it.palets} palés · altura ${it.altura}</div>
      <div class="hist-item-prices">
        <span class="hist-price pw">PW: ${fmt(it.pw)}</span>
        <span class="hist-price ceva">CEVA: ${fmt(it.ceva)}</span>
        <span class="hist-price winner-tag">${it.winner}</span>
        ${it.ahorro > 0.01 ? `<span class="hist-saving">−${fmt(it.ahorro)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function cargarDesdeHistorial(idx) {
  const hist = getHistorial();
  const day = getTodayKey();
  const items = hist[day] || [];
  const it = items[idx];
  if (!it) return;
  document.getElementById('num-palets').value = it.palets;
  document.getElementById('altura-total').value = it.altura;
  document.getElementById('prov-input').value = it.provincia.charAt(0) + it.provincia.slice(1).toLowerCase();
  state.prov = it.provincia.toUpperCase();
  state.zona = it.zona;
  const zd = document.getElementById('zona-detected');
  zd.innerHTML = `Zona ${state.zona} detectada — ${ZONAS_DESC[state.zona]}`;
  zd.className = 'show';
  toggleHistorial();
  calcular();
}

function limpiarHistorial() {
  if (!confirm('¿Seguro que quieres borrar todo el historial de hoy?')) return;
  const hist = getHistorial();
  delete hist[getTodayKey()];
  saveHistorial(hist);
  updateHistorialUI();
}

function toggleHistorial() {
  const panel = document.getElementById('historial-panel');
  panel.classList.toggle('open');
  updateHistorialUI();
}

// ═══════════════════════════════════════════════════════════════
