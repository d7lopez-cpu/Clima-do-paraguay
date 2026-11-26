// Mide el contraste REAL de cada texto e ícono de Clima PY (WCAG AA), con colores computados y el fondo tal como se pinta.
// Uso: node pruebas/contraste.js <puerto>
// Método: 1) captura normal; 2) captura con todo el texto y los íconos transparentes (queda solo el fondo);
// 3) para cada elemento con texto propio (o ícono .i), el color del texto se compone sobre los píxeles del fondo de su caja
//    y se toma el peor caso razonable (percentil 10 del contraste). AA: 4,5 (texto normal), 3 (texto grande y íconos).
// Es una medición aproximada: los valores muy bajos (< 1,5) conviene mirarlos en la captura antes de darlos por ciertos.
// Animaciones apagadas (✨ off + reducir movimiento) para que las dos capturas coincidan.
const { crear, chromium } = require('./comun');
// el proyecto es la carpeta de arriba (la raíz del repositorio)
const REPO = require('path').join(__dirname, '..');
const [PUERTO = '8261'] = process.argv.slice(2);
const { abrir } = crear(REPO);


async function cargarFondo(p) {
  // Decodifica la captura en el propio navegador y la deja en window.__fondo (no se pasan millones de números a Node)
  const b64 = (await p.screenshot({ fullPage: false })).toString('base64');
  return p.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    window.__fondo = { w: img.width, h: img.height, d: x.getImageData(0, 0, img.width, img.height).data };
    return img.width;
  }, b64);
}

async function medir(p, nombre) {
  await p.evaluate(() => { scrollTo(0, 0); });
  const resultados = [];
  // se mide por tramos de pantalla para cubrir toda la página
  const altoTotal = await p.evaluate(() => document.documentElement.scrollHeight), vh = await p.evaluate(() => innerHeight);
  const conDialogo = await p.evaluate(() => !!document.querySelector('dialog[open]'));
  for (let y0 = 0; y0 < (conDialogo ? 1 : altoTotal); y0 += vh) {
    await p.evaluate(y => scrollTo(0, y), y0); await p.waitForTimeout(150);
    const objetivos = await p.evaluate(() => {
      const out = [];
      const visible = e => { const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.05; };
      // cualquier color CSS (oklch, color-mix…) → [r, g, b, a] dibujándolo en un lienzo de 1 px
      const lz = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const aRGB = c => { lz.clearRect(0, 0, 1, 1); lz.fillStyle = '#000'; lz.fillStyle = c; lz.fillRect(0, 0, 1, 1); const d = lz.getImageData(0, 0, 1, 1).data; return d[3] ? [d[0] * 255 / d[3], d[1] * 255 / d[3], d[2] * 255 / d[3], d[3] / 255].map((v, i) => i < 3 ? Math.min(255, v) : v) : [0, 0, 0, 0]; };
      const dlg = document.querySelector('dialog[open]');
      for (const e of (dlg || document.body).querySelectorAll('*')) {
        if (!e.matches('svg.ic') && e.closest('svg, canvas, script, style, .sr-only, [aria-hidden=true], #iconos')) continue;
        if (e.matches('svg.ic') && e.closest('#iconos, .sr-only')) continue;
        const esIcono = e.matches('svg.ic');
        const texto = [...e.childNodes].some(n => n.nodeType === 3 && /[A-Za-zÁ-ú0-9°]/.test(n.nodeValue));
        if (!esIcono && !texto) continue;
        let x = e, ok = true; while (x && x !== document.body) { if (!visible(x)) { ok = false; break; } x = x.parentElement; }
        if (!ok) continue;
        // caja visible: recortada por los ancestros con desplazamiento/recorte propio (lista, fila de horas, cuerpo del panel)
        const q = e.getBoundingClientRect(), r = { left: q.left, top: q.top, right: q.right, bottom: q.bottom };
        for (let y = e.parentElement; y && y !== document.documentElement; y = y.parentElement) {
          const sy = getComputedStyle(y); if (sy.overflowX === 'visible' && sy.overflowY === 'visible') continue;
          const c = y.getBoundingClientRect(); r.left = Math.max(r.left, c.left); r.top = Math.max(r.top, c.top); r.right = Math.min(r.right, c.right); r.bottom = Math.min(r.bottom, c.bottom);
        }
        r.width = r.right - r.left; r.height = r.bottom - r.top;
        if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
        // tapado por otro elemento (barra inferior, cuadros flotantes): se salta
        const top = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
        if (!top || !(e.contains(top) || top.contains(e))) continue;
        const s = getComputedStyle(e), m = aRGB(s.color);
        const tam = parseFloat(s.fontSize), peso = parseInt(s.fontWeight, 10);
        const grande = tam >= 24 || (tam >= 18.66 && peso >= 700);
        const desc = (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.getAttribute('class') ? '.' + e.getAttribute('class').trim().split(/\s+/).join('.') : '') + (esIcono && e.parentElement ? ' en ' + (e.parentElement.getAttribute('class') || e.parentElement.tagName.toLowerCase()) : '')) +
          (texto ? ' «' + e.textContent.trim().slice(0, 28) + '»' : '');
        // opacidad acumulada (botones deshabilitados, etc.)
        let op = 1; for (let y = e; y; y = y.parentElement) op *= parseFloat(getComputedStyle(y).opacity);
        out.push({ desc, color: m, op, minimo: esIcono || grande ? 3 : 4.5, caja: [Math.max(0, r.left), Math.max(0, r.top), Math.min(innerWidth, r.right), Math.min(innerHeight, r.bottom)], deshab: !!e.closest(':disabled') });
      }
      return out;
    });
    await p.addStyleTag({ content: '/*sin-texto*/ * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } .ic { stroke: transparent !important; --ic-2: transparent !important; } .ic path { fill: transparent !important; } input::placeholder { color: transparent !important; }' });
    await p.waitForTimeout(60);
    await cargarFondo(p);
    await p.evaluate(() => [...document.querySelectorAll('style')].filter(x => x.textContent.startsWith('/*sin-texto*/')).forEach(x => x.remove()));
    const medidos = await p.evaluate(objetivos => {
      const F = window.__fondo, dpr = F.w / innerWidth;
      const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      return objetivos.filter(o => !o.deshab).map(o => {
        const [x0, y0, x1, y1] = o.caja.map(v => Math.round(v * dpr)), cs = [];
        const paso = Math.max(1, Math.floor(Math.min(x1 - x0, y1 - y0) / 6));
        for (let y = y0; y < y1; y += paso) for (let x = x0; x < x1; x += paso) {
          const i = (y * F.w + x) * 4, bg = [F.d[i], F.d[i + 1], F.d[i + 2]];
          const a = (o.color[3] ?? 1) * o.op, fg = o.color.slice(0, 3).map((c, k) => c * a + bg[k] * (1 - a));
          cs.push(ratio(fg, bg));
        }
        if (!cs.length) return null;
        cs.sort((a, b) => a - b);
        return { desc: o.desc, minimo: o.minimo, peor: cs[Math.floor(cs.length * 0.1)] };
      }).filter(Boolean);
    }, objetivos);
    resultados.push(...medidos);
  }
  const malos = resultados.filter(r => r.peor < r.minimo);
  const unicos = new Map(); for (const r of malos) if (!unicos.has(r.desc)) unicos.set(r.desc, r);
  console.log(`\n== ${nombre}: ${resultados.length} textos/íconos medidos, ${unicos.size} por debajo de AA`);
  [...unicos.values()].sort((a, b) => a.peor - b.peor).slice(0, 25).forEach(r => console.log(`  ${r.peor.toFixed(2)} < ${r.minimo}  ${r.desc}`));
  return unicos.size;
}

