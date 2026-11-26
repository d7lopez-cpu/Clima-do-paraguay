// ¿Las gotas llegan parejas aunque la página se trabe? Con lluvia, se bloquea la página 250 ms cada segundo (como un celular
// ocupado dibujando) y se anota la hora (reloj del audio) a la que quedó programada cada gota. Se informa el hueco más largo entre
// gotas y cuántas caen «para ya» (sin margen: llegan tarde al hilo del audio y su envolvente se corta).
// Uso: node pruebas/tirones.js <puerto> [--sin-trabas]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const PUERTO = process.argv[2] || '8271';
const datos = JSON.parse(fs.readFileSync(path.join(__dirname, 'datos.json'), 'utf8')).datos;
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ locale: 'es-PY', timezoneId: 'America/Asuncion' });
  await ctx.addInitScript(d => { localStorage.setItem('clima-py-datos', JSON.stringify({ t: Date.now(), datos: d })); localStorage.setItem('clima-py-anim', JSON.stringify({ volumen: 0.6 })); }, datos);
  await ctx.addInitScript(() => {
    const E = window.__gotas = [];
    const st = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, off, dur) {
      if (!(this.context instanceof OfflineAudioContext) && !this.loop && dur !== undefined && dur <= 0.13) E.push({ when: when || 0, ahora: this.context.currentTime });
      return st.call(this, when, off, dur);
    };
  });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PUERTO}/`); await page.waitForTimeout(1500);
  await page.evaluate(() => window.climaAnim.fijar({ vistaPrevia: { tipo: 'lluvia', fase: 'dia' } }));
  await page.click('#btnSonido'); await page.waitForTimeout(4000);
  await page.evaluate(t => { window.__gotas.length = 0; window.__traba = t; }, process.argv.includes('--sin-trabas') ? 0 : 250);
  // 12 s con trabones de 250 ms cada segundo
  await page.evaluate(() => new Promise(fin => { let n = 0; const id = setInterval(() => { const t = performance.now(); while (performance.now() - t < (window.__traba ?? 250)) {} if (++n >= 12) { clearInterval(id); fin(); } }, 1000); }));
  const g = await page.evaluate(() => window.__gotas.slice());
  const t = g.map(x => x.when).sort((a, b) => a - b), huecos = t.slice(1).map((x, i) => x - t[i]);
  const tarde = g.filter(x => x.when - x.ahora < 0.01).length;
  const porVentana = {}; for (const x of t) { const k = Math.floor(x * 4); porVentana[k] = (porVentana[k] || 0) + 1; }
  const v = Object.values(porVentana), media = v.reduce((a, b) => a + b, 0) / v.length, desv = Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / v.length);
  console.log(`gotas: ${g.length} · hueco más largo: ${(Math.max(...huecos) * 1000).toFixed(0)} ms · huecos > 200 ms: ${huecos.filter(h => h > 0.2).length} · programadas sin margen: ${tarde} (${(100 * tarde / g.length).toFixed(0)} %) · gotas por 1/4 s: media ${media.toFixed(1)}, desvío ${desv.toFixed(1)}`);
  await b.close();
})();
