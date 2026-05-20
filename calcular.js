// ═══════════════════════════════════════════════════════════════
// calcular.js — Lógica principal de cálculo palés y exportación
// ═══════════════════════════════════════════════════════════════
// MAIN CALCULATE
// ═══════════════════════════════════════════════════════════════
function calcular() {
  const errEl = document.getElementById('error-msg');
  errEl.className='';
  const numPalets = parseInt(document.getElementById('num-palets').value);
  const alturaTotal = parseFloat(document.getElementById('altura-total').value);
  if(!numPalets||numPalets<1){errEl.innerHTML='⚠ Introduce el número de palés.';errEl.className='show';return;}
  if(!alturaTotal||alturaTotal<=0){errEl.innerHTML='⚠ Introduce la altura total del envío.';errEl.className='show';return;}
  if(alturaTotal>numPalets){errEl.innerHTML=`⚠ La altura total (${alturaTotal}) no puede ser mayor que el número de palés (${numPalets}).`;errEl.className='show';return;}

  // ── PORTUGAL ──
  if (state.country === 'PRT') {
    if (!state.cpPrt) { errEl.innerHTML='⚠ Introduce el código postal de Portugal.'; errEl.className='show'; return; }
    const cp2 = parseInt(state.cpPrt.substring(0,2));
    if (!CEVA_PRT[cp2]) { errEl.innerHTML='⚠ Código postal no encontrado en la tabla Portugal.'; errEl.className='show'; return; }

    const pwZona = getPwZonaPrt(state.cpPrt);
    const pwRes = calcPalletways(numPalets, alturaTotal, pwZona);
    const cevaRes = calcCevaPrt(numPalets, alturaTotal, state.cpPrt);

    if(!pwRes&&!cevaRes){errEl.innerHTML='⚠ No se encontraron tarifas.';errEl.className='show';return;}

    lastPwRes=pwRes; lastCevaRes=cevaRes;
    lastInput={palets:numPalets,altura:alturaTotal,prov:`Portugal CP ${state.cpPrt}xx`,zona:pwZona,country:'PRT'};

    const pwWins = pwRes&&cevaRes ? pwRes.total<=cevaRes.total : !!pwRes;
    if(pwRes) renderPW(pwRes, pwWins);
    if(cevaRes) renderCEVA(cevaRes, !pwWins);

    const saving = pwRes&&cevaRes ? Math.abs(pwRes.total-cevaRes.total) : 0;
    const winner = pwWins?'Palletways':'CEVA';
    document.getElementById('winner-name').textContent=`${winner} es más barato`;
    document.getElementById('winner-desc').textContent=saving>0.01?`Ahorro de ${fmt(saving)} respecto a ${pwWins?'CEVA':'Palletways'}`:'Ambos tienen el mismo precio';
    document.getElementById('saving-pill').textContent=saving>0.01?`−${fmt(saving)}`:'=';
    document.getElementById('winner-banner').className='show';
    document.getElementById('results').className='show';
    document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});

    const now=new Date();
    addToHistorial({
      hora:now.toTimeString().substring(0,5),
      provincia:`Portugal CP${state.cpPrt}`, zona:pwZona,
      palets:numPalets, altura:alturaTotal,
      pw:pwRes?pwRes.total:0, ceva:cevaRes?cevaRes.total:0,
      winner, ahorro:saving
    });
    return;
  }

  // ── ESPAÑA ──
  if(!state.prov||!state.zona){errEl.innerHTML='⚠ Selecciona una provincia de destino.';errEl.className='show';return;}

  const pwRes = calcPalletways(numPalets, alturaTotal, state.zona);
  const cevaRes = calcCeva(numPalets, alturaTotal, state.prov);
  if(!pwRes&&!cevaRes){errEl.innerHTML='⚠ No se encontraron tarifas para esta provincia.';errEl.className='show';return;}

  lastPwRes=pwRes; lastCevaRes=cevaRes;
  lastInput={palets:numPalets,altura:alturaTotal,prov:state.prov,zona:state.zona,country:'ESP'};

  const pwWins = pwRes&&cevaRes ? pwRes.total<=cevaRes.total : !!pwRes;
  if(pwRes) renderPW(pwRes, pwWins);
  if(cevaRes) renderCEVA(cevaRes, !pwWins);

  const saving = pwRes&&cevaRes ? Math.abs(pwRes.total-cevaRes.total) : 0;
  const winner = pwWins?'Palletways':'CEVA';
  document.getElementById('winner-name').textContent=`${winner} es más barato`;
  document.getElementById('winner-desc').textContent=saving>0.01?`Ahorro de ${fmt(saving)} respecto a ${pwWins?'CEVA':'Palletways'}`:'Ambos tienen el mismo precio';
  document.getElementById('saving-pill').textContent=saving>0.01?`−${fmt(saving)}`:'=';
  document.getElementById('winner-banner').className='show';
  document.getElementById('results').className='show';
  document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'});

  const now=new Date();
  addToHistorial({
    hora:now.toTimeString().substring(0,5), provincia:state.prov, zona:state.zona,
    palets:numPalets, altura:alturaTotal,
    pw:pwRes?pwRes.total:0, ceva:cevaRes?cevaRes.total:0,
    winner, ahorro:saving
  });
}

