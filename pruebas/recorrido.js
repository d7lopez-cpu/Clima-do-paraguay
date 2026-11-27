// Recorrido de TODAS las funciones de Clima PY con Playwright (datos reales de hoy, Open-Meteo simulado).
// Uso: node pruebas/recorrido.js <puerto> [prefijo-capturas]
//   Sirve antes el proyecto: python3 -m http.server <puerto> --bind 127.0.0.1 -d <proyecto>
//   Con prefijo, deja capturas de estados clave en esta carpeta (<prefijo>-*.png).
// Cada paso comprueba algo concreto; al final lista ✅/❌ y los errores de JavaScript. Sale con código 1 si algo falló.
const path = require('path');
const { crear, chromium } = require('./comun');
// el proyecto es la carpeta de arriba (la raíz del repositorio)
const REPO = require('path').join(__dirname, '..');
const [PUERTO = '8261', PRE] = process.argv.slice(2);
const { abrir } = crear(REPO);

const resultados = [];
async function paso(nombre, fn) {
  try { const extra = await fn(); resultados.push([true, nombre, extra || '']); }
  catch (e) { resultados.push([false, nombre, String(e && e.message || e).split('\n')[0].slice(0, 220)]); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const captura = async (p, nombre, op = {}) => { if (PRE) await p.screenshot({ path: path.join(__dirname, `${PRE}-${nombre}.png`), ...op }); };
const capturaEl = async (p, sel, nombre) => { if (PRE) { const e = await p.$(sel); await e.scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await e.screenshot({ path: path.join(__dirname, `${PRE}-${nombre}.png`) }); } };
const texto = (p, sel) => p.$eval(sel, e => e.textContent.trim());
const nombreCiudad = p => texto(p, '#detalle .ciudad-nombre');
const esperarCiudad = (p, n) => p.waitForFunction(n => { const e = document.querySelector('#detalle .ciudad-nombre'); return e && e.textContent.trim() === n && document.querySelector('#detalle .pestanas'); }, n, { timeout: 8000 });
const iconoDe = (p, sel) => p.$eval(sel, e => { const u = e.querySelector('use'); return u ? u.getAttribute('href') : ''; });

(async () => {
  const b = await chromium.launch();
  const todosErrores = [];

  // ===================== ESCRITORIO, MODO OSCURO =====================
  {
    const { ctx, p, errs } = await abrir(b, PUERTO, { tema: 'oscuro' });
    await paso('Carga: detalle, resumen y lista con datos', async () => {
      ok(await p.$('#detalle .pestanas'), 'el detalle no terminó de cargar');
      const n = await p.$$eval('#stats .stat', x => x.length); ok(n === 4, `resumen con ${n} tarjetas`);
      const items = await p.$$eval('#lista .item', x => x.length); ok(items > 10, `lista con ${items} filas`);
      return `${await nombreCiudad(p)}, ${items} filas`;
    });
    await captura(p, 'escritorio-oscuro', { fullPage: true });
    await paso('Índice tereré: nota de 0 a 10, frase y barra', async () => {
      const t = await p.$eval('#terereDato', e => ({ txt: e.innerText, on: e.querySelectorAll('.terere-barra i.on').length, tramos: e.querySelectorAll('.terere-barra i').length }));
      const n = Number((t.txt.match(/(\d+)\/10/) || [])[1]);
      ok(n >= 0 && n <= 10, 'sin nota: ' + t.txt); ok(t.tramos === 10 && t.on === n, `barra ${t.on}/${t.tramos} para nota ${n}`);
      return t.txt.replace(/\s+/g, ' ');
    });

    await paso('Buscar una ciudad (escribir + Enter)', async () => {
      await p.fill('#buscador', 'Encarna');
      await p.waitForTimeout(200);
      const filas = await p.$$eval('#lista .item-main', x => x.map(e => e.dataset.ciudad));
      ok(filas.includes('Encarnación'), 'la lista filtrada no muestra Encarnación');
      await p.press('#buscador', 'Enter'); await esperarCiudad(p, 'Encarnación');
      await p.press('#buscador', 'Escape');
      return `${filas.length} coincidencias`;
    });
    await paso('Elegir una ciudad en la lista', async () => {
      await p.click('#lista .item-main[data-ciudad="Caacupé"]'); await esperarCiudad(p, 'Caacupé');
      ok(await p.$('#lista .item.activo .item-main[data-ciudad="Caacupé"]'), 'la fila elegida no quedó marcada');
    });
    await paso('Elegir una ciudad en el mapa', async () => {
      await p.click('#zReset'); await p.waitForTimeout(700);
      await p.click('#mapa .zona[data-ciudad="Pilar"]', { force: true }); await esperarCiudad(p, 'Pilar');
      const chip = await texto(p, '#chipSel'); ok(/Pilar/.test(chip), 'el chip del mapa no dice Pilar: ' + chip);
    });
    await paso('Elegir desde el resumen nacional', async () => {
      const destino = await p.$eval('#stats button.stat[data-ir]', e => e.dataset.ir);
      await p.click('#stats button.stat[data-ir]'); await esperarCiudad(p, destino); return destino;
    });
    await paso('Favoritas: marcar en el detalle, franja y lista', async () => {
      const n = await nombreCiudad(p);
      await p.click('#detalle .estrella');
      ok(await p.$eval('#detalle .estrella', e => e.classList.contains('on') && e.getAttribute('aria-pressed') === 'true'), 'la estrella del detalle no se encendió');
      ok((await iconoDe(p, '#detalle .estrella')) === '#i-favorito-lleno', 'la estrella no se llenó');
      ok(await p.$eval('#favs', e => !e.hidden), 'la franja de favoritas no apareció');
      ok(await p.$(`#favs .fav-chip[data-ciudad="${n}"]`), 'falta la ficha en la franja');
      ok(await p.$(`#lista .estrella.on[data-fav="${n}"]`), 'la lista no marca la favorita');
      await p.click('#lista .estrella[data-fav="Caacupé"]');
      ok(await p.$('#favs .fav-chip[data-ciudad="Caacupé"]'), 'marcar desde la lista no agregó la ficha');
      await p.click('#favs .fav-chip[data-ciudad="Caacupé"]'); await esperarCiudad(p, 'Caacupé');
      await captura(p, 'favoritas', { clip: { x: 0, y: 0, width: 1366, height: 900 } });
      await p.click('#detalle .estrella'); await p.click(`#lista .estrella[data-fav="${n}"]`);
      ok(await p.$eval('#favs', e => e.hidden), 'al quitar todas, la franja no se ocultó');
    });
    await paso('Pronóstico: horas («Ahora» destacado), gráfico y tarjeta de días', async () => {
      ok(await p.$eval('#pronostico .fila-scroll .mini', e => e.classList.contains('ahora') && /Ahora/.test(e.textContent)), 'la primera hora no es «Ahora» destacada');
      await p.click('[data-tab="grafico"]'); await p.waitForSelector('#pronostico svg.grafico');
      ok(await p.$eval('[data-tab="grafico"]', e => e.getAttribute('aria-selected') === 'true'), 'aria-selected no cambió');
      await capturaEl(p, '#detalle', 'pestana-grafico');
      await p.click('[data-tab="horas"]'); await p.waitForSelector('#pronostico .fila-scroll .mini');
      const dias = await p.$$eval('#dias7 .dia-fila', x => x.length); ok(dias >= 5, `solo ${dias} días`);
      ok(await p.$eval('#dias7 .dia-fila', e => /^Hoy/.test(e.textContent.trim())), 'el primer día no es «Hoy»');
      return `${dias} días en su tarjeta`;
    });
    await paso('Pestañas con teclado (flechas)', async () => {
      await p.focus('[data-tab="horas"]'); await p.keyboard.press('ArrowRight');
      const sel = await p.$eval('#detalle [role=tab][aria-selected=true]', e => e.dataset.tab);
      ok(sel === 'grafico', 'la flecha derecha no pasó a «Gráfico» (está en ' + sel + ')');
      ok(await p.evaluate(() => document.activeElement.dataset.tab === 'grafico'), 'el foco no siguió a la pestaña');
      await p.keyboard.press('End'); ok(await p.$eval('#detalle [role=tab][aria-selected=true]', e => e.dataset.tab) === 'grafico', 'Fin no fue a la última');
      await p.keyboard.press('Home'); ok(await p.$eval('#detalle [role=tab][aria-selected=true]', e => e.dataset.tab) === 'horas', 'Inicio no fue a la primera');
      const tabidx = await p.$$eval('#detalle [role=tab]', x => x.map(e => e.tabIndex).join(','));
      ok(tabidx === '0,-1', 'tabindex itinerante incorrecto: ' + tabidx);
      return 'flechas, Inicio y Fin';
    });
    await paso('Microinteracciones: entrada al cambiar de pestaña y de ciudad', async () => {
      await p.click('[data-tab="grafico"]'); await p.click('[data-tab="horas"]');
      const a1 = await p.evaluate(() => document.getAnimations().filter(a => a.animationName === 'entra').length);
      ok(a1 > 0, 'cambiar de pestaña no animó');
      await p.waitForTimeout(1700);
      ok(await p.$eval('#pronostico .fila-scroll', e => !e.classList.contains('cascada')), 'la clase cascada no se quitó');
      await p.click('#lista .item-main[data-ciudad="Pilar"]');
      const a2 = await p.evaluate(() => document.getAnimations().some(a => a.animationName === 'entra' && a.effect.target.id === 'detalleCab'));
      ok(a2, 'cambiar de ciudad no animó el detalle');
      await esperarCiudad(p, 'Pilar');
      return `${a1} cajitas en cascada`;
    });
    await paso('Comparar ciudades: abrir y cerrar', async () => {
      await p.click('#btnComparar'); await p.waitForFunction(() => !document.getElementById('comparar').hidden);
      await p.waitForFunction(() => document.querySelector('#compRes svg, #compRes table'), null, { timeout: 8000 });
      await capturaEl(p, '#comparar', 'comparar');
      await p.click('#compCerrar'); ok(await p.$eval('#comparar', e => e.hidden), 'no se cerró');
    });
    await paso('Capas del mapa', async () => {
      const capas = await p.$$eval('#capas .capa', x => x.map(e => e.dataset.capa));
      for (const c of capas) {
        await p.click(`#capas .capa[data-capa="${c}"]`);
        ok(await p.$eval(`#capas .capa[data-capa="${c}"]`, e => e.classList.contains('on')), 'capa no activa: ' + c);
      }
      await p.click('#capas .capa[data-capa="temp"]'); return capas.join(', ');
    });
    await paso('Deslizador de horas y reproducir/pausar', async () => {
      await p.$eval('#hSlider', e => { e.value = 6; e.dispatchEvent(new Event('input', { bubbles: true })); });
      await p.waitForTimeout(200);
      const etq = await texto(p, '#hEtq'); ok(etq !== 'Ahora', 'la etiqueta no cambió');
      await p.click('#hPlay'); await p.waitForTimeout(300);
      ok(await p.$eval('#hPlay', e => e.getAttribute('aria-label') === 'Pausar'), 'no pasó a Pausar');
      ok((await iconoDe(p, '#hPlay')) === '#i-pausa' && await p.$eval('#hPlay', e => e.getAttribute('aria-pressed') === 'true'), 'el ícono no cambió a pausa');
      await p.click('#hPlay');
      ok(await p.$eval('#hPlay', e => e.getAttribute('aria-label') === 'Reproducir'), 'no volvió a Reproducir');
      await p.$eval('#hSlider', e => { e.value = 0; e.dispatchEvent(new Event('input', { bubbles: true })); });
      return etq;
    });
    await paso('Zoom del mapa (+, −, ver todo)', async () => {
      const vb = () => p.$eval('#mapa', e => e.getAttribute('viewBox'));
      const a = await vb(); await p.click('#zMas'); await p.waitForTimeout(500); const m = await vb();
      ok(a !== m, 'el zoom no cambió el viewBox');
      await p.click('#zMenos'); await p.click('#zReset'); await p.waitForTimeout(500);
    });
    await paso('Radar encendido/apagado y rutas', async () => {
      await p.click('#btnRadar'); await p.waitForTimeout(800);
      ok(await p.$eval('#btnRadar', e => e.getAttribute('aria-pressed') === 'true'), 'radar no se encendió');
      const etq = await texto(p, '#radarEtq');
      const pausaOn = await p.$eval('#btnRadarPlay', e => !e.disabled);
      if (pausaOn) {
        await p.click('#btnRadarPlay');
        ok(await p.$eval('#btnRadarPlay', e => e.getAttribute('aria-pressed') === 'true'), 'Pausar no pausó');
        ok((await iconoDe(p, '#btnRadarPlay')) === '#i-reproducir', 'el ícono no pasó a reproducir');
        await p.click('#btnRadarPlay');
      }
      await p.click('#btnRadar');
      ok(await p.$eval('#btnRadar', e => e.getAttribute('aria-pressed') === 'false'), 'radar no se apagó');
      await p.click('#btnRutas'); ok(await p.$eval('#btnRutas', e => e.getAttribute('aria-pressed') === 'true'), 'rutas no se encendieron');
      await p.click('#btnRutas');
      return `«${etq}» (radar simulado), pausar ${pausaOn ? 'probado' : 'deshabilitado'}`;
    });
    await paso('Tema claro/oscuro', async () => {
      await p.click('#btnTema'); ok(await p.evaluate(() => document.documentElement.dataset.tema === 'claro'), 'no pasó a claro');
      ok(/oscuro/.test(await p.$eval('#btnTema', e => e.getAttribute('aria-label'))), 'en claro el botón no ofrece volver a oscuro');
      await p.waitForTimeout(400); await captura(p, 'escritorio-claro', { fullPage: true });
      await p.click('#btnTema'); ok(await p.evaluate(() => document.documentElement.dataset.tema === 'oscuro'), 'no volvió a oscuro');
    });
    await paso('°C / °F', async () => {
      await p.click('#btnUnidad'); await p.waitForTimeout(200);
      ok((await texto(p, '#btnUnidad')) === '°F', 'el botón no dice °F');
      ok(/°F$/.test(await texto(p, '#detalle .temp-grande')), 'la temperatura no está en °F');
      await p.click('#btnUnidad'); ok(/°C$/.test(await texto(p, '#detalle .temp-grande')), 'no volvió a °C');
    });
    await paso('Guaraní y vuelta al español', async () => {
      await p.click('#btnIdioma'); await p.waitForTimeout(300);
      ok(await p.evaluate(() => document.documentElement.lang === 'gn'), 'lang no es gn');
      const lugar = await texto(p, '#btnLugar'), radar = await texto(p, '#btnRadar');
      ok(lugar === 'Eheka tenda', 'Buscar lugar sin traducir: ' + lugar);
      ok(/rehegua/.test(radar), 'Radar sin traducir: ' + radar);
      const etq = await texto(p, '#btnIdioma');
      ok(/GN/.test(etq), 'el botón no dice GN: ' + etq);
      await captura(p, 'guarani', { clip: { x: 0, y: 0, width: 1366, height: 900 } });
      await p.click('#btnIdioma'); await p.waitForTimeout(300);
      ok((await texto(p, '#btnLugar')) === 'Buscar lugar', 'no volvió al español');
      return `«${lugar}», «${radar}»`;
    });
    await paso('Sonido encendido/apagado', async () => {
      await p.click('#btnSonido'); await p.waitForTimeout(300);
      const on = await p.$eval('#btnSonido', e => e.getAttribute('aria-pressed'));
      ok(on === 'true', 'no se encendió (aria-pressed=' + on + ')');
      ok((await iconoDe(p, '#btnSonido')) === '#i-sonido', 'el ícono no muestra el parlante con ondas');
      await p.click('#btnSonido'); ok(await p.$eval('#btnSonido', e => e.getAttribute('aria-pressed') === 'false'), 'no se apagó');
    });
    await paso('Efectos del cielo (✨)', async () => {
      await p.click('#btnFx'); ok(await p.$eval('#btnFx', e => e.getAttribute('aria-pressed') === 'false'), 'no se apagó');
      await p.click('#btnFx'); ok(await p.$eval('#btnFx', e => e.getAttribute('aria-pressed') === 'true'), 'no se encendió');
    });
    await paso('Panel ⚙️: ajustes, vista previa, restablecer y cierre', async () => {
      await p.click('#btnAjustesAnim'); ok(await p.$eval('#dlgAnim', e => e.open), 'el panel no abrió');
      await p.click('#daFondo'); await p.click('input[name=daIntensidad][value="1.5"]');
      await p.click('input[name=daTipo][value=tormenta]'); await p.click('input[name=daFase][value=noche]');
      await p.waitForTimeout(300);
      ok(await p.$eval('#escenaPrevia', e => !e.hidden), 'el aviso de vista previa no apareció');
      ok((await texto(p, '#epTipo')) === 'Tormenta' && (await texto(p, '#epFase')) === 'Noche', 'el aviso no dice Tormenta · Noche');
      await captura(p, 'panel', { clip: { x: 0, y: 0, width: 1366, height: 900 } });
      await p.click('.da-listo'); ok(await p.$eval('#dlgAnim', e => !e.open), 'Listo no cerró');
      ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'btnAjustesAnim'), 'el foco no volvió al botón ⚙️');
      await capturaEl(p, '#escena', 'vista-previa');
      await p.click('#epVolver'); ok(await p.$eval('#escenaPrevia', e => e.hidden), '«Volver al clima real» no quitó el aviso');
      await p.click('#btnAjustesAnim'); await p.click('#daTabAnim'); await p.click('#daRestablecer');
      ok(await p.$eval('#daFondo', e => e.checked), 'restablecer no volvió a encender el fondo');
      await p.keyboard.press('Escape'); ok(await p.$eval('#dlgAnim', e => !e.open), 'Escape no cerró');
    });
    await paso('Compartir (sin hoja del sistema: menú con copiar enlace y WhatsApp)', async () => {
      await p.click('#detalle [data-compartir="1"]'); await p.waitForTimeout(200);
      ok(await p.isVisible('#menuCompartir'), 'el menú de compartir no se abrió');
      ok(await p.$('#menuCompartir [data-compartir="wa"]'), 'falta la opción de WhatsApp en el menú');
      await p.click('#menuCompartir [data-compartir="copiar"]'); await p.waitForTimeout(400);
      ok(!(await p.isVisible('#menuCompartir')), 'el menú no se cerró después de copiar');
      const av = await texto(p, '#aviso'); ok(/copiado/i.test(av), 'aviso: ' + av);
      const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => ''));
      ok(/#c=/.test(clip), 'el portapapeles no tiene el enlace: ' + clip);
      return clip.slice(0, 70) + '…';
    });
    await paso('Modo campo: se abre, carga lluvia, helada, suelo y horas para fumigar', async () => {
      if (!(await p.$eval('#campo', e => e.open))) await p.click('#campo > summary');
      await p.waitForFunction(() => /Fumigar:/.test(document.getElementById('campoCuerpo').textContent), null, { timeout: 8000 });
      const t = await texto(p, '#campoCuerpo');
      ok(/mm/.test(t) && /Helada/.test(t) && /suelo/i.test(t), 'faltan datos: ' + t.slice(0, 120));
      await p.click('#campo > summary'); ok(await p.$eval('#campo', e => !e.open), 'no se cerró');
      return t.match(/Fumigar:[^.]*/)[0].slice(0, 70);
    });
    await paso('Acerca de Clima PY: abre, muestra la versión y la firma, y cierra', async () => {
      await p.click('#btnAcerca'); await p.waitForFunction(() => /Versión \d+/.test(document.getElementById('acercaVersion').textContent), null, { timeout: 5000 });
      ok(await p.$eval('#dlgAcerca', e => e.open), 'no se abrió');
      ok(/Douglas López/.test(await texto(p, '#dlgAcerca .ac-firma')), 'falta la firma');
      const v = await texto(p, '#acercaVersion');
      await p.keyboard.press('Escape'); ok(await p.$eval('#dlgAcerca', e => !e.open), 'Escape no cerró');
      return v;
    });
    await paso('Avisos de tormenta (🔔)', async () => {
      await p.click('#btnAvisos'); await p.waitForTimeout(300);
      return 'aria-pressed=' + await p.$eval('#btnAvisos', e => e.getAttribute('aria-pressed')) + ' (el navegador de prueba niega notificaciones)';
    });
    await paso('Sin internet: el detalle usa el clima actual (humedad, viento, lluvia)', async () => {
      await p.route('**/api.open-meteo.com/**', r => new URL(r.request().url()).searchParams.get('daily') ? r.abort() : r.fallback());
      await p.click('#lista .item-main[data-ciudad="Ayolas"]');
      await p.waitForFunction(() => document.querySelector('#detalleCuerpo #reintentar'), null, { timeout: 15000 });
      const vals = await p.$$eval('#detalleCuerpo .dato', x => x.slice(0, 5).map(d => d.querySelector('b').textContent.trim()));
      ok(vals[1] !== '--' && vals[2] !== '--' && vals[4] !== '--', 'muestra «--» teniendo el dato: ' + vals.join(' | '));
      await p.unroute('**/api.open-meteo.com/**');
      await p.click('#reintentar'); await esperarCiudad(p, 'Ayolas');
      return vals.join(' · ');
    });
    await paso('Nombres con caracteres especiales escapados', async () => {
      const n = await p.evaluate(() => { const h = document.getElementById('lista').innerHTML; return /data-ciudad="[^"]*[<>]/.test(h) ? 'mal' : 'bien'; });
      ok(n === 'bien', 'hay nombres sin escapar');
    });
    await paso('Foco visible con teclado', async () => {
      await p.focus('#buscador'); await p.keyboard.press('Tab');
      const r = await p.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { id: e.id, o: s.outlineStyle, w: s.outlineWidth }; });
      ok(r.o !== 'none' && parseFloat(r.w) >= 2, `sin contorno de foco en #${r.id}`); return '#' + r.id;
    });
    errs.forEach(e => todosErrores.push('escritorio: ' + e));
    await ctx.close();
  }

  // ===================== NAVIDAD =====================
  for (const tema of ['oscuro', 'claro']) {
    const { ctx, p, errs } = await abrir(b, PUERTO, { tema, navidad: 'si' });
    await paso(`Navidad (${tema}): logo, guirnalda y saludo`, async () => {
      ok(await p.evaluate(() => document.documentElement.classList.contains('navidad')), 'falta la clase navidad');
      ok(/icono-navidad\.svg$/.test(await p.$eval('header .logo', e => e.getAttribute('src'))), 'el logo no es el festivo');
      ok(await p.$eval('#saludoNavidad', e => !e.hidden), 'el saludo no aparece');
      ok(await p.$('#guirnalda svg path'), 'no hay guirnalda');
      await captura(p, `navidad-${tema}`, { clip: { x: 0, y: 0, width: 1366, height: 700 } });
      const cuenta = await texto(p, '#saludoCuenta'); ok(/Faltan? \d+ días? para|Feliz/.test(cuenta), 'sin cuenta regresiva: ' + cuenta);
      await p.click('#saludoCerrar'); ok(await p.$eval('#saludoNavidad', e => e.hidden), 'el saludo no se cerró');
      ok(await p.$$eval('#guirnalda .focos', x => x.length) === 3, 'la guirnalda no tiene sus tres grupos de luces');
      ok(await p.$$eval('#guirnalda image', x => x.length) === 3, 'faltan las rosetas de ñandutí');
      const anim = await p.evaluate(() => document.getAnimations().filter(a => a.animationName === 'nvFoco').length);
      ok(anim === 3, 'las luces no parpadean (' + anim + ' animaciones)');
      await p.click('#btnAjustesAnim'); await p.click('#daTabNavidad');
      ok(await p.$eval('#daPanelNavidad', e => !e.hidden), 'la pestaña Navidad no se abrió');
      await p.click('#daNvParpadeo');
      ok(await p.evaluate(() => document.documentElement.classList.contains('navidad-quieta') && localStorage.getItem('clima-py-navidad-parpadeo') === 'no'), 'apagar el parpadeo no puso navidad-quieta');
      ok(await p.evaluate(() => document.getAnimations().filter(a => a.animationName === 'nvFoco').length === 0), 'las luces siguen parpadeando');
      await p.click('#daNvParpadeo');
      await p.click('#daNvFuegos');
      ok(await p.evaluate(() => document.documentElement.classList.contains('sin-fuegos')), 'apagar los fuegos no puso sin-fuegos');
      await p.click('#daNvFuegos');
      await p.click('#daNvCuenta');
      ok(await p.evaluate(() => document.getElementById('saludoCuenta').hidden), 'apagar la cuenta regresiva no la ocultó');
      await p.click('#daNvCuenta');
      await p.click('#daNvMusica'); await p.waitForTimeout(600);
      const mu = await p.evaluate(() => window.climaSonido.estado() && window.climaSonido.estado().musica);
      ok(mu && mu.pedida && mu.suena, 'la música no suena: ' + JSON.stringify(mu));
      await p.click('#daNvMusica'); await p.waitForTimeout(300);
      ok(await p.evaluate(() => !window.climaSonido.estado().musica.suena && localStorage.getItem('clima-py-navidad-musica') === 'no'), 'la música no se apagó');
      await p.fill('#daVolMusica', '40'); await p.$eval('#daVolMusica', e => e.dispatchEvent(new Event('input', { bubbles: true })));
      ok(await p.$eval('#daVolumen', e => e.value === '40'), 'el volumen de la música no sigue al general');
      await captura(p, `navidad-panel-${tema}`, { clip: { x: 0, y: 0, width: 1366, height: 900 } });
      await p.click('input[name=daNavidad][value=no]');
      ok(await p.evaluate(() => !document.documentElement.classList.contains('navidad') && !document.querySelector('#guirnalda svg')), '«Nunca» no quitó la decoración');
      await p.click('input[name=daNavidad][value=si]'); await p.keyboard.press('Escape');
      return `cuenta: «${await texto(p, '#saludoCuenta')}», música ${mu.cancion}`;
    });
    errs.forEach(e => todosErrores.push(`navidad ${tema}: ` + e));
    await ctx.close();
  }

  // ===================== CELULAR =====================
  for (const [nombre, op] of [['celular', { celular: true }], ['320 px', { celular: true, ancho: 320, alto: 640 }], ['celular claro', { celular: true, tema: 'claro' }]]) {
    const { ctx, p, errs } = await abrir(b, PUERTO, op);
    await paso(`${nombre}: sin desborde horizontal`, async () => {
      const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      ok(r.sw <= r.cw, `scrollWidth ${r.sw} > ${r.cw}`);
      const anchos = await p.evaluate(() => [...document.querySelectorAll('.contenedor *')].filter(e => { const q = e.getBoundingClientRect(); return q.width && q.right > innerWidth + 1 && !e.closest('.fila-scroll, .favs, .comp-tabla, #lista, svg, .escena'); }).slice(0, 5).map(e => (e.id ? '#' + e.id : e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().right)));
      ok(!anchos.length, 'elementos que se salen: ' + anchos.join(', '));
      return `${r.cw} px`;
    });
    await paso(`${nombre}: objetivos táctiles ≥ 44 px`, async () => {
      const chicos = await p.evaluate(() => [...document.querySelectorAll('button, select, input:not([type=hidden]), .barra-nav button')].filter(e => {
        if (e.closest('dialog:not([open])') || e.closest('[hidden]') || e.closest('#mapa')) return false;
        const q = e.getBoundingClientRect(); if (!q.width || !q.height) return false;
        if (e.matches('input[type=checkbox], input[type=radio]') && e.closest('label')) return false;
        return q.height < 43.5 || (q.width < 43.5 && !e.matches('input[type=range]'));
      }).map(e => (e.id ? '#' + e.id : (e.className || e.tagName)) + ` ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`));
      ok(!chicos.length, 'chicos: ' + chicos.slice(0, 8).join(', '));
    });
    await paso(`${nombre}: barra inferior lleva a cada sección`, async () => {
      ok(await p.$eval('.barra-nav', e => getComputedStyle(e).display !== 'none'), 'barra oculta');
      await p.click('.barra-nav [data-ir="seccionMapa"]'); await p.waitForTimeout(900);
      const y = await p.$eval('#seccionMapa', e => e.getBoundingClientRect().top); ok(Math.abs(y) < 120, 'no llegó al mapa (top ' + Math.round(y) + ')');
      await p.click('#navComparar'); await p.waitForFunction(() => !document.getElementById('comparar').hidden);
      await p.click('#compCerrar');
      await p.click('.barra-nav [data-ir="detalle"]'); await p.waitForTimeout(900);
    });
    if (nombre === 'celular') {
      await paso('celular: menú desplegable (abre, muestra los ajustes y cierra con Escape)', async () => {
        ok(await p.$eval('#menuPanel', e => getComputedStyle(e).display === 'none'), 'el menú debería empezar cerrado');
        await p.click('#btnMenu');
        ok(await p.$eval('#btnMenu', e => e.getAttribute('aria-expanded') === 'true') && await p.isVisible('#btnTema'), 'el menú no abrió');
        await captura(p, 'celular-menu');
        await p.keyboard.press('Escape');
        ok(await p.$eval('#btnMenu', e => e.getAttribute('aria-expanded') === 'false'), 'Escape no cerró el menú');
        return 'abre y cierra';
      });
      await paso('celular: panel ⚙️ como hoja inferior', async () => {
        await p.click('#btnMenu'); await p.click('#btnAjustesAnim');
        ok(await p.$eval('#btnMenu', e => e.getAttribute('aria-expanded') === 'false'), 'abrir los ajustes no cerró el menú');
        const r = await p.$eval('#dlgAnim', e => { const q = e.getBoundingClientRect(); return { b: Math.round(innerHeight - q.bottom), w: Math.round(q.width), iw: innerWidth }; });
        ok(r.b <= 1 && r.w === r.iw, JSON.stringify(r));
        await captura(p, 'celular-panel'); await p.keyboard.press('Escape');
      });
      await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
      await captura(p, 'celular', { fullPage: true });
    }
    if (nombre === '320 px') await captura(p, 'celular-320', { fullPage: true });
    errs.forEach(e => todosErrores.push(`${nombre}: ` + e));
    await ctx.close();
  }

  // ===================== MOVIMIENTO REDUCIDO =====================
  {
    const { ctx, p, errs } = await abrir(b, PUERTO, { movimiento: 'reduce' });
    await paso('Movimiento reducido: sin animaciones ni transiciones', async () => {
      const n = await p.evaluate(() => document.getAnimations().length);
      await p.click('[data-tab="grafico"]'); await p.click('#lista .item-main[data-ciudad="Caacupé"]'); await esperarCiudad(p, 'Caacupé');
      const m = await p.evaluate(() => document.getAnimations().map(a => (a.animationName || a.transitionProperty || '?')));
      ok(!m.length, 'animaciones activas: ' + m.slice(0, 5).join(', '));
      ok(await p.$eval('#daReducido', e => !e.hidden), 'el panel no avisa del movimiento reducido');
      return `antes ${n}, después ${m.length}`;
    });
    errs.forEach(e => todosErrores.push('reducido: ' + e));
    await ctx.close();
  }

  await b.close();
  let fallas = 0;
  for (const [bien, n, extra] of resultados) { if (!bien) fallas++; console.log(`${bien ? '✅' : '❌'} ${n}${extra ? ' — ' + extra : ''}`); }
  console.log(todosErrores.length ? `\n❌ Errores de JavaScript (${todosErrores.length}):\n- ` + [...new Set(todosErrores)].join('\n- ') : '\nSin errores de JavaScript');
  console.log(`\n${resultados.length - fallas}/${resultados.length} pasos bien`);
  process.exit(fallas || todosErrores.length ? 1 : 0);
})();
