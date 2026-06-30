// Helpers compartidos entre ui.js, calcular.js y cajas.js.

// Convierte una provincia almacenada en MAYÚSCULAS (p.ej. "BARCELONA") al
// formato de visualización "Barcelona".
function formatProvincia(p) {
  return p.charAt(0) + p.slice(1).toLowerCase();
}

// ── Validación compartida cliente/CP (calcular.js y cajas.js) ──
// Devuelven un mensaje de error si la validación falla (respetando los
// toggles de appSettings en Configuraciones), o null si es válida.
function validarCliente(cliente) {
  if (appSettings.requireCliente && !cliente) return '⚠ Introduce el nombre del cliente.';
  return null;
}

function validarCp(cp, digitos, pais) {
  if (appSettings.requireCp && !new RegExp(`^\\d{${digitos}}$`).test(cp)) {
    return `⚠ Introduce el código postal completo de ${pais} (${digitos} dígitos).`;
  }
  return null;
}

// Banner de error compartido (#error-msg / #error-cajas-msg, clase .error-banner).
function mostrarError(errEl, mensaje) {
  errEl.textContent = mensaje;
  errEl.classList.add('show');
}

function ocultarError(errEl) {
  errEl.classList.remove('show');
}
