// ═══════════════════════════════════════════════════════════════
// guardar.js — Selección manual de transportista y guardado en Firestore
// Los cálculos NO se guardan automáticamente: el usuario debe elegir
// el transportista real y pulsar "Guardar" para que aparezca en el Dashboard.
// ═══════════════════════════════════════════════════════════════

// ── MODO PALÉS / PORTUGAL ──
let pendienteGuardado = null;
let transportistaElegido = null;

function prepararGuardado(datos) {
  pendienteGuardado = datos;
  transportistaElegido = null;

  const btnPw = document.getElementById('elegir-pw');
  const btnCeva = document.getElementById('elegir-ceva');
  btnPw.classList.remove('active');
  btnCeva.classList.remove('active');
  btnPw.style.display = datos.precioPall > 0 ? '' : 'none';
  btnCeva.style.display = datos.precioCeva > 0 ? '' : 'none';
  document.getElementById('elegir-pw-precio').textContent = datos.precioPall > 0 ? fmt(datos.precioPall) : '—';
  document.getElementById('elegir-ceva-precio').textContent = datos.precioCeva > 0 ? fmt(datos.precioCeva) : '—';

  const btnGuardar = document.getElementById('btn-guardar-calculo');
  btnGuardar.disabled = true;
  btnGuardar.textContent = '💾 GUARDAR ESTE ENVÍO';
  btnGuardar.classList.remove('saved');
  document.getElementById('guardar-msg').textContent = '';
  document.getElementById('guardar-msg').className = 'guardar-msg';
  document.getElementById('guardar-section').className = 'guardar-section show';
}

function elegirTransportista(cual) {
  transportistaElegido = cual;
  document.getElementById('elegir-pw').classList.toggle('active', cual === 'PALLETWAYS');
  document.getElementById('elegir-ceva').classList.toggle('active', cual === 'CEVA');
  document.getElementById('btn-guardar-calculo').disabled = false;
}

async function guardarCalculoActual() {
  if (!pendienteGuardado || !transportistaElegido) return;
  await ejecutarGuardado(
    { ...pendienteGuardado, elegido: transportistaElegido },
    document.getElementById('btn-guardar-calculo'),
    document.getElementById('guardar-msg')
  );
}

// ── MODO CAJAS (siempre CEVA, no requiere selección) ──
let pendienteGuardadoCajas = null;

function prepararGuardadoCajas(datos) {
  pendienteGuardadoCajas = datos;
  const btnGuardar = document.getElementById('btn-guardar-cajas');
  btnGuardar.disabled = false;
  btnGuardar.textContent = '💾 GUARDAR ESTE ENVÍO';
  btnGuardar.classList.remove('saved');
  document.getElementById('guardar-cajas-msg').textContent = '';
  document.getElementById('guardar-cajas-msg').className = 'guardar-msg';
  document.getElementById('guardar-cajas-section').className = 'guardar-section show';
}

async function guardarCalculoCajasActual() {
  if (!pendienteGuardadoCajas) return;
  await ejecutarGuardado(
    { ...pendienteGuardadoCajas, elegido: 'CEVA' },
    document.getElementById('btn-guardar-cajas'),
    document.getElementById('guardar-cajas-msg')
  );
}

// ── COMÚN: envío a Firestore (window.fsGuardarCalculo, definido en index.html) ──
async function ejecutarGuardado(datosConElegido, btn, msgEl) {
  const precioElegido = datosConElegido.elegido === 'PALLETWAYS' ? datosConElegido.precioPall : datosConElegido.precioCeva;
  const precioOtro = datosConElegido.elegido === 'PALLETWAYS' ? datosConElegido.precioCeva : datosConElegido.precioPall;
  const ahorro = (precioOtro > 0 && precioElegido > 0) ? (precioOtro - precioElegido) : 0;

  btn.disabled = true;
  btn.textContent = 'Guardando…';
  try {
    await window.fsGuardarCalculo({ ...datosConElegido, ahorro });
    btn.textContent = '✓ GUARDADO';
    btn.classList.add('saved');
    msgEl.textContent = 'Cálculo guardado correctamente en el Dashboard.';
    msgEl.className = 'guardar-msg ok';
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '💾 GUARDAR ESTE ENVÍO';
    msgEl.textContent = '⚠ Error al guardar: ' + (e.message || e);
    msgEl.className = 'guardar-msg error';
  }
}
