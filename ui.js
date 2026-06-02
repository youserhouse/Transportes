// ═══════════════════════════════════════════════════════════════
// ui.js — Búsqueda de provincias, CP, validación y render de resultados
// ═══════════════════════════════════════════════════════════════
// CP INPUT
// ═══════════════════════════════════════════════════════════════
function onCpInput() {
  const val = document.getElementById('cp-input').value.trim();
  if (val.length < 2) return;
  const prefix = val.substring(0, 2);
  const prov = CP_PROV[prefix];
  if (!prov) return;
  // Set province
  state.prov = prov;
  state.zona = PROV_ZONA[prov] || null;
  const label = prov.charAt(0) + prov.slice(1).toLowerCase();
  document.getElementById('prov-input').value = label;
  document.getElementById('sugg-box').className = '';
  if (state.zona) {
    const zd = document.getElementById('zona-detected');
    zd.innerHTML = `📮 CP ${val} → ${label} → Zona ${state.zona} — ${ZONAS_DESC[state.zona]}`;
    zd.className = 'show';
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
  let palets = [], remaining = alturaTotal;
  for (let i = 0; i < numPalets; i++) {
    if (i === numPalets - 1) {
      const cm = remaining > 0 ? Math.round(remaining * 100) : 100;
      palets.push({cm, full: remaining >= 1.0});
      remaining = 0;
    } else if (remaining >= 1.0) {
      palets.push({cm:100, full:true});
      remaining = Math.round((remaining - 1.0) * 100) / 100;
    } else if (remaining > 0) {
      palets.push({cm:Math.round(remaining*100), full:false});
      remaining = 0;
    } else {
      palets.push({cm:100, full:true});
    }
  }
  const posturas = Math.floor(numPalets/2);
  const suelto = numPalets%2===1 ? palets[palets.length-1] : null;
  const subtotalPosturas = posturas * t.C;
  let subtotalSuelto=0, sueltoTipo=null;
  if (suelto) {
    if (suelto.cm<=80) { sueltoTipo=t.A<=t.B?'Mini Quarter (≤80cm)':'Quarter (≤110cm)'; subtotalSuelto=Math.min(t.A,t.B); }
    else if (suelto.cm<=110) { sueltoTipo='Quarter Palé (≤110cm)'; subtotalSuelto=t.B; }
    else { sueltoTipo='Super Euro Light (≤220cm)'; subtotalSuelto=t.B; }
  }
  const subtotal = subtotalPosturas+subtotalSuelto;
  const porte = subtotal*CONFIG.PW_PORTE_PCT;
  return { total:subtotal+porte, subtotal, porte, posturas, suelto:suelto?{tipo:sueltoTipo,cm:suelto.cm,precio:subtotalSuelto}:null, palets, precioPostura:t.C };
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
  html+=`<div class="breakdown-line"><span class="bl-label">Posturas (${res.posturas} × ${fmt(res.precioPostura)})</span><span class="bl-val">${fmt(res.subtotal-(res.suelto?.precio||0))}</span></div>`;
  if(res.suelto) html+=`<div class="breakdown-line"><span class="bl-label">Palé suelto — ${res.suelto.tipo} (${res.suelto.cm}cm)</span><span class="bl-val">${fmt(res.suelto.precio)}</span></div>`;
  html+=`<div class="breakdown-line"><span class="bl-label">Subtotal</span><span class="bl-val">${fmt(res.subtotal)}</span></div>`;
  html+=`<div class="breakdown-line"><span class="bl-label">Porte adicional (+${(CONFIG.PW_PORTE_PCT*100).toFixed(1)}%)</span><span class="bl-val">+${fmt(res.porte)}</span></div>`;
  html+=`<div class="breakdown-line total"><span class="bl-label">TOTAL</span><span class="bl-val">${fmt(res.total)}</span></div>`;
  document.getElementById('pw-breakdown').innerHTML=html;
  let vis='';
  for(let i=0;i<res.palets.length;i+=2){
    const p1=res.palets[i],p2=res.palets[i+1];
    if(p2) vis+=`<div class="palet-box full-p"><div class="pb-icon">📦📦</div><div class="pb-label">POSTURA<br>${p1.cm}+${p2.cm}cm</div></div>`;
    else vis+=`<div class="palet-box partial-p"><div class="pb-icon">📦</div><div class="pb-label">SUELTO<br>${p1.cm}cm<br>${p1.cm<=80?'Mini Q.':p1.cm<=110?'Quarter':'S.E.Light'}</div></div>`;
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
