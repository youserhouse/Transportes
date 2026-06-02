// ═══════════════════════════════════════════════════════════════
// sw.js — Service Worker (PWA offline cache)
// Versión: incrementar CACHE_NAME al actualizar archivos
// ═══════════════════════════════════════════════════════════════
const CACHE_NAME = 'transportes-v8';

const ASSETS = [
  './login.html',
  './splash.html',
  './index.html',
  './styles.css',
  './data.js',
  './state.js',
  './historial.js',
  './ui.js',
  './calcular.js',
  './cajas.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=Lato:wght@300;400;700&display=swap'
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

// ── FETCH: Cache-first para assets, network-first para el resto ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Solo interceptar GET
  if (event.request.method !== 'GET') return;

  // Fuentes: cache-first con fallback a red
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

  // Assets locales: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
