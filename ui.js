// ═══════════════════════════════════════════════════════════════
// ui.js — Búsqueda de provincias, CP, validación y render de resultados
// ═══════════════════════════════════════════════════════════════
// CP INPUT
// ═══════════════════════════════════════════════════════════════
function onCpInput() {
  const val = document.getElementById('cp-input').value.trim();
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

  state.prov = prov;
  state.zona = PROV_ZONA[prov] || null;
  const label = prov.charAt(0) + prov.slice(1).toLowerCase();
  document.getElementById('prov-input').value = label;
  document.getElementById('sugg-box').className = '';
  const zd = document.getElementById('zona-detected');
  if (state.zona) {
    if (ambiguo) {
      zd.innerHTML = `⚠ CP ${val}xx — prefijo ambiguo. Zona estimada: ${state.zona} (${label}). Introduce el CP completo (5 dígitos) para mayor precisión.`;
      zd.className = 'show warn';
    } else {
      zd.innerHTML = `📮 CP ${val} → ${label} → Zona ${state.zona} — ${ZONAS_DESC[state.zona]}`;
      zd.className = 'show';
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// PROVINCIA SEARCH
// ═══════════════════════════════════════════════════════════════
function onProvInput() {
  const val = document.getElementById('prov-input').value;
  state.prov = null; state.zona = null;
  document.getElementById('zona-detected').className = '';
  document.getElementById('cp-input').value = '';
  showSuggestions(val);
}
function onProvFocus() { const val = document.getElementById('prov-input').value; if (val.length >= 1) showSuggestions(val); }
function onProvBlur() { blurTO = setTimeout(() => { document.getElementById('sugg-box').className = ''; }, 200); }
function showSuggestions(q) {
  const box = document.getElementById('sugg-box');
  const inp = document.getElementById('prov-input');
  if (!q || q.length < 1) { box.className = ''; inp.setAttribute('aria-expanded','false'); return; }
  const upper = q.toUpperCase().trim();
  const matches = ALL_PROVS.filter(p => p.includes(upper)).slice(0, 8);
  if (!matches.length) { box.className = ''; inp.setAttribute('aria-expanded','false'); return; }
  box.innerHTML = matches.map(p => {
    const z = PROV_ZONA[p];
    const label = p.charAt(0) + p.slice(1).toLowerCase();
    return `<div class="sugg-item" role="option" onmousedown="selectProv('${p}')"><span>${label}</span><span class="sugg-zona">Zona ${z}</span></div>`;
  }).join('');
  box.className = 'open';
  inp.setAttribute('aria-expanded','true');
}
function selectProv(p) {
  clearTimeout(blurTO);
  state.prov = p; state.zona = PROV_ZONA[p];
  const label = p.charAt(0) + p.slice(1).toLowerCase();
  document.getElementById('prov-input').value = label;
  document.getElementById('prov-input').setAttribute('aria-expanded','false');
  document.getElementById('cp-input').value = '';
  document.getElementById('sugg-box').className = '';
  const zd = document.getElementById('zona-detected');
  zd.innerHTML = `Zona ${state.zona} detectada — ${ZONAS_DESC[state.zona]}`;
  zd.className = 'show';
}
function onInputChange() {
  document.getElementById('results').className = '';
  document.getElementById('error-msg').className = '';
  document.getElementById('winner-banner').className = '';
}

// ── VALIDACIÓN EN TIEMPO REAL ──
function validatePalets() {
  const inp = document.getElementById('num-palets');
  const errEl = document.getElementById('err-palets');
  const v = parseInt(inp.value);
  if (!inp.value) { inp.classList.remove('input-error','input-ok'); errEl.className='field-inline-error'; return; }
  if (isNaN(v) || v < 1) {
    inp.classList.add('input-error'); inp.classList.remove('input-ok');
    errEl.textContent = '⚠ Mínimo 1 palé'; errEl.className='field-inline-error show';
  } else {
    inp.classList.add('input-ok'); inp.classList.remove('input-error');
    errEl.className='field-inline-error';
  }
  validateAltura(); // cross-validate
}

function validateAltura() {
  const inpA = document.getElementById('altura-total');
  const inpP = document.getElementById('num-palets');
  const errEl = document.getElementById('err-altura');
  const a = parseFloat(inpA.value);
  const p = parseInt(inpP.value);
  if (!inpA.value) { inpA.classList.remove('input-error','input-ok'); errEl.className='field-inline-error'; return; }
  if (isNaN(a) || a <= 0) {
    inpA.classList.add('input-error'); inpA.classList.remove('input-ok');
    errEl.textContent = '⚠ La altura debe ser mayor que 0'; errEl.className='field-inline-error show';
  } else if (!isNaN(p) && p >= 1 && a > p * 2.2) {
    inpA.classList.add('input-error'); inpA.classList.remove('input-ok');
    errEl.textContent = `⚠ Máximo ${(p * 2.2).toFixed(1)} para ${p} palé${p>1?'s':''} (220 cm/palé)`; errEl.className='field-inline-error show';
  } else {
    inpA.classList.add('input-ok'); inpA.classList.remove('input-error');
    errEl.className='field-inline-error';
  }
}

// ═══════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════
function calcPalletways(numPalets, alturaTotal, zona) {
  const t = PW_TARIFA[zona]; if (!t) return null;
  const SEL_MAX = 2.2;

  // If there are enough pallets to fill ceil(H/2.2) SEL pairs (2 pallets per pair),
  // all slots bill as SEL — avoids misclassifying exact boundary remainders.
  const numSEL_ceil = Math.ceil(alturaTotal / SEL_MAX);
  if (numPalets >= 2 * numSEL_ceil) {
    const subtotal = numSEL_ceil * t.C;
    const porte    = subtotal * CONFIG.PW_PORTE_PCT;
    return { total: subtotal + porte, subtotal, porte, totalSEL: numSEL_ceil, extra: null, precioSEL: t.C };
  }

  const numSEL_base = Math.floor(alturaTotal / SEL_MAX);
  const remainder   = Math.round((alturaTotal - numSEL_base * SEL_MAX) * 1000) / 1000;

  let totalSEL = numSEL_base;
  let extra = null;

  if (remainder > 1.10) {
    totalSEL += 1;
  } else if (remainder > 0.80) {
    extra = { tipo: 'Quarter (≤110cm)', cm: Math.round(remainder * 100), precio: t.B };
  } else if (remainder > 0) {
    extra = { tipo: 'Mini Quarter (≤80cm)', cm: Math.round(remainder * 100), precio: t.A };
  }

  const subtotalSEL   = totalSEL * t.C;
  const subtotalExtra = extra ? extra.precio : 0;
  const subtotal      = subtotalSEL + subtotalExtra;
  const porte         = subtotal * CONFIG.PW_PORTE_PCT;

  return { total: subtotal + porte, subtotal, porte, totalSEL, extra, precioSEL: t.C };
}

function getCevaTarifa(prov) {
  const upper = prov.toUpperCase();
  if (CEVA_TARIFA[upper]) return CEVA_TARIFA[upper];
  for (const key of Object.keys(CEVA_TARIFA)) { if (key.includes(upper)||upper.includes(key)) return CEVA_TARIFA[key]; }
  return null;
}

function calcCeva(numPalets, alturaTotal, prov) {
  const tarifa = getCevaTarifa(prov); if (!tarifa) return null;
  const totalKg = Math.round(alturaTotal * 250);
  let palets=[], remaining=alturaTotal;
  for (let i=0;i<numPalets;i++) {
    if (i === numPalets - 1) {
      const kg = remaining > 0 ? Math.round(remaining*250) : 250;
      palets.push({altura:remaining>0?remaining:1.0, kg, full:remaining>=1.0});
      remaining = 0;
    } else if(remaining>=1.0){palets.push({altura:1.0,kg:250,full:true});remaining=Math.round((remaining-1.0)*100)/100;}
    else if(remaining>0){const kg=Math.round(remaining*250);palets.push({altura:remaining,kg,full:false});remaining=0;}
    else{palets.push({altura:1.0,kg:250,full:true});}
  }
  let basePrice, rangeLabel;
  if(totalKg<=10){basePrice=tarifa[0];rangeLabel='0–10 kg';}
  else if(totalKg<=20){basePrice=tarifa[1];rangeLabel='11–20 kg';}
  else if(totalKg<=30){basePrice=tarifa[2];rangeLabel='21–30 kg';}
  else if(totalKg<=40){basePrice=tarifa[3];rangeLabel='31–40 kg';}
  else if(totalKg<=50){basePrice=tarifa[4];rangeLabel='41–50 kg';}
  else if(totalKg<=60){basePrice=tarifa[5];rangeLabel='51–60 kg';}
  else if(totalKg<=70){basePrice=tarifa[6];rangeLabel='61–70 kg';}
  else if(totalKg<=80){basePrice=tarifa[7];rangeLabel='71–80 kg';}
  else if(totalKg<=90){basePrice=tarifa[8];rangeLabel='81–90 kg';}
  else if(totalKg<=100){basePrice=tarifa[9];rangeLabel='91–100 kg';}
  else if(totalKg<=500){basePrice=totalKg*tarifa[10];rangeLabel=`101–500 kg (${tarifa[10]}€/kg × ${totalKg}kg)`;}
  else if(totalKg<=1000){basePrice=totalKg*tarifa[11];rangeLabel=`501–1000 kg (${tarifa[11]}€/kg × ${totalKg}kg)`;}
  else if(totalKg<=2000){basePrice=totalKg*tarifa[12];rangeLabel=`1001–2000 kg (${tarifa[12]}€/kg × ${totalKg}kg)`;}
  else{basePrice=totalKg*tarifa[13];rangeLabel=`2001+ kg (${tarifa[13]}€/kg × ${totalKg}kg)`;}
  if(basePrice===null||basePrice===undefined) return null;
  const surcharge=basePrice*CONFIG.CEVA_RECARGO_PCT;
  return {total:basePrice+surcharge,basePrice,surcharge,totalKg,rangeLabel,palets};
}

// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════
function fmt(n) { return n.toFixed(2).replace('.', ',') + ' €'; }

function renderPW(res, isWinner) {
  document.getElementById('pw-price').innerHTML = res.total.toFixed(2).replace('.',',')+'<span class="price-eur">€</span>';
  document.getElementById('pw-card').className = 'result-card pw'+(isWinner?' winner':'');
  let html='';
  html+=`<div class="breakdown-line"><span class="bl-label">Super Euro Light (${res.totalSEL} × ${fmt(res.precioSEL)})</span><span class="bl-val">${fmt(res.totalSEL * res.precioSEL)}</span></div>`;
  if(res.extra) html+=`<div class="breakdown-line"><span class="bl-label">${res.extra.tipo} — ${res.extra.cm} cm</span><span class="bl-val">${fmt(res.extra.precio)}</span></div>`;
  html+=`<div class="breakdown-line"><span class="bl-label">Subtotal</span><span class="bl-val">${fmt(res.subtotal)}</span></div>`;
  html+=`<div class="breakdown-line"><span class="bl-label">Porte adicional (+${(CONFIG.PW_PORTE_PCT*100).toFixed(1)}%)</span><span class="bl-val">+${fmt(res.porte)}</span></div>`;
  html+=`<div class="breakdown-line total"><span class="bl-label">TOTAL</span><span class="bl-val">${fmt(res.total)}</span></div>`;
  document.getElementById('pw-breakdown').innerHTML=html;
  let vis='';
  for(let i=0;i<res.totalSEL;i++) {
    vis+=`<div class="palet-box full-p"><div class="pb-icon">📦</div><div class="pb-label">S.E.LIGHT<br>220cm</div></div>`;
  }
  if(res.extra) {
    vis+=`<div class="palet-box partial-p"><div class="pb-icon">📦</div><div class="pb-label">${res.extra.cm<=80?'MINI Q.':'QUARTER'}<br>${res.extra.cm}cm</div></div>`;
  }
  document.getElementById('pw-visual').innerHTML=vis;
}

function renderCEVA(res, isWinner) {
  document.getElementById('ceva-price').innerHTML = res.total.toFixed(2).replace('.',',')+'<span class="price-eur">€</span>';
  document.getElementById('ceva-card').className = 'result-card ceva'+(isWinner?' winner':'');
  let html='';
  html+=`<div class="breakdown-line"><span class="bl-label">Peso total</span><span class="bl-val">${res.totalKg} kg</span></div>`;
  html+=`<div class="breakdown-line"><span class="bl-label">Rango aplicado</span><span class="bl-val">${res.rangeLabel}</span></div>`;
  html+=`<div class="breakdown-line"><span class="bl-label">Precio base</span><span class="bl-val">${fmt(res.basePrice)}</span></div>`;
  html+=`<div class="breakdown-line"><span class="bl-label">Recargo fijo (+${(CONFIG.CEVA_RECARGO_PCT*100).toFixed(1)}%)</span><span class="bl-val">+${fmt(res.surcharge)}</span></div>`;
  html+=`<div class="breakdown-line total"><span class="bl-label">TOTAL</span><span class="bl-val">${fmt(res.total)}</span></div>`;
  document.getElementById('ceva-breakdown').innerHTML=html;
  document.getElementById('ceva-detail').innerHTML=res.palets.map((p,i)=>`Palé ${i+1}: ${p.full?'100cm (completo)':`${Math.round(p.altura*100)}cm (parcial)`} → <span>${p.kg} kg</span>`).join('<br>');
}

// ═══════════════════════════════════════════════════════════════
