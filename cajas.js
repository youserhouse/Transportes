// ═══════════════════════════════════════════════════════════════
// cajas.js — Modo cajas: cálculo, UI y exportación
// ═══════════════════════════════════════════════════════════════
// MODE SWITCHING
// ═══════════════════════════════════════════════════════════════
let currentMode = 'palets';

function setMode(mode) {
  currentMode = mode;
  document.getElementById('mode-palets').style.display    = mode==='palets'    ? '' : 'none';
  document.getElementById('mode-cajas').style.display     = mode==='cajas'     ? '' : 'none';
  document.getElementById('mode-config').style.display    = mode==='config'    ? '' : 'none';
  document.getElementById('mode-dashboard').style.display = mode==='dashboard' ? '' : 'none';
  document.getElementById('tab-palets').className    = 'mode-tab' + (mode==='palets'?' active-palets':'');
  document.getElementById('tab-cajas').className     = 'mode-tab' + (mode==='cajas' ?' active-cajas':'');
  document.getElementById('tab-config').className    = 'mode-tab' + (mode==='config'?' active-config':'');
  document.getElementById('tab-dashboard').className = 'mode-tab' + (mode==='dashboard'?' active-dashboard':'');
  if (mode==='cajas') renderCajaVisual();
  if (mode==='dashboard') initDashboard();
}

