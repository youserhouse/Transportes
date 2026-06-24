// ═══════════════════════════════════════════════════════════════
// dashboard.js — Dashboard nativo (KPIs, comparativa, evolución,
// distribución, provincias e historial) leyendo en tiempo real la
// colección Firestore 'calculos' vía window.fsListenCalculos.
// ═══════════════════════════════════════════════════════════════

const DASH_PAGE_SIZE = 8;
const DASH_DONUT_COLORS = ['var(--pw)', 'var(--ceva)', 'var(--accent)', 'var(--winner-save)', 'var(--yellow)', 'var(--text3)'];

let dashState = { periodo: 'mes', carrier: 'ambos', page: 1, calculos: [], listening: false, _currentList: [], viewMonth: null };

function initDashboard() {
  if (!dashState.listening) {
    dashState.listening = true;
    window.fsListenCalculos(onDashData);
  }
  updateDashFilterButtons();
  renderDashboard();
}

function onDashData(docs) {
  dashState.calculos = docs.map(dashNormalize);
  if (currentMode === 'dashboard') renderDashboard();
}

function dashNormalize(doc) {
  return { ...doc, _fecha: dashToDate(doc.fecha) };
}

function dashToDate(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function dashPrecioElegido(c) {
  return c.elegido === 'PALLETWAYS' ? (Number(c.precioPall) || 0) : (Number(c.precioCeva) || 0);
}

function setDashPeriodo(p) { dashState.periodo = p; dashState.page = 1; updateDashFilterButtons(); renderDashboard(); }
function setDashCarrier(c) { dashState.carrier = c; dashState.page = 1; updateDashFilterButtons(); renderDashboard(); }

function dashMonthPrev() {
  dashState.viewMonth.setMonth(dashState.viewMonth.getMonth() - 1);
  dashState.page = 1;
  renderDashboard();
}

function dashMonthNext() {
  const now = new Date();
  const candidate = new Date(dashState.viewMonth);
  candidate.setMonth(candidate.getMonth() + 1);
  if (candidate.getFullYear() > now.getFullYear() || (candidate.getFullYear() === now.getFullYear() && candidate.getMonth() > now.getMonth())) return;
  dashState.viewMonth = candidate;
  dashState.page = 1;
  renderDashboard();
}

function updateDashFilterButtons() {
  document.querySelectorAll('#dash-per-group .dash-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.per === dashState.periodo);
  });
  document.querySelectorAll('#dash-car-group .dash-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.car === dashState.carrier);
  });
}

function dashPeriodPredicate(d, now, viewMonth) {
  if (dashState.periodo === 'hoy') {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }
  if (dashState.periodo === 'semana') {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);
    return d >= weekAgo && d <= now;
  }
  return d.getFullYear() === viewMonth.getFullYear() && d.getMonth() === viewMonth.getMonth();
}

function renderDashboard() {
  const now = new Date();
  if (!dashState.viewMonth) dashState.viewMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const viewMonth = dashState.viewMonth;
  const periodFiltered = dashState.calculos.filter(c => c._fecha && dashPeriodPredicate(c._fecha, now, viewMonth));
  const viewFiltered = dashState.carrier === 'ambos' ? periodFiltered : periodFiltered.filter(c => c.elegido === dashState.carrier);

  renderDashKPIs(periodFiltered, viewFiltered);
  renderDashCompare(periodFiltered);
  renderDashMonthlyBars(viewMonth);
  renderDashEvolucion(viewMonth);
  renderDashDistribucion(periodFiltered);
  renderDashProvincia(viewFiltered);
  renderDashHistorial(viewFiltered);

  const isCurrentMonth = viewMonth.getFullYear() === now.getFullYear() && viewMonth.getMonth() === now.getMonth();
  document.getElementById('dash-month-next').disabled = isCurrentMonth;
  document.getElementById('dash-empty').style.display = dashState.calculos.length ? 'none' : 'block';
}

