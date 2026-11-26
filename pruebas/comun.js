// Utilidades compartidas por las pruebas de interfaz de Clima PY (rol interfaz).
// Arma un contexto de Playwright con datos guardados (pruebas/datos.json y horas.json) y simula Open-Meteo:
// las pruebas no dependen de internet ni del clima de hoy.
const { chromium, devices } = require('playwright');
const fs = require('fs'), vm = require('vm'), path = require('path');

const H = __dirname;
const PNG_VACIO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const datos = JSON.parse(fs.readFileSync(path.join(H, 'datos.json'), 'utf8'));
const horas = JSON.parse(fs.readFileSync(path.join(H, 'horas.json'), 'utf8')).horas;

function crear(REPO) {
  const GEO = vm.runInNewContext(fs.readFileSync(path.join(REPO, 'js', 'geo.js'), 'utf8') + ';GEO');
  const pts = GEO.ciudades.map(c => [c.n, c.lat, c.lon]);
  const cerca = (la, lo) => pts.reduce((m, p) => { const d = (p[1] - la) ** 2 + (p[2] - lo) ** 2; return d < m.d ? { d, n: p[0] } : m; }, { d: 1e9 }).n;
  function detalle(n) {
    const cur = Object.assign({ apparent_temperature: 30, wind_direction_10m: 90, pressure_msl: 1009 }, datos.datos[n]);
    const h = horas[n], time = [], T = [], P = [], W = [], D = [], U = [];
    for (let k = 0; k < 144; k++) {
      const i = k % 48, dia = Math.floor(k / 24), hr = k % 24;
      time.push(new Date(Date.parse(h.time[0] + ':00Z') + k * 3600e3).toISOString().slice(0, 16));
      T.push(h.temperature_2m[i] + (dia % 3) - 1);
      P.push(Math.min(100, Math.round((h.precipitation[i] || 0) * 40 + (dia === 2 ? 50 : 10))));
      W.push(h.precipitation[i] > 0.2 ? 61 : hr > 11 && hr < 18 ? 2 : 1); D.push(hr >= 6 && hr < 19 ? 1 : 0);
      U.push(hr >= 6 && hr < 19 ? Math.round(10 * Math.sin((hr - 6) / 13 * Math.PI)) : 0);
    }
    const days = [...new Set(time.map(t => t.slice(0, 10)))].slice(0, 6);
    const idx = f => time.map((t, i) => t.startsWith(f) ? i : -1).filter(i => i >= 0);
    return {
      current: cur, minutely_15: { time: [], precipitation: [] },
      hourly: { time, temperature_2m: T, precipitation_probability: P, weather_code: W, is_day: D, uv_index: U },
      daily: {
        time: days, weather_code: [95, 3, 61, 1, 0, 2],
        temperature_2m_max: days.map(f => Math.max(...idx(f).map(i => T[i]))), temperature_2m_min: days.map(f => Math.min(...idx(f).map(i => T[i]))),
        precipitation_probability_max: days.map(f => Math.max(...idx(f).map(i => P[i]))), uv_index_max: days.map(() => 11),
        sunrise: days.map(f => f + 'T05:12'), sunset: days.map(f => f + 'T18:41')
      }
    };
  }
  // Rutas: Open-Meteo simulado; lo demás de afuera se corta. `sustituir` = { 'css/estilos.css': '/ruta/local.css', ... }
  async function rutas(p, sustituir = {}, cambios = {}) {
    const actual = n => Object.assign({}, datos.datos[n], cambios[n] || {});
    await p.route('**/*', async route => {
      const u = new URL(route.request().url());
      if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') {
        const nom = u.pathname.replace(/^\//, '');
        if (sustituir[nom]) {
          const tipo = nom.endsWith('.css') ? 'text/css' : nom.endsWith('.js') ? 'application/javascript' : 'text/html';
          return route.fulfill({ status: 200, contentType: tipo, body: fs.readFileSync(sustituir[nom]) });
        }
        if (nom === 'sw.js') return route.fulfill({ status: 404, body: '' });   // sin service worker: siempre lo último
        return route.continue();
      }
      if (u.hostname === 'api.open-meteo.com') {
        const la = u.searchParams.get('latitude').split(',').map(Number), lo = u.searchParams.get('longitude').split(',').map(Number);
        const ns = la.map((v, i) => cerca(v, lo[i]));
        let body = u.searchParams.get('daily') ? detalle(ns[0]) : u.searchParams.get('current') ? ns.map(n => ({ current: actual(n) })) : ns.map(n => ({ hourly: horas[n] }));
        if (Array.isArray(body) && body.length === 1) body = body[0];
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
      if (u.hostname === 'api.rainviewer.com') {                       // radar simulado: 6 fotogramas
        const t = Math.floor(Date.now() / 1000 / 600) * 600;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ host: 'https://tilecache.rainviewer.com',
          radar: { past: [5, 4, 3, 2, 1, 0].map(k => ({ time: t - k * 600, path: '/v2/radar/' + (t - k * 600) })) } }) });
      }
      if (u.hostname === 'tilecache.rainviewer.com') return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_VACIO });
      return route.abort();
    });
  }
  // Abre la app. op: { ancho, alto, celular, tema, navidad, idioma, extra: {clave: valor}, sustituir, movimiento }
  async function abrir(b, PUERTO, op = {}) {
    const base = op.celular ? { ...devices['iPhone 13'] } : { viewport: { width: op.ancho || 1366, height: op.alto || 900 } };
    if (op.celular && op.ancho) base.viewport = { width: op.ancho, height: op.alto || 740 };
    const ctx = await b.newContext({ ...base, locale: 'es-PY', timezoneId: 'America/Asuncion', reducedMotion: op.movimiento || 'no-preference',
      permissions: ['clipboard-read', 'clipboard-write'] });
    const ls = Object.assign({ 'clima-py-tema': op.tema || 'oscuro' }, op.navidad ? { 'clima-py-navidad': op.navidad } : {},
      op.idioma ? { 'clima-py-idioma': op.idioma } : {}, op.extra || {});
    const dd = JSON.parse(JSON.stringify(datos.datos)); for (const n in (op.cambios || {})) Object.assign(dd[n], op.cambios[n]);
    await ctx.addInitScript(([d, ls]) => { try { localStorage.setItem('clima-py-datos', JSON.stringify({ t: Date.now(), datos: d })); for (const k in ls) localStorage.setItem(k, ls[k]); } catch (e) {} }, [dd, ls]);
    const p = await ctx.newPage(), errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errs.push('consola: ' + m.text()); });
    await rutas(p, op.sustituir, op.cambios || {});
    await p.goto(`http://127.0.0.1:${PUERTO}/`, { waitUntil: 'load' });
    await p.waitForFunction(() => document.querySelector('#detalle .pestanas'), null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(op.espera ?? 1500);
    return { ctx, p, errs };
  }
  return { abrir, rutas, detalle };
}
module.exports = { crear, chromium, devices, datos, horas };