function volverAlFormulario() {
  document.getElementById('results').className = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverAlFormularioCajas() {
  document.getElementById('results-cajas').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ═══════════════════════════════════════════════════════════════
// CAJAS STATE & HELPERS
// ═══════════════════════════════════════════════════════════════
let stateCajas = { prov: null };
let blurCajasTO;
let lastCajasRes = null;

// ── BREAKPOINTS peso CEVA España (índices 0–9 precio fijo, 10–13 €/kg) ──
const KG_BREAKS = [10,20,30,40,50,60,70,80,90,100];

function calcCevaByKg(prov, totalKg, aplicarRecargo = true) {
  const upper = prov.toUpperCase();
  let tarifa = CEVA_ESP[upper];
  if (!tarifa) {
    for (const k of Object.keys(CEVA_ESP)) {
      if (k.includes(upper) || upper.includes(k)) { tarifa = CEVA_ESP[k]; break; }
    }
  }
  if (!tarifa) return null;

  let basePrice, rangeLabel;
  const fixedIdx = KG_BREAKS.findIndex(b => totalKg <= b);
  if (fixedIdx !== -1) {
    basePrice = tarifa[fixedIdx];
    rangeLabel = `≤${KG_BREAKS[fixedIdx]} kg → precio fijo`;
  } else if (totalKg <= 500)  { basePrice = totalKg * tarifa[10]; rangeLabel = `${totalKg} kg × ${tarifa[10]}€/kg (101–500)`; }
  else if (totalKg <= 1000)   { basePrice = totalKg * tarifa[11]; rangeLabel = `${totalKg} kg × ${tarifa[11]}€/kg (501–1000)`; }
  else if (totalKg <= 2000)   { basePrice = totalKg * tarifa[12]; rangeLabel = `${totalKg} kg × ${tarifa[12]}€/kg (1001–2000)`; }
  else                         { basePrice = totalKg * tarifa[13]; rangeLabel = `${totalKg} kg × ${tarifa[13]}€/kg (2001+)`; }

  if (basePrice == null) return null;
  const surcharge = aplicarRecargo ? basePrice * CONFIG.CEVA_RECARGO_PCT : 0;
  return { total: basePrice + surcharge, basePrice, surcharge, totalKg, rangeLabel };
}

function validateClienteCajas() {
  const inp = document.getElementById('cliente-cajas-nombre');
  const errEl = document.getElementById('err-cliente-cajas');
  if (!inp.value.trim()) {
    inp.classList.remove('input-ok'); errEl.className='field-inline-error';
  } else {
    inp.classList.add('input-ok'); inp.classList.remove('input-error');
    errEl.className='field-inline-error';
  }
}

function calcularCajas() {
  const errEl = document.getElementById('error-cajas-msg');
  ocultarError(errEl);

  const cliente = document.getElementById('cliente-cajas-nombre').value.trim();
  const errCliente = validarCliente(cliente);
  if (errCliente) { mostrarError(errEl, errCliente); return; }

  const numCajas = parseInt(document.getElementById('num-cajas').value);
  if (!numCajas || numCajas < 1) { mostrarError(errEl, '⚠ Introduce el número de cajas.'); return; }
  if (numCajas > CONFIG.CAJAS_MAX) { mostrarError(errEl, `⚠ Máximo ${CONFIG.CAJAS_MAX} cajas.`); return; }
  if (!stateCajas.prov) { mostrarError(errEl, '⚠ Selecciona una provincia de destino.'); return; }
  const cpCajas = document.getElementById('cp-cajas-input').value.trim();
  const errCp = validarCp(cpCajas, 5, 'España');
  if (errCp) { mostrarError(errEl, errCp); return; }

  // Lógica: nº cajas × 0.15 × 250 = kg
  const altura = numCajas * CONFIG.CAJAS_ALTURA_POR_CAJA;
  const totalKg = Math.round(altura * CONFIG.CAJAS_KG_POR_UD_ALTURA * 100) / 100;
  const res = calcCevaByKg(stateCajas.prov, totalKg, appSettings.cevaRecargoActivo);

  if (!res) { mostrarError(errEl, '⚠ No se encontró tarifa para esta provincia.'); return; }

  lastCajasRes = { ...res, numCajas, altura, prov: stateCajas.prov };

  const provCajasLabel = formatProvincia(stateCajas.prov);
  document.getElementById('result-cajas-title').textContent = `${numCajas} caja${numCajas>1?'s':''} · ${provCajasLabel}`;

  // Render
  document.getElementById('ceva-cajas-price').innerHTML =
    res.total.toFixed(2).replace('.',',') + '<span class="price-eur">€</span>';

  let html = '';
  html += `<div class="breakdown-line"><span class="bl-label">Cajas</span><span class="bl-val">${numCajas} × 0,15 = ${altura.toFixed(2)} uds</span></div>`;
  html += `<div class="breakdown-line"><span class="bl-label">Peso total</span><span class="bl-val">${altura.toFixed(2)} × 250 = ${totalKg} kg</span></div>`;
  html += `<div class="breakdown-line"><span class="bl-label">Rango aplicado</span><span class="bl-val">${res.rangeLabel}</span></div>`;
  html += `<div class="breakdown-line"><span class="bl-label">Precio base</span><span class="bl-val">${fmt(res.basePrice)}</span></div>`;
  if (res.surcharge > 0) html += `<div class="breakdown-line"><span class="bl-label">Recargo (+${(CONFIG.CEVA_RECARGO_PCT*100).toFixed(1)}%)</span><span class="bl-val">+${fmt(res.surcharge)}</span></div>`;
  html += `<div class="breakdown-line total"><span class="bl-label">TOTAL</span><span class="bl-val">${fmt(res.total)}</span></div>`;
  document.getElementById('ceva-cajas-breakdown').innerHTML = html;
  document.getElementById('results-cajas').style.display = 'block';
  document.getElementById('results-cajas').scrollIntoView({behavior:'smooth', block:'start'});

  prepararGuardadoCajas({
    tipo: 'CAJAS', destino: 'ESPAÑA',
    cliente,
    provincia: formatProvincia(stateCajas.prov), cp: cpCajas, zona: '—',
    pales: numCajas, altura, peso: totalKg,
    precioPall: 0, precioCeva: res.total,
  });
}

// Caja counter
function cambiarCajas(delta) {
  const inp = document.getElementById('num-cajas');
  let v = (parseInt(inp.value) || 0) + delta;
  v = Math.max(1, Math.min(CONFIG.CAJAS_MAX, v));
  inp.value = v;
  onCajasInput();
}

function onCajasInput() {
  const v = parseInt(document.getElementById('num-cajas').value) || 0;
  document.getElementById('max-warn').className = 'max-warn' + (v >= CONFIG.CAJAS_MAX ? ' show' : '');
  document.getElementById('results-cajas').style.display = 'none';
  renderCajaVisual();
  // Update peso info
  const kg = Math.round(v * CONFIG.CAJAS_ALTURA_POR_CAJA * CONFIG.CAJAS_KG_POR_UD_ALTURA * 100) / 100;
  document.getElementById('cajas-peso-info').innerHTML =
    `<span style="font-family:var(--mono);font-size:0.75rem;color:var(--muted)">Altura total: <span style="color:var(--ceva-light)">${(v*CONFIG.CAJAS_ALTURA_POR_CAJA).toFixed(2)} uds</span> · Peso estimado: <span style="color:var(--ceva-light)">${kg} kg</span></span>`;
}

function renderCajaVisual() {
  const v = parseInt(document.getElementById('num-cajas').value) || 0;
  let html = '';
  for (let i = 1; i <= CONFIG.CAJAS_MAX; i++) {
    html += `<div class="caja-icon${i > v ? ' dim' : ''}">📦</div>`;
  }
  document.getElementById('caja-visual').innerHTML = html;
}

// Provincia search for cajas
function onProvCajasInput() {
  stateCajas.prov = null;
  document.getElementById('zona-cajas-detected').className='';
  document.getElementById('cp-cajas-input').value='';
  showCajasSugg(document.getElementById('prov-cajas-input').value);
}
function onProvCajasFocus() { showCajasSugg(document.getElementById('prov-cajas-input').value); }
function onProvCajasBlur() { blurCajasTO = setTimeout(()=>{ document.getElementById('sugg-cajas-box').className=''; }, 200); }

function showCajasSugg(q) {
  const box = document.getElementById('sugg-cajas-box');
  if (!q || q.length < 1) { box.className=''; return; }
  const upper = q.toUpperCase().trim();
  const matches = ALL_PROVS.filter(p => p.includes(upper)).slice(0, 8);
  if (!matches.length) { box.className=''; return; }
  box.innerHTML = matches.map(p => {
    const label = formatProvincia(p);
    return `<div class="sugg-item" onmousedown="selectProvCajas('${p}')"><span>${label}</span><span class="sugg-zona" style="border-color:var(--ceva);color:var(--ceva-light)">CEVA</span></div>`;
  }).join('');
  box.className = 'open';
}

function selectProvCajas(p) {
  clearTimeout(blurCajasTO);
  stateCajas.prov = p;
  const label = formatProvincia(p);
  document.getElementById('prov-cajas-input').value = label;
  document.getElementById('cp-cajas-input').value = '';
  document.getElementById('sugg-cajas-box').className = '';
  const zd = document.getElementById('zona-cajas-detected');
  zd.innerHTML = `Provincia seleccionada: ${label} — <span style="color:var(--yellow)">introduce también el código postal completo (5 dígitos)</span>`;
  zd.className = 'show';
}

function onCpCajasInput() {
  const val = document.getElementById('cp-cajas-input').value.trim();
  if (val.length < 2) return;
  const prefix = val.substring(0, 2);
  let prov = CP_PROV[prefix];
  if (!prov) return;

  let ambiguo = false;
  if (CP_AMBIGUOS[prefix]) {
    if (val.length >= 4) {
      const cpNum = parseInt(val);
      const match = CP_ISLA_RANGES.find(r => cpNum >= r.min && cpNum <= r.max);
      if (match) prov = match.prov;
    } else {
      ambiguo = true;
    }
  }

  stateCajas.prov = prov;
  const label = formatProvincia(prov);
  document.getElementById('prov-cajas-input').value = label;
  document.getElementById('sugg-cajas-box').className = '';
  const zd = document.getElementById('zona-cajas-detected');
  if (ambiguo) {
    zd.innerHTML = `⚠ CP ${val}xx — prefijo ambiguo. Provincia estimada: ${label}. Introduce el CP completo (5 dígitos) para mayor precisión.`;
    zd.className = 'show warn';
  } else {
    zd.innerHTML = `📮 CP ${val} → ${label}`;
    if (val.length < 5) zd.innerHTML += ` — <span style="color:var(--yellow)">faltan ${5 - val.length} dígitos</span>`;
    zd.className = 'show';
  }
}

// Init (guard allows loading this file in Node for unit tests)
if (typeof document !== 'undefined') renderCajaVisual();