(async () => {
  const b = await chromium.launch();
  let total = 0;
  const base = { movimiento: 'reduce', extra: { 'clima-py-fx': '0' }, espera: 2500 };
  for (const [nombre, op, accion] of [
    ['escritorio oscuro', { tema: 'oscuro' }],
    ['escritorio claro', { tema: 'claro' }],
    ['celular oscuro', { celular: true, tema: 'oscuro' }],
    ['celular claro', { celular: true, tema: 'claro' }],
    ['navidad oscuro', { tema: 'oscuro', navidad: 'si' }],
    ['navidad claro', { tema: 'claro', navidad: 'si' }],
    ['panel oscuro (vista previa)', { tema: 'oscuro' }, async p => { await p.click('#btnAjustesAnim'); await p.click('input[name=daTipo][value=lluvia]'); }],
    ['panel claro', { tema: 'claro' }, async p => { await p.click('#btnAjustesAnim'); }],
    ['panel Navidad oscuro', { tema: 'oscuro', navidad: 'si' }, async p => { await p.click('#btnAjustesAnim'); await p.click('#daTabNavidad'); }],
    ['panel Navidad claro', { tema: 'claro', navidad: 'si' }, async p => { await p.click('#btnAjustesAnim'); await p.click('#daTabNavidad'); }],
    ['panel Sonido claro', { tema: 'claro' }, async p => { await p.click('#btnAjustesAnim'); await p.click('#daTabSonido'); }],
  ]) {
    const { ctx, p } = await abrir(b, PUERTO, { ...base, ...op });
    if (accion) { await accion(p); await p.waitForTimeout(300); }
    total += await medir(p, nombre);
    await ctx.close();
  }
  console.log(`\nTOTAL por debajo de AA: ${total}`);
  await b.close();
})();
