// Helpers compartidos entre ui.js, calcular.js y cajas.js.

// Convierte una provincia almacenada en MAYÚSCULAS (p.ej. "BARCELONA") al
// formato de visualización "Barcelona".
function formatProvincia(p) {
  return p.charAt(0) + p.slice(1).toLowerCase();
}