// ── KPI cards ──
function renderDashKPIs(periodFiltered, viewFiltered) {
  const total = viewFiltered.length;
  document.getElementById('dash-kpi-total').textContent = total;
  document.getElementById('dash-kpi-total-sub').textContent = `${total} ${total === 1 ? 'envío' : 'envíos'} en el período`;

  let gasto = 0, ahorro = 0;
  for (const c of viewFiltered) {
    gasto += dashPrecioElegido(c);
    ahorro += Number(c.ahorro) || 0;
  }
  document.getElementById('dash-kpi-gasto').textContent = fmt(gasto);
  document.getElementById('dash-kpi-ahorro').textContent = fmt(ahorro);

  let pwCount = 0, cevaCount = 0;
  for (const c of periodFiltered) {
    if (c.elegido === 'PALLETWAYS') pwCount++;
    else if (c.elegido === 'CEVA') cevaCount++;
  }
  const masUsadoEl = document.getElementById('dash-kpi-mas-usado');
  if (pwCount === 0 && cevaCount === 0) { masUsadoEl.textContent = '—'; masUsadoEl.style.color = ''; }
  else if (pwCount >= cevaCount) { masUsadoEl.textContent = 'Palletways'; masUsadoEl.style.color = 'var(--pw)'; }
  else { masUsadoEl.textContent = 'CEVA'; masUsadoEl.style.color = 'var(--ceva)'; }
  document.getElementById('dash-kpi-mas-usado-sub').textContent = `${pwCount} Pall. · ${cevaCount} CEVA`;
}

// ── Comparativa PW vs CEVA ──
function renderDashCompare(list) {
  const pw = list.filter(c => c.elegido === 'PALLETWAYS');
  const ceva = list.filter(c => c.elegido === 'CEVA');
  const pwGasto = pw.reduce((s, c) => s + (Number(c.precioPall) || 0), 0);
  const cevaGasto = ceva.reduce((s, c) => s + (Number(c.precioCeva) || 0), 0);
  const totalCount = pw.length + ceva.length;
  document.getElementById('dash-pw-pct').textContent = (totalCount ? Math.round(pw.length / totalCount * 100) : 0) + '%';
  document.getElementById('dash-ceva-pct').textContent = (totalCount ? Math.round(ceva.length / totalCount * 100) : 0) + '%';
  document.getElementById('dash-pw-count').textContent = pw.length;
  document.getElementById('dash-ceva-count').textContent = ceva.length;
  document.getElementById('dash-pw-gasto').textContent = fmt(pwGasto);
  document.getElementById('dash-ceva-gasto').textContent = fmt(cevaGasto);
  document.getElementById('dash-pw-ticket').textContent = pw.length ? fmt(pwGasto / pw.length) : '—';
  document.getElementById('dash-ceva-ticket').textContent = ceva.length ? fmt(cevaGasto / ceva.length) : '—';
}

