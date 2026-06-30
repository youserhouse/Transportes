// ═══════════════════════════════════════════════════════════════
// sw.js — Service Worker (PWA offline cache)
// Versión: incrementar CACHE_NAME al actualizar archivos
// ═══════════════════════════════════════════════════════════════
const CACHE_NAME = 'transportes-v47';

const ASSETS = [
  './login.html',
  './splash.html',
  './index.html',
  './styles.css?v=47',
  './theme.js?v=47',
  './data.js?v=47',
  './state.js?v=47',
  './guardar.js?v=47',
  './ui.js?v=47',
  './calcular.js?v=47',
  './cajas.js?v=47',
  './dashboard.js?v=47',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap'
];

// ── INSTALL: precachear todos los assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cachear assets locales obligatoriamente, fuentes opcionales
      const local = ASSETS.filter(u => !u.startsWith('http'));
      const remote = ASSETS.filter(u => u.startsWith('http'));
      return cache.addAll(local).then(() =>
        Promise.allSettled(remote.map(u => cache.add(u)))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar caches antiguas ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Network-first para JS/HTML, cache-first para fuentes e imágenes ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  // Fuentes: cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Imágenes e iconos: cache-first
  if (/\.(png|jpg|jpeg|svg|ico|webp)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        })
      )
    );
    return;
  }

  // JS, HTML, CSS, JSON: network-first (siempre intenta la red, caché como fallback offline)
  event.respondWith(
    fetch(event.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
      }
      return res;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});
