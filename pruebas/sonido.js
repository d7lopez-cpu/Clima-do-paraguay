// Prueba del sonido del clima (no se puede ESCUCHAR aquí: se revisa el grafo de audio por código y se mide la señal).
// Uso: node pruebas/sonido.js <puerto> [--rapida]   (con el proyecto servido en ese puerto)
// Mezcla: cama + ≤ 2 acentos, ducking, limitador, anti-rebote de truenos, música navideña y estallidos.
//  A) datos simulados (datos.json): capas por estado, textos, render sin conexión (OfflineAudioContext) de los 24 estados con picos y
//     sonoridad, volumen, 200 cambios de estado (nodos y automatizaciones acotados), fundidos cruzados, contexto suspendido, pagehide.
//  B) tormenta con granizo (código 96), 33 °C y viento de 45 km/h con el fondo animado apagado: truenos sin encimarse y con ducking.
//  C) calma total (0 km/h): la brisa queda en silencio real.
//  D) música navideña: solo con la decoración activa y pedida, fundidos, ducking del ambiente, notas acotadas, render sin conexión.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const PUERTO = process.argv[2] || '8263', RAPIDA = process.argv.includes('--rapida');
const datos = JSON.parse(fs.readFileSync(path.join(__dirname, 'datos.json'), 'utf8')).datos;
const TIPOS = ['despejado', 'parcial', 'nublado', 'lluvia', 'tormenta', 'niebla'], FASES = ['amanecer', 'dia', 'atardecer', 'noche'];
let fallos = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✔ ' : '  ✘ ') + msg); if (!cond) fallos++; };

function espiar() {                                                 // se inyecta antes que el código de la app
  const E = window.__audio = { contextos: 0, ctx: null, nodos: {}, autom: 0, finales: [] };
  const B = window.BaseAudioContext || window.AudioContext;
  for (const k of Object.getOwnPropertyNames(B.prototype)) {
    if (!/^create/.test(k) || typeof B.prototype[k] !== 'function') continue;
    const orig = B.prototype[k];
    B.prototype[k] = function (...a) { const n = orig.apply(this, a); if (!(this instanceof OfflineAudioContext)) E.nodos[k] = (E.nodos[k] || 0) + 1; return n; };
  }
  for (const k of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime', 'setValueCurveAtTime']) {
    const orig = AudioParam.prototype[k]; if (!orig) continue;
    AudioParam.prototype[k] = function (...a) { E.autom++; return orig.apply(this, a); };
  }
  const con = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...r) { if (dest instanceof AudioDestinationNode && !(this.context instanceof OfflineAudioContext)) E.finales.push(this.constructor.name + (this.threshold ? `(${this.threshold.value}/${this.ratio.value})` : '')); return con.call(this, dest, ...r); };
  const AC = window.AudioContext;
  window.AudioContext = function (...a) { E.contextos++; const c = new AC(...a); E.ctx = c; return c; };
  window.AudioContext.prototype = AC.prototype;
}
async function abrir(b, d, prefs) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-PY', timezoneId: 'America/Asuncion' });
  await ctx.addInitScript(([d, p]) => { localStorage.setItem('clima-py-datos', JSON.stringify({ t: Date.now(), datos: d })); localStorage.setItem('clima-py-anim', JSON.stringify(p)); }, [d, prefs]);
  await ctx.addInitScript(espiar);
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('consola: ' + m.text()); });
  await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
  await page.goto(`http://127.0.0.1:${PUERTO}/`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  return { ctx, page, errs: () => errs.filter(e => !/net::ERR|Failed to load resource/.test(e)) };
}
const estado = p => p.evaluate(() => window.climaSonido.estado());
const espia = p => p.evaluate(() => { const E = window.__audio; return { contextos: E.contextos, nodos: { ...E.nodos }, autom: E.autom, finales: E.finales.slice() }; });
const totalNodos = s => Object.values(s.nodos).reduce((a, b) => a + b, 0);
const fijar = (p, v) => p.evaluate(v => window.climaAnim.fijar(v), v);
// Render sin conexión del estado actual: pico (dBFS) y sonoridad aprox. (LUFS, ponderación K de BS.1770 para 48 kHz) desde `desde` s
const renderizar = (p, seg, desde, fn = 'renderizar') => p.evaluate(async ([seg, desde, fn]) => {
  const buf = await window.climaSonido[fn](seg), sr = buf.sampleRate, i0 = Math.round(desde * sr);
  let pico = 0, k = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const x = buf.getChannelData(c);
    for (let i = i0; i < x.length; i++) if (Math.abs(x[i]) > pico) pico = Math.abs(x[i]);
    // ponderación K: estante (etapa 1) y paso alto RLB (etapa 2), coeficientes de BS.1770 para 48 kHz
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    let a1 = 0, a2 = 0, b1 = 0, b2 = 0, s = 0; const st = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) { const v = x[i], y = 1.53512485958697 * v - 2.69169618940638 * x1 + 1.19839281085285 * x2 + 1.69065929318241 * y1 - 0.73248077421585 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; st[i] = y; }
    for (let i = 0; i < x.length; i++) { const v = st[i], z = v - 2 * a1 + a2 + 1.99004745483398 * b1 - 0.99007225036621 * b2; a2 = a1; a1 = v; b2 = b1; b1 = z; if (i >= i0) s += z * z; }
    k += s / (x.length - i0);
  }
  return { pico: pico ? +(20 * Math.log10(pico)).toFixed(1) : -200, lufs: +(-0.691 + 10 * Math.log10(k + 1e-20)).toFixed(1), truenos: buf.info ? buf.info.truenos : null, descartados: buf.info ? buf.info.descartados : null, info: buf.info };
}, [seg, desde, fn]);
// palabras que el texto usa para cada capa (para comprobar que describe exactamente lo que suena)
const PALABRA = { viento: /brisa|\bviento\b(?! fuerte de)|viento fuerte/, lluvia: /lluvia fuerte|aguacero|gotas/, grillos: /grillos/, aves: /aves/, ranas: /ranas/, rafagas: /ráfagas/, chicharras: /chicharras/, granizo: /granizo/, truenos: /truenos/ };

