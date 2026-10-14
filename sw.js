/* Clima PY — Service Worker
 * - Guarda la app (HTML, manifest e iconos) para que abra sin internet.
 * - La página se pide primero a la red (así siempre ves la última versión) y, si no hay internet, usa la copia guardada.
 * - Los datos del clima (Open-Meteo, METAR, RainViewer) NO se guardan aquí: la app ya conserva los últimos datos por su cuenta
 *   y así nunca se muestra un pronóstico viejo como si fuera nuevo.
 * Para publicar una versión nueva de la app, cambia el número de VERSION.
 */
const VERSION = 'v2';
const CACHE = 'clima-py-' + VERSION;
const APP = ['./', 'index.html', 'manifest.webmanifest', 'icono-192.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Uno por uno: si falta un archivo (por ejemplo un icono) no se cae toda la instalación
    await Promise.allSettled(APP.map(u => cache.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const claves = await caches.keys();
    await Promise.all(claves.filter(k => k.startsWith('clima-py-') && k !== CACHE).map(k => caches.delete(k)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // APIs externas: directo a la red

  // Páginas: red primero, copia guardada si no hay internet
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const r = (await e.preloadResponse) || (await fetch(req));
        if (r && r.ok) { const c = await caches.open(CACHE); c.put('index.html', r.clone()); }
        return r;
      } catch (_) {
        const c = await caches.open(CACHE);
        return (await c.match(req, { ignoreSearch: true })) || (await c.match('index.html')) || (await c.match('./')) ||
          new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // Archivos propios (iconos, manifest): salen de la copia guardada y se renuevan en segundo plano
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const guardado = await c.match(req);
    const red = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return guardado || (await red) || new Response('', { status: 504 });
  })());
});

// Al tocar un aviso de tormenta se abre (o se enfoca) la app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (abiertas.length) return abiertas[0].focus();
    return self.clients.openWindow('./');
  })());
});
