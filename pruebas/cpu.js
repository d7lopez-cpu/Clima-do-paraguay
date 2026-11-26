// Mide cuánto le cuesta al procesador el paisaje sonoro: arma cada escena en un OfflineAudioContext (render sin conexión,
// lo más rápido que se pueda) y cronometra. Menos ms por segundo de audio = más margen en el celular = menos cortes.
// Uso: node pruebas/cpu.js <puerto> [repeticiones]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const PUERTO = process.argv[2] || '8270', REP = +(process.argv[3] || 3);
const datos = JSON.parse(fs.readFileSync(path.join(__dirname, 'datos.json'), 'utf8')).datos;
const ESCENAS = [['despejado', 'noche'], ['despejado', 'dia'], ['lluvia', 'noche'], ['tormenta', 'noche'], ['nublado', 'atardecer']];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ locale: 'es-PY', timezoneId: 'America/Asuncion' });
  await ctx.addInitScript(d => { localStorage.setItem('clima-py-datos', JSON.stringify({ t: Date.now(), datos: d })); }, datos);
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${PUERTO}/`); await page.waitForTimeout(1500);
  const tot = [];
  for (const [tipo, fase] of ESCENAS) {
    await page.evaluate(([tipo, fase]) => window.climaAnim.fijar({ vistaPrevia: { tipo, fase } }), [tipo, fase]); await page.waitForTimeout(300);
    const ms = [];
    for (let i = 0; i < REP; i++) ms.push(await page.evaluate(async () => { const t = performance.now(); await window.climaSonido.renderizar(20); return performance.now() - t; }));
    ms.sort((a, b) => a - b); const med = ms[Math.floor(ms.length / 2)]; tot.push(med);
    console.log(`${(tipo + '-' + fase).padEnd(20)} ${(med / 20).toFixed(1)} ms por segundo de audio`);
  }
  console.log(`PROMEDIO             ${(tot.reduce((a, b) => a + b, 0) / tot.length / 20).toFixed(1)} ms por segundo de audio`);
  await b.close();
})();