(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

  console.log('A) Datos simulados de hoy');
  let { ctx, page, errs } = await abrir(b, datos, { volumen: 0.6 });
  for (const tipo of ['tormenta', 'lluvia', 'despejado']) await fijar(page, { vistaPrevia: { tipo, fase: 'noche' } });
  ok((await espia(page)).contextos === 0 && (await estado(page)) === null, 'sin tocar 🔈 no se crea ningún AudioContext (nunca suena solo)');
  await page.click('#btnSonido'); await page.waitForTimeout(1500);
  let e = await estado(page), s = await espia(page);
  ok(e && e.sonando && s.contextos === 1 && e.contexto === 'running', `al tocar 🔈 se crea UN contexto y suena (estado ${e && e.contexto})`);
  ok(Math.abs(e.ganancias.master - 0.6) < 0.02, `ganancia maestra real con volumen 0,6 = ${e.ganancias.master} (≤ 1)`);
  ok(s.finales.length === 1 && /^DynamicsCompressorNode/.test(s.finales[0]) && e.limitador.umbral <= -3 && e.limitador.ratio >= 12, `la cadena termina en un limitador: ${s.finales.join(', ')}`);

  // Escena de los 24 estados: capas audibles y coherencia del texto
  const filas = [];
  for (const tipo of TIPOS) for (const fase of FASES) {
    await fijar(page, { vistaPrevia: { tipo, fase } });
    const x = await estado(page);
    filas.push({ tipo, fase, x });
  }
  const amb = await page.evaluate(() => window.climaAnim.estado());
  console.log(`  ciudad simulada: ${amb.temp} °C, ${amb.viento} km/h`);
  for (const r of filas) console.log(`    ${r.tipo.padEnd(9)} ${r.fase.padEnd(9)} cama ${r.x.cama.padEnd(7)} acentos ${(r.x.acentos.join('+') || '-').padEnd(16)} «${r.x.descripcion}»`);
  ok(filas.every(r => r.x.audibles.length <= 3 && r.x.acentos.length <= 2), `como mucho 1 cama + 2 acentos (máx. ${Math.max(...filas.map(r => r.x.audibles.length))} capas audibles)`);
  const incoherentes = filas.filter(r => {
    const d = r.x.descripcion, aud = r.x.audibles;
    if ((d.match(/ y /g) || []).length > 1) return true;
    for (const [c, re] of Object.entries(PALABRA)) if (re.test(d) !== aud.includes(c)) return true;
    return false;
  });
  ok(!incoherentes.length, 'el texto nombra exactamente las capas que suenan y sin «y … y»' + (incoherentes.length ? ': ' + incoherentes.map(r => `${r.tipo}/${r.fase} «${r.x.descripcion}» [${r.x.audibles}]`).join(' | ') : ''));
  const f = (t, fa) => filas.find(r => r.tipo === t && r.fase === fa).x;
  ok(f('despejado', 'noche').audibles.includes('grillos') && !f('lluvia', 'noche').audibles.includes('grillos') && !f('despejado', 'dia').audibles.includes('grillos'), 'grillos: en noches despejadas, no con lluvia ni de día');
  ok(['aves', 'ranas', 'grillos', 'chicharras'].every(c => !f('tormenta', 'dia').audibles.includes(c) && !f('tormenta', 'noche').audibles.includes(c)), 'tormenta: sin aves, ranas ni insectos (la lluvia fuerte los saca)');
  ok(f('despejado', 'atardecer').capas.aves > f('despejado', 'dia').capas.aves, 'coro de aves en la hora dorada');
  ok(filas.every(r => r.x.capas.granizo === false), 'sin granizo con la vista previa (el código real no es 96/99)');

  // Render sin conexión (OfflineAudioContext) con volumen 1, el peor caso: picos y sonoridad por estado
  await fijar(page, { volumen: 1 });
  const lista = RAPIDA ? [['despejado', 'dia'], ['despejado', 'noche'], ['lluvia', 'dia'], ['tormenta', 'noche'], ['niebla', 'noche']] : TIPOS.flatMap(t => FASES.map(fa => [t, fa]));
  const med = [];
  for (const [tipo, fase] of lista) {
    await fijar(page, { vistaPrevia: { tipo, fase } });
    const m = await renderizar(page, 10, 3.5); med.push({ tipo, fase, ...m });
  }
  console.log('  render sin conexión, volumen 1 (de 3,5 a 10 s): estado → LUFS aprox., pico dBFS');
  for (const m of med) console.log(`    ${m.tipo.padEnd(9)} ${m.fase.padEnd(9)} ${String(m.lufs).padStart(6)} LUFS  pico ${String(m.pico).padStart(6)}${m.tipo === 'tormenta' ? `  truenos ${m.truenos} (descartados por anti-rebote ${m.descartados})` : ''}`);
  const L = med.map(m => m.lufs);
  ok(Math.max(...med.map(m => m.pico)) < -1, `sin saturar: pico máximo ${Math.max(...med.map(m => m.pico))} dBFS (< −1)`);
  ok(Math.max(...L) - Math.min(...L) <= 7, `sonoridad pareja entre estados: ${Math.min(...L)} a ${Math.max(...L)} LUFS (rango ${(Math.max(...L) - Math.min(...L)).toFixed(1)} dB, tope 7)`);
  const tor = med.filter(m => m.tipo === 'tormenta');
  ok(tor.every(m => m.truenos === 1 && m.descartados >= 1), 'render de tormenta: el segundo pedido de trueno a 0,5 s del primero se descarta (un solo trueno)');
  await fijar(page, { volumen: 0.6 });

  // Volumen
  await fijar(page, { volumen: 0.2 }); await page.waitForTimeout(800);
  e = await estado(page); ok(Math.abs(e.ganancias.master - 0.2) < 0.02 && Math.abs(e.volumen - 0.2) < 1e-9, `volumen 0,2 → ganancia maestra ${e.ganancias.master}`);
  await fijar(page, { volumen: 0 }); await page.waitForTimeout(800);
  ok((await estado(page)).ganancias.master < 0.01, 'volumen 0 → silencio');
  await fijar(page, { volumen: 1 }); await page.waitForTimeout(800);
  ok(Math.abs((await estado(page)).ganancias.master - 1) < 0.02, 'volumen 1 → ganancia maestra 1 (nunca más)');
  const antesVol = await espia(page);
  await page.evaluate(() => { for (let i = 0; i <= 100; i++) window.climaAnim.fijar({ volumen: i / 100 }); });
  const despVol = await espia(page);
  ok(despVol.autom - antesVol.autom < 400 && totalNodos(despVol) - totalNodos(antesVol) < 60, `mover el volumen 100 veces: ${despVol.autom - antesVol.autom} automatizaciones, ${totalNodos(despVol) - totalNodos(antesVol)} nodos (solo sonidos sueltos)`);
  await fijar(page, { volumen: 0.6 });

  // Fundido cruzado: de noche despejada (grillos) a lluvia de día
  await fijar(page, { vistaPrevia: { tipo: 'despejado', fase: 'noche' } }); await page.waitForTimeout(4500);
  const g0 = (await estado(page)).ganancias;
  await fijar(page, { vistaPrevia: { tipo: 'lluvia', fase: 'dia' } });
  await page.waitForTimeout(1200); const g1 = (await estado(page)).ganancias;
  await page.waitForTimeout(3000); const g2 = (await estado(page)).ganancias;
  ok(g1.grillos > 0 && g1.grillos < g0.grillos && g1.lluvia > 0 && g2.grillos === 0 && g2.lluvia > g1.lluvia,
    `fundido cruzado de 2,5–3,5 s: grillos ${g0.grillos} → ${g1.grillos} (1,2 s) → ${g2.grillos} (4,2 s); lluvia → ${g1.lluvia} → ${g2.lluvia}`);

  // 200 cambios de estado seguidos: nada se acumula
  await fijar(page, { vistaPrevia: { tipo: 'despejado', fase: 'noche' } }); await page.waitForTimeout(4000);
  const ritmo = async ms => { const a = await espia(page); await page.waitForTimeout(ms); const z = await espia(page); return { nodos: totalNodos(z) - totalNodos(a), autom: z.autom - a.autom }; };
  const base = await ritmo(5000);
  const a0 = await espia(page);
  await page.evaluate(() => { for (let i = 0; i < 200; i++) window.climaAnim.fijar({ vistaPrevia: { tipo: ['despejado', 'parcial', 'nublado', 'lluvia', 'tormenta', 'niebla'][i % 6], fase: ['amanecer', 'dia', 'atardecer', 'noche'][(i * 7) % 4] } }); window.climaAnim.fijar({ vistaPrevia: { tipo: 'despejado', fase: 'noche' } }); });
  const a1 = await espia(page);
  await page.waitForTimeout(6000);
  const luego = await ritmo(5000);
  e = await estado(page);
  console.log(`  en 5 s de noche despejada: antes ${base.nodos} nodos / ${base.autom} automatizaciones; después de 200 cambios ${luego.nodos} / ${luego.autom}; durante los 200 cambios ${a1.autom - a0.autom} automatizaciones y ${totalNodos(a1) - totalNodos(a0)} nodos`);
  ok(a1.contextos === 1 && (a1.nodos.createConvolver || 0) === (a0.nodos.createConvolver || 0), '200 cambios: un solo contexto y ninguna capa fija nueva');
  ok((a1.autom - a0.autom) / 201 < 60 && totalNodos(a1) - totalNodos(a0) < 50, `200 cambios: ${((a1.autom - a0.autom) / 201).toFixed(1)} automatizaciones por cambio (tope 60), nodos casi sin crecer`);
  ok(luego.nodos <= base.nodos * 2 + 40 && luego.autom <= base.autom * 2 + 40, 'después de los cambios el ritmo de nodos y automatizaciones vuelve al de antes (no queda nada acumulado)');
  ok(e.fuentesSueltas <= 150, `sonidos sueltos vivos acotados (${e.fuentesSueltas} ≤ 150)`);

  // Contexto suspendido (p. ej. iOS lo interrumpe) con el sonido «encendido»: no se crea nada
  await fijar(page, { vistaPrevia: { tipo: 'lluvia', fase: 'noche' } }); await page.waitForTimeout(500);
  await page.evaluate(() => window.__audio.ctx.suspend()); await page.waitForTimeout(300);
  const sus = await ritmo(3000);
  ok(sus.nodos === 0, `con el contexto suspendido no se crean sonidos sueltos (${sus.nodos} nodos en 3 s)`);
  await page.evaluate(() => window.__audio.ctx.resume());

  // Estallido de fuegos artificiales (para el paisaje): anti-ráfaga de 250 ms
  const ex = await page.evaluate(() => [window.climaSonido.estallido(0.8), window.climaSonido.estallido(0.8)]);
  ok(ex[0] === true && ex[1] === false, `estallido: el primero suena y el segundo inmediato se descarta (${ex})`);
  // pagehide: el audio se libera y el botón queda apagado; al volver a tocarlo suena otra vez
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  const btn = await page.evaluate(() => { const b = document.getElementById('btnSonido'); return { t: b.textContent, p: b.getAttribute('aria-pressed') }; });
  ok(btn.p === 'false' && (await estado(page)) === null, `tras pagehide el botón queda apagado (aria-pressed ${btn.p}) y el audio liberado`);
  await page.click('#btnSonido'); await page.waitForTimeout(800);
  e = await estado(page); ok(e && e.sonando && e.contexto === 'running', 'al volver a tocar 🔈 suena con un contexto nuevo');
  await page.click('#btnSonido'); await page.waitForTimeout(4200);
  e = await estado(page); ok(!e.sonando && e.contexto === 'suspended', `al apagar, el contexto se suspende (${e.contexto})`);
  ok(!errs().length, 'sin errores de JS' + (errs().length ? ': ' + errs().join(' | ') : ''));
  await ctx.close();

  console.log('B) Tormenta con granizo (código 96), 33 °C, viento 45 km/h, fondo animado apagado');
  const d2 = {}; for (const [n, v] of Object.entries(datos)) d2[n] = { ...v, weather_code: 96, temperature_2m: 33, wind_speed_10m: 45, precipitation: 6 };
  ({ ctx, page, errs } = await abrir(b, d2, { volumen: 0.6, fondo: false }));
  await page.click('#btnSonido'); await page.waitForTimeout(500);
  e = await estado(page);
  ok(e.audibles.includes('granizo') && /granizo/i.test(e.descripcion) && e.acentos.length <= 2, `granizo activo y descrito: «${e.descripcion}» [${e.audibles}]`);
  // Se vigila el ducking y los truenos simultáneos cada 100 ms; el paisaje (si se ve) y la reserva piden truenos a la vez
  const seg = RAPIDA ? 30 : 50;
  const vig = await page.evaluate(async seg => {
    const r = { maxT: 0, minCama: 1, minAc: 1, conTrueno: 0, recuperado: false, total: 0, desc: 0 };
    let ultTrueno = -1;
    for (let i = 0; i < seg * 10; i++) {
      await new Promise(z => setTimeout(z, 100));
      const e = window.climaSonido.estado();
      r.maxT = Math.max(r.maxT, e.truenos);
      if (e.truenos) { r.conTrueno++; r.minCama = Math.min(r.minCama, e.ducking.cama); r.minAc = Math.min(r.minAc, e.ducking.acentos); ultTrueno = i; }
      else if (ultTrueno >= 0 && i - ultTrueno > 30 && e.ducking.cama > 0.97 && e.ducking.acentos > 0.97) r.recuperado = true;
      r.total = e.truenosTotal; r.desc = e.truenosDescartados;
    }
    return r;
  }, seg);
  ok(vig.total > 0, `con el fondo animado apagado igual llegan truenos (${vig.total} en ${seg} s; ${vig.desc} pedidos descartados por el anti-rebote)`);
  ok(vig.maxT <= 1, `nunca hay dos truenos encimados (máx. simultáneos ${vig.maxT})`);
  ok(vig.minCama < 0.6 && vig.minAc < 0.35 && vig.recuperado, `ducking durante el trueno: cama hasta ${vig.minCama}, acentos hasta ${vig.minAc}; luego vuelven a 1 (${vig.recuperado})`);
  await fijar(page, { vistaPrevia: { tipo: 'despejado', fase: 'dia' } }); await page.waitForTimeout(3000);
  e = await estado(page);
  ok(e.audibles.includes('chicharras') && !e.audibles.includes('granizo') && e.ganancias.truenos < 0.05 && e.ducking.cama > 0.97, `vista previa despejado/día con 33 °C en noviembre → «${e.descripcion}» [${e.audibles}], truenos apagados`);
  await fijar(page, { vistaPrevia: { tipo: 'despejado', fase: 'noche' } });
  e = await estado(page);
  ok(e.cama === 'grillos' && !e.audibles.includes('chicharras'), `noche despejada → «${e.descripcion}» [${e.audibles}]`);
  await fijar(page, { vistaPrevia: { fase: 'noche' } });
  ok((await estado(page)).capas.granizo === true, 'vista previa que solo cambia la hora conserva el granizo real');
  ok(!errs().length, 'sin errores de JS' + (errs().length ? ': ' + errs().join(' | ') : ''));
  await ctx.close();

  console.log('C) Calma total: 0 km/h');
  const d3 = {}; for (const [n, v] of Object.entries(datos)) d3[n] = { ...v, weather_code: 0, wind_speed_10m: 0, temperature_2m: 22 };
  ({ ctx, page, errs } = await abrir(b, d3, { volumen: 0.6 }));
  await page.click('#btnSonido');
  await fijar(page, { vistaPrevia: { tipo: 'despejado', fase: 'dia' } }); await page.waitForTimeout(4500);
  e = await estado(page);
  ok(e.ganancias.viento === 0 && e.ganancias.rafagas === 0 && !/brisa|viento|ráfagas/.test(e.descripcion), `sin viento la brisa calla del todo (ganancia ${e.ganancias.viento}) y el texto no la nombra: «${e.descripcion}»`);
  await fijar(page, { vistaPrevia: { tipo: 'niebla', fase: 'noche' } }); await page.waitForTimeout(4500);
  e = await estado(page);
  ok(e.ganancias.viento === 0 && e.cama === 'calma', `niebla nocturna en calma: «${e.descripcion}» [${e.audibles}]`);
  ok(!errs().length, 'sin errores de JS' + (errs().length ? ': ' + errs().join(' | ') : ''));
  await ctx.close();

  console.log('D) Música navideña');
  ({ ctx, page, errs } = await abrir(b, datos, { volumen: 0.6 }));
  const mus = () => page.evaluate(() => { const e = window.climaSonido.estado(); return e && { ...e.musica, contexto: e.contexto, g: e.ganancias }; });
  await page.evaluate(() => localStorage.setItem('clima-py-navidad-musica', 'quizás'));
  ok(await page.evaluate(() => document.documentElement.classList.contains('navidad')) === false, 'hoy (noviembre) la decoración automática no está activa');
  let suena = await page.evaluate(() => window.climaSonido.musicaNavidad(true));
  ok(suena === false && (await espia(page)).contextos === 0 && await page.evaluate(() => localStorage.getItem('clima-py-navidad-musica')) === 'si', 'sin decoración navideña la música no suena ni crea audio (la preferencia sí queda en «si»)');
  await page.evaluate(() => window.climaSonido.musicaNavidad(false));
  await page.evaluate(() => { localStorage.setItem('clima-py-navidad', 'si'); });
  await ctx.close();
  ({ ctx, page, errs } = await abrir(b, datos, { volumen: 0.6 }));
  await page.evaluate(() => { localStorage.setItem('clima-py-navidad', 'si'); localStorage.setItem('clima-py-navidad-musica', 'no'); });
  await page.reload(); await page.waitForTimeout(2000);
  ok(await page.evaluate(() => document.documentElement.classList.contains('navidad')), 'con la decoración en «Siempre», <html class="navidad">');
  await page.mouse.click(5, 5); await page.waitForTimeout(300);
  ok((await espia(page)).contextos === 0, 'con la preferencia en «no», tocar la página no hace sonar nada');
  suena = await page.evaluate(() => window.climaSonido.musicaNavidad(true)); await page.waitForTimeout(2200);
  let m = await mus();
  ok(suena && m.suena && m.contexto === 'running' && Math.abs(m.g.musica - 1.8) < 0.05 && m.g.ambiente === 0 && Math.abs(m.g.master - 0.6) < 0.02, `musicaNavidad(true): suena «${m.cancion}», música ${m.g.musica} (fundido de 1,5 s), ambiente ${m.g.ambiente}, maestra ${m.g.master}`);
  await page.click('#btnSonido'); await page.waitForTimeout(2000);
  m = await mus();
  ok(Math.abs(m.g.ambiente - 0.32) < 0.02 && Math.abs(m.g.musica - 1.8) < 0.05, `con el sonido del clima a la vez, el ambiente baja a ${m.g.ambiente} (≈ −10 dB) y la música sigue al frente`);
  // notas y nodos acotados mientras suena
  const n0 = await espia(page); const vivasM = [];
  for (let i = 0; i < 10; i++) { await page.waitForTimeout(1000); vivasM.push((await mus()).notasVivas); }
  const n1 = await espia(page); const vivasM2 = [];
  for (let i = 0; i < 10; i++) { await page.waitForTimeout(1000); vivasM2.push((await mus()).notasVivas); }
  const n2 = await espia(page);
  console.log(`  notas vivas por segundo: ${vivasM.join(' ')} | ${vivasM2.join(' ')}; osciladores creados: ${(n1.nodos.createOscillator || 0) - (n0.nodos.createOscillator || 0)} y ${(n2.nodos.createOscillator || 0) - (n1.nodos.createOscillator || 0)} por tanda de 10 s`);
  ok(Math.max(...vivasM, ...vivasM2) <= 48, 'notas vivas siempre ≤ 48 (las programa por tandas y se liberan solas)');
  // encender y apagar 48 veces seguidas: un solo programador (no se duplican las notas)
  // 48 cambios: 24 apagados avanzan 24 canciones (múltiplo de 4), así se compara con la misma canción
  await page.evaluate(async () => { for (let i = 0; i < 48; i++) await window.climaSonido.musicaNavidad(i % 2 === 1); });
  await page.waitForTimeout(1500);
  const r0 = await espia(page); await page.waitForTimeout(10000); const r1 = await espia(page);
  const osc = (r1.nodos.createOscillator || 0) - (r0.nodos.createOscillator || 0), oscAntes = (n2.nodos.createOscillator || 0) - (n1.nodos.createOscillator || 0);
  ok((await mus()).suena && osc < oscAntes * 1.8 + 60, `48 encendidos y apagados seguidos: sigue un solo programador (${osc} osciladores en 10 s, antes ${oscAntes})`);
  await page.click('#btnSonido'); await page.waitForTimeout(500);
  // pestaña oculta
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(500); m = await mus();
  ok(m.contexto === 'suspended', `con la pestaña oculta la música se pausa (${m.contexto})`);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(800); m = await mus();
  ok(m.contexto === 'running' && m.suena, 'al volver, sigue');
  // la decoración se apaga: la música la sigue
  await page.evaluate(() => document.documentElement.classList.remove('navidad')); await page.waitForTimeout(2000);
  m = await mus();
  ok(!m.suena && m.g.musica < 0.05 && m.pedida, `al quitarse la decoración la música se apaga con fundido (${m.g.musica}) y la preferencia se conserva`);
  await page.evaluate(() => document.documentElement.classList.add('navidad')); await page.waitForTimeout(300);
  ok((await mus()).suena, 'al volver la decoración, vuelve la música');
  await page.evaluate(() => window.climaSonido.musicaNavidad(false)); await page.waitForTimeout(4500);
  m = await mus();
  ok(!m.suena && m.g.musica < 0.01 && m.contexto === 'suspended' && await page.evaluate(() => localStorage.getItem('clima-py-navidad-musica')) === 'no', `musicaNavidad(false): se apaga, el contexto se suspende (${m.contexto}) y queda «no»`);
  // preferencia guardada en «si»: vuelve con el primer toque de la visita
  await page.evaluate(() => localStorage.setItem('clima-py-navidad-musica', 'si')); await page.reload(); await page.waitForTimeout(2000);
  ok((await espia(page)).contextos === 0, 'al abrir con la preferencia en «si» no suena nada antes de un gesto');
  await page.mouse.click(5, 5); await page.waitForTimeout(800);
  ok((await mus() || {}).suena === true, 'con el primer toque de la visita, la música vuelve');
  // render sin conexión: un ciclo entero de las 4 canciones con volumen 1
  await fijar(page, { volumen: 1 });
  const rm = await renderizar(page, 120, 0, 'renderizarMusica');
  console.log(`  render sin conexión de la música (120 s, volumen 1): ${rm.lufs} LUFS aprox., pico ${rm.pico} dBFS, ${rm.info.notas} notas, ${rm.info.canciones} canciones completas`);
  ok(rm.pico < -1 && rm.lufs > -30 && rm.info.canciones >= 2, 'la música no satura y tiene un nivel parecido al del ambiente');
  ok(!errs().length, 'sin errores de JS' + (errs().length ? ': ' + errs().join(' | ') : ''));
  await ctx.close(); await b.close();
  console.log(fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron');
  process.exit(fallos ? 1 : 0);
})();
