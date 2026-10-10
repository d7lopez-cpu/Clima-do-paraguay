// Service worker: guarda los archivos de la app para que abra sin internet.
// El clima en sí se guarda aparte (localStorage, en index.html).
// Si cambias algún archivo, sube el número de VERSION para que los celulares lo actualicen.
const VERSION = 'clima-py-v9';
const ARCHIVOS = ['./', 'index.html', 'manifest.webmanifest', 'icono-192.png', 'icono-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // la API del clima va directo a internet
  // Primero la red (así siempre ves la versión nueva); si no hay internet, la copia guardada
  e.respondWith(fetch(e.request).then(r => {
    const copia = r.clone();
    caches.open(VERSION).then(c => c.put(e.request, copia));
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
