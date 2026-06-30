// ═══════════════════════════════════════════════════════════════
// calcular.js — Lógica principal de cálculo palés y exportación
// ═══════════════════════════════════════════════════════════════
// MAIN CALCULATE
// ═══════════════════════════════════════════════════════════════
function calcular() {
  const errEl = document.getElementById('error-msg');
  ocultarError(errEl);
  const cliente = document.getElementById('cliente-nombre').value.trim();
  const numPalets = parseInt(document.getElementById('num-palets').value);
  const alturaTotal = parseFloat(document.getElementById('altura-total').value);
  const errCliente = validarCliente(cliente);
  if (errCliente) { mostrarError(errEl, errCliente); return; }
  if(!numPalets||numPalets<1){mostrarError(errEl, '⚠ Introduce el número de palés.');return;}
  if(!alturaTotal||alturaTotal<=0){mostrarError(errEl, '⚠ Introduce la altura total del envío.');return;}
  if(alturaTotal > numPalets * 2.2){mostrarError(errEl, `⚠ La altura total (${alturaTotal}) supera el máximo de ${(numPalets*2.2).toFixed(1)} para ${numPalets} palé${numPalets>1?'s':''} (220 cm/palé).`);return;}

  const nSEL = manualDesglose.sel;
  const nQ   = manualDesglose.q;
  const nMQ  = manualDesglose.mq;
  const useManual = nSEL > 0 || nQ > 0 || nMQ > 0;

  // ── PORTUGAL ──
  if (state.country === 'PRT') {
    if (!state.cpPrt) { mostrarError(errEl, '⚠ Introduce el código postal de Portugal.'); return; }
    const errCpPrt = validarCp(state.cpPrt, 7, 'Portugal');
    if (errCpPrt) { mostrarError(errEl, errCpPrt); return; }
    const cp2 = parseInt(state.cpPrt.substring(0,2));
    if (!CEVA_PRT[cp2]) { mostrarError(errEl, '⚠ Código postal no encontrado en la tabla Portugal.'); return; }

    const pwZona = getPwZonaPrt(state.cpPrt);
    const pwRes = useManual
      ? calcPallettaysManual(nSEL, nQ, nMQ, pwZona)
      : calcPalletways(numPalets, alturaTotal, pwZona);
    const cevaRes = calcCevaPrt(numPalets, alturaTotal, state.cpPrt);

    if(!pwRes&&!cevaRes){mostrarError(errEl, '⚠ No se encontraron tarifas.');return;}

    lastPwRes=pwRes; lastCevaRes=cevaRes;
    lastInput={palets:numPalets,altura:alturaTotal,prov:`Portugal CP ${state.cpPrt}`,zona:pwZona,country:'PRT'};
    document.getElementById('result-title').textContent = `${numPalets} palé${numPalets>1?'s':''} · Portugal CP ${state.cpPrt}`;

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

    prepararGuardado({
      tipo: 'PALÉS', destino: 'PORTUGAL',
      cliente,
      provincia: 'Portugal', cp: state.cpPrt, zona: pwZona,
      pales: numPalets, altura: alturaTotal, peso: null,
      precioPall: pwRes?pwRes.total:0, precioCeva: cevaRes?cevaRes.total:0,
    });
    return;
  }

  // ── ESPAÑA ──
  if(!state.prov||!state.zona){mostrarError(errEl, '⚠ Selecciona una provincia de destino.');return;}
  const cpEsp = document.getElementById('cp-input').value.trim();
  const errCpEsp = validarCp(cpEsp, 5, 'España');
  if (errCpEsp) { mostrarError(errEl, errCpEsp); return; }

  const pwRes = useManual
    ? calcPallettaysManual(nSEL, nQ, nMQ, state.zona)
    : calcPalletways(numPalets, alturaTotal, state.zona);
  const cevaRes = calcCeva(numPalets, alturaTotal, state.prov);
  if(!pwRes&&!cevaRes){mostrarError(errEl, '⚠ No se encontraron tarifas para esta provincia.');return;}

  lastPwRes=pwRes; lastCevaRes=cevaRes;
  lastInput={palets:numPalets,altura:alturaTotal,prov:state.prov,zona:state.zona,country:'ESP'};
  const provLabel = formatProvincia(state.prov);
  document.getElementById('result-title').textContent = `${numPalets} palé${numPalets>1?'s':''} · ${provLabel} · España`;

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

  prepararGuardado({
    tipo: 'PALÉS', destino: 'ESPAÑA',
    cliente,
    provincia: formatProvincia(state.prov), cp: cpEsp, zona: state.zona,
    pales: numPalets, altura: alturaTotal, peso: null,
    precioPall: pwRes?pwRes.total:0, precioCeva: cevaRes?cevaRes.total:0,
  });
}

// ═══════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════
function configMsg(text) {
  const el = document.getElementById('config-msg');
  if (!el) return;
  el.textContent = text;
  el.className = 'config-msg' + (text ? ' show' : '');
}

function imprimirResultado() {
  if (!lastPwRes||!lastCevaRes||!lastInput) { configMsg('⚠ Debes realizar un cálculo de palés antes de imprimir.'); return; }
  configMsg('');
  window.print();
}

function exportarCSV() {
  if(!lastPwRes||!lastCevaRes||!lastInput) { configMsg('⚠ Debes realizar un cálculo de palés antes de exportar.'); return; }
  configMsg('');
  const rows = [
    ['Transportista','Total (€)','Subtotal (€)','Recargo (€)','Provincia','Zona','Palés','Altura'],
    ['Palletways', lastPwRes.total.toFixed(2), lastPwRes.subtotal.toFixed(2), lastPwRes.porte.toFixed(2), lastInput.prov, lastInput.zona, lastInput.palets, lastInput.altura],
    ['CEVA', lastCevaRes.total.toFixed(2), lastCevaRes.basePrice.toFixed(2), lastCevaRes.surcharge.toFixed(2), lastInput.prov, lastInput.zona, lastInput.palets, lastInput.altura],
  ];
  downloadCSV(rows, `porte_${lastInput.prov}_${new Date().toISOString().split('T')[0]}.csv`);
}

function exportarExcel() {
  if(!lastPwRes||!lastCevaRes||!lastInput) { configMsg('⚠ Debes realizar un cálculo de palés antes de exportar.'); return; }
  configMsg('');
  const rows = [
    ['Transportista','Total (€)','Subtotal (€)','Recargo (€)','Provincia','Zona','Palés','Altura'],
    ['Palletways', lastPwRes.total.toFixed(2), lastPwRes.subtotal.toFixed(2), lastPwRes.porte.toFixed(2), lastInput.prov, lastInput.zona, lastInput.palets, lastInput.altura],
    ['CEVA', lastCevaRes.total.toFixed(2), lastCevaRes.basePrice.toFixed(2), lastCevaRes.surcharge.toFixed(2), lastInput.prov, lastInput.zona, lastInput.palets, lastInput.altura],
  ];
  downloadXLS(rows, `porte_${lastInput.prov}_${new Date().toISOString().split('T')[0]}.xls`);
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
