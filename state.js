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
  const cpLabel = val.length === 7 ? val : `${val}xx`;
  zd.innerHTML = `🇵🇹 CP ${cpLabel} → CEVA: tabla CP ${cp2} · Palletways: ${zonaLabel}`;
  zd.className = 'show';
  if (val.length < 7) {
    zd.innerHTML += ` — <span style="color:var(--yellow)">faltan ${7 - val.length} dígitos</span>`;
  }
}

// ═══════════════════════════════════════════════════════════════
// AJUSTES DE LA APP — interruptores en Configuraciones, persistentes
// vía localStorage. requireCp/requireCliente activan/desactivan las
// validaciones de obligatoriedad en Palés y Cajas. dashHiddenCols
// controla qué columnas de la tabla "Historial de cálculos" del
// Dashboard están ocultas (ver DASH_HIST_COLUMNS en dashboard.js).
// ═══════════════════════════════════════════════════════════════
const APP_SETTINGS_KEY = 'transportes_settings';
const DASH_COL_KEYS = ['fecha', 'cliente', 'tipo', 'destino', 'provincia', 'cp', 'pales', 'altura', 'envio', 'pw', 'ceva'];
let appSettings = { requireCp: true, requireCliente: true, dashHiddenCols: [] };

function loadAppSettings() {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (raw) appSettings = { ...appSettings, ...JSON.parse(raw) };
  } catch (e) {}
}

function saveAppSettings() {
  try { localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(appSettings)); } catch (e) {}
}

function applySettingsToggles() {
  const cpToggle = document.getElementById('toggle-require-cp');
  const clienteToggle = document.getElementById('toggle-require-cliente');
  if (cpToggle) cpToggle.checked = appSettings.requireCp;
  if (clienteToggle) clienteToggle.checked = appSettings.requireCliente;
  for (const key of DASH_COL_KEYS) {
    const el = document.getElementById('toggle-col-' + key);
    if (el) el.checked = !(appSettings.dashHiddenCols || []).includes(key);
  }
}

function toggleRequireCp() {
  appSettings.requireCp = document.getElementById('toggle-require-cp').checked;
  saveAppSettings();
}

function toggleRequireCliente() {
  appSettings.requireCliente = document.getElementById('toggle-require-cliente').checked;
  saveAppSettings();
}

function toggleDashColumn(key) {
  const checked = document.getElementById('toggle-col-' + key).checked;
  const hidden = new Set(appSettings.dashHiddenCols || []);
  if (checked) hidden.delete(key); else hidden.add(key);
  appSettings.dashHiddenCols = [...hidden];
  saveAppSettings();
  if (typeof currentMode !== 'undefined' && currentMode === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
}

loadAppSettings();
document.addEventListener('DOMContentLoaded', applySettingsToggles);

// ═══════════════════════════════════════════════════════════════
