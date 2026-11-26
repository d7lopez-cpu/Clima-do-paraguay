/* Clima PY — Resumen nacional, lista de ciudades y detalle de la ciudad elegida: portada, tarjetas, pronóstico por horas, gráfico y 7 días.
 * Parte del código de la app, dividido por temas en js/01…12 (se cargan en orden desde index.html y comparten
 * las mismas variables). Usa GEO, definido en js/geo.js. */
'use strict';

  // ============ 7) RESUMEN, LISTA Y DETALLE ============
  // Íconos de los controles: el set propio de estilos.css (scripts/iconos.mjs). La estrella se llena sola con la clase .on.
  const iconoEstrella = on => icono(on ? 'favorito-lleno' : 'favorito');
  // Microinteracciones: las animaciones están en estilos.css (sección 19, con los tokens --d-*) y no corren con
  // «reducir movimiento». Aquí solo se ponen y quitan las clases que las disparan.
  function animarEntrada(el) {                                     // el bloque entra suave (cambio de ciudad o de pestaña)
    if (!el) return;
    el.classList.remove('entra'); void el.offsetWidth; el.classList.add('entra');
    el.addEventListener('animationend', function fin(e) { if (e.target === el) { el.classList.remove('entra'); el.removeEventListener('animationend', fin); } });
  }
  function animarCascada(el) {                                     // los hijos aparecen uno tras otro (--i = su orden)
    if (!el) return;
    [...el.children].forEach((h, i) => h.style.setProperty('--i', i));
    el.classList.add('cascada');
    clearTimeout(el._tCascada); el._tCascada = setTimeout(() => el.classList.remove('cascada'), 1600);
  }
  let statsVistas = false;                                         // el resumen aparece en cascada solo la primera vez
  function dibujarStats() {
    const con = CIUDADES.filter(c => valor(c) !== null);
    if (!con.length) { $('stats').innerHTML = ''; return; }
    const c = capa();
    const alta = con.reduce((a, b) => valor(b) > valor(a) ? b : a);
    const baja = con.reduce((a, b) => valor(b) < valor(a) ? b : a);
    const prom = con.reduce((s, x) => s + valor(x), 0) / con.length;
    const conLluvia = CIUDADES.filter(x => datos[x.n] && datos[x.n].precipitation > 0);
    const secas = CIUDADES.filter(x => datos[x.n] && esNumero(datos[x.n].precipitation) && datos[x.n].precipitation === 0).length;
    const tarjeta = ([ic, titulo], v, sub, ir, color) =>
      `<${ir ? 'button' : 'div'} class="stat"${ir ? ` data-ir="${escObs(ir)}"` : ''}><small>${icono(ic)}<span>${titulo}</span></small><b${color ? ` style="color:${color}"` : ''}>${v}</b><span>${sub}</span></${ir ? 'button' : 'div'}>`;
    $('stats').innerHTML =
      tarjeta([c.icono, `Promedio · ${c.nombre.toLowerCase()}`], c.dec ? prom.toFixed(c.dec) + c.largo : Math.round(prom * 10) / 10 + c.largo, `${con.length} ciudades`, '', paraTexto(colorValor(prom))) +
      tarjeta(c.alto, fmt(valor(alta), true), escObs(alta.n), alta.n, paraTexto(colorValor(valor(alta)))) +
      (capaId === 'lluvia'
        ? tarjeta(['despejado', 'Sin lluvia ahora'], secas, 'ciudades secas', '', '')
        : tarjeta(c.bajo, fmt(valor(baja), true), escObs(baja.n), baja.n, paraTexto(colorValor(valor(baja))))) +
      (conLluvia.length ? tarjeta(['lluvia', 'Con lluvia ahora'], conLluvia.length, 'ej.: ' + escObs(conLluvia[0].n), conLluvia[0].n, '')
                        : tarjeta(['lluvia', 'Con lluvia ahora'], 0, 'ninguna ciudad', '', ''));
    if (!statsVistas) { statsVistas = true; animarCascada($('stats')); }
  }
  $('stats').addEventListener('click', e => {
    const b = e.target.closest('[data-ir]');
    if (b) elegir(b.dataset.ir, { zoom: true });
  });

  let verTodas = false;                   // la lista muestra solo las ciudades principales hasta que se pide verlas todas
  function dibujarLista() {
    const orden = $('orden').value;
    const lista = CIUDADES.filter(coincide);
    const v = c => { const x = valor(c); return x === null ? null : x; };
    lista.sort((a, b) => {
      if (orden === 'nombre') return a.n.localeCompare(b.n, 'es');
      const va = v(a), vb = v(b);
      if (va === null && vb === null) return a.n.localeCompare(b.n, 'es');
      if (va === null) return 1;
      if (vb === null) return -1;
      return orden === 'mayor' ? vb - va : va - vb;
    });
    const favs = lista.filter(c => favoritas.has(c.n)), todas = lista.filter(c => !favoritas.has(c.n));
    // Sin búsqueda, sin filtro y ordenada por nombre: primero solo las ciudades principales (al ordenar por valor se ven todas)
    const resumida = !verTodas && !filtroActivo() && orden === 'nombre';
    const resto = resumida ? todas.filter(c => c.g <= 2 || c.n === seleccionada) : todas;
    const tituloResto = resumida ? 'Ciudades principales' : 'Todas';
    const fila = c => {
      const d = datos[c.n], x = valor(c), fav = favoritas.has(c.n);
      return `<div class="item${c.n === seleccionada ? ' activo' : ''}" role="listitem">
        <button class="item-main" data-ciudad="${escObs(c.n)}">
          ${d ? clima(d.weather_code, d.is_day).svg : '<span class="ic ic-espera" aria-hidden="true"></span>'}<span class="nom">${escObs(c.n)}<small>${nombreDep(c.dep)}</small></span>
          <span class="t" style="color:${x === null ? 'var(--suave)' : paraTexto(colorValor(x))}">${fmt(x)}</span>
        </button>
        <button class="estrella${fav ? ' on' : ''}" data-fav="${escObs(c.n)}" aria-label="${escObs(fav ? 'Quitar ' + c.n + ' de favoritas' : 'Marcar ' + c.n + ' como favorita')}" aria-pressed="${fav}">${iconoEstrella(fav)}</button>
      </div>`;
    };
    const cont = $('lista'), scroll = cont.scrollTop;
    $('contador').textContent = `(${lista.length})`;
    cont.innerHTML = lista.length
      ? (favs.length ? '<div class="sep">' + icono('favorito-lleno') + '<span>Favoritas</span></div>' + favs.map(fila).join('') : '') +
        (resto.length && (favs.length || resumida) ? `<div class="sep">${tituloResto}</div>` : '') + resto.map(fila).join('') +
        (resto.length < todas.length ? '<button class="btn ver-todas" id="verTodas">Ver todas las ciudades</button>' : '')
      : '<div class="vacio">No hay ciudades con ese filtro.<br><button class="btn" id="quitarFiltros">Quitar filtros</button></div>';
    cont.scrollTop = scroll;
  }
  $('lista').addEventListener('click', e => {
    if (e.target.id === 'quitarFiltros') { limpiarFiltros(); return; }
    if (e.target.id === 'verTodas') { verTodas = true; dibujarLista(); return; }
    const fav = e.target.closest('[data-fav]');
    if (fav) { alternarFav(fav.dataset.fav); return; }
    const it = e.target.closest('[data-ciudad]');
    if (it) elegir(it.dataset.ciudad, { zoom: true });
  });
  // Al pasar el mouse por la lista, la ciudad se marca en el mapa
  $('lista').addEventListener('mouseover', e => {
    const it = e.target.closest('.item-main');
    const n = it ? it.dataset.ciudad : null;
    if (n !== hover) { hover = n; dibujarPuntos(); }
  });
  $('lista').addEventListener('mouseleave', () => { if (hover) { hover = null; dibujarPuntos(); } });
  // Flechas arriba/abajo para recorrer la lista con el teclado
  $('lista').addEventListener('keydown', e => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = [...$('lista').querySelectorAll('.item-main')];
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : limitar(i + (e.key === 'ArrowDown' ? 1 : -1), 0, items.length - 1);
    items[j].focus();
  });

  function alternarFav(n) {
    if (favoritas.has(n)) favoritas.delete(n); else favoritas.add(n);
    guardar('clima-py-favs', JSON.stringify([...favoritas]));
    dibujarLista();
    pintarFavs();
    const b = document.querySelector('#detalle .estrella');
    if (b && b.dataset.fav === n) { b.classList.toggle('on', favoritas.has(n)); b.setAttribute('aria-pressed', String(favoritas.has(n))); b.innerHTML = iconoEstrella(favoritas.has(n)); }
  }

  // --- Detalle de la ciudad elegida ---
  // La cabecera (nombre, temperatura, datos) se arma igual con datos parciales o completos
  function luna() {
    const P = 29.530588853, e = (((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % P + P) % P, i = Math.round(e / P * 8) % 8;
    return { ilum: Math.round((1 - Math.cos(2 * Math.PI * e / P)) / 2 * 100),
      t: ['Luna nueva', 'Creciente', 'Cuarto creciente', 'Gibosa creciente', 'Luna llena', 'Gibosa menguante', 'Cuarto menguante', 'Menguante'][i] };
  }
  const cacheAire = new Map();
  async function cargarAire(c) {
    const g = cacheAire.get(c.n);
    if (g && Date.now() - g.t < 15 * 60000) return g.v;
    const j = await pedir(`${OM.aire}?latitude=${c.lat}&longitude=${c.lon}&current=us_aqi,pm2_5&timezone=America%2FAsuncion`, 12000, 0);
    const v = j && j.current ? { aqi: j.current.us_aqi, pm: j.current.pm2_5 } : null;
    cacheAire.set(c.n, { t: Date.now(), v });
    return v;
  }
  function textoAire(v) {
    if (!v || !esNumero(v.aqi)) return '--';
    const a = v.aqi, t = a <= 50 ? 'Buena' : a <= 100 ? 'Moderada' : a <= 150 ? 'Dañina para sensibles' : a <= 200 ? 'Dañina' : a <= 300 ? 'Muy dañina' : 'Peligrosa';
    return `${Math.round(a)} · ${t}`;
  }
  function llenarAire(c) {
    const poner = t => { const el = document.querySelector('#aireDato b'); if (el && seleccionada === c.n) el.textContent = t; };
    const g = cacheAire.get(c.n);
    if (g) poner(textoAire(g.v));
    cargarAire(c).then(v => poner(textoAire(v))).catch(() => poner('--'));
  }
  // Cabecera: ciudad, temperatura grande (Fraunces), estado y máx/mín/sensación. Con datos parciales (solo el clima actual)
  // ya muestra lo que se sabe; `error`: no se pudo cargar el pronóstico.
  // Portada: ubicación, ñandutí a color detrás de la temperatura, estado, máx/mín y sensación. Con datos parciales (solo el clima
  // actual) ya muestra lo que se sabe; `error`: no se pudo cargar el pronóstico. El paisaje animado (#escena) queda debajo, fijo:
  // al cambiar de ciudad solo se reescribe este bloque, el paisaje no se vuelve a armar.
  function htmlCabecera(c, a, d, error) {
    const w = a ? clima(a.weather_code, a.is_day) : { svg: error ? icono('aviso', 'ic-clima') : '', texto: error ? 'Sin datos por ahora' : 'Cargando…' };
    const t = a ? a.temperature_2m : null, fav = favoritas.has(c.n), n = escObs(c.n);
    const mm = d ? `<div class="minmax"><span>Máx ${grados(d.daily.temperature_2m_max[0])}</span><i aria-hidden="true">·</i><span>Mín ${grados(d.daily.temperature_2m_min[0])}</span></div>` : '';
    const sens = a && esNumero(a.apparent_temperature) ? `<div class="sensacion-pill">${icono('sensacion')}<span>Sensación ${grados(a.apparent_temperature)}</span></div>` : '';
    return `
      <div class="hero">
        <div class="ciudad-fila">
          <span class="hero-lado">${d ? `<button class="btn-redondo" data-compartir="1" aria-label="Compartir el clima de esta ciudad" title="Compartir">${icono('compartir')}</button>` : ''}</span>
          <div class="ciudad-centro">
            <h3 class="ciudad-nombre${c.n.length > 16 ? ' largo' : ''}">${icono('ubicacion')}${n}</h3>
            <div class="dep-nombre" title="${c.dep === 'Asunción' ? 'Capital del país' : 'Departamento ' + escObs(c.dep)}"><span>${c.dep === 'Asunción' ? 'Capital del país' : escObs(c.dep)}</span></div>
          </div>
          <span class="hero-lado"><button class="btn-redondo estrella${fav ? ' on' : ''}" data-fav="${n}" aria-label="Favorita" aria-pressed="${fav}">${iconoEstrella(fav)}</button></span>
        </div>
        <div class="hero-temp">
          <svg class="hero-nanduti" aria-hidden="true" focusable="false"><use href="#nanduti-portada"/></svg>
          <div class="temp-grande">${esNumero(t) ? Math.round(aU(t)) + '°<span class="unidad">' + UT() + '</span>' : (a || error ? '--' : '<span class="esq">00°</span>')}</div>
        </div>
        <div class="estado">${w.svg}<span>${w.texto}</span></div>
        ${mm}
        ${sens}
        ${d && d.rangoDia && d.rangoDia.max[0] ? `<div class="rango-prob" title="Rango del 10 % al 90 % de las simulaciones de 4 modelos">Máx. probable ${Math.round(aU(d.rangoDia.max[0][0])) === Math.round(aU(d.rangoDia.max[0][1])) ? grados(d.rangoDia.max[0][0]) + ' (muy segura)' : grados(d.rangoDia.max[0][0]) + '–' + grados(d.rangoDia.max[0][1])}</div>` : ''}
        ${d && !navigator.share ? `<div class="hero-acciones"><button class="btn" data-compartir="wa" aria-label="Enviar el clima por WhatsApp">WhatsApp</button></div>` : ''}
      </div>`;
  }
  // Cuerpo: avisos, datos y verificación con aeropuertos. Los datos del clima actual (humedad, viento, lluvia, presión) salen
  // de datos[c.n] si el pronóstico todavía no llegó o no se pudo cargar (sin internet): así no se ven «--» teniendo el dato.
  function htmlDatos(c, a, d, error) {
    const L = luna(), falta = d || error ? '--' : '<span class="esq">0000000</span>';
    const v = (hay, val) => hay ? val : falta;
    const dato = (ic, titulo, val, id) => `<div class="dato" data-c="${ic}"${id ? ` id="${id}"` : ''}>${icono(ic)}<b>${val}</b><small>${titulo}</small></div>`;
    const vis = a && esNumero(a.visibility) ? a.visibility : null;
    const prob = d && esNumero(d.daily.precipitation_probability_max[0]) ? d.daily.precipitation_probability_max[0] : null;
    const alertasHtml = d ? alertas(a, d).map(x => `<div class="alerta${x.fuerte ? ' fuerte' : ''}">${icono(x.ic)}<span>${x.t}</span></div>`).join('') : '';
    return `
      ${alertasHtml ? `<div class="alertas">${alertasHtml}</div>` : ''}
      <div class="datos">
        ${dato('sensacion', 'Sensación térmica', v(a && esNumero(a.apparent_temperature), a && grados(a.apparent_temperature) + UT()))}
        ${dato('humedad', 'Humedad', v(a && esNumero(a.relative_humidity_2m), a && a.relative_humidity_2m + '%'))}
        ${dato('viento', 'Viento', v(a && esNumero(a.wind_speed_10m), a && Math.round(a.wind_speed_10m) + ' km/h ' + dirViento(a.wind_direction_10m)))}
        ${dato('presion', 'Presión', v(a && esNumero(a.pressure_msl), a && Math.round(a.pressure_msl) + ' hPa'))}
        ${dato('lluvia', 'Lluvia ahora', v(a && esNumero(a.precipitation), a && a.precipitation + ' mm'))}
        ${dato('uv', 'Índice UV (máx. hoy)', v(d && esNumero(d.daily.uv_index_max[0]), d && Math.round(d.daily.uv_index_max[0]) + ' · ' + nivelUvCorto(d.daily.uv_index_max[0])))}
        ${dato('paraguas', 'Prob. de lluvia hoy', v(prob !== null, prob + '%'))}
        ${vis !== null ? dato('ojo', 'Visibilidad', vis >= 10000 ? Math.round(vis / 1000) + ' km' : (vis / 1000).toFixed(1).replace('.', ',') + ' km') : ''}
        ${dato('luna', 'Luna', `${L.t} · ${L.ilum}%`)}
        ${d ? dato('hoja', 'Calidad del aire', '…', 'aireDato') : ''}
        ${d ? htmlSol(d) : `${dato('amanecer', 'Amanecer', falta)}${dato('atardecer', 'Atardecer', falta)}`}
      </div>
      ${d ? htmlObs(c, a) : ''}`;
  }
  const nivelUvCorto = u => u >= 11 ? 'Extremo' : u >= 8 ? 'Muy alto' : u >= 6 ? 'Alto' : u >= 3 ? 'Moderado' : 'Bajo';
  // Salida y puesta del sol en una tarjeta ancha, con el arco del día y el sol donde está ahora (hora de Asunción)
  function htmlSol(d) {
    const sale = String(d.daily.sunrise[0]).slice(11, 16), pone = String(d.daily.sunset[0]).slice(11, 16);
    const min = h => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
    const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Asuncion', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
    const ahora = +p.hour * 60 + +p.minute, k = limitar((ahora - min(sale)) / Math.max(1, min(pone) - min(sale)), 0, 1), dia = ahora >= min(sale) && ahora <= min(pone);
    const x = 10 + 80 * k, y = 34 - 26 * Math.sin(Math.PI * k);
    return `<div class="dato dato-sol" data-c="amanecer">
      <div class="sol-lado">${icono('amanecer')}<small>Salida del sol</small><b>${sale}</b></div>
      <svg class="sol-arco" viewBox="0 0 100 40" aria-hidden="true" focusable="false"><path d="M10 34A40 26 0 0 1 90 34" class="sol-camino"/><path d="M4 34H96" class="sol-suelo"/>${dia ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" class="sol-punto"/>` : ''}</svg>
      <div class="sol-lado">${icono('atardecer')}<small>Puesta del sol</small><b>${pone}</b></div>
    </div>`;
  }
  function pintarPartes(cab, cuerpo) { $('detalleCab').innerHTML = cab; $('detalleCuerpo').innerHTML = cuerpo; }
  const capaTemp = t => CAPAS.temp.color(t);

  // ---- Lluvia en la próxima hora (datos cada 15 min) ----
  function ahoraAsuncionMin() {
    const p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${String(Math.floor(+p.minute / 15) * 15).padStart(2, '0')}`;
  }
  // Devuelve { t, k, mm }: k = tramos de 15 min hasta la primera lluvia (0 = ya llueve; null = no llueve en la próxima hora), mm = total en la hora
  function resumirProximaHora(d) {
    const m = d && d.minutely_15;
    if (!m || !Array.isArray(m.time) || !Array.isArray(m.precipitation)) return null;
    const ahora = ahoraAsuncionMin(), i = m.time.findIndex(h => String(h).slice(0, 16) >= ahora);
    if (i < 0) return null;
    const v = m.precipitation.slice(i, i + 4);
    if (v.length < 4 || !v.every(esNumero)) return null;
    const k = v.findIndex(x => x >= 0.1);
    return { t: Date.now(), k: k < 0 ? null : k, mm: Math.round(v.reduce((a, b) => a + b, 0) * 10) / 10 };
  }
  const NIVEL_UV = u => u >= 11 ? 'extremo' : u >= 8 ? 'muy alto' : u >= 6 ? 'alto' : 'moderado';

  // Umbrales de los avisos nuevos del detalle
  const UMBRAL_CALOR_EXTREMO = 38;   // °C de sensación térmica (apparent_temperature) desde el que se avisa "Calor extremo"
  const UMBRAL_FRIO_INTENSO = 5;     // °C de temperatura del aire (temperature_2m) hasta el que se avisa "Frío intenso"
  const UMBRAL_VIENTO_FUERTE = 50;   // km/h de viento (wind_speed_10m) desde el que se avisa "Viento fuerte" con la velocidad

  // Avisos útiles según las condiciones de ahora
  function alertas(a, d) {
    const r = [];
    const calorExtremo = esNumero(a.apparent_temperature) && a.apparent_temperature >= UMBRAL_CALOR_EXTREMO;
    const frioIntenso = esNumero(a.temperature_2m) && a.temperature_2m <= UMBRAL_FRIO_INTENSO;
    if (calorExtremo) r.push({ ic: 'calor', fuerte: 1, t: 'Calor extremo: hidrátate y evita el sol en las horas centrales del día' });
    else if (esNumero(a.apparent_temperature) && a.apparent_temperature >= 35) r.push({ ic: 'calor', t: 'Sensación térmica muy alta: hidrátate y evita el sol del mediodía' });
    if (frioIntenso) r.push({ ic: 'frio', fuerte: 1, t: 'Frío intenso: abrígate bien' });
    else if (esNumero(a.apparent_temperature) && a.apparent_temperature <= 5) r.push({ ic: 'frio', t: 'Sensación de frío intenso: abrígate bien' });
    const px = d.proxh;
    if (px && Date.now() - px.t < 20 * 60000) {                    // solo si el dato es reciente (20 min)
      if (px.k === 0) r.push({ ic: 'lluvia', t: `Está lloviendo ahora (unos ${px.mm} mm en la próxima hora)` });
      else if (px.k > 0) r.push({ ic: 'llovizna', t: `Lluvia en unos ${px.k * 15} min (unos ${px.mm} mm en la próxima hora)` });
    }
    const uvMax = d.daily.uv_index_max[0];
    if (esNumero(uvMax) && uvMax >= 3) {
      let tramo = '';
      if (Array.isArray(d.hourly.uv_index)) {
        const hoy = String(d.daily.time[0]), hs = [];
        d.hourly.time.forEach((h, k) => { if (String(h).startsWith(hoy) && d.hourly.uv_index[k] >= 3) hs.push(+String(h).slice(11, 13)); });
        if (hs.length) tramo = ` entre las ${String(Math.min(...hs)).padStart(2, '0')}:00 y las ${String(Math.max(...hs) + 1).padStart(2, '0')}:00`;
      }
      r.push({ ic: 'uv', fuerte: uvMax >= 8, t: `UV ${NIVEL_UV(uvMax)} hoy (${Math.round(uvMax)}): usa protector solar${tramo}${uvMax >= 8 ? ', gorra y busca sombra' : ''}` });
    }
    if ([95, 96, 99].includes(a.weather_code)) r.push({ ic: 'tormenta', fuerte: 1, t: 'Tormenta eléctrica en la zona ahora' });
    if (esNumero(a.wind_speed_10m) && a.wind_speed_10m >= UMBRAL_VIENTO_FUERTE) r.push({ ic: 'viento', fuerte: 1, t: `Viento fuerte: ${Math.round(a.wind_speed_10m)} km/h` });
    else if (esNumero(a.wind_speed_10m) && a.wind_speed_10m >= 40) r.push({ ic: 'viento', t: 'Viento fuerte' });
    const i = horaInicio(d);
    const prox = d.hourly.precipitation_probability.slice(i, i + 4).filter(esNumero);
    if (prox.length && Math.max(...prox) >= 70) r.push({ ic: 'lluvia', t: 'Alta probabilidad de lluvia en las próximas horas' });
    return r;
  }

  function pintarPrevio(c) {
    pintarPartes(htmlCabecera(c, datos[c.n] || null, null), htmlDatos(c, datos[c.n] || null, null));
    if (datos[c.n]) ambiente(datos[c.n]);
  }
  function pintarErrorDetalle(c, e) {
    const msg = e && e.tipo === 'limite'
      ? 'Open-Meteo recibió demasiadas consultas. Espera un minuto e inténtalo de nuevo.'
      : 'No se pudo cargar el pronóstico de ' + escObs(c.n) + '. Revisa tu conexión.';
    pintarPartes(htmlCabecera(c, datos[c.n] || null, null, true), htmlDatos(c, datos[c.n] || null, null, true) +
      `<div class="vacio">${icono('aviso')}<span>${msg}</span><button class="btn" id="reintentar">Reintentar</button></div>`);
    $('reintentar').addEventListener('click', () => { if (hayDatos) dibujarDetalle(); else actualizarTodo(true); });
  }

  async function dibujarDetalle() {
    const c = porNombre.get(seleccionada);
    const mi = ++tokenDetalle;
    const previo = detalleActual && detalleActual.c.n === c.n;
    if (!previo) { pintarPrevio(c); animarEntrada($('detalleCab')); animarEntrada($('detalleCuerpo')); }   // enseguida se ve la ciudad elegida, con lo que ya sabemos
    $('detalle').setAttribute('aria-busy', 'true');
    try {
      const d = await cargarDetalle(c);
      if (mi !== tokenDetalle) return;          // el usuario ya eligió otra ciudad
      detalleActual = { c, d };
      datos[c.n] = Object.assign({}, datos[c.n] || {}, d.current);   // la lista y el mapa quedan iguales al detalle
      sincronizarDia();
      ambiente(d.current, d);
      pintarDetalle();
      const w = clima(d.current.weather_code, d.current.is_day);
      anunciar(`${c.n}: ${Math.round(aU(d.current.temperature_2m))} grados, ${w.texto}`);
      refrescarVistas();
    } catch (e) {
      if (mi !== tokenDetalle) return;
      if (previo) aviso('No se pudo actualizar el pronóstico de ' + c.n + '. Se muestran los últimos datos.');
      else { detalleActual = null; pintarErrorDetalle(c, e); }
    } finally {
      if (mi === tokenDetalle) $('detalle').setAttribute('aria-busy', 'false');
    }
  }

  function pintarDetalle() {
    const { c, d } = detalleActual;
    // Orden: pronóstico por horas (lo más consultado) → avisos y tarjetas → próximos 7 días
    pintarPartes(htmlCabecera(c, d.current, d), `
      <div class="pronostico-caja">
      <div class="caja-titulo"><h4>${icono('reloj')}<span>Pronóstico</span></h4>
      <div class="pestanas" role="tablist" aria-label="Vista del pronóstico">
        ${PESTANAS.map(([id, txt]) => `<button class="pestana${pestana === id ? ' on' : ''}" data-tab="${id}" id="tab-${id}" role="tab" aria-controls="pronostico" aria-selected="${pestana === id}" tabindex="${pestana === id ? 0 : -1}">${txt}</button>`).join('')}
      </div></div>
      <div id="pronostico" role="tabpanel" aria-labelledby="tab-${pestana}">${htmlPronostico(d)}</div>
      </div>` + htmlDatos(c, d.current, d) + htmlDias7(d));
    llenarAire(c);
  }
  const PESTANAS = [['horas', 'Próximas horas'], ['grafico', 'Gráfico 24 h']];   // los días tienen su propia tarjeta (htmlDias7)
  // Cambiar de pestaña solo redibuja el pronóstico (no toda la tarjeta), con una entrada suave
  function cambiarPestana(id, enfocar) {
    if (!detalleActual || !PESTANAS.some(([x]) => x === id)) return;
    pestana = id;
    document.querySelectorAll('#detalle [data-tab]').forEach(b => {
      const on = b.dataset.tab === id;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      if (on && enfocar) b.focus();
    });
    const caja = $('pronostico');
    if (!caja) { pintarDetalle(); return; }
    caja.setAttribute('aria-labelledby', 'tab-' + id);
    caja.innerHTML = htmlPronostico(detalleActual.d);
    const fila = caja.querySelector('.fila-scroll, .dias');
    if (fila) animarCascada(fila); else animarEntrada(caja);
  }
  // ---- Compartir el clima de la ciudad (Web Share; si no existe: copiar enlace y WhatsApp) ----
  function datosCompartir() {
    const { c, d } = detalleActual, a = d.current;
    const w = clima(a.weather_code, a.is_day);
    const t = esNumero(a.temperature_2m) ? `${Math.round(aU(a.temperature_2m))}°${UT()}` : '--';
    const url = location.origin + location.pathname + '#c=' + encodeURIComponent(c.n);
    const texto = `Clima en ${c.n}: ${t}, ${w.texto}. Máx ${grados(d.daily.temperature_2m_max[0])} / Mín ${grados(d.daily.temperature_2m_min[0])}.`;
    return { texto, url };
  }
  async function copiarTexto(txt) {
    try { await navigator.clipboard.writeText(txt); return true; } catch (_) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch (_) { return false; }
  }
  async function compartir(modo) {
    if (!detalleActual) return;
    const { texto, url } = datosCompartir();
    if (modo === 'wa') { window.open('https://wa.me/?text=' + encodeURIComponent(texto + ' ' + url), '_blank', 'noopener'); return; }
    if (navigator.share) {
      try { await navigator.share({ title: 'Clima PY', text: texto, url }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }   // si la persona cancela no se hace nada; otro error: se copia el enlace
    }
    aviso(await copiarTexto(texto + ' ' + url) ? 'Enlace copiado' : 'No se pudo copiar el enlace');
  }
  $('detalle').addEventListener('click', e => {
    const comp = e.target.closest('[data-compartir]');
    if (comp) { compartir(comp.dataset.compartir); return; }
    const fav = e.target.closest('[data-fav]');
    if (fav) { alternarFav(fav.dataset.fav); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab && detalleActual) cambiarPestana(tab.dataset.tab);
  });
  // Pestañas con teclado: flechas, Inicio y Fin (patrón de pestañas de ARIA)
  $('detalle').addEventListener('keydown', e => {
    const tab = e.target.closest && e.target.closest('[role=tab]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const ids = PESTANAS.map(([x]) => x), i = ids.indexOf(tab.dataset.tab);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
    cambiarPestana(ids[j], true);
  });

  // Posición de la hora actual dentro de la lista "hourly" de la API
  function horaInicio(d) {
    const ahora = horaAsuncion();
    const i = d.hourly.time.findIndex(h => String(h).slice(0, 13) >= ahora);
    return Math.max(0, i);
  }

  function htmlPronostico(d) { return htmlPronosticoBase(d) + notaProb(d); }
  function htmlPronosticoBase(d) {
    const inicio = horaInicio(d);
    if (pestana === 'horas') {
      return '<div class="fila-scroll">' + d.hourly.time.slice(inicio, inicio + 24).map((h, i) => {
        const k = inicio + i;
        const w = clima(d.hourly.weather_code[k], d.hourly.is_day[k]);
        return `<div class="mini${i === 0 ? ' ahora' : ''}"><div>${i === 0 ? 'Ahora' : String(h).slice(11, 16)}</div>${w.svg}
          <b>${grados(d.hourly.temperature_2m[k])}</b><div class="lluvia">${icono('humedad')}${d.hourly.precipitation_probability[k] ?? 0}%</div></div>`;
      }).join('') + '</div>';
    }
    return graficoHoras(d, inicio);
  }

  // Próximos 7 días, en filas: día, ícono, probabilidad de lluvia y la barra de mínima a máxima (en la escala de toda la semana;
  // la franja clara es el rango probable de los ensambles, si lo hay)
  function htmlDias7(d) {
    const nombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const mins = d.daily.temperature_2m_min.filter(esNumero), maxs = d.daily.temperature_2m_max.filter(esNumero);
    if (!mins.length || !maxs.length) return '';
    const rd = d.rangoDia, bajos = mins.slice(), altos = maxs.slice();
    if (rd) { rd.min.forEach(r => r && bajos.push(r[0])); rd.max.forEach(r => r && altos.push(r[1])); }
    const minG = Math.min(...bajos), maxG = Math.max(...altos), rango = (maxG - minG) || 1;
    const filas = d.daily.time.map((f, i) => {
      const fecha = new Date(f + 'T12:00:00'), w = clima(d.daily.weather_code[i], 1);
      const mn = d.daily.temperature_2m_min[i], mx = d.daily.temperature_2m_max[i], pr = d.daily.precipitation_probability_max[i];
      const izq = esNumero(mn) ? (mn - minG) / rango * 100 : 0, ancho = esNumero(mn) && esNumero(mx) ? Math.max(8, (mx - mn) / rango * 100) : 8;
      const rMx = rd && rd.max[i], rMn = rd && rd.min[i];
      const inc = rMx && rMn ? `<i class="inc" style="left:${Math.max(0, (rMn[0] - minG) / rango * 100).toFixed(0)}%;width:${Math.min(Math.max(6, (rMx[1] - rMn[0]) / rango * 100), 100 - Math.max(0, (rMn[0] - minG) / rango * 100)).toFixed(0)}%"></i>` : '';
      const tip = rMx && rMn ? ` title="Máxima probable ${grados(rMx[0])} a ${grados(rMx[1])} · mínima probable ${grados(rMn[0])} a ${grados(rMn[1])}"` : '';
      const nom = i === 0 ? 'Hoy' : nombres[fecha.getDay()];
      return `<li class="dia-fila"${tip}><span class="dia-nombre"><span class="nom-largo">${nom}</span><span class="nom-corto" aria-hidden="true">${i === 0 ? 'Hoy' : nom.slice(0, 3)}</span></span>
        <span class="dia-ic" title="${w.texto}">${w.svg}</span>
        <span class="lluvia${(pr ?? 0) >= 50 ? ' alta' : ''}">${icono('humedad')}${pr ?? 0}%</span>
        <span class="dia-min">${grados(mn)}</span><span class="barra-rango">${inc}<i style="left:${izq.toFixed(0)}%;width:${Math.min(ancho, 100 - izq).toFixed(0)}%"></i></span><span class="dia-max">${grados(mx)}</span></li>`;
    }).join('');
    return `<div class="pronostico-caja dias7" id="dias7"><div class="caja-titulo"><h4>${icono('calendario')}<span>Próximos ${d.daily.time.length} días</span></h4></div><ul class="dias-lista">${filas}</ul></div>`;
  }

  // Gráfico de temperatura de las próximas 24 horas (SVG dibujado a mano)
  function graficoHoras(d, inicio) {
    const T = [], P = [], Hs = [];
    for (let i = 0; i < 24 && inicio + i < d.hourly.time.length; i++) {
      const t = d.hourly.temperature_2m[inicio + i];
      if (!esNumero(t)) continue;
      T.push(t);
      P.push(d.hourly.precipitation_probability[inicio + i] ?? 0);
      Hs.push(String(d.hourly.time[inicio + i]).slice(11, 16));
    }
    if (T.length < 2) return '<div class="vacio">No hay datos suficientes para el gráfico.</div>';
    const An = 720, Al = 230, mI = 36, mD = 14, mS = 22, mB = 32;
    const tmin = Math.floor(Math.min(...T)) - 1, tmax = Math.ceil(Math.max(...T)) + 1;
    const x = i => mI + i * (An - mI - mD) / (T.length - 1);
    const y = t => mS + (tmax - t) * (Al - mS - mB) / (tmax - tmin);
    const linea = T.map((t, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(t).toFixed(1)).join('');
    const area = linea + `L${x(T.length - 1).toFixed(1)} ${Al - mB}L${x(0).toFixed(1)} ${Al - mB}Z`;
    const alto = Al - mS - mB;
    let barras = '', etiquetas = '', puntos = '';
    T.forEach((t, i) => {
      const h = P[i] / 100 * alto * 0.5;
      barras += `<rect x="${(x(i) - 4).toFixed(1)}" y="${(Al - mB - h).toFixed(1)}" width="8" height="${h.toFixed(1)}" rx="2" fill="#5cc8ff" opacity="0.35"/>`;
      if (i % 3 === 0) {
        etiquetas += `<text x="${x(i).toFixed(1)}" y="${Al - 10}" text-anchor="middle">${Hs[i]}</text>`;
        puntos += `<circle cx="${x(i).toFixed(1)}" cy="${y(t).toFixed(1)}" r="3.5" fill="${capaTemp(t)}" stroke="#fff" stroke-width="1"/>` +
          `<text class="valor" x="${x(i).toFixed(1)}" y="${(y(t) - 9).toFixed(1)}" text-anchor="middle">${Math.round(t)}°</text>`;
      }
    });
    const guias = [tmin, (tmin + tmax) / 2, tmax].map(t =>
      `<line x1="${mI}" x2="${An - mD}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}" stroke="rgba(148,163,184,0.2)"/>` +
      `<text x="${mI - 6}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${Math.round(t)}°</text>`).join('');
    return `<svg class="grafico" viewBox="0 0 ${An} ${Al}" role="img" aria-label="Temperatura de las próximas 24 horas">
      <defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb347" stop-opacity="0.45"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></linearGradient></defs>
      ${guias}${barras}<path d="${area}" fill="url(#gArea)"/><path d="${linea}" fill="none" stroke="#ffb347" stroke-width="2.5" stroke-linejoin="round"/>${puntos}${etiquetas}
      <text x="${An - mD}" y="12" text-anchor="end">Barras azules: probabilidad de lluvia</text></svg>`;
  }
