// Tema claro/oscuro persistente — usado por index.html, login.html, splash.html
(function () {
  var KEY = 'transportes_theme';

  function getStoredTheme() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function applyTheme(theme) {
    var cls = theme === 'light' ? 'theme-light' : 'theme-dark';
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.documentElement.classList.add(cls);
    document.documentElement.setAttribute('data-theme', theme);
  }

  function currentTheme() {
    return document.documentElement.classList.contains('theme-light') ? 'light' : 'dark';
  }

  function updateToggleLabels() {
    var theme = currentTheme();
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.textContent = theme === 'light' ? '🌙 Oscuro' : '☀ Claro';
      btn.setAttribute('aria-label', theme === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
    });
  }

  window.toggleAppTheme = function () {
    var next = currentTheme() === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
    updateToggleLabels();
  };

  document.addEventListener('DOMContentLoaded', updateToggleLabels);
})();
