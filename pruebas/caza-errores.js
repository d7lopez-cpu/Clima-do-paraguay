// Caza de errores de Clima PY: recorre la app completa en muchos escenarios y anota errores de JS, avisos de consola y estados raros.
// Uso: node pruebas/caza-errores.js <puerto> [escenario,...]     (escenarios: normal, celular, vacio, corrupto, faltantes, sinred, rapido, visibilidad, geocoder, extras, bfcache)
// Open-Meteo NO es accesible desde aquí: sus respuestas se arman con pruebas/datos.json y horas.json;
// el geocodificador se simula con dos resultados; todo otro dominio se aborta (radar, INE, GitHub…).
const { chromium, devices } = require('playwright');
// En el celular, idioma, tema, sonido, ajustes y los accesos rápidos están dentro del menú (#btnMenu): si el botón buscado está
// en el menú cerrado, primero se abre (como lo haría una persona).
async function clic(p, sel, op) {
  const enMenu = await p.$eval(sel, e => !!e.closest('#menuPanel') && getComputedStyle(document.getElementById('menuPanel')).display === 'none').catch(() => false);
  if (enMenu) await p.click('#btnMenu');
  return p.click(sel, op);
}
const fs = require('fs'), vm = require('vm'), path = require('path');
const PUERTO = process.argv[2] || '8263', SOLO = process.argv[3] ? process.argv[3].split(',') : null;
const H = __dirname, REPO = path.join(__dirname, '..');
const datos = JSON.parse(fs.readFileSync(path.join(H, 'datos.json'), 'utf8'));
const horas = JSON.parse(fs.readFileSync(path.join(H, 'horas.json'), 'utf8')).horas;
const GEO = vm.runInNewContext(fs.readFileSync(path.join(REPO, 'js', 'geo.js'), 'utf8') + ';GEO');
const pts = GEO.ciudades.map(c => [c.n, c.lat, c.lon]);
const cerca = (la, lo) => pts.reduce((m, p) => { const d = (p[1] - la) ** 2 + (p[2] - lo) ** 2; return d < m.d ? { d, n: p[0] } : m; }, { d: 1e9 }).n;
function detalle(n) {
  const cur = Object.assign({ apparent_temperature: 30, wind_direction_10m: 90, pressure_msl: 1009 }, datos.datos[n]);
  const h = horas[n], time = [], T = [], P = [], W = [], D = [], U = [];
  for (let k = 0; k < 144; k++) {
    const i = k % 48, dia = Math.floor(k / 24), hr = k % 24;
    time.push(new Date(Date.parse(h.time[0] + ':00Z') + k * 3600e3).toISOString().slice(0, 16));
    T.push(h.temperature_2m[i] + (dia % 3) - 1); P.push(Math.min(100, Math.round((h.precipitation[i] || 0) * 40 + (dia === 2 ? 50 : 10))));
    W.push(h.precipitation[i] > 0.2 ? 61 : hr > 11 && hr < 18 ? 2 : 1); D.push(hr >= 6 && hr < 19 ? 1 : 0); U.push(hr >= 6 && hr < 19 ? Math.round(10 * Math.sin((hr - 6) / 13 * Math.PI)) : 0);
  }
  const days = [...new Set(time.map(t => t.slice(0, 10)))].slice(0, 6), idx = f => time.map((t, i) => t.startsWith(f) ? i : -1).filter(i => i >= 0);
  return { current: cur, minutely_15: { time: [], precipitation: [] }, hourly: { time, temperature_2m: T, precipitation_probability: P, weather_code: W, is_day: D, uv_index: U },
    daily: { time: days, weather_code: [95, 3, 61, 1, 0, 2], temperature_2m_max: days.map(f => Math.max(...idx(f).map(i => T[i]))), temperature_2m_min: days.map(f => Math.min(...idx(f).map(i => T[i]))),
      precipitation_probability_max: days.map(f => Math.max(...idx(f).map(i => P[i]))), uv_index_max: days.map(() => 11), sunrise: days.map(f => f + 'T05:12'), sunset: days.map(f => f + 'T18:41') } };
}
const hallazgos = [];
let SIN_RED = false;                                                // simula la caída de internet también para las respuestas simuladas
const anotar = (esc, tipo, msg) => { const k = `[${esc}] ${tipo}: ${msg}`; if (!hallazgos.includes(k)) { hallazgos.push(k); console.log('  ✘ ' + k); } };

