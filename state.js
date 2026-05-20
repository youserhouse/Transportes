// ═══════════════════════════════════════════════════════════════
// state.js — Estado global de la aplicación y selección de país
// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let state = { prov: null, zona: null, country: 'ESP', cpPrt: null };
let blurTO;
let lastPwRes = null, lastCevaRes = null, lastInput = null;

function setCountry(c) {
  state.country = c;
  state.prov = null; state.zona = null; state.cpPrt = null;
  document.getElementById('zona-detected').className = '';
  document.getElementById('results').className = '';
  document.getElementById('winner-banner').className = '';
  document.getElementById('error-msg').className = '';

  document.getElementById('fields-esp').style.display = c==='ESP' ? '' : 'none';
  document.getElementById('fields-prt').style.display = c==='PRT' ? '' : 'none';
  document.getElementById('btn-esp').className = 'country-btn' + (c==='ESP'?' active-esp':'');
  document.getElementById('btn-prt').className = 'country-btn' + (c==='PRT'?' active-prt':'');

  if (c==='ESP') {
    document.getElementById('prov-input').value='';
    document.getElementById('cp-input').value='';
  } else {
    document.getElementById('cp-prt-input').value='';
    document.getElementById('cp-disclaimer').className='cp-disclaimer';
  }
}

function onCpPrtInput() {
  const val = document.getElementById('cp-prt-input').value.trim();
  const disc = document.getElementById('cp-disclaimer');
  const zd = document.getElementById('zona-detected');
  const ambig = document.getElementById('cp-prt-ambiguous');

  if (!val || val.length < 2) {
    state.cpPrt = null; state.zona = null;
    zd.className = ''; disc.className = 'cp-disclaimer'; ambig.style.display='none'; return;
  }

  const cp2 = parseInt(val.substring(0,2));
  if (!CEVA_PRT[cp2]) {
    zd.innerHTML = '⚠ Código postal no encontrado en la tabla Portugal'; zd.className='show';
    state.cpPrt=null; state.zona=null; ambig.style.display='none'; return;
  }

  state.cpPrt = val;
  const pwZona = getPwZonaPrt(val);
  state.zona = pwZona;

  // Show ambiguous warning for CP 38xx with only 2 digits
  if (cp2===38 && val.length < 4) {
    disc.className = 'cp-disclaimer show';
    ambig.style.display = 'block';
  } else {
    disc.className = 'cp-disclaimer';
    ambig.style.display = 'none';
  }

  const zonaLabel = pwZona===7 ? 'Zona 7 (Portugal norte/centro)' : 'Zona 8 (Portugal resto)';
  zd.innerHTML = `🇵🇹 CP ${val}xx → CEVA: tabla CP ${cp2} · Palletways: ${zonaLabel}`;
  zd.className = 'show';
}

// ═══════════════════════════════════════════════════════════════