// ── Barras diarias del mes seleccionado, dentro de las tarjetas comparativa ──
function renderDashMonthlyBars(viewMonth) {
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const pwDaily = new Array(daysInMonth).fill(0);
  const cevaDaily = new Array(daysInMonth).fill(0);
  for (const c of dashState.calculos) {
    if (!c._fecha || c._fecha.getFullYear() !== viewMonth.getFullYear() || c._fecha.getMonth() !== viewMonth.getMonth()) continue;
    const day = c._fecha.getDate() - 1;
    if (c.elegido === 'PALLETWAYS') pwDaily[day] += Number(c.precioPall) || 0;
    else if (c.elegido === 'CEVA') cevaDaily[day] += Number(c.precioCeva) || 0;
  }
  const maxVal = Math.max(1, ...pwDaily, ...cevaDaily);
  dashRenderBars('dash-pw-bars', pwDaily, maxVal);
  dashRenderBars('dash-ceva-bars', cevaDaily, maxVal);
  document.getElementById('dash-pw-axis-mid').textContent = Math.round(daysInMonth / 2);
  document.getElementById('dash-pw-axis-end').textContent = daysInMonth;
  document.getElementById('dash-ceva-axis-mid').textContent = Math.round(daysInMonth / 2);
  document.getElementById('dash-ceva-axis-end').textContent = daysInMonth;
  document.getElementById('dash-month-label').textContent = dashCapitalize(viewMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
}

function dashRenderBars(containerId, values, maxVal) {
  const el = document.getElementById(containerId);
  el.innerHTML = values.map(v => `<div class="dash-bar" style="height:${maxVal > 0 ? (v / maxVal * 100) : 0}%"></div>`).join('');
}

function dashCapitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Simulación: gasto acumulado del mes si todos los envíos hubieran ido
// con un único transportista (suma precioPall / precioCeva de cada registro,
// sin filtrar por cuál fue el elegido en su momento) ──
function renderDashEvolucion(viewMonth) {
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const pwDaily = new Array(daysInMonth).fill(0);
  const cevaDaily = new Array(daysInMonth).fill(0);
  for (const c of dashState.calculos) {
    if (!c._fecha || c._fecha.getFullYear() !== viewMonth.getFullYear() || c._fecha.getMonth() !== viewMonth.getMonth()) continue;
    const day = c._fecha.getDate() - 1;
    pwDaily[day] += Number(c.precioPall) || 0;
    cevaDaily[day] += Number(c.precioCeva) || 0;
  }
  const pwTotal = pwDaily.reduce((a, b) => a + b, 0);
  const cevaTotal = cevaDaily.reduce((a, b) => a + b, 0);

  let pwCum = 0, cevaCum = 0;
  const pwPoints = [], cevaPoints = [];
  const maxCum = Math.max(1, pwTotal, cevaTotal);
  for (let i = 0; i < daysInMonth; i++) {
    pwCum += pwDaily[i];
    cevaCum += cevaDaily[i];
    const x = daysInMonth > 1 ? (i / (daysInMonth - 1)) * 600 : 0;
    pwPoints.push(x.toFixed(1) + ',' + (160 - (pwCum / maxCum) * 160).toFixed(1));
    cevaPoints.push(x.toFixed(1) + ',' + (160 - (cevaCum / maxCum) * 160).toFixed(1));
  }
  document.getElementById('dash-evo-pw').setAttribute('points', pwPoints.join(' '));
  document.getElementById('dash-evo-ceva').setAttribute('points', cevaPoints.join(' '));
  document.getElementById('dash-evo-axis').innerHTML = `<span>${fmt(maxCum)}</span><span>${fmt(maxCum / 2)}</span><span>0€</span>`;
  document.getElementById('dash-evo-xaxis').innerHTML =
    `<span>1</span><span>${Math.round(daysInMonth * 0.25)}</span><span>${Math.round(daysInMonth * 0.5)}</span><span>${Math.round(daysInMonth * 0.75)}</span><span>${daysInMonth}</span>`;

  document.getElementById('dash-sim-pw-total').textContent = fmt(pwTotal);
  document.getElementById('dash-sim-ceva-total').textContent = fmt(cevaTotal);
  const diff = Math.abs(pwTotal - cevaTotal);
  document.getElementById('dash-sim-diff').textContent = fmt(diff);
  document.getElementById('dash-sim-diff-sub').textContent =
    diff > 0.01 ? `${pwTotal <= cevaTotal ? 'Palletways' : 'CEVA'} saldría más barato` : 'Mismo coste';
}

// ── Distribución por rango de palés (PW vs CEVA, agrupado) ──
function renderDashDistribucion(list) {
  const palets = list.filter(c => c.tipo === 'PALÉS');
  const buckets = [p => p === 1, p => p >= 2 && p <= 3, p => p >= 4];
  const counts = buckets.map(test => ({
    pw: palets.filter(c => c.elegido === 'PALLETWAYS' && test(Number(c.pales))).length,
    ceva: palets.filter(c => c.elegido === 'CEVA' && test(Number(c.pales))).length,
  }));
  const maxCount = Math.max(1, ...counts.map(c => c.pw), ...counts.map(c => c.ceva));
  document.getElementById('dash-dist-bars').innerHTML = counts.map(c => `
    <div class="dash-dist-group">
      <div class="dash-dist-bar" style="height:${c.pw / maxCount * 100}%;background:var(--pw)" title="Palletways: ${c.pw}"></div>
      <div class="dash-dist-bar" style="height:${c.ceva / maxCount * 100}%;background:var(--ceva)" title="CEVA: ${c.ceva}"></div>
    </div>`).join('');
}

// ── Por provincia (donut) ──
function renderDashProvincia(list) {
  const counts = {};
  for (const c of list) {
    const p = c.provincia || '—';
    counts[p] = (counts[p] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = list.length;
  let acc = 0;
  const segments = entries.map(([, count], i) => {
    const pct = total ? count / total * 100 : 0;
    const seg = `${DASH_DONUT_COLORS[i % DASH_DONUT_COLORS.length]} ${acc}% ${acc + pct}%`;
    acc += pct;
    return seg;
  });
  document.getElementById('dash-donut').style.background = total ? `conic-gradient(${segments.join(',')})` : 'var(--border)';
  document.getElementById('dash-prov-legend').innerHTML = entries.slice(0, 6).map(([prov, count], i) => `
    <div class="dash-prov-row">
      <span><span class="dash-dot-sm" style="background:${DASH_DONUT_COLORS[i % DASH_DONUT_COLORS.length]}"></span>${prov}</span>
      <span>${count} (${total ? Math.round(count / total * 100) : 0}%)</span>
    </div>`).join('') || '<div class="dash-prov-row"><span>Sin datos</span></div>';
}

// ── Historial paginado + export CSV ──
function renderDashHistorial(list) {
  const totalPages = Math.max(1, Math.ceil(list.length / DASH_PAGE_SIZE));
  if (dashState.page > totalPages) dashState.page = totalPages;
  if (dashState.page < 1) dashState.page = 1;
  const start = (dashState.page - 1) * DASH_PAGE_SIZE;
  const pageItems = list.slice(start, start + DASH_PAGE_SIZE);

  document.getElementById('dash-table-body').innerHTML = pageItems.map(c => `
    <div class="dash-table-row">
      <div>${dashFechaLabel(c._fecha)}</div>
      <div><span class="dash-table-tag">${c.tipo || '—'}</span></div>
      <div><span class="dash-table-destino">${c.destino || '—'}</span></div>
      <div>${c.provincia || '—'}</div>
      <div>${c.pales != null ? c.pales : '—'}</div>
      <div class="r dash-table-pw">${c.precioPall ? fmt(Number(c.precioPall)) : '—'}</div>
      <div class="r dash-table-ceva">${c.precioCeva ? fmt(Number(c.precioCeva)) : '—'}</div>
      <div class="dash-table-actions"><button type="button" class="dash-action-btn edit" onclick="abrirEdicionDashboard('${c.id}')" title="Editar">✎</button></div>
      <div class="dash-table-actions"><button type="button" class="dash-action-btn delete" onclick="eliminarCalculoDashboard('${c.id}')" title="Eliminar">✕</button></div>
    </div>`).join('');

  const from = list.length ? start + 1 : 0;
  const to = Math.min(start + DASH_PAGE_SIZE, list.length);
  document.getElementById('dash-pag-info').textContent = `${from}–${to} de ${list.length} registros`;
  document.getElementById('dash-pag-current').textContent = dashState.page;
  document.getElementById('dash-pag-prev').disabled = dashState.page <= 1;
  document.getElementById('dash-pag-next').disabled = dashState.page >= totalPages;
  dashState._currentList = list;
}

function dashFechaLabel(d) {
  if (!d) return '—';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function dashPagePrev() { if (dashState.page > 1) { dashState.page--; renderDashboard(); } }
function dashPageNext() { dashState.page++; renderDashboard(); }

function exportarHistorialDashboardCSV() {
  const list = dashState._currentList || [];
  if (!list.length) return;
  const header = ['Fecha', 'Tipo', 'Destino', 'Provincia', 'Palés', 'Palletways €', 'CEVA €'];
  const rows = list.map(c => [
    dashFechaLabel(c._fecha), c.tipo || '', c.destino || '', c.provincia || '',
    c.pales != null ? c.pales : '',
    c.precioPall ? Number(c.precioPall).toFixed(2) : '',
    c.precioCeva ? Number(c.precioCeva).toFixed(2) : '',
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'dashboard_historial.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Edición y eliminación de registros ──
let dashEditId = null;

function abrirEdicionDashboard(id) {
  const c = dashState.calculos.find(x => x.id === id);
  if (!c) return;
  dashEditId = id;
  document.getElementById('dash-edit-fecha').value = dashToDatetimeLocal(c._fecha);
  document.getElementById('dash-edit-tipo').value = c.tipo || 'PALÉS';
  document.getElementById('dash-edit-destino').value = c.destino || 'ESPAÑA';
  document.getElementById('dash-edit-provincia').value = c.provincia || '';
  document.getElementById('dash-edit-pales').value = c.pales != null ? c.pales : '';
  document.getElementById('dash-edit-elegido').value = c.elegido || 'PALLETWAYS';
  document.getElementById('dash-edit-precio-pall').value = c.precioPall != null ? Number(c.precioPall) : '';
  document.getElementById('dash-edit-precio-ceva').value = c.precioCeva != null ? Number(c.precioCeva) : '';
  document.getElementById('dash-edit-msg').textContent = '';
  document.getElementById('dash-edit-overlay').style.display = 'flex';
}

function closeDashEditModal() {
  document.getElementById('dash-edit-overlay').style.display = 'none';
  dashEditId = null;
}

function dashToDatetimeLocal(d) {
  if (!d) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function guardarEdicionDashboard() {
  if (!dashEditId) return;
  const btn = document.getElementById('dash-edit-save-btn');
  const msgEl = document.getElementById('dash-edit-msg');

  const tipo = document.getElementById('dash-edit-tipo').value;
  const destino = document.getElementById('dash-edit-destino').value;
  const provincia = document.getElementById('dash-edit-provincia').value.trim();
  const pales = parseInt(document.getElementById('dash-edit-pales').value) || 0;
  const elegido = document.getElementById('dash-edit-elegido').value;
  const precioPall = parseFloat(document.getElementById('dash-edit-precio-pall').value) || 0;
  const precioCeva = parseFloat(document.getElementById('dash-edit-precio-ceva').value) || 0;
  const fechaVal = document.getElementById('dash-edit-fecha').value;
  const fecha = fechaVal ? new Date(fechaVal) : new Date();

  const precioElegido = elegido === 'PALLETWAYS' ? precioPall : precioCeva;
  const precioOtro = elegido === 'PALLETWAYS' ? precioCeva : precioPall;
  const ahorro = (precioOtro > 0 && precioElegido > 0) ? (precioOtro - precioElegido) : 0;

  btn.disabled = true;
  btn.textContent = 'Guardando…';
  msgEl.textContent = '';
  try {
    await window.fsActualizarCalculo(dashEditId, { tipo, destino, provincia, pales, elegido, precioPall, precioCeva, ahorro, fecha });
    closeDashEditModal();
  } catch (e) {
    msgEl.textContent = '⚠ Error: ' + (e.message || e);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar cambios';
  }
}

async function eliminarCalculoDashboard(id) {
  if (!confirm('¿Eliminar este cálculo? Esta acción no se puede deshacer.')) return;
  try {
    await window.fsEliminarCalculo(id);
  } catch (e) {
    alert('Error al eliminar: ' + (e.message || e));
  }
}
