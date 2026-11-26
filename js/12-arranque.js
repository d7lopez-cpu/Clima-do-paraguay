/* Clima PY — Arranque: localidades extra (geocodificador), primer dibujo, primera actualización y registro del service worker.
 * Parte del código de la app, dividido por temas en js/01…12 (se cargan en orden desde index.html y comparten
 * las mismas variables). Usa GEO, definido en js/geo.js. */
'use strict';

  // ============ 9) ARRANQUE ============
  function pintarConteos() {
    const actual = $('filtroDep').value, deps = [...new Set(CIUDADES.map(c => c.dep))].sort((a, b) => a.localeCompare(b, 'es'));
    $('filtroDep').innerHTML = `<option value="">Todo el país (${CIUDADES.length})</option>` +
      deps.map(n => `<option value="${n}">${n} (${CIUDADES.filter(c => c.dep === n).length})</option>`).join('');
    $('filtroDep').value = deps.includes(actual) ? actual : '';
    $('subtitulo').textContent = `${CIUDADES.length} ciudades · ${GEO.deps.length} departamentos`;
  }

  // ---- Localidades adicionales: alternativa cartográfica basada en geocodificación pública; solo se aceptan resultados dentro del departamento correcto y separados de marcadores existentes ----
  // Cada resultado solo se acepta si cae dentro del departamento correcto y no repite una ciudad que ya existe. Se guarda en el dispositivo.
  // Vacío a propósito: la app ya tiene el total acordado de 263 localidades (ver MAX_LOCALIDADES).
  const PENDIENTES = {
  };
  const LS_LUGARES = 'clima-py-lugares-v1';
  let lugaresListo = false;
  const normN = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const leerLugares = () => { try { return JSON.parse(leer(LS_LUGARES, '{}')) || {}; } catch (e) { return {}; } };
  function enAnillo(lon, lat, r) {
    let d = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [x1, y1] = r[i], [x2, y2] = r[j];
      if ((y1 > lat) !== (y2 > lat) && lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1) d = !d;
    }
    return d;
  }
  const enDepartamento = (lat, lon, dep) => { const d = GEO.deps.find(x => x.n === dep); return !!d && d.r.some(r => enAnillo(lon, lat, r)); };
  function distKm(a, b, c, d) {
    const p = Math.PI / 180, h = Math.sin((c - a) * p / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin((d - b) * p / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  }
  // La base ya contiene las 263 localidades acordadas, así que no se agregan más (PENDIENTES está vacío).
  const MAX_LOCALIDADES = 263;
  function sumarLugar(n, dep, lat, lon) {
    if (CIUDADES.length >= MAX_LOCALIDADES || typeof n !== 'string' || !n.trim() || !dep || !esNumero(lat) || !esNumero(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
    const clave = normN(n);
    if (!clave || [...porNombre.keys()].some(k => normN(k) === clave)) return false;
    const c = { n: n.trim(), lat, lon, dep, g: 4 };
    CIUDADES.push(c); porNombre.set(c.n, c);
    return true;
  }
  function aplicarLugaresGuardados() {
    const g = leerLugares();
    // Orden estable: evita que el contenido antiguo del almacenamiento cambie al azar qué extras se muestran.
    for (const [dep, nombres] of Object.entries(PENDIENTES)) {
      for (const n of nombres) {
        if (CIUDADES.length >= MAX_LOCALIDADES) return;
        const v = g[n];
        if (v && v.dep === dep && esNumero(v.lat) && esNumero(v.lon)) sumarLugar(n, dep, v.lat, v.lon);
      }
    }
  }
  // Pide el clima de las ciudades que todavía no tienen datos (sin tocar las demás)
  async function cargarFaltantes() {
    if (cargando) return;
    const faltan = CIUDADES.filter(c => !datos[c.n]);
    if (!faltan.length) return;
    const lotes = [];
    for (let i = 0; i < faltan.length; i += TAM_LOTE) lotes.push(faltan.slice(i, i + TAM_LOTE));
    await Promise.allSettled(lotes.map(async lote => {
      const url = `${OM.clima}?latitude=${lote.map(c => c.lat).join(',')}&longitude=${lote.map(c => c.lon).join(',')}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code,is_day&timezone=America%2FAsuncion`;
      const json = await pedirClima(url);
      (Array.isArray(json) ? json : [json]).forEach((d, i) => { if (d && d.current && climaValido(d.current) && lote[i]) datos[lote[i].n] = conObservacion(lote[i], d.current); });
    }));
    sincronizarDia();
    guardar('clima-py-datos', JSON.stringify({ t: ultimaOk, datos }));
  }
  async function completarLugares() {
    const guardado = leerLugares();
    const tareas = [];
    Object.keys(PENDIENTES).forEach(dep => PENDIENTES[dep].forEach(n => { if (CIUDADES.length + tareas.length < MAX_LOCALIDADES && !(n in guardado) && ![...porNombre.keys()].some(k => normN(k) === normN(n))) tareas.push([n, dep]); }));
    if (!tareas.length) return;
    let nuevos = 0, i = 0;
    const trabajador = async () => {
      while (i < tareas.length && CIUDADES.length < MAX_LOCALIDADES) {
        const [n, dep] = tareas[i++];
        try {
          const j = await pedir(`${OM.lugares}?name=${encodeURIComponent(n)}&count=10&language=es&countryCode=PY`, 12000, 0);
          const buenos = ((j && j.results) || []).filter(x => {
            const a = normN(x.name), b = normN(n);
            return Number.isFinite(x.latitude) && Number.isFinite(x.longitude) && x.latitude >= -28.0 && x.latitude <= -19.0 && x.longitude >= -63.0 && x.longitude <= -54.0 &&
              (a === b || (b.length >= 5 && (a.includes(b) || b.includes(a)))) && enDepartamento(x.latitude, x.longitude, dep) &&
              !CIUDADES.some(c => distKm(c.lat, c.lon, x.latitude, x.longitude) < 5);
          }).sort((p, q) => (q.population || 0) - (p.population || 0));
          if (buenos.length) {
            const x = buenos[0], lat = Math.round(x.latitude * 1e4) / 1e4, lon = Math.round(x.longitude * 1e4) / 1e4;
            guardado[n] = { dep, lat, lon };
            if (sumarLugar(n, dep, lat, lon)) nuevos++;
          } else guardado[n] = 0;           // la respuesta llegó pero no hubo un resultado confiable: no se vuelve a intentar
        } catch (e) { /* sin conexión o límite: queda pendiente para otra sesión */ }
      }
    };
    await Promise.all([trabajador(), trabajador(), trabajador()]);
    guardar(LS_LUGARES, JSON.stringify(guardado));
    if (nuevos) { pintarConteos(); await cargarFaltantes(); refrescarVistas(); }
  }
  aplicarLugaresGuardados();
  pintarConteos();

  window.addEventListener('pagehide', e => {
    if (e.persisted) return;                                       // ver arriba: al volver desde la caché todo debe seguir andando
    clearInterval(intervaloActualizacion); clearInterval(intervaloEstado); clearInterval(intervaloCielo);
    clearInterval(radarTimer); clearInterval(relojMapa);
    clearTimeout(reintentoAuto); clearTimeout(tAjuste); clearTimeout(temporizadorPista);
  });

  pintarFavs();
  pintarCapas();
  dibujarMapaBase();
  // Actualiza los límites distritales desde la capa oficial del INE (Censo 2022).
  // Si no hay conexión o el servicio falla, se conserva la cartografía incrustada como respaldo.
  (async function actualizarCartografiaINE() {
    const url = 'https://geonode.ine.gov.py/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=geonode%3ADistritos_Paraguay_INE_2022&outputFormat=application%2Fjson&srsName=EPSG%3A4326&maxFeatures=500';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const resp = await fetch(url, { signal: ctrl.signal, cache: 'no-cache' });
      if (!resp.ok) throw new Error('Servicio cartográfico no disponible');
      const data = await resp.json();
      if (!data || !Array.isArray(data.features) || data.features.length < 260) throw new Error('Capa oficial incompleta: se esperaban aproximadamente 263 distritos');
      const anillos = [];
      let geometríasValidas = 0;
      const agregarPoligono = coords => {
        if (!Array.isArray(coords)) return;
        // Los límites oficiales pueden sobrepasar ligeramente la caja del país;
        // validar un margen amplio evita descartar anillos completos por vértices fronterizos.
        const anilloValido = ring => Array.isArray(ring) && ring.length >= 4 && ring.every(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] >= -70 && p[0] <= -50 && p[1] >= -35 && p[1] <= -15);
        if (coords.length && anilloValido(coords[0])) {
          coords.forEach(ring => { if (anilloValido(ring)) anillos.push(ring); });
        } else coords.forEach(agregarPoligono);
      };
      data.features.forEach(f => {
        if (!f || !f.geometry || !Array.isArray(f.geometry.coordinates)) return;
        const antes = anillos.length;
        agregarPoligono(f.geometry.coordinates);
        if (anillos.length > antes) geometríasValidas++;
      });
      if (geometríasValidas < 260 || anillos.length < 260) throw new Error(`Geometrías oficiales incompletas (${geometríasValidas} polígonos válidos)`);
      trazoDistritos = anillos.map(trazo).join('');
      const pathDist = $('trazoDist');
      if (pathDist) pathDist.setAttribute('d', trazoDistritos);
      const avisoMapa = $('estadoMapaINE');
      if (avisoMapa) avisoMapa.textContent = `Cartografía distrital del INE 2022 cargada: ${geometríasValidas} polígonos válidos (${data.features.length} registros de origen).`;
      console.info('Cartografía INE 2022 cargada:', data.features.length, 'registros y', geometríasValidas, 'polígonos válidos;', anillos.length, 'anillos.');
    } catch (e) {
      const avisoMapa = $('estadoMapaINE');
      if (avisoMapa) avisoMapa.textContent = 'No se pudo actualizar la cartografía oficial. Se muestra el mapa de respaldo incluido en el archivo.';
      console.warn('Se mantiene el mapa de respaldo; no se pudo actualizar la capa INE 2022.', e);
    } finally { clearTimeout(timer); }
  })();
  pintarChip();
  dibujarLista();
  pintarEstado();
  escribirHash();
  sincronizarDia();
  if (datos[seleccionada]) ambiente(datos[seleccionada]);
  actualizarTodo();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