async function abrir(b, esc, { opts = {}, stor = 'datos', red = true, geocoder = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-PY', timezoneId: 'America/Asuncion', ...opts });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write', ...(opts.permissions || [])], { origin: `http://127.0.0.1:${PUERTO}` });
  if (stor === 'datos') await ctx.addInitScript(d => { if (!sessionStorage.getItem('ya')) { sessionStorage.setItem('ya', 1); localStorage.setItem('clima-py-datos', JSON.stringify({ t: Date.now(), datos: d })); } }, datos.datos);
  else if (stor && stor.fn) await ctx.addInitScript(stor.fn, stor.arg);
  const p = await ctx.newPage();
  p.on('pageerror', e => anotar(esc, 'pageerror', e.message.split('\n')[0]));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) anotar(esc, 'console.error', m.text().slice(0, 200)); });
  p.on('dialog', d => d.dismiss());
  await p.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (!red || SIN_RED) return route.abort('internetdisconnected');
    if (u.hostname === 'api.open-meteo.com') {
      const la = u.searchParams.get('latitude').split(',').map(Number), lo = u.searchParams.get('longitude').split(',').map(Number), ns = la.map((v, i) => cerca(v, lo[i]));
      let body = u.searchParams.get('daily') ? detalle(ns[0]) : u.searchParams.get('current') ? ns.map(n => ({ current: datos.datos[n] })) : ns.map(n => ({ hourly: horas[n] }));
      if (Array.isArray(body) && body.length === 1) body = body[0];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (geocoder && u.hostname === 'geocoding-api.open-meteo.com')
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [
        { name: 'Caacupé', latitude: -25.386, longitude: -57.14, admin1: 'Cordillera', country_code: 'PY', population: 21000 },
        { name: 'Compañía "Rosado" <b>x</b>', latitude: -25.5, longitude: -57.2, admin1: 'Central', country_code: 'PY', population: 10 }] }) });
    return route.abort();
  });
  await p.goto(`http://127.0.0.1:${PUERTO}/`, { waitUntil: 'load' });
  await p.waitForTimeout(3500);
  return { ctx, p };
}
const paso = async (esc, nombre, f) => { try { await f(); } catch (e) { anotar(esc, 'paso falló', `${nombre}: ${e.message.split('\n')[0]}`); } };
const sel = p => p.evaluate(() => ({ hash: location.hash, chip: (document.getElementById('chipSel') || {}).textContent, det: (document.querySelector('#detalle h2, #detalle h3') || {}).textContent }));

