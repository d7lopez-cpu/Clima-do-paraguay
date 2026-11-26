/* Clima PY — Decoración navideña: modo automático (1-dic al 6-ene), logo festivo, guirnalda, saludo con cuenta regresiva y preferencias.
 * Parte del código de la app, dividido por temas en js/01…12 (se cargan en orden desde index.html y comparten
 * las mismas variables). Usa GEO, definido en js/geo.js. */
'use strict';

  // ============ 6g) DECORACIÓN NAVIDEÑA ============
  // Del 1 de diciembre al 6 de enero (Reyes), con la fecha de Paraguay. En Paraguay la Navidad es en verano: luces y estrella, sin nieve.
  // Se elige en el panel de ajustes («Automática / Siempre / Nunca») y se guarda aparte de prefsAnim, en 'clima-py-navidad'.
  const MODOS_NAVIDAD = ['auto', 'si', 'no'];
  let modoNavidad = MODOS_NAVIDAD.includes(leer('clima-py-navidad', 'auto')) ? leer('clima-py-navidad', 'auto') : 'auto';
  function fechaPY() {                                             // { a, m, d } de hoy en Paraguay, sin importar la zona horaria del equipo
    try {
      const pt = {}; new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', year: 'numeric', month: 'numeric', day: 'numeric' })
        .formatToParts(new Date()).forEach(x => { pt[x.type] = Number(x.value); });
      if (pt.year && pt.month && pt.day) return { a: pt.year, m: pt.month, d: pt.day };
    } catch (_) {}
    const f = new Date(); return { a: f.getFullYear(), m: f.getMonth() + 1, d: f.getDate() };
  }
  const enNavidad = ({ m, d } = fechaPY()) => m === 12 || (m === 1 && d <= 6);
  const LOGO_NORMAL = 'img/icono.svg', LOGO_NAVIDAD = 'img/icono-navidad.svg';
  // Preferencias de la temporada (panel ⚙️, pestaña Navidad), cada una en su clave: 'si' | 'no'
  const prefNv = (clave, base) => leer('clima-py-navidad-' + clave, base) === 'si';
  const fijarPrefNv = (clave, si) => guardar('clima-py-navidad-' + clave, si ? 'si' : 'no');
  // Cuenta regresiva del saludo: hasta Navidad (25-dic), luego hasta Año Nuevo; el 1-ene, «¡Feliz Año Nuevo!»
  function textoCuenta({ a, m, d }) {
    const dias = (y, mm, dd) => Math.round((Date.UTC(y, mm - 1, dd) - Date.UTC(a, m - 1, d)) / 864e5);
    const falta = (n, que) => n === 1 ? `Falta 1 día para ${que}` : `Faltan ${n} días para ${que}`;
    if (m === 1 && d === 1) return '¡Feliz Año Nuevo!';
    if (m === 1) return '';
    if (m === 12 && d === 24 && hayFuegos()) return '¡Feliz Navidad!';          // desde las 23:30 del 24, con los fuegos artificiales
    if (m === 12 && d === 31 && hayFuegos()) return '¡Feliz Año Nuevo!';
    if (m === 12 && d === 25) return '¡Feliz Navidad!';
    if (m === 12 && d > 25) return falta(dias(a + 1, 1, 1), 'Año Nuevo');
    return falta(dias(a, 12, 25), 'Navidad');
  }
  // Guirnalda del borde superior: cable en festones (4 en celular, más en pantallas anchas) con bombillas de 4 colores en
  // tres grupos que se encienden por turnos (estilos.css; quietas con html.navidad-quieta o «reducir movimiento»)
  // y tres ñandutí navideños (verde, rojo y dorado) colgando de hilos finos.
  const COLORES_LUZ = ['#ef4444', '#fbbf24', '#22c55e', '#60a5fa'];
  let anchoGuirnalda = 0;
  function armarGuirnalda() {
    const caja = $('guirnalda'), W = document.documentElement.clientWidth;
    if (!document.documentElement.classList.contains('navidad')) { caja.textContent = ''; anchoGuirnalda = 0; return; }
    if (W === anchoGuirnalda) return;
    anchoGuirnalda = W;
    const F = W < 600 ? 4 : W < 1000 ? 6 : 8, an = W / F, f = n => n.toFixed(1);
    let cable = '', focos = ['', '', ''];
    for (let k = 0; k < F; k++) {
      const x0 = k * an, x1 = x0 + an, cx = (x0 + x1) / 2;
      cable += `M${f(x0)} 6Q${f(cx)} 44 ${f(x1)} 6`;
      for (let j = 1; j <= 5; j++) {
        const t = j / 6, x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, y = (1 - t) ** 2 * 6 + 2 * (1 - t) * t * 44 + t * t * 6;
        const i = k * 5 + j, c = COLORES_LUZ[i % 4];
        focos[i % 3] += `<circle cx="${f(x)}" cy="${f(y + 7)}" r="7" fill="${c}" opacity=".28"/><rect x="${f(x - 3.5)}" y="${f(y + 1.5)}" width="7" height="10.5" rx="3.5" fill="${c}"/><rect x="${f(x - 2)}" y="${f(y - 0.5)}" width="4" height="3" rx="1" fill="#1f3326"/>`;
      }
    }
    const adornos = [0.12, 0.5, 0.88].map((p, k) => { const x = W * p, largo = [22, 30, 24][k], tam = [22, 26, 22][k];   // hilo + adorno ≤ 80 px: la guirnalda mide 80 px y lo que pasa se corta
      return `<line x1="${f(x)}" y1="20" x2="${f(x)}" y2="${20 + largo}" stroke="rgba(253,230,138,.6)" stroke-width="1"/><image href="img/nanduti-navidad-hilos.svg" x="${f(x - tam / 2)}" y="${20 + largo}" width="${tam}" height="${tam}"/>`; }).join('');
    caja.innerHTML = `<svg width="${W}" height="80" viewBox="0 0 ${W} 80"><path d="${cable}" fill="none" stroke="#3f5a3a" stroke-width="1.6"/>${adornos}` +
      focos.map((g, n) => `<g class="focos f${n}">${g}</g>`).join('') + '</svg>';
  }
  window.addEventListener('resize', () => { clearTimeout(armarGuirnalda.t); armarGuirnalda.t = setTimeout(armarGuirnalda, 200); });
  function aplicarNavidad() {
    const hoy = fechaPY(), activa = modoNavidad === 'si' || (modoNavidad === 'auto' && enNavidad(hoy)), raiz = document.documentElement;
    raiz.classList.toggle('navidad', activa);
    raiz.classList.toggle('navidad-quieta', !prefNv('parpadeo', 'si'));
    raiz.classList.toggle('sin-fuegos', !prefNv('fuegos', 'si'));
    const logo = document.querySelector('header .logo'), ico = document.querySelector('link[rel="icon"]');
    if (logo && !logo.getAttribute('src').endsWith(activa ? LOGO_NAVIDAD : LOGO_NORMAL)) logo.src = activa ? LOGO_NAVIDAD : LOGO_NORMAL;
    if (ico && !ico.getAttribute('href').endsWith(activa ? LOGO_NAVIDAD : LOGO_NORMAL)) ico.href = activa ? LOGO_NAVIDAD : LOGO_NORMAL;
    const clave = `${hoy.a}-${hoy.m}-${hoy.d}`, cuenta = prefNv('cuenta', 'si') ? textoCuenta(hoy) : '';
    $('saludoNavidad').hidden = !activa || leer('clima-py-navidad-saludo', '') === clave;
    $('saludoCuenta').textContent = cuenta; $('saludoCuenta').hidden = !cuenta;
    armarGuirnalda();
    marcarRadio('daNavidad', modoNavidad);
    $('daNvParpadeo').checked = prefNv('parpadeo', 'si'); $('daNvCuenta').checked = prefNv('cuenta', 'si');
    $('daNvFuegos').checked = prefNv('fuegos', 'si'); $('daNvMusica').checked = prefNv('musica', 'no');
  }
  $('saludoCerrar').addEventListener('click', () => {
    const h = fechaPY(); guardar('clima-py-navidad-saludo', `${h.a}-${h.m}-${h.d}`);   // no vuelve a aparecer hasta mañana
    $('saludoNavidad').hidden = true;
  });
  $$a('input[name="daNavidad"]').forEach(r => r.addEventListener('change', () => {
    if (!r.checked || !MODOS_NAVIDAD.includes(r.value)) return;
    modoNavidad = r.value; guardar('clima-py-navidad', modoNavidad); aplicarNavidad();
  }));
  [['daNvParpadeo', 'parpadeo'], ['daNvCuenta', 'cuenta'], ['daNvFuegos', 'fuegos']].forEach(([id, clave]) =>
    $(id).addEventListener('change', e => { fijarPrefNv(clave, e.target.checked); aplicarNavidad(); }));
  // Música navideña: la toca la sección de sonido (climaSonido.musicaNavidad); el clic es el gesto que el navegador pide
  $('daNvMusica').addEventListener('change', async e => {
    const si = e.target.checked;
    if (window.climaSonido && window.climaSonido.musicaNavidad) {
      const suena = await window.climaSonido.musicaNavidad(si);
      if (si && !suena && !document.documentElement.classList.contains('navidad')) aviso('La música suena cuando la decoración navideña está activa.');
    } else fijarPrefNv('musica', si);
  });
  $('btnAjustesAnim').addEventListener('click', () => aplicarNavidad());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) aplicarNavidad(); });   // por si la página quedó abierta de un día para otro
  setInterval(aplicarNavidad, 5 * 60e3);   // cada 5 min: el saludo cambia a tiempo a las 23:30 del 24 y del 31
  aplicarNavidad();
