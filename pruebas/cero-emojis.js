// Comprueba que NO quede ningún emoji (ni símbolos usados como íconos: ★ ☆ ● ▶ ⏸ Ⅱ ✕ ⟲ ⚙) en la interfaz de Clima PY,
// en todos los estados: español y guaraní, oscuro y claro, Navidad, panel ⚙️ (cada pestaña), comparar, búsqueda de lugares,
// pronóstico, error sin internet, mensajes (#aviso), anuncios para lectores de pantalla, título y notificaciones.
// Uso: node pruebas/cero-emojis.js <puerto>
const { crear, chromium, datos } = require('./comun');
// En el celular, idioma, tema, sonido, ajustes y los accesos rápidos están dentro del menú (#btnMenu): si el botón buscado está
// en el menú cerrado, primero se abre (como lo haría una persona).
async function clic(p, sel, op) {
  const enMenu = await p.$eval(sel, e => !!e.closest('#menuPanel') && getComputedStyle(document.getElementById('menuPanel')).display === 'none').catch(() => false);
  if (enMenu) await p.click('#btnMenu');
  return p.click(sel, op);
}
// el proyecto es la carpeta de arriba (la raíz del repositorio)
const REPO = require('path').join(__dirname, '..');
const [PUERTO = '8261'] = process.argv.slice(2);
const { abrir } = crear(REPO);

const INIT = () => {
  window.__textos = [];                                           // todo lo que pase por #aviso, #anuncio y notificaciones
  class N { constructor(t, o) { window.__textos.push('notificación: ' + t + ' | ' + (o && o.body)); } static get permission() { return 'granted'; } static requestPermission() { return Promise.resolve('granted'); } }
  window.Notification = N;
  if (navigator.serviceWorker) navigator.serviceWorker.getRegistration = async () => ({ showNotification: async (t, o) => window.__textos.push('notificación: ' + t + ' | ' + (o && o.body)) });
  document.addEventListener('DOMContentLoaded', () => {
    for (const id of ['aviso', 'anuncio']) {
      const el = document.getElementById(id);
      if (el) new MutationObserver(() => window.__textos.push(id + ': ' + el.textContent)).observe(el, { childList: true, characterData: true, subtree: true });
    }
  });
};
const REVISAR = () => {
  const re = /[\p{Extended_Pictographic}★☆●▶⏸Ⅱ✕⟲⚙️]/u, malos = [];
  const w = document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) { const p = n.parentElement; if (p && (p.closest('script, style') )) continue; if (re.test(n.nodeValue)) malos.push('texto «' + n.nodeValue.trim().slice(0, 60) + '» en ' + (p ? p.tagName + (p.id ? '#' + p.id : '') + (p.className && typeof p.className === 'string' ? '.' + p.className : '') : '?')); }
  for (const el of document.querySelectorAll('*')) {
    for (const a of ['title', 'aria-label', 'placeholder', 'alt', 'content', 'value', 'aria-valuetext']) { const v = el.getAttribute(a); if (v && re.test(v)) malos.push(`${a}="${v}" en ${el.tagName}${el.id ? '#' + el.id : ''}`); }
    for (const ps of ['::before', '::after']) { const c = getComputedStyle(el, ps).content; if (c && c !== 'none' && c !== 'normal' && re.test(c)) malos.push(`${ps} ${c} en ${el.tagName}${el.id ? '#' + el.id : ''}`); }
  }
  if (re.test(document.title)) malos.push('título: ' + document.title);
  for (const t of window.__textos || []) if (re.test(t)) malos.push(t);
  return [...new Set(malos)];
};

(async () => {
  const b = await chromium.launch();
  const fav = 'Pilar', d2 = JSON.parse(JSON.stringify(datos.datos)); d2[fav] = Object.assign({}, d2[fav], { weather_code: 95 });
  const todos = new Map(); let estados = 0;
  for (const idioma of ['es', 'gn']) for (const tema of ['oscuro', 'claro']) {
    const { ctx, p, errs } = await abrir(b, PUERTO, { tema, idioma, navidad: 'si', cambios: { [fav]: { weather_code: 95 } }, extra: { 'clima-py-favs': JSON.stringify([fav]), 'clima-py-avisos': '1' } });
    await ctx.addInitScript(INIT);
    await p.reload({ waitUntil: 'load' }); await p.waitForFunction(() => document.querySelector('#detalle .pestanas'), null, { timeout: 15000 }); await p.waitForTimeout(1200);
    const nota = async nombre => { estados++; for (const m of await p.evaluate(REVISAR)) { if (!todos.has(m)) todos.set(m, `${idioma}/${tema}/${nombre}`); } };
    await nota('inicio');
    for (const t of ['grafico', 'horas']) { await clic(p, `[data-tab="${t}"]`); await nota('pestaña ' + t); }
    await clic(p, '#btnActualizar'); await p.waitForTimeout(2000);
    const notis = await p.evaluate(() => window.__textos.filter(t => t.startsWith('notificación')));
    if (!notis.length) todos.set('no se capturó ninguna notificación (la prueba no las revisó)', `${idioma}/${tema}`); else if (tema === 'oscuro') console.log(`  ${idioma}: ${notis[0]}`);
    await nota('actualizar (notificaciones)');
    await clic(p, '#btnSonido'); await p.waitForTimeout(400); await clic(p, '#btnSonido'); await nota('sonido');
    await clic(p, '#btnRadar'); await p.waitForTimeout(600); await clic(p, '#btnRadarPlay').catch(() => {}); await nota('radar'); await clic(p, '#btnRadar');
    await clic(p, '#hPlay'); await p.waitForTimeout(300); await nota('reproducir'); await clic(p, '#hPlay');
    await clic(p, '#btnComparar'); await p.waitForTimeout(1200); await nota('comparar'); await clic(p, '#compCerrar');
    await p.fill('#buscador', 'Lugar inventado'); await clic(p, '#btnLugar'); await p.waitForTimeout(1200); await nota('buscar lugar'); await p.fill('#buscador', '');
    await clic(p, '#detalle [data-compartir="1"]'); await p.waitForTimeout(300); await nota('compartir');
    await clic(p, '#btnAvisos'); await clic(p, '#btnAvisos'); await nota('avisos');
    await clic(p, '#btnAjustesAnim');
    for (const t of ['Anim', 'Sonido', 'Navidad']) { await clic(p, '#daTab' + t); await nota('panel ' + t); }
    await clic(p, '#daTabAnim'); await clic(p, 'input[name=daTipo][value=tormenta]'); await nota('vista previa');
    await clic(p, '#daRestablecer'); await p.keyboard.press('Escape'); await nota('restablecer');
    await p.route('**/api.open-meteo.com/**', r => new URL(r.request().url()).searchParams.get('daily') ? r.abort() : r.fallback());
    await clic(p, '#lista .item-main[data-ciudad="Ayolas"]'); await p.waitForTimeout(2500); await nota('error sin internet');
    for (const e of errs) todos.set('ERROR JS: ' + e, `${idioma}/${tema}`);
    await ctx.close();
  }
  await b.close();
  console.log(`${estados} estados revisados (español y guaraní, oscuro y claro, Navidad activa)`);
  if (!todos.size) { console.log('✅ Cero emojis en la interfaz'); return; }
  console.log(`❌ ${todos.size} hallazgos:`); for (const [m, d] of todos) console.log(`  [${d}] ${m}`);
  process.exit(1);
})();