const ESCENARIOS = {
  async normal(b) {
    const E = 'normal', { ctx, p } = await abrir(b, E);
    await paso(E, 'búsqueda local con y sin tildes', async () => {
      for (const q of ['asuncion', 'Asunción', 'ENCARNACIÓN', 'encarnacion', 'ñemby', 'nemby', 'caaguazu', 'zzzz', '(', '[a-', '.*', '   ']) {
        await p.fill('#buscador', q); await p.waitForTimeout(120);
        const n = await p.evaluate(() => document.querySelectorAll('#lista [data-ciudad]').length);
        if (/^(asuncion|Asunción)$/.test(q) && n < 1) anotar(E, 'búsqueda', `«${q}» no encuentra Asunción (${n} resultados)`);
        if (/encarnaci/i.test(q) && n < 1) anotar(E, 'búsqueda', `«${q}» no encuentra Encarnación`);
        if (/^(ñemby|nemby)$/.test(q) && n < 1) anotar(E, 'búsqueda', `«${q}» no encuentra Ñemby`);
        if (q === 'caaguazu' && n < 1) anotar(E, 'búsqueda', '«caaguazu» sin resultados');
      }
      await p.fill('#buscador', 'encarnacion'); await p.press('#buscador', 'Enter'); await p.waitForTimeout(800);
      const s = await sel(p); if (!/Encarnaci/.test(decodeURIComponent(s.hash))) anotar(E, 'búsqueda', `Enter con «encarnacion» no elige Encarnación (hash ${s.hash})`);
      await p.press('#buscador', 'Escape'); await p.waitForTimeout(200);
    });
    await paso(E, 'lista y favoritos', async () => {
      const it = p.locator('#lista [data-ciudad]').nth(3); const n = await it.getAttribute('data-ciudad'); await it.click(); await p.waitForTimeout(900);
      if (!decodeURIComponent((await sel(p)).hash).includes(n)) anotar(E, 'lista', `click en «${n}» no la elige`);
      await p.locator('#lista [data-fav]').first().click(); await p.waitForTimeout(200);
      const favs = await p.evaluate(() => JSON.parse(localStorage.getItem('clima-py-favs') || '[]'));
      if (!favs.length) anotar(E, 'favoritos', 'marcar ★ en la lista no guarda la favorita');
      await p.locator('#favs [data-ciudad]').first().click(); await p.waitForTimeout(600);
      await p.locator('#lista [data-fav]').first().click(); await p.waitForTimeout(200);
    });
    await paso(E, 'mapa: click en ciudad, zoom, arrastre y teclado', async () => {
      const z = p.locator('#mapa circle.zona').nth(10); const n = await z.getAttribute('data-ciudad');
      await z.click({ force: true }); await p.waitForTimeout(800);
      if (!decodeURIComponent((await sel(p)).hash).includes(n)) anotar(E, 'mapa', `click en el punto de «${n}» no la elige`);
      for (const id of ['zMas', 'zMas', 'zMenos', 'zReset']) { await clic(p, '#' + id); await p.waitForTimeout(150); }
      const bb = await p.locator('#mapa').boundingBox();
      await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.mouse.move(bb.x + bb.width / 2 + 80, bb.y + bb.height / 2 + 40, { steps: 5 }); await p.mouse.up();
      await p.mouse.wheel(0, -400); await p.waitForTimeout(200); await p.mouse.wheel(0, 400);
      await p.focus('#mapa'); for (const k of ['ArrowLeft', 'ArrowUp', '+', '-', 'Enter']) await p.keyboard.press(k);
    });
    await paso(E, 'pestañas del detalle', async () => {
      for (const t of ['grafico', 'horas', 'grafico']) { await clic(p, `#detalle [data-tab="${t}"]`); await p.waitForTimeout(250); }
      const on = await p.evaluate(() => (document.querySelector('#detalle [data-tab].on') || {}).dataset?.tab);
      if (on !== 'grafico') anotar(E, 'pestañas', `la pestaña activa es ${on}`);
      await clic(p, '#detalle [data-fav]'); await p.waitForTimeout(200); await clic(p, '#detalle [data-fav]');
    });
    await paso(E, 'capas y deslizador', async () => {
      const capas = await p.locator('#capas button').count();
      for (let i = 0; i < capas; i++) { await p.locator('#capas button').nth(i).click(); await p.waitForTimeout(250); }
      for (const v of [0, 1, 6, 12, 24, 3, 0]) { await p.locator('#hSlider').fill(String(v)); await p.waitForTimeout(250); }
      await clic(p, '#hPlay'); await p.waitForTimeout(2500); await clic(p, '#hPlay'); await p.waitForTimeout(300);
      await p.locator('#hSlider').fill('0'); await p.waitForTimeout(300);
    });
    await paso(E, 'comparar', async () => {
      await clic(p, '#btnComparar'); await p.waitForTimeout(400);
      for (const [i, idx] of [[0, 5], [1, 40], [2, 0], [2, 100], [1, 5]]) { await p.selectOption(`#compSel select[data-i="${i}"]`, { index: idx }); await p.waitForTimeout(400); }
      const cols = await p.locator('#compRes th, #compRes td').count(); if (!cols) anotar(E, 'comparar', 'la tabla de comparación queda vacía');
      await clic(p, '#btnUnidad'); await p.waitForTimeout(200); await clic(p, '#btnUnidad');
      await clic(p, '#compCerrar'); await p.waitForTimeout(200);
      if (!(await p.evaluate(() => document.getElementById('comparar').hidden))) anotar(E, 'comparar', 'no se cierra');
    });
    await paso(E, 'radar y rutas sin red', async () => {
      await clic(p, '#btnRadar'); await p.waitForTimeout(1500);
      await clic(p, '#btnRadarPlay').catch(() => {}); await p.waitForTimeout(300);
      await p.locator('#radarOpacidad').fill('30').catch(() => {}); await p.waitForTimeout(200);
      await clic(p, '#btnRadar'); await p.waitForTimeout(300);
      await clic(p, '#btnRutas'); await p.waitForTimeout(300); await clic(p, '#btnRutas');
    });
    await paso(E, '°C/°F, tema, guaraní', async () => {
      for (const id of ['btnUnidad', 'btnTema', 'btnIdioma']) { await clic(p, '#' + id); await p.waitForTimeout(500); }
      await p.locator('#lista [data-ciudad]').nth(5).click(); await p.waitForTimeout(800);
      await clic(p, '#detalle [data-tab="grafico"]'); await p.waitForTimeout(300);
      for (const id of ['btnUnidad', 'btnTema', 'btnIdioma']) { await clic(p, '#' + id); await p.waitForTimeout(500); }
      const lang = await p.evaluate(() => document.documentElement.lang); if (lang !== 'es') anotar(E, 'idioma', `queda en ${lang}`);
    });
    await paso(E, 'panel ⚙️ y vista previa', async () => {
      await clic(p, '#btnAjustesAnim'); await p.waitForTimeout(300);
      for (const r of await p.locator('#dlgAnim input[type=radio], #dlgAnim input[type=checkbox]').all()) { if (await r.isVisible()) { await r.click({ force: true }).catch(() => {}); await p.waitForTimeout(60); } }
      await p.locator('#daVolumen').fill('0.3').catch(() => {});
      await clic(p, '#daPreviaVolver').catch(() => {}); await clic(p, '#daRestablecer').catch(() => {});
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      await p.evaluate(() => climaAnim.fijar({ vistaPrevia: { tipo: 'tormenta', fase: 'noche' } })); await p.waitForTimeout(500);
      await clic(p, '#epVolver').catch(() => {}); await p.waitForTimeout(300);
      const vp = await p.evaluate(() => climaAnim.prefs().vistaPrevia); if (vp) anotar(E, 'vista previa', '«Volver» no sale de la vista previa');
      await clic(p, '#btnSonido'); await p.waitForTimeout(500); await clic(p, '#btnFx'); await p.waitForTimeout(300); await clic(p, '#btnFx'); await clic(p, '#btnSonido');
    });
    await paso(E, 'compartir', async () => {
      await p.evaluate(() => { window.__abierto = []; window.open = (...a) => { window.__abierto.push(a[0]); return null; }; });
      const bs = await p.locator('#detalle [data-compartir]').all();
      for (const bt of bs) { await bt.click(); await p.waitForTimeout(400); }
      const r = await p.evaluate(async () => ({ ab: window.__abierto, clip: await navigator.clipboard.readText().catch(() => ''), aviso: document.getElementById('aviso').textContent }));
      if (!bs.length) anotar(E, 'compartir', 'no hay botón de compartir');
      if (!r.clip.includes('http') && !r.ab.length) anotar(E, 'compartir', `no copió ni abrió nada (aviso «${r.aviso}»)`);
    });
    await paso(E, 'redimensionar', async () => {
      for (const [w, h] of [[360, 740], [1920, 1080], [800, 600], [1366, 900]]) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(400); }
      const ancho = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (ancho > 2) anotar(E, 'diseño', `desborde horizontal de ${ancho}px a 1366`);
    });
    await paso(E, 'sin internet tras la primera carga', async () => {
      SIN_RED = true; await ctx.setOffline(true); await p.evaluate(() => window.dispatchEvent(new Event('offline'))); await p.waitForTimeout(400);
      await clic(p, '#btnActualizar'); await p.waitForTimeout(1500);
      await p.locator('#lista [data-ciudad]').nth(20).click(); await p.waitForTimeout(1500);
      await clic(p, '#btnRadar'); await p.waitForTimeout(800); await clic(p, '#btnRadar');
      await p.fill('#buscador', 'villarrica'); await p.waitForTimeout(800); await clic(p, '#btnLugar'); await p.waitForTimeout(800);
      const est = await p.evaluate(() => document.getElementById('estado').textContent);
      SIN_RED = false; await ctx.setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(1500);
      console.log('    estado sin red:', est);
    });
    await ctx.close();
  },
  async celular(b) {
    const E = 'celular', { ctx, p } = await abrir(b, E, { opts: { ...devices['iPhone 13'] } });
    await paso(E, 'tocar, rotar, navegar', async () => {
      await p.locator('#lista [data-ciudad]').nth(2).tap(); await p.waitForTimeout(700);
      await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(600);
      await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(600);
      for (const b2 of await p.locator('.barra-nav [data-ir]').all()) { await b2.tap().catch(() => {}); await p.waitForTimeout(200); }
      const ancho = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (ancho > 2) anotar(E, 'diseño', `desborde horizontal de ${ancho}px`);
      await clic(p, '#btnAjustesAnim'); await p.waitForTimeout(300); await p.keyboard.press('Escape');
    });
    await ctx.close();
  },
  async vacio(b) {             // sin nada guardado: todo llega de la API simulada
    const E = 'vacio', { ctx, p } = await abrir(b, E, { stor: null });
    await p.waitForTimeout(3000);
    const n = await p.evaluate(() => [...document.querySelectorAll('#lista .item .t')].filter(e => /\d/.test(e.textContent)).length);
    const c = await p.evaluate(() => document.getElementById('contador').textContent);
    if (n < 20) anotar(E, 'datos', `con almacenamiento vacío solo ${n} filas tienen valor (contador ${c})`);
    await ctx.close();
  },
  async corrupto(b) {          // cada clave con basura distinta
    for (const basura of ['{', 'null', '[]', '"x"', '123', '{"t":"no","datos":5}', '{"t":1e30,"datos":{"Asunción":{"temperature_2m":"caliente"}}}']) {
      const E = 'corrupto ' + basura;
      const { ctx, p } = await abrir(b, E, { stor: { fn: v => { if (sessionStorage.getItem('ya')) return; sessionStorage.setItem('ya', 1); for (const k of ['clima-py-datos', 'clima-py-favs', 'clima-py-comp', 'clima-py-anim', 'clima-py-tema', 'clima-py-f', 'clima-py-idioma', 'clima-py-ultima', 'clima-py-fx', 'clima-py-avisos', 'clima-py-avisados', 'clima-py-lugares-v1', 'clima-py-navidad', 'clima-py-navidad-saludo', 'clima-py-det-Asunción']) localStorage.setItem(k, v); }, arg: basura } });
      await paso(E, 'usar con almacenamiento corrupto', async () => {
        await clic(p, '#btnComparar'); await p.waitForTimeout(300); await clic(p, '#compCerrar');
        await p.locator('#lista [data-ciudad]').first().click(); await p.waitForTimeout(800);
        await clic(p, '#btnAjustesAnim'); await p.waitForTimeout(200); await p.keyboard.press('Escape');
        const n = await p.evaluate(() => parseInt(document.getElementById('contador').textContent.replace(/\D/g, ''))); if (!(n >= 263)) anotar(E, 'datos', `contador con ${n} ciudades`);
      });
      await ctx.close();
    }
  },
  async faltantes(b) {         // datos con campos faltantes, nulos o rarezas
    const d = JSON.parse(JSON.stringify(datos.datos)), ns = Object.keys(d);
    ns.forEach((n, i) => { const x = d[n]; if (i % 5 === 0) delete x.temperature_2m; if (i % 7 === 0) x.weather_code = null; if (i % 11 === 0) x.wind_speed_10m = undefined; if (i % 13 === 0) x.precipitation = -1; if (i % 17 === 0) x.weather_code = 999; if (i % 19 === 0) x.relative_humidity_2m = 'x'; });
    d['Asunción'] = { time: d['Asunción'].time, is_day: 1, relative_humidity_2m: 50 };
    const E = 'faltantes', { ctx, p } = await abrir(b, E, { stor: { fn: d => { if (sessionStorage.getItem('ya')) return; sessionStorage.setItem('ya', 1); localStorage.setItem('clima-py-datos', JSON.stringify({ t: Date.now(), datos: d })); }, arg: d } });
    await paso(E, 'recorrer con datos raros', async () => {
      for (const cap of await p.locator('#capas button').all()) { await cap.click(); await p.waitForTimeout(200); }
      await clic(p, '#btnComparar'); await p.waitForTimeout(300); await clic(p, '#compCerrar');
      for (const o of ['temp', 'nombre', 'lluvia', 'viento']) await p.selectOption('#orden', o).catch(() => {});
      await p.evaluate(() => climaSonido && 0);
      await clic(p, '#btnSonido'); await p.waitForTimeout(500); await clic(p, '#btnSonido');
      const txt = await p.evaluate(() => document.body.innerText); if (/NaN|undefined/.test(txt)) anotar(E, 'texto', `aparece ${txt.match(/.{0,30}(NaN|undefined).{0,30}/)[0].replace(/\n/g, ' ')}`);
    });
    await ctx.close();
  },
  async sinred(b) {            // sin red desde el principio (con datos guardados)
    const E = 'sinred', { ctx, p } = await abrir(b, E, { red: false });
    await paso(E, 'abrir sin red', async () => {
      await p.locator('#lista [data-ciudad]').nth(4).click(); await p.waitForTimeout(1500);
      const det = await p.evaluate(() => document.getElementById('detalle').innerText.slice(0, 200));
      console.log('    detalle sin red:', det.replace(/\n/g, ' | ').slice(0, 160));
      await clic(p, '#btnActualizar'); await p.waitForTimeout(1500);
    });
    await ctx.close();
  },
  async rapido(b) {            // cambio rápido de ciudades: el detalle debe mostrar la última elegida
    const E = 'rapido', { ctx, p } = await abrir(b, E);
    await paso(E, 'cambiar 40 veces seguidas', async () => {
      const nombres = await p.$$eval('#lista [data-ciudad]', bs => bs.slice(0, 40).map(b => b.dataset.ciudad));
      for (const n of nombres) await p.evaluate(n => document.querySelector(`#lista [data-ciudad="${CSS.escape(n)}"]`).click(), n);
      await p.waitForTimeout(3000);
      const ult = nombres[nombres.length - 1];
      const r = await p.evaluate(() => ({ hash: decodeURIComponent(location.hash), det: document.getElementById('detalle').innerText.slice(0, 120) }));
      if (!r.hash.includes(ult) || !r.det.includes(ult)) anotar(E, 'carrera', `tras 40 cambios el detalle no muestra la última (${ult}): ${r.det.slice(0, 60).replace(/\n/g, ' ')}`);
    });
    await ctx.close();
  },
  async visibilidad(b) {       // pestaña oculta y vuelta: el bucle se detiene y vuelve
    const E = 'visibilidad', { ctx, p } = await abrir(b, E);
    await paso(E, 'ocultar y volver', async () => {
      await clic(p, '#btnSonido'); await p.waitForTimeout(500);
      const cdp = await ctx.newCDPSession(p);
      await p.evaluate(() => { window.__raf = 0; const o = requestAnimationFrame; window.requestAnimationFrame = f => { window.__raf++; return o(f); }; });
      await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false }).catch(() => {});
      await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
      await p.waitForTimeout(300); const r0 = await p.evaluate(() => window.__raf); await p.waitForTimeout(1500); const r1 = await p.evaluate(() => window.__raf);
      const sOculta = await p.evaluate(() => climaSonido.estado().contexto);
      await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
      await p.waitForTimeout(1500); const r2 = await p.evaluate(() => window.__raf); const sVuelta = await p.evaluate(() => climaSonido.estado().contexto);
      console.log(`    rAF oculta: ${r1 - r0} en 1,5 s; al volver: ${r2 - r1}; sonido oculta ${sOculta}, al volver ${sVuelta}`);
      if (r1 - r0 > 2) anotar(E, 'bucle', `con la pestaña oculta el bucle sigue (${r1 - r0} rAF en 1,5 s)`);
      if (r2 - r1 < 10) anotar(E, 'bucle', 'al volver a la pestaña el bucle no se reanuda');
      if (sOculta !== 'suspended' || sVuelta !== 'running') anotar(E, 'sonido', `oculta ${sOculta} / vuelta ${sVuelta}`);
    });
    await ctx.close();
  },
  async geocoder(b) {          // el geocodificador responde: Enter, resultados con comillas y HTML
    const E = 'geocoder', { ctx, p } = await abrir(b, E, { geocoder: true });
    await paso(E, 'buscar lugar externo', async () => {
      await p.fill('#buscador', 'san'); await p.waitForTimeout(900);
      const vis = await p.evaluate(() => !document.getElementById('lugares').hidden);
      const elegidas = [];
      await p.exposeFunction('__anota', h => elegidas.push(h));
      await p.evaluate(() => { const o = history.replaceState.bind(history); history.replaceState = (...a) => { window.__anota(decodeURIComponent(String(a[2]))); return o(...a); }; const q = history.pushState.bind(history); history.pushState = (...a) => { window.__anota(decodeURIComponent(String(a[2]))); return q(...a); }; });
      await p.press('#buscador', 'Enter'); await p.waitForTimeout(1500);
      const r = await p.evaluate(() => decodeURIComponent(location.hash));
      console.log(`    sugerencias visibles: ${vis}; tras Enter: ${r}; cambios de hash: ${elegidas.join(' → ')}`);
      if (elegidas.length > 1) anotar(E, 'búsqueda', `un solo Enter eligió ${elegidas.length} lugares seguidos (${elegidas.join(' → ')})`);
      await p.fill('#buscador', 'compania'); await p.waitForTimeout(900);
      const btns = await p.locator('#lugares button[data-lugar]').count();
      const iR = await p.$$eval('#lugares button[data-lugar]', bs => bs.findIndex(b => /Rosado/.test(b.textContent)));
      if (iR >= 0) { await p.locator('#lugares button[data-lugar]').nth(iR).click(); await p.waitForTimeout(1500); }
      const inj = await p.evaluate(() => [...document.querySelectorAll('b')].filter(b => b.textContent === 'x').map(b => (b.parentElement.closest('[id]') || {}).id + ': ' + b.parentElement.outerHTML.slice(0, 160)).join(' | '));
      if (inj) anotar(E, 'seguridad', 'HTML del geocodificador interpretado: ' + inj);
      const opciones = await p.$$eval('#lugares button[data-lugar]', bs => bs.map(b => b.textContent));
      console.log('    sugerencias para «compania»:', opciones.join(' / '));
      const raro = await p.evaluate(() => [...document.querySelectorAll('[data-ciudad]')].filter(e => /Rosado/.test(e.getAttribute('data-ciudad'))).map(e => e.getAttribute('data-ciudad')));
      console.log('    lugar con comillas:', JSON.stringify(raro).slice(0, 120), 'html inyectado:', inj);
    });
    await ctx.close();
  },
  async extras(b) {            // filtros, orden, ver todas, teclado, ubicación, avisos, sonido tocado muchas veces
    const E = 'extras', { ctx, p } = await abrir(b, E, { opts: { geolocation: { latitude: -27.33, longitude: -55.87 }, permissions: ['geolocation', 'notifications'] } });
    await paso(E, 'filtros y orden', async () => {
      for (const o of ['mayor', 'menor', 'nombre']) { await p.selectOption('#orden', o); await p.waitForTimeout(200); }
      const deps = await p.$$eval('#filtroDep option', os => os.map(o => o.value));
      for (const d of deps.slice(1, 4)) { await p.selectOption('#filtroDep', d); await p.waitForTimeout(400); }
      await p.selectOption('#filtroDep', ''); await p.waitForTimeout(300);
      await clic(p, '#verTodas'); await p.waitForTimeout(300);
      const filas = await p.locator('#lista .item').count(); if (filas < 263) anotar(E, 'lista', `«Ver todas» muestra ${filas}`);
      await p.fill('#buscador', 'qqqq'); await p.waitForTimeout(200); await clic(p, '#quitarFiltros'); await p.waitForTimeout(300);
      if (await p.inputValue('#buscador')) anotar(E, 'lista', '«Quitar filtros» no limpia el buscador');
      await p.locator('#lista .item-main').first().focus(); for (const k of ['ArrowDown', 'ArrowDown', 'End', 'Home', 'Enter']) await p.keyboard.press(k);
    });
    await paso(E, 'cerca de mí', async () => {
      await clic(p, '#btnUbicacion'); await p.waitForTimeout(2500);
      const h = await p.evaluate(() => decodeURIComponent(location.hash)); console.log('    cerca de mí (Encarnación):', h, '· aviso:', await p.evaluate(() => document.getElementById('aviso').textContent));
      if (!/Encarnaci|Cambyret|Capitán Miranda|Carmen/.test(h)) anotar(E, 'ubicación', `«Cerca de mí» en Encarnación eligió ${h}`);
    });
    await paso(E, 'avisos', async () => { await clic(p, '#btnAvisos'); await p.waitForTimeout(300); await clic(p, '#btnAvisos'); });
    await paso(E, 'sonido tocado 7 veces seguidas', async () => {
      for (let i = 0; i < 7; i++) await clic(p, '#btnSonido', { delay: 0 });
      await p.waitForTimeout(4500);
      const r = await p.evaluate(() => ({ b: document.getElementById('btnSonido').getAttribute('aria-pressed'), e: climaSonido.estado() }));
      console.log(`    tras 7 toques: botón ${r.b}, sonando ${r.e.sonando}, contexto ${r.e.contexto}`);
      if (String(r.e.sonando) !== r.b || (r.e.sonando && r.e.contexto !== 'running')) anotar(E, 'sonido', `estado incoherente tras toques rápidos: botón ${r.b}, sonando ${r.e.sonando}, contexto ${r.e.contexto}`);
    });
    await ctx.close();
  },
  async bfcache(b) {           // ir a otra página y volver con «atrás» (caché atrás/adelante)
    const E = 'bfcache', { ctx, p } = await abrir(b, E);
    await paso(E, 'atrás/adelante', async () => {
      await clic(p, '#btnSonido'); await p.waitForTimeout(400);
      await p.evaluate(() => { window.__marca = 1; });
      await p.goto(`http://127.0.0.1:${PUERTO}/manifest.webmanifest`); await p.waitForTimeout(300);
      await p.goBack(); await p.waitForTimeout(1500);
      const r = await p.evaluate(() => ({ restaurada: window.__marca === 1, boton: document.getElementById('btnSonido').getAttribute('aria-pressed'), sonido: window.climaSonido.estado() }));
      console.log(`    restaurada desde bfcache: ${r.restaurada}; botón aria-pressed ${r.boton}; sonido ${r.sonido ? r.sonido.contexto : null}`);
      if (r.restaurada && r.boton === 'true' && !(r.sonido && r.sonido.sonando)) anotar(E, 'sonido', 'botón en 🔊 sin sonido tras volver');
      // headless no siempre usa la caché atrás/adelante: se simula el pagehide «persisted» y se cuentan los temporizadores borrados
      const borrados = await p.evaluate(() => { let n = 0; const o = window.clearInterval; window.clearInterval = id => { n++; return o(id); }; window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); window.clearInterval = o; return n; });
      const boton2 = await p.evaluate(() => document.getElementById('btnSonido').getAttribute('aria-pressed'));
      console.log(`    pagehide persisted simulado: ${borrados} clearInterval (sonido aparte); botón ${boton2}`);
      if (borrados > 2) anotar(E, 'temporizadores', `un pagehide hacia la caché atrás/adelante borra ${borrados} temporizadores de la app (al volver ya no se actualiza)`);
    });
    await ctx.close();
  }
};

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [n, f] of Object.entries(ESCENARIOS)) {
    if (SOLO && !SOLO.includes(n)) continue;
    console.log('Escenario:', n);
    try { await f(b); } catch (e) { anotar(n, 'escenario abortado', e.message.split('\n')[0]); }
  }
  await b.close();
  console.log(hallazgos.length ? `\n${hallazgos.length} hallazgos:\n` + hallazgos.join('\n') : '\nSin hallazgos');
})();
