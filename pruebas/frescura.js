// ¿La app queda al día aunque el archivo compartido de GitHub llegue atrasado?
// Sirve la app como si estuviera en GitHub Pages (d7lopez-cpu.github.io) con un Open-Meteo y un datos.json simulados.
// Uso: node pruebas/frescura.js [carpeta-del-proyecto]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const RAIZ = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const SITIO = 'https://d7lopez-cpu.github.io/Clima-do-paraguay/';
const geo = fs.readFileSync(path.join(RAIZ, 'js', 'geo.js'), 'utf8'), gi = geo.indexOf('const GEO = ') + 12;
const CIUDADES = JSON.parse(geo.slice(gi, geo.indexOf('\n', gi)).trim().replace(/;$/, '')).ciudades;
let fallos = 0; const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) fallos++; };
// hora de Asunción (UTC−3) en formato de Open-Meteo, redondeada al cuarto de hora
const horaPY = ms => { const d = new Date(ms - 3 * 3600e3); d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 15) * 15, 0, 0); return d.toISOString().slice(0, 16); };
const clima = (ms, temp) => ({ time: horaPY(ms), interval: 900, temperature_2m: temp, relative_humidity_2m: 60, wind_speed_10m: 10, precipitation: 0, weather_code: 1, is_day: 1 });
const tipo = f => ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' })[path.extname(f)] || 'application/octet-stream';

async function escenario(b, nombre, { edadArchivo, guardado, consultas }) {
  console.log(nombre);
  const ctx = await b.newContext({ locale: 'es-PY', timezoneId: 'America/Asuncion', serviceWorkers: 'block' });
  const cuenta = { actual: 0, ciudades: 0, archivo: 0 };
  await ctx.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.host === 'd7lopez-cpu.github.io') {
      const f = path.join(RAIZ, decodeURIComponent(u.pathname.replace('/Clima-do-paraguay/', '')) || 'index.html');
      const real = fs.existsSync(f) && fs.statSync(f).isFile() ? f : path.join(RAIZ, 'index.html');
      return r.fulfill({ body: fs.readFileSync(real), contentType: tipo(real) });
    }
    if (u.host === 'raw.githubusercontent.com' && u.pathname.endsWith('/datos.json')) {
      cuenta.archivo++;
      const t = Date.now() - edadArchivo, datos = {};
      CIUDADES.forEach(c => { datos[c.n] = clima(t, 10); });                // 10 °C = dato del archivo
      return r.fulfill({ json: { t, datos, lugares: {} } });
    }
    if (u.host === 'api.open-meteo.com' && u.searchParams.get('current') && !u.searchParams.get('hourly') && !u.searchParams.get('daily')) {   // solo el clima de ahora por lotes (no el detalle de la ciudad elegida)
      const lats = u.searchParams.get('latitude').split(',');
      cuenta.actual++; cuenta.ciudades += lats.length;
      const res = lats.map(() => ({ current: clima(Date.now(), 30) }));    // 30 °C = dato directo de Open-Meteo (al día)
      return r.fulfill({ json: res.length === 1 ? res[0] : res });
    }
    return r.fulfill({ status: 404, body: '' });                            // el resto (aeropuertos, detalle…) no importa aquí
  });
  if (consultas) await ctx.addInitScript(n => localStorage.setItem('clima-py-consultas', JSON.stringify([[Date.now() - 60e3, n]])), consultas);
  if (guardado) await ctx.addInitScript(g => localStorage.setItem('clima-py-datos', JSON.stringify(g)), guardado);
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(SITIO); await page.waitForTimeout(4000);
  const r = await page.evaluate(() => { const g = JSON.parse(localStorage.getItem('clima-py-datos') || '{}'); const v = Object.values(g.datos || {}); return { n: v.length, de30: v.filter(d => d.temperature_2m === 30).length, de10: v.filter(d => d.temperature_2m === 10).length, de20: v.filter(d => d.temperature_2m === 20).length, estado: document.getElementById('estado').textContent }; });
  await ctx.close();
  return { ...r, ...cuenta, errs };
}
(async () => {
  const b = await chromium.launch();
  const gr = CIUDADES.filter(c => c.g < 4).length;
  let r = await escenario(b, 'A) Archivo de GitHub con 7 h de atraso', { edadArchivo: 7 * 3600e3 });
  ok(r.de30 === CIUDADES.length, `todas las ciudades quedan al día con Open-Meteo directo (${r.de30}/${CIUDADES.length}; del archivo viejo: ${r.de10})`);
  ok(/En vivo/.test(r.estado), `estado: «${r.estado}»`);
  ok(r.errs.length === 0, 'sin errores de JS ' + r.errs.join(' | '));
  r = await escenario(b, 'B) Archivo de GitHub fresco (5 min)', { edadArchivo: 5 * 60e3 });
  ok(r.ciudades === 0, `con el archivo fresco no se pide nada a Open-Meteo (${r.ciudades} ciudades pedidas)`);
  ok(r.de10 === CIUDADES.length && /En vivo/.test(r.estado), `todas del archivo (${r.de10}) · estado: «${r.estado}»`);
  // C) El celular tiene datos de hace 10 min (20 °C) y el archivo tiene 7 h: el archivo NO debe pisarlos, y no hace falta pedir nada
  const t10 = Date.now() - 10 * 60e3, g = {}; CIUDADES.forEach(c => { g[c.n] = clima(t10, 20); });
  r = await escenario(b, 'C) Datos guardados de hace 10 min y archivo de 7 h', { edadArchivo: 7 * 3600e3, guardado: { t: t10, datos: g } });
  ok(r.de20 === CIUDADES.length && r.de10 === 0, `el archivo atrasado no pisa los datos más nuevos (${r.de20} siguen; ${r.de10} pisados)`);
  ok(r.ciudades === 0 && r.archivo === 0, `datos al día: no se pide nada (${r.ciudades} a Open-Meteo, ${r.archivo} archivo)`);
  // D) Datos guardados de hace 40 min: se piden solo los vencidos
  const t40 = Date.now() - 40 * 60e3, g2 = {}; CIUDADES.forEach(c => { g2[c.n] = clima(t40, 20); });
  r = await escenario(b, 'D) Datos guardados de hace 40 min y archivo de 7 h', { edadArchivo: 7 * 3600e3, guardado: { t: t40, datos: g2 } });
  ok(r.de30 >= gr && r.de10 === 0, `se renuevan las vencidas (${r.de30} al día; localidades chicas cada ~55 min) y el archivo viejo no pisa nada (${r.de10})`);
  // E) Este dispositivo ya usó 2450 de sus 2500 consultas de la hora: se piden como mucho 50 (más la elegida y las favoritas)
  r = await escenario(b, 'E) Cupo casi agotado (2450 consultas en la última hora)', { edadArchivo: 7 * 3600e3, consultas: 2450 });
  ok(r.ciudades > 0 && r.ciudades <= 51, `respeta el cupo: pidió ${r.ciudades} ciudades (tope 50 + la elegida)`);
  await b.close();
  console.log(fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron');
  process.exit(fallos ? 1 : 0);
})();