// ═══════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function getExportChoice() {
  // Returns 'csv', 'excel', or null
  return null; // Called directly from buttons, no need for choice dialog
}

function exportarCSV() {
  if(!lastPwRes||!lastCevaRes||!lastInput) return;
  const rows = [
    ['Transportista','Total (€)','Subtotal (€)','Recargo (€)','Provincia','Zona','Palés','Altura'],
    ['Palletways', lastPwRes.total.toFixed(2), lastPwRes.subtotal.toFixed(2), lastPwRes.porte.toFixed(2), lastInput.prov, lastInput.zona, lastInput.palets, lastInput.altura],
    ['CEVA', lastCevaRes.total.toFixed(2), lastCevaRes.basePrice.toFixed(2), lastCevaRes.surcharge.toFixed(2), lastInput.prov, lastInput.zona, lastInput.palets, lastInput.altura],
  ];
  downloadCSV(rows, `porte_${lastInput.prov}_${new Date().toISOString().split('T')[0]}.csv`);
}

function exportarExcel() {
  if(!lastPwRes||!lastCevaRes||!lastInput) return;
  const rows = [
    ['Transportista','Total (€)','Subtotal (€)','Recargo (€)','Provincia','Zona','Palés','Altura'],
    ['Palletways', lastPwRes.total.toFixed(2), lastPwRes.subtotal.toFixed(2), lastPwRes.porte.toFixed(2), lastInput.prov, lastInput.zona, lastInput.palets, lastInput.altura],
    ['CEVA', lastCevaRes.total.toFixed(2), lastCevaRes.basePrice.toFixed(2), lastCevaRes.surcharge.toFixed(2), lastInput.prov, lastInput.zona, lastInput.palets, lastInput.altura],
  ];
  downloadXLS(rows, `porte_${lastInput.prov}_${new Date().toISOString().split('T')[0]}.xls`);
}

function exportarHistorialCSV() {
  const hist = getHistorial();
  const day = getTodayKey();
  const items = hist[day]||[];
  if(!items.length){alert('No hay datos en el historial de hoy.');return;}
  const rows=[['Hora','Provincia','Zona','Palés','Altura','PW (€)','CEVA (€)','Ganador','Ahorro (€)']];
  items.forEach(it=>rows.push([it.hora,it.provincia,it.zona,it.palets,it.altura,it.pw.toFixed(2),it.ceva.toFixed(2),it.winner,(it.ahorro||0).toFixed(2)]));
  downloadCSV(rows, `historial_${day}.csv`);
}

function exportarHistorialExcel() {
  const hist = getHistorial();
  const day = getTodayKey();
  const items = hist[day]||[];
  if(!items.length){alert('No hay datos en el historial de hoy.');return;}
  const rows=[['Hora','Provincia','Zona','Palés','Altura','PW (€)','CEVA (€)','Ganador','Ahorro (€)']];
  items.forEach(it=>rows.push([it.hora,it.provincia,it.zona,it.palets,it.altura,it.pw.toFixed(2),it.ceva.toFixed(2),it.winner,(it.ahorro||0).toFixed(2)]));
  downloadXLS(rows, `historial_${day}.xls`);
}

function downloadCSV(rows, filename) {
  const content = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadXLS(rows, filename) {
  let xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Datos"><Table>`;
  rows.forEach(row=>{
    xml+='<Row>';
    row.forEach(cell=>{ xml+=`<Cell><Data ss:Type="String">${String(cell).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Data></Cell>`; });
    xml+='</Row>';
  });
  xml+='</Table></Worksheet></Workbook>';
  const blob=new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════
