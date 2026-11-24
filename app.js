/* Clima PY — código de la app (usa GEO, definido en geo.js) */
(function () {
  'use strict';

  // ============ 1) DATOS GEOGRÁFICOS (incrustados) ============
  // GEO.deps: 18 departamentos | GEO.dist: 247 polígonos locales de respaldo; se intenta actualizar con INE 2022 | GEO.vecinos: países vecinos
  // GEO.ciudades: 263 puntos de localidades/distritos con nombre (n), latitud (lat), longitud (lon), departamento (dep) y tamaño (g: 1 grande, 3 chica)
  const CIUDADES = GEO.ciudades;
  const porNombre = new Map(CIUDADES.map(c => [c.n, c]));
  const $ = id => document.getElementById(id);
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
  const norm = (v, a, b) => limitar((v - a) / (b - a), 0, 1);
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  const REDUCIDO = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const INTERVALO = 30 * 60 * 1000;   // cada cuánto se actualiza solo
  const nombreDep = n => n === 'Asunción' ? 'Asunción (capital)' : n;

  // ============ 2) CAPAS DEL MAPA ============
  // Cada capa dice qué dato mostrar, en qué rango y con qué colores.
  const CAPAS = {
    temp: { icono: '🌡️', nombre: 'Temperatura', campo: 'temperature_2m', min: 5, max: 40, dec: 0, corto: '°', largo: '°C',
      color: v => escalaTemp(v), alto: '🔥 Más calurosa', bajo: '❄️ Más fría' },
    humedad: { icono: '💧', nombre: 'Humedad', campo: 'relative_humidity_2m', min: 20, max: 100, dec: 0, corto: '%', largo: '%',
      color: v => `hsl(${Math.round(45 + norm(v, 20, 100) * 170)}, 75%, 55%)`, alto: '💧 Más húmeda', bajo: '🏜️ Más seca' },
    viento: { icono: '💨', nombre: 'Viento', campo: 'wind_speed_10m', min: 0, max: 40, dec: 0, corto: ' km/h', largo: ' km/h',
      color: v => `hsl(${Math.round(165 + norm(v, 0, 40) * 135)}, 75%, 55%)`, alto: '💨 Más ventosa', bajo: '🍃 Más calma' },
    lluvia: { icono: '🌧️', nombre: 'Lluvia', campo: 'precipitation', min: 0, max: 4, dec: 1, corto: ' mm', largo: ' mm',
      color: v => { const x = norm(v, 0, 4); return `hsl(210, ${Math.round(18 + x * 67)}%, ${Math.round(68 - x * 30)}%)`; },
      alto: '🌧️ Más lluvia', bajo: '☀️ Más seca' }
  };
  // Escala de temperatura: azul (frío) → verde agua (templado) → amarillo → naranja → rojo (calor)
  const PARADAS_TEMP = [[5, '#3b6cf6'], [12, '#38bdf8'], [19, '#5eead4'], [25, '#fde047'], [30, '#fb923c'], [35, '#ef4444'], [40, '#be123c']];
  function escalaTemp(v) {
    const P = PARADAS_TEMP, x = limitar(v, P[0][0], P[P.length - 1][0]);
    let i = 1; while (i < P.length - 1 && x > P[i][0]) i++;
    const [t0, c0] = P[i - 1], [t1, c1] = P[i], k = (x - t0) / (t1 - t0);
    const a = [1, 3, 5].map(j => parseInt(c0.slice(j, j + 2), 16)), b = [1, 3, 5].map(j => parseInt(c1.slice(j, j + 2), 16));
    return `rgb(${a.map((y, j) => Math.round(y + (b[j] - y) * k)).join(',')})`;
  }
  // Para TEXTO sobre fondo claro, los colores vivos (amarillo, verde agua) se oscurecen para que se lean bien
  const esClaro = () => document.documentElement.dataset.tema === 'claro';
  const paraTexto = c => esClaro() ? `oklch(from ${c} 0.56 calc(c * 1.35) h)` : c;   // mismo tono, más oscuro e intenso
  let capaId = 'temp';
  const capa = () => CAPAS[capaId];
  const esNumero = v => typeof v === 'number' && isFinite(v);
  const fmt = (v, largo) => {
    if (!esNumero(v)) return '--';
    const c = capa();
    const x = capaId === 'temp' ? aU(v) : v;
    return (c.dec ? x.toFixed(c.dec) : Math.round(x)) + (capaId === 'temp' && largo ? '°' + UT() : largo ? c.largo : c.corto);
  };
  let usaF = leer('clima-py-f', '0') === '1';          // °F o °C (los datos siempre se guardan en °C)
  const aU = t => usaF ? t * 9 / 5 + 32 : t;
  const UT = () => usaF ? 'F' : 'C';
  const grados = t => esNumero(t) ? Math.round(aU(t)) + '°' : '--';

  // ============ 3) ESTADO DE LA APP ============
  function leer(clave, def) { try { return localStorage.getItem(clave) || def; } catch (e) { return def; } }
  function leerJSON(clave, def) { try { const raw = localStorage.getItem(clave); if (!raw) return def; const v = JSON.parse(raw); return v == null ? def : v; } catch (e) { return def; } }
  // Datos externos o guardados nunca se consideran válidos solo por ser JSON.
  function climaValido(v) { return !!v && typeof v === 'object' && !Array.isArray(v) && ['temperature_2m','relative_humidity_2m','wind_speed_10m','precipitation','weather_code','is_day'].some(k => esNumero(v[k])); }
  function limpiarDatosGuardados(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const salida = {};
    for (const [n, d] of Object.entries(v)) {
      if (typeof n === 'string' && porNombre.has(n) && climaValido(d)) salida[n] = d;
    }
    return salida;
  }
  function guardar(clave, valor) { try { localStorage.setItem(clave, String(valor)); return true; } catch (e) { avisoSeguroAlmacenamiento(); return false; } }
  let avisoAlmacenamientoMostrado = false;
  function avisoSeguroAlmacenamiento() { if (avisoAlmacenamientoMostrado) return; avisoAlmacenamientoMostrado = true; try { const el = $('aviso'); if (el) { el.textContent = 'No se pudieron guardar los cambios en este navegador.'; el.style.display = 'block'; } } catch (_) {} }

  const hashInicial = new URLSearchParams(location.hash.slice(1));
  let datos = {};                         // nombre de ciudad -> clima actual
  let seleccionada = hashInicial.get('c') || leer('clima-py-ultima', 'Asunción');
  if (!porNombre.has(seleccionada)) seleccionada = 'Asunción';
  if (CAPAS[hashInicial.get('capa')]) capaId = hashInicial.get('capa');
  const favGuardadas = leerJSON('clima-py-favs', []);
  let favoritas = new Set(Array.isArray(favGuardadas) ? favGuardadas.filter(n => typeof n === 'string' && n.length < 120 && porNombre.has(n)) : []);
  let depFiltro = '';                     // departamento filtrado ('' = todos)
  let consulta = '';                      // texto del buscador (en minúsculas)
  let pestana = 'horas';                  // pestaña del pronóstico
  let detalleActual = null;               // último detalle cargado {c, d}
  let tokenDetalle = 0;                   // sirve para ignorar respuestas viejas
  let hover = null;                       // ciudad sobre la que está el mouse en la lista
  let ultimaOk = 0, ultimoError = false, cargando = false, ultimoIntento = 0, hayDatos = false;
  const cacheDetalle = new Map();
  let horaMapa = 0, horas = null, horasT = 0, pHoras = null;   // deslizador: 0 = ahora, 1..24 = horas por delante

  // Memoria sin internet: al abrir, se muestra el último clima guardado
  (function restaurar() {
    const g = leerJSON('clima-py-datos', null);
    if (g && g.datos && Number.isFinite(g.t) && g.t > 0) { datos = limpiarDatosGuardados(g.datos); ultimaOk = g.t; hayDatos = Object.keys(datos).length > 0; ultimoError = !navigator.onLine; }
  })();

  // ============ 4) FUNCIONES AUXILIARES ============
  const CODIGOS = {
    0: ['☀️', '🌙', 'Despejado'], 1: ['🌤️', '🌙', 'Mayormente despejado'], 2: ['⛅', '☁️', 'Parcialmente nublado'],
    3: ['☁️', '☁️', 'Nublado'], 45: ['🌫️', '🌫️', 'Niebla'], 48: ['🌫️', '🌫️', 'Niebla con escarcha'],
    51: ['🌦️', '🌧️', 'Llovizna leve'], 53: ['🌦️', '🌧️', 'Llovizna'], 55: ['🌧️', '🌧️', 'Llovizna fuerte'],
    56: ['🌧️', '🌧️', 'Llovizna helada'], 57: ['🌧️', '🌧️', 'Llovizna helada fuerte'],
    61: ['🌧️', '🌧️', 'Lluvia leve'], 63: ['🌧️', '🌧️', 'Lluvia'], 65: ['🌧️', '🌧️', 'Lluvia fuerte'],
    66: ['🌧️', '🌧️', 'Lluvia helada'], 67: ['🌧️', '🌧️', 'Lluvia helada fuerte'],
    71: ['🌨️', '🌨️', 'Nieve leve'], 73: ['🌨️', '🌨️', 'Nieve'], 75: ['🌨️', '🌨️', 'Nieve fuerte'], 77: ['🌨️', '🌨️', 'Granizo fino'],
    80: ['🌦️', '🌧️', 'Chubascos leves'], 81: ['🌧️', '🌧️', 'Chubascos'], 82: ['⛈️', '⛈️', 'Chubascos fuertes'],
    85: ['🌨️', '🌨️', 'Chubascos de nieve'], 86: ['🌨️', '🌨️', 'Chubascos de nieve fuertes'],
    95: ['⛈️', '⛈️', 'Tormenta'], 96: ['⛈️', '⛈️', 'Tormenta con granizo'], 99: ['⛈️', '⛈️', 'Tormenta fuerte con granizo']
  };
  function clima(codigo, esDia) {
    const c = CODIGOS[codigo] || ['🌡️', '🌡️', 'Sin datos'];
    return { emoji: esDia === 0 ? c[1] : c[0], texto: c[2] };
  }
  const dirViento = g => esNumero(g) ? ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(g / 45) % 8] : '';
  const fmtHora = f => f.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false });

  function aviso(texto) {
    const el = $('aviso');
    el.textContent = texto;
    el.style.display = 'block';
    clearTimeout(aviso.t);
    aviso.t = setTimeout(() => { el.style.display = 'none'; }, 4500);
  }
  const anunciar = t => { $('anuncio').textContent = t; };

  // Distancia entre dos puntos de la Tierra (fórmula de Haversine), en km
  function distanciaKm(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
      Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
  }

  // Valor de la capa actual para una ciudad (o null si no hay dato)
  function valor(c) {
    if (horaMapa > 0 && horas && horas[c.n]) {
      const v = horas[c.n][capa().campo][indiceAhora(c.n) + horaMapa];
      return esNumero(v) ? v : null;
    }
    const d = datos[c.n];
    const v = d ? d[capa().campo] : null;
    return esNumero(v) ? v : null;
  }
  const colorValor = v => v === null ? '#64748b' : capa().color(v);
  const filtroActivo = () => !!(consulta || depFiltro);
  const normalizarTexto = t => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
  const coincide = c => (!depFiltro || c.dep === depFiltro) && (!consulta || normalizarTexto(c.n).includes(normalizarTexto(consulta)));

  // ============ 5) PEDIR DATOS A LA API ============
  class ErrorApi extends Error { constructor(tipo) { super(tipo); this.tipo = tipo; } }

  // fetch con tiempo máximo y un reintento si falla la red
  async function pedir(url, ms = 12000, reintentos = 1) {
    for (let i = 0; i <= reintentos; i++) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), ms);
      try {
        const resp = await fetch(url, { signal: ctl.signal });
        if (resp.status === 429) throw new ErrorApi('limite');
        if (!resp.ok) throw new ErrorApi('http' + resp.status);
        const json = await resp.json();
        if (json == null || typeof json !== 'object') throw new ErrorApi('json');
        return json;
      } catch (e) {
        if (i === reintentos || (e && e.tipo === 'limite')) throw e;
        await esperar(800 * (i + 1));
      } finally {
        clearTimeout(t);
      }
    }
  }

  // ---- Una sola fuente de datos: Open-Meteo (clima, calidad del aire y búsqueda de lugares) ----
  // Open-Meteo ya mezcla por su cuenta los mejores modelos para cada punto, así que se pide una sola vez, sin combinar nada aquí.
  const OM = { clima: 'https://api.open-meteo.com/v1/forecast', aire: 'https://air-quality-api.open-meteo.com/v1/air-quality', lugares: 'https://geocoding-api.open-meteo.com/v1/search' };
  const pedirClima = (url, ms, reintentos) => pedir(url, ms, reintentos);

  const TAM_LOTE = 40;
  // Las ciudades principales (g 1 a 3) se piden en cada actualización. Las localidades extra (g 4) solo cada ~55 min
  // (o de inmediato si son favoritas, la elegida, o todavía no tienen datos), para no gastar de más el límite de consultas de Open-Meteo.
  const EXTRAS_MS = 55 * 60 * 1000;
  let ultimaExtras = 0;
  // ---- Datos compartidos ----
  // GitHub Actions baja el clima de todas las ciudades cada 30 min y lo deja en la rama "datos" del repositorio.
  // Así cada visita lee un archivo en vez de pedirle ~200 ciudades a Open-Meteo (cuyo límite gratuito es de 600 consultas por minuto por red).
  const DATOS_URL_MANUAL = '';          // con un dominio propio: pon aquí la dirección de la carpeta que contiene datos.json (sin "/" al final)
  let usoCompartido = false;
  function baseCompartida() {
    if (DATOS_URL_MANUAL) return DATOS_URL_MANUAL.replace(/\/$/, '');
    const h = location.hostname;
    if (!/\.github\.io$/i.test(h)) return null;                     // fuera de GitHub Pages: se consulta directo, como antes
    return `https://raw.githubusercontent.com/${h.split('.')[0]}/${location.pathname.split('/')[1] || h}/datos`;
  }
  async function cargarCompartidos() {
    const base = baseCompartida();
    if (!base) return null;
    try {
      const j = await pedir(`${base}/datos.json?v=${Math.floor(Date.now() / 300000)}`, 8000, 0);
      if (!j || !j.datos || !esNumero(j.t)) return null;
      let nuevos = 0;
      Object.keys(j.lugares || {}).forEach(n => { const v = j.lugares[n]; if (v && v.dep && esNumero(v.lat) && esNumero(v.lon) && sumarLugar(n, v.dep, v.lat, v.lon)) nuevos++; });
      if (nuevos) pintarConteos();
      const cubre = new Set();
      CIUDADES.forEach(c => { const d = j.datos[c.n]; if (d && esNumero(d.temperature_2m)) { datos[c.n] = d; cubre.add(c.n); } });
      if (!cubre.size) return null;
      usoCompartido = true;
      return { t: j.t, cubre, fresco: Date.now() - j.t < 100 * 60000 };
    } catch (e) { return null; }
  }
  async function cargarTodas(forzar) {
    // 1) Datos recientes ya guardados en el dispositivo: no se pide nada (abrir la app varias veces seguidas no gasta consultas)
    if (!forzar && hayDatos && Date.now() - ultimaOk < 10 * 60000 && CIUDADES.every(c => c.g === 4 || datos[c.n])) return { ok: 1, total: 1, omitido: true };
    // 2) Archivo compartido (lo actualiza GitHub cada 30 min)
    const comp = await cargarCompartidos();
    // 3) Directo a Open-Meteo solo lo que falta
    const caducan = Date.now() - ultimaExtras > EXTRAS_MS;
    let lista;
    if (comp && comp.fresco) lista = CIUDADES.filter(c => !comp.cubre.has(c.n) && (caducan || !datos[c.n] || favoritas.has(c.n) || c.n === seleccionada));
    else if (comp) lista = CIUDADES.filter(c => !comp.cubre.has(c.n) || c.g <= 2 || favoritas.has(c.n) || c.n === seleccionada);   // archivo viejo: se usa y solo se refrescan principales y favoritas
    else lista = CIUDADES.filter(c => c.g < 4 || caducan || !datos[c.n] || favoritas.has(c.n) || c.n === seleccionada);
    const lotes = [];
    for (let i = 0; i < lista.length; i += TAM_LOTE) lotes.push(lista.slice(i, i + TAM_LOTE));
    let ok = 0;
    if (lotes.length) {
      const res = await Promise.allSettled(lotes.map(async lote => {
        const url = `${OM.clima}?latitude=${lote.map(c => c.lat).join(',')}` +
          `&longitude=${lote.map(c => c.lon).join(',')}` +
          `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code,is_day&timezone=America%2FAsuncion`;
        const json = await pedirClima(url);
        (Array.isArray(json) ? json : [json]).forEach((d, i) => { if (d && d.current && lote[i]) datos[lote[i].n] = d.current; });
      }));
      ok = res.filter(r => r.status === 'fulfilled').length;
      if (!ok && !comp) throw res[0].reason;
    }
    if (caducan || (comp && comp.fresco)) ultimaExtras = Date.now();
    return { ok: lotes.length ? ok : 1, total: lotes.length || 1, t: comp && comp.fresco ? comp.t : undefined };
  }

  // ---- Probabilidad de lluvia: se calcula con ensambles (muchas simulaciones) de 4 modelos, no con el valor básico ----
  const OM_ENS = 'https://ensemble-api.open-meteo.com/v1/ensemble';
  const MODELOS_ENS = ['ecmwf_ifs025', 'gfs025', 'icon_seamless', 'gem_global'];
  const aMultiplo5 = p => Math.round(p * 20) * 5;
  const promedio = a => a.reduce((x, y) => x + y, 0) / a.length;
  function pedirEnsamble(c) {
    const url = `${OM_ENS}?latitude=${c.lat}&longitude=${c.lon}&models=${MODELOS_ENS.join(',')}&hourly=precipitation,temperature_2m&timezone=America%2FAsuncion&forecast_days=6`;
    return pedir(url, 15000, 0).catch(() => null);   // si falla, se queda con la probabilidad básica
  }
  // ---- Rango probable de temperatura (ensambles) ----
  // Se mira cuánto se abren las simulaciones: del 10 % al 90 % de la máxima y la mínima de cada día (cada modelo pesa igual).
  // Esa dispersión se pone alrededor del pronóstico que muestra la app, para que el rango siempre sea coherente con el número principal.
  function percentilPond(items, q) {
    const o = items.slice().sort((a, b) => a.v - b.v), tot = o.reduce((a, x) => a + x.w, 0);
    let acc = 0;
    for (const x of o) { acc += x.w; if (acc / tot >= q) return x.v; }
    return o[o.length - 1].v;
  }
  function rangosTemperatura(d, H) {
    const porModelo = {};
    Object.keys(H).forEach(k => {
      if (!Array.isArray(H[k]) || !(k === 'temperature_2m' || k.startsWith('temperature_2m_'))) return;
      const m = MODELOS_ENS.find(x => k.endsWith('_' + x)) || 'unico';
      (porModelo[m] = porModelo[m] || []).push(H[k]);
    });
    const modelos = Object.values(porModelo);
    if (!modelos.length) return null;
    const dias = {};
    H.time.forEach((t, i) => { const f = String(t).slice(0, 10); (dias[f] = dias[f] || []).push(i); });
    const sal = { max: [], min: [] };
    d.daily.time.forEach((f, k) => {
      sal.max[k] = null; sal.min[k] = null;
      const idx = dias[f];
      if (!idx || idx.length < 20) return;                         // día incompleto: sin rango
      const mxs = [], mns = [];
      modelos.forEach(ms => ms.forEach(s => {
        const v = idx.map(i => s[i]).filter(esNumero);
        if (v.length < 20) return;
        mxs.push({ v: Math.max(...v), w: 1 / ms.length }); mns.push({ v: Math.min(...v), w: 1 / ms.length });
      }));
      if (mxs.length < 10) return;
      const alrededor = (arr, base) => {
        if (!esNumero(base)) return null;
        const med = percentilPond(arr, 0.5);
        return [base + percentilPond(arr, 0.1) - med, base + percentilPond(arr, 0.9) - med].map(x => Math.round(x * 10) / 10);
      };
      sal.max[k] = alrededor(mxs, d.daily.temperature_2m_max[k]);
      sal.min[k] = alrededor(mns, d.daily.temperature_2m_min[k]);
    });
    return sal.max.some(Boolean) ? sal : null;
  }
  function aplicarEnsamble(d, e) {
    try {
      const H = e && e.hourly;
      if (!H || !Array.isArray(H.time)) return false;
      // Columnas "precipitation_memberNN_modelo": se agrupan por modelo para que cada modelo pese igual
      const porModelo = {};
      Object.keys(H).forEach(k => {
        if (!Array.isArray(H[k]) || !(k === 'precipitation' || k.startsWith('precipitation_'))) return;
        const m = MODELOS_ENS.find(x => k.endsWith('_' + x)) || 'unico';
        (porModelo[m] = porModelo[m] || []).push(H[k]);
      });
      const modelos = Object.values(porModelo);
      if (!modelos.length) return false;
      // Por hora: % de simulaciones con al menos 0,1 mm
      const pHora = H.time.map((_, i) => {
        const ps = modelos.map(ms => { const v = ms.map(s => s[i]).filter(esNumero); return v.length ? v.filter(x => x >= 0.1).length / v.length : null; }).filter(x => x !== null);
        return ps.length ? promedio(ps) : null;
      });
      // Por día: % de simulaciones con al menos 1 mm en el día completo (así se calcula la "probabilidad de lluvia del día")
      const dias = {};
      H.time.forEach((t, i) => { const f = String(t).slice(0, 10); (dias[f] = dias[f] || []).push(i); });
      const pDia = {};
      Object.keys(dias).forEach(f => {
        const idx = dias[f];
        if (idx.length < 20) return;                                   // día incompleto: se deja el valor básico
        const ps = modelos.map(ms => { const sumas = ms.map(s => idx.reduce((a, i) => a + (esNumero(s[i]) ? s[i] : 0), 0)); return sumas.filter(x => x >= 1).length / sumas.length; });
        pDia[f] = promedio(ps);
      });
      const pos = new Map(H.time.map((t, i) => [String(t), i]));
      d.hourly.precipitation_probability = d.hourly.time.map((t, k) => { const i = pos.get(String(t)); return i != null && pHora[i] !== null ? aMultiplo5(pHora[i]) : d.hourly.precipitation_probability[k]; });
      d.daily.precipitation_probability_max = d.daily.time.map((f, k) => pDia[f] !== undefined ? aMultiplo5(pDia[f]) : d.daily.precipitation_probability_max[k]);
      d.probFuente = 'ensamble';
      try { d.rangoDia = rangosTemperatura(d, H); } catch (err2) { d.rangoDia = null; }   // si falla, solo se omite el rango
      return true;
    } catch (err) { return false; }
  }
  const notaProb = d => `<p class="ayuda">${d.probFuente === 'ensamble'
    ? 'Probabilidad de lluvia calculada con ensambles de 4 modelos (ECMWF, GFS, ICON y GEM): porcentaje de simulaciones con lluvia (≥ 0,1 mm por hora; ≥ 1 mm en el día).'
    : 'Probabilidad básica de Open-Meteo (no se pudo consultar el ensamble de modelos).'}${d.rangoDia ? ' La franja clara detrás de cada barra de temperatura es el rango probable (del 10 % al 90 % de las simulaciones); cuanto más ancha, menos seguros están los modelos.' : ''}</p>`;

  // El detalle (humedad, viento, horas, días) se pide solo de la ciudad elegida
  async function cargarDetalle(c) {
    const guardado = cacheDetalle.get(c.n);
    if (guardado && Date.now() - guardado.t < 5 * 60 * 1000) return guardado.d;
    const url = `${OM.clima}?latitude=${c.lat}&longitude=${c.lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl` +
      `&hourly=temperature_2m,precipitation_probability,weather_code,is_day,uv_index&minutely_15=precipitation` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset` +
      `&timezone=America%2FAsuncion&forecast_days=6`;
    const pEns = pedirEnsamble(c);                       // se pide al mismo tiempo que el pronóstico
    let d;
    try { d = await pedirClima(url); }
    catch (e) { const v = leerJSON('clima-py-det-' + c.n, null); if (v && typeof v === 'object' && v.current && v.hourly && v.daily) return v; throw e; }   // sin internet: último detalle guardado (validado)
    if (!d || !d.current || !d.hourly || !d.daily) throw new ErrorApi('datos');
    conObservacionDetalle(c, d);                         // cerca de un aeropuerto: se usan los valores medidos
    d.proxh = resumirProximaHora(d); delete d.minutely_15;
    aplicarEnsamble(d, await pEns);
    guardar('clima-py-det-' + c.n, JSON.stringify(d));
    cacheDetalle.set(c.n, { t: Date.now(), d });
    return d;
  }

  // ---- Observaciones reales: METAR de los aeropuertos de Paraguay (aviationweather.gov) ----
  // El modelo CALCULA el clima; el aeropuerto lo MIDE. Cerca de un aeropuerto (≤ 25 km) se usan los valores medidos.
  // En el resto del país se muestra cuánto difiere hoy el modelo de lo medido, para que se pueda juzgar si es realista.
  // Si esta fuente falla (sin internet, bloqueada, etc.), la app sigue funcionando solo con el modelo.
  const URL_METAR = 'https://aviationweather.gov/api/data/metar?bbox=-27.7,-62.7,-19.2,-54.2&hours=3&format=json';
  const RADIO_OBS = 25, RADIO_REF = 250;             // km: usar el dato medido / mostrar la estación de referencia
  const EDAD_OBS = 100 * 60, EDAD_MAX = 3 * 3600;    // segundos: observación "fresca" / máxima edad que se guarda
  let estaciones = [];                               // [{id, nombre, lat, lon, t, temp, hum, viento, dir, pres, wx, modelo, dif}]
  const escObs = x => String(x).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  // Humedad relativa a partir de temperatura y punto de rocío (fórmula de Magnus)
  const humRel = (t, td) => { const f = x => Math.exp(17.625 * x / (243.04 + x)); return esNumero(t) && esNumero(td) ? Math.min(100, 100 * f(td) / f(t)) : null; };

  function leerEstaciones(lista) {
    const ult = {};
    (Array.isArray(lista) ? lista : []).forEach(o => {
      if (!o || !/^SG/.test(String(o.icaoId))) return;                  // "SG..." = aeropuertos de Paraguay
      const t = esNumero(o.obsTime) ? o.obsTime : Date.parse(String(o.reportTime || '').replace(' ', 'T') + 'Z') / 1000;
      if (![o.lat, o.lon, o.temp, t].every(esNumero) || o.temp < -10 || o.temp > 55) return;
      if (!ult[o.icaoId] || t > ult[o.icaoId].t) ult[o.icaoId] = { o, t };
    });
    const ahora = Date.now() / 1000;
    return Object.values(ult).filter(x => ahora - x.t <= EDAD_MAX).map(({ o, t }) => {
      const pres = [o.slp, o.altim].find(p => esNumero(p) && p > 900 && p < 1100);
      return {
        id: o.icaoId, nombre: String(o.name || o.icaoId).split(',')[0].trim(), lat: o.lat, lon: o.lon, t,
        temp: o.temp, hum: humRel(o.temp, o.dewp), viento: esNumero(o.wspd) ? o.wspd * 1.852 : null,   // nudos -> km/h
        dir: esNumero(o.wdir) ? o.wdir : null, pres: pres === undefined ? null : pres, wx: String(o.wxString || '')
      };
    });
  }

  // Ciudad -> aeropuerto más cercano (dentro de un radio)
  function estacionCerca(c, radio) {
    let mejor = null, dm = Infinity;
    estaciones.forEach(s => { const k = distanciaKm(c.lat, c.lon, s.lat, s.lon); if (k < dm) { dm = k; mejor = s; } });
    return mejor && dm <= radio ? { s: mejor, km: dm } : null;
  }

  // Devuelve el "current" del modelo corregido con lo medido en el aeropuerto cercano (si hay uno y es reciente)
  const CODIGOS_LLUVIA = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
  function conObservacion(c, a) {
    const e = a && estacionCerca(c, RADIO_OBS);
    if (!e || Date.now() / 1000 - e.s.t > EDAD_OBS) return a;
    const s = e.s, b = Object.assign({}, a), dT = esNumero(a.temperature_2m) ? s.temp - a.temperature_2m : 0;
    b.temperature_2m = s.temp;
    if (esNumero(b.apparent_temperature)) b.apparent_temperature += dT;      // la sensación se corre igual que la temperatura
    if (esNumero(s.hum)) b.relative_humidity_2m = Math.round(s.hum);
    if (esNumero(s.viento)) b.wind_speed_10m = Math.round(s.viento);
    if (esNumero(s.dir)) b.wind_direction_10m = s.dir;
    if (esNumero(s.pres)) b.pressure_msl = s.pres;
    // Tiempo presente informado por el aeropuerto (se ignoran "VC" = en las cercanías y "RE" = reciente)
    const tk = s.wx.split(/\s+/).filter(x => x && !x.startsWith('VC') && !x.startsWith('RE'));
    if (tk.some(x => x.includes('TS'))) b.weather_code = 95;
    else if (!CODIGOS_LLUVIA.includes(a.weather_code) && tk.some(x => x.includes('RA') || x.includes('DZ'))) b.weather_code = tk.some(x => x.includes('RA')) ? 61 : 51;
    else if (![45, 48].includes(a.weather_code) && tk.some(x => x.includes('FG'))) b.weather_code = 45;
    b.obs = { id: s.id, nombre: s.nombre, km: Math.round(e.km), t: s.t };
    return b;
  }
  // En el pronóstico detallado, la diferencia de hoy se va apagando en las horas siguientes (el modelo "parte" de lo medido)
  function conObservacionDetalle(c, d) {
    const antes = d.current && d.current.temperature_2m;
    d.current = conObservacion(c, d.current);
    if (!d.current || !d.current.obs || !esNumero(antes)) return;
    const dT = d.current.temperature_2m - antes, i0 = horaInicio(d), T = d.hourly.temperature_2m;
    for (let k = 0; k < 12 && i0 + k < T.length; k++) if (esNumero(T[i0 + k])) T[i0 + k] += dT * Math.exp(-k / 4);
  }

  // Temperatura que el modelo calculaba para la hora de cada observación -> diferencia (modelo − medido)
  async function compararModelo(lista) {
    if (!lista.length) return;
    const url = `${OM.clima}?latitude=${lista.map(s => s.lat).join(',')}&longitude=${lista.map(s => s.lon).join(',')}` +
      `&hourly=temperature_2m&past_days=1&forecast_days=1&timezone=GMT`;
    const json = await pedirClima(url, 10000, 0);
    (Array.isArray(json) ? json : [json]).forEach((d, i) => {
      const s = lista[i], H = d && d.hourly;
      if (!s || !H || !Array.isArray(H.time) || !Array.isArray(H.temperature_2m)) return;
      const hora = new Date(Math.round(s.t / 3600) * 3600 * 1000).toISOString().slice(0, 13);   // "AAAA-MM-DDTHH" (UTC)
      const k = H.time.findIndex(t => String(t).slice(0, 13) === hora);
      if (k >= 0 && esNumero(H.temperature_2m[k])) { s.modelo = H.temperature_2m[k]; s.dif = s.modelo - s.temp; }
    });
  }
  async function cargarObservaciones() {
    try {
      const lista = leerEstaciones(await pedir(URL_METAR, 9000, 0));
      if (!lista.length) return;
      estaciones = lista;
      await compararModelo(lista);
    } catch (e) { /* sin observaciones: se sigue con el modelo */ }
  }

  const difTxt = x => (x >= 0 ? '+' : '−') + Math.abs(usaF ? x * 1.8 : x).toFixed(1).replace('.', ',') + '°' + UT();
  const haceTxt = t => { const m = Math.max(0, Math.round((Date.now() / 1000 - t) / 60)); return m < 90 ? m + ' min' : Math.round(m / 60) + ' h'; };
  function htmlObs(c, a) {
    const e = estacionCerca(c, RADIO_REF);
    if (!e) return '';
    const s = e.s, km = Math.round(e.km), lugar = `aeropuerto de ${escObs(s.nombre)} (${escObs(s.id)})`;
    const usada = !!(a && a.obs && a.obs.id === s.id);
    let txt = usada
      ? `📡 <b>Dato medido</b> (temperatura, humedad, viento y presión) en el ${lugar}, a ${km} km, hace ${haceTxt(s.t)}: ${grados(s.temp)}${UT()}.`
      : `📡 <b>Referencia real:</b> el ${lugar}, a ${km} km, midió ${grados(s.temp)}${UT()} hace ${haceTxt(s.t)}.`;
    if (esNumero(s.dif)) txt += usada ? ` El modelo calculaba ${grados(s.modelo)}${UT()} (${difTxt(s.dif)}).` : ` En ese punto el modelo calculaba ${grados(s.modelo)}${UT()} (${difTxt(s.dif)}).`;
    const v = estaciones.filter(x => esNumero(x.dif));
    if (v.length >= 3) {
      const err = promedio(v.map(x => Math.abs(x.dif))), sesgo = promedio(v.map(x => x.dif));
      txt += `<br>Hoy, en ${v.length} aeropuertos del país, el modelo se desvía en promedio ${(usaF ? err * 1.8 : err).toFixed(1).replace('.', ',')}°${UT()} (sesgo ${difTxt(sesgo)}).`;
    }
    return `<div class="verif">${txt}</div>`;
  }

  // ============ 6) MAPA ============
  const svg = $('mapa');
  // Proyección: convierte longitud/latitud en posición X/Y del dibujo.
  // La longitud se multiplica por cos(24.5°) para que el país no se vea "estirado".
  const COS = Math.cos(24.5 * Math.PI / 180);
  const K = 62;       // unidades del dibujo por cada grado de latitud
  const PAD = 0.45;   // margen en grados alrededor del país
  const todosPts = GEO.deps.flatMap(d => d.r.flat());
  let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
  todosPts.forEach(p => { lonMin = Math.min(lonMin, p[0]); lonMax = Math.max(lonMax, p[0]); latMin = Math.min(latMin, p[1]); latMax = Math.max(latMax, p[1]); });
  const px = lon => (lon - lonMin + PAD) * COS * K;
  const py = lat => (latMax + PAD - lat) * K;
  const W = (lonMax - lonMin + 2 * PAD) * COS * K;
  const H = (latMax - latMin + 2 * PAD) * K;
  const ZOOM_MAX = 12;

  // Convierte un anillo de coordenadas en el texto "M x y L x y ... Z" que entiende SVG
  const trazo = anillo => 'M' + anillo.map(p => px(p[0]).toFixed(1) + ' ' + py(p[1]).toFixed(1)).join('L') + 'Z';

  // Estas partes del mapa no cambian: se calculan una sola vez
  const trazoVecinos = Object.values(GEO.vecinos).flat().map(trazo);
  const trazoDeps = GEO.deps.map(d => ({ n: d.n, d: d.r.map(trazo).join('') }));
  let trazoDistritos = GEO.dist.map(rs => rs.map(trazo).join('')).join('');
  const ROTULOS = [['ARGENTINA', -60.6, -26.2], ['BRASIL', -54.4, -21.2], ['BOLIVIA', -60.2, -18.95]];

  // Caja y centro de cada departamento (en unidades del dibujo), para ajustar el zoom y poner su nombre
  const infoDep = {};
  GEO.deps.forEach(d => {
    const anillo = d.r.reduce((a, b) => b.length > a.length ? b : a);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, area = 0, cx = 0, cy = 0;
    d.r.flat().forEach(p => { x0 = Math.min(x0, px(p[0])); x1 = Math.max(x1, px(p[0])); y0 = Math.min(y0, py(p[1])); y1 = Math.max(y1, py(p[1])); });
    for (let i = 0; i < anillo.length - 1; i++) {
      const ax = px(anillo[i][0]), ay = py(anillo[i][1]), bx = px(anillo[i + 1][0]), by = py(anillo[i + 1][1]);
      const cruz = ax * by - bx * ay;
      area += cruz; cx += (ax + bx) * cruz; cy += (ay + by) * cruz;
    }
    area *= 0.5;
    infoDep[d.n] = { x0, x1, y0, y1, cx: area ? cx / (6 * area) : (x0 + x1) / 2, cy: area ? cy / (6 * area) : (y0 + y1) / 2 };
  });

  let vista = { x: 0, y: 0, w: W, h: H };   // la parte del mapa que se ve (zoom y movimiento)
  const nivelZoom = () => W / vista.w;
  let animId = 0;

  function aplicarVista() {
    vista.w = limitar(vista.w, W / ZOOM_MAX, W);
    vista.h = vista.w * H / W;
    vista.x = limitar(vista.x, 0, W - vista.w);
    vista.y = limitar(vista.y, 0, H - vista.h);
    svg.setAttribute('viewBox', `${vista.x.toFixed(2)} ${vista.y.toFixed(2)} ${vista.w.toFixed(2)} ${vista.h.toFixed(2)}`);
    const z = nivelZoom();
    // Los distritos van apareciendo al acercar
    const gd = $('gDist');
    if (gd) gd.style.opacity = limitar((z - 1.8) / 1.2, 0, 1).toFixed(2);
    // Con el mapa completo, un dedo puede deslizar la página; con zoom, mueve el mapa
    svg.style.touchAction = z > 1.05 ? 'none' : 'pan-y';
    programarPuntos();
  }
  function zoomEn(factor, cx, cy) {
    animId++;
    const nw = limitar(vista.w / factor, W / ZOOM_MAX, W);
    const f = nw / vista.w;
    vista.x = cx - (cx - vista.x) * f;
    vista.y = cy - (cy - vista.y) * f;
    vista.w = nw;
    aplicarVista();
  }
  // Mueve la vista con una animación suave hasta "dest" ({x, y, w})
  function irA(dest, ms = 380) {
    const id = ++animId;
    if (REDUCIDO || ms === 0) { vista.x = dest.x; vista.y = dest.y; vista.w = dest.w; aplicarVista(); return; }
    const ini = { x: vista.x, y: vista.y, w: vista.w }, t0 = performance.now();
    (function paso(t) {
      if (id !== animId) return;
      const k = limitar((t - t0) / ms, 0, 1), e = 1 - Math.pow(1 - k, 3);
      vista.x = ini.x + (dest.x - ini.x) * e;
      vista.y = ini.y + (dest.y - ini.y) * e;
      vista.w = ini.w + (dest.w - ini.w) * e;
      aplicarVista();
      if (k < 1) requestAnimationFrame(paso);
    })(t0);
  }
  function clienteASvg(ev) {
    const r = svg.getBoundingClientRect();
    return { x: vista.x + (ev.clientX - r.left) / r.width * vista.w, y: vista.y + (ev.clientY - r.top) / r.height * vista.h };
  }
  function centrarEn(c, zoomMin) {
    const w = Math.min(vista.w, W / Math.max(zoomMin || 1, nivelZoom()));
    const h = w * H / W;
    if (nivelZoom() <= 1.05 && !zoomMin) return;
    irA({ x: px(c.lon) - w / 2, y: py(c.lat) - h / 2, w });
  }
  function ajustarA(b) {
    const w = limitar(Math.max((b.x1 - b.x0) * 1.35, (b.y1 - b.y0) * 1.35 * W / H), W / ZOOM_MAX, W);
    irA({ x: (b.x0 + b.x1) / 2 - w / 2, y: (b.y0 + b.y1) / 2 - w * H / W / 2, w });
  }

  // Promedio de la capa actual en cada departamento (para colorearlo)
  function promedioDep(nombre) {
    const vs = CIUDADES.filter(c => c.dep === nombre).map(valor).filter(v => v !== null);
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  }
  const colorDep = n => { const p = promedioDep(n); return p === null ? 'rgba(92,200,255,0.18)' : capa().color(p); };

  // Dibuja las capas fijas del mapa (vecinos, contorno, departamentos, distritos)
  function dibujarMapaBase() {
    const caminos = trazoDeps.map(dp => dp.d);
    let h = '<g>' + trazoVecinos.map(d => `<path class="vecino" d="${d}"/>`).join('') + '</g>';
    h += '<g>' + ROTULOS.map(([t, lo, la]) =>
      `<text class="rotulo-pais" x="${px(lo).toFixed(1)}" y="${py(la).toFixed(1)}" text-anchor="middle" font-size="11">${t}</text>`).join('') + '</g>';
    // Truco del contorno: un trazo grueso debajo y los departamentos tapándolo; solo se ve el borde exterior
    h += '<g>' + caminos.map(d => `<path class="contorno" d="${d}"/>`).join('') + '</g>';
    h += '<g>' + caminos.map(d => `<path class="base" d="${d}"/>`).join('') + '</g>';
    h += '<g id="gDeps">' + trazoDeps.map(dp =>
      `<path class="dep" data-dep="${dp.n}" d="${dp.d}" style="fill:${colorDep(dp.n)}"/>`).join('') + '</g>';
    h += `<g id="gDist" style="opacity:0"><path id="trazoDist" class="distritos" d="${trazoDistritos}"/></g>`;
    h += '<g id="gNomDep"></g><g id="gPuntos"></g>';
    svg.innerHTML = h;
    aplicarVista();
  }

  // Vuelve a colorear los departamentos (cuando llegan datos nuevos o cambia la capa o el filtro)
  function pintarDeps() {
    svg.querySelectorAll('.dep').forEach(el => {
      el.style.fill = colorDep(el.dataset.dep);
      el.classList.toggle('filtrado', el.dataset.dep === depFiltro);
    });
  }

  // Medir texto con un canvas (para saber cuánto ocupa cada etiqueta y evitar que se pisen)
  const ctxTexto = document.createElement('canvas').getContext('2d');
  ctxTexto.font = '600 12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const cacheAncho = new Map();
  function anchoTexto(t) {
    let w = cacheAncho.get(t);
    if (w === undefined) { w = ctxTexto.measureText(t).width; cacheAncho.set(t, w); }
    return w;
  }

  let pendiente = false;
  function programarPuntos() {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; dibujarPuntos(); });
  }

  // Dibuja puntos y etiquetas. Con el mapa completo solo se ven las ciudades más grandes;
  // al acercar aparecen las demás. Las etiquetas nunca se pisan ni se salen del mapa.
  function dibujarPuntos() {
    const g = $('gPuntos');
    if (!g) return;
    const z = nivelZoom();
    const rect = svg.getBoundingClientRect();
    const ancho = rect.width || 600, alto = rect.height || ancho * H / W;
    const esc = ancho / vista.w;                  // píxeles de pantalla por unidad del dibujo
    const rpx = 4.6 + (z - 1) * 0.5;              // radio del punto en píxeles (crece un poco al acercar)
    const maxGrado = z < 1.7 ? 2 : z < 3.2 ? 3 : 4;
    const filtrando = filtroActivo();
    const enfoque = c => c.n === seleccionada || c.n === hover;

    // 1) ¿Qué puntos se ven?
    const vis = [];
    for (const c of CIUDADES) {
      if (!enfoque(c)) { if (filtrando ? !coincide(c) : c.g > maxGrado) continue; }
      const sx = (px(c.lon) - vista.x) * esc, sy = (py(c.lat) - vista.y) * esc;
      if (sx < -20 || sx > ancho + 20 || sy < -20 || sy > alto + 20) continue;
      vis.push({ c, sx, sy, sel: c.n === seleccionada });
    }
    vis.sort((a, b) => (a.sel - b.sel));          // la elegida se dibuja encima de las demás
    const u = v => (v / esc).toFixed(2);          // de píxeles a unidades del dibujo
    const X = v => (vista.x + v / esc).toFixed(1), Y = v => (vista.y + v / esc).toFixed(1);

    let pts = '';
    vis.forEach(({ c, sx, sy, sel }) => {
      const v = valor(c);
      pts += `<circle class="punto${sel ? ' sel' : ''}" cx="${X(sx)}" cy="${Y(sy)}" r="${u(sel ? rpx * 1.35 : rpx)}" fill="${colorValor(v)}"/>`;
      if (c.n === hover && !sel) pts += `<circle class="anillo" cx="${X(sx)}" cy="${Y(sy)}" r="${u(rpx + 5)}"/>`;
      pts += `<circle class="zona" data-ciudad="${c.n}" cx="${X(sx)}" cy="${Y(sy)}" r="${u(Math.max(rpx + 3, 11))}"/>`;
    });

    // 2) Etiquetas: se prueban por prioridad y solo se dibuja la que cabe sin pisar nada
    const fpx = 12, colocadas = [];
    const puntosRect = vis.map(it => ({ it, x: it.sx - rpx - 1, y: it.sy - rpx - 1, w: 2 * rpx + 2, h: 2 * rpx + 2 }));
    const prioridad = it => it.sel ? 0 : it.c.n === hover ? 1 : it.c.g;
    const quiere = it => it.sel || it.c.n === hover || filtrando || it.c.g === 1 || (it.c.g === 2 && z >= 2) || z >= (it.c.g === 4 ? 6 : 4.5);
    const choca = (r, it) => {
      if (r.x < 3 || r.y < 3 || r.x + r.w > ancho - 3 || r.y + r.h > alto - 3) return true;
      for (const o of colocadas) if (r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h) return true;
      for (const p of puntosRect) if (p.it !== it && r.x < p.x + p.w && p.x < r.x + r.w && r.y < p.y + p.h && p.y < r.y + r.h) return true;
      return false;
    };
    let txt = '';
    vis.filter(quiere).sort((a, b) => prioridad(a) - prioridad(b) || a.sy - b.sy).forEach(it => {
      const v = valor(it.c);
      const texto = v === null ? it.c.n : `${it.c.n} ${fmt(v)}`;
      const w = anchoTexto(texto) + 4, h = fpx + 2;
      const derPrimero = it.sx < ancho * 0.55;
      const opciones = [
        { x: it.sx + rpx + 4, y: it.sy - h / 2, a: 'start', ax: it.sx + rpx + 4 + 2 },
        { x: it.sx - rpx - 4 - w, y: it.sy - h / 2, a: 'end', ax: it.sx - rpx - 4 - 2 },
        { x: it.sx - w / 2, y: it.sy - rpx - 3 - h, a: 'middle', ax: it.sx },
        { x: it.sx - w / 2, y: it.sy + rpx + 3, a: 'middle', ax: it.sx }
      ];
      if (!derPrimero) [opciones[0], opciones[1]] = [opciones[1], opciones[0]];
      let elegida = opciones.find(o => !choca({ x: o.x, y: o.y, w, h }, it.c));
      if (!elegida && it.sel) {           // la ciudad elegida siempre muestra su nombre
        elegida = opciones[0];
        elegida = { ...elegida, x: limitar(elegida.x, 3, ancho - w - 3), y: limitar(elegida.y, 3, alto - h - 3) };
        elegida.ax = elegida.a === 'end' ? elegida.x + w - 2 : elegida.a === 'middle' ? elegida.x + w / 2 : elegida.x + 2;
      }
      if (!elegida) return;
      colocadas.push({ x: elegida.x, y: elegida.y, w, h });
      txt += `<text class="etiqueta${it.sel ? ' sel' : ''}" x="${X(elegida.ax)}" y="${Y(elegida.y + h / 2 + fpx * 0.35)}" font-size="${u(fpx)}" stroke-width="${u(3)}" text-anchor="${elegida.a}">${texto}</text>`;
    });
    g.innerHTML = pts + txt;

    // 3) Nombres de los departamentos: van al final y solo si caben dentro de su área
    //    sin pisar ninguna ciudad, ningún punto ni otro nombre
    let nd = '';
    if (z < 3.2) {
      const cand = GEO.deps.filter(d => d.n !== 'Asunción').map(d => {
        const i = infoDep[d.n], nombre = d.n.toUpperCase();
        return {
          nombre, w: anchoTexto(nombre) * 10 / 12 + nombre.length * 1.3 + 4, h: 13,
          sx: (i.cx - vista.x) * esc, sy: (i.cy - vista.y) * esc, ancho: (i.x1 - i.x0) * esc
        };
      }).filter(o => o.w < o.ancho * 0.8).sort((a, b) => b.ancho - a.ancho);
      cand.forEach(o => {
        const r = { x: o.sx - o.w / 2, y: o.sy - o.h / 2, w: o.w, h: o.h };
        if (choca(r, null)) return;           // choca() también descarta lo que se sale del mapa
        colocadas.push(r);
        nd += `<text class="nom-dep" x="${X(o.sx)}" y="${Y(o.sy + 3.5)}" font-size="${u(10)}">${o.nombre}</text>`;
      });
    }
    $('gNomDep').innerHTML = nd;
  }

  // --- Interacción con el mapa: zoom, arrastrar, pellizcar, clic, teclado y tooltip ---
  const punteros = new Map();
  let inicioClic = null, seMovio = false, distPinza = 0, temporizadorPista = 0;
  const tip = $('tooltip');
  const ocultarTip = () => { tip.style.display = 'none'; };

  // La rueda sola NO hace zoom (así no te bloquea el scroll de la página); con Ctrl sí
  svg.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const p = clienteASvg(e);
      zoomEn(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025)), p.x, p.y);
    } else {
      $('pista').classList.add('on');
      clearTimeout(temporizadorPista);
      temporizadorPista = setTimeout(() => $('pista').classList.remove('on'), 1300);
    }
  }, { passive: false });

  svg.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    animId++;
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 1) { inicioClic = { x: e.clientX, y: e.clientY }; seMovio = false; }
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      distPinza = Math.hypot(a.x - b.x, a.y - b.y);
      seMovio = true;
    }
  });
  window.addEventListener('pointermove', e => {
    if (!punteros.has(e.pointerId)) return;
    const previo = punteros.get(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = svg.getBoundingClientRect();
    if (punteros.size === 1 && inicioClic) {
      if (!seMovio && Math.hypot(e.clientX - inicioClic.x, e.clientY - inicioClic.y) > 5) {
        seMovio = true; svg.classList.add('arrastrando'); ocultarTip();
      }
      if (seMovio) {
        vista.x -= (e.clientX - previo.x) / r.width * vista.w;
        vista.y -= (e.clientY - previo.y) / r.height * vista.h;
        aplicarVista();
      }
    } else if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (distPinza > 0) {
        const centro = clienteASvg({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
        zoomEn(dist / distPinza, centro.x, centro.y);
      }
      distPinza = dist;
    }
  });
  function soltar(e) {
    if (!punteros.has(e.pointerId)) return;
    const eraClic = punteros.size === 1 && !seMovio && e.type === 'pointerup';
    punteros.delete(e.pointerId);
    svg.classList.remove('arrastrando');
    if (punteros.size < 2) distPinza = 0;
    if (eraClic && e.target && e.target.closest) {
      const ciudad = e.target.closest('[data-ciudad]');
      const dep = e.target.closest('[data-dep]');
      if (ciudad) elegir(ciudad.dataset.ciudad, { desdeMapa: true });
      else if (dep) filtrarDep(dep.dataset.dep === depFiltro ? '' : dep.dataset.dep);
    }
  }
  window.addEventListener('pointerup', soltar);
  window.addEventListener('pointercancel', soltar);

  // Teclado: + / - para el zoom, 0 para ver todo, flechas para moverse
  svg.addEventListener('keydown', e => {
    const cx = vista.x + vista.w / 2, cy = vista.y + vista.h / 2;
    let usado = true;
    if (e.key === '+' || e.key === '=') zoomEn(1.4, cx, cy);
    else if (e.key === '-' || e.key === '_') zoomEn(1 / 1.4, cx, cy);
    else if (e.key === '0') irA({ x: 0, y: 0, w: W });
    else if (e.key === 'ArrowLeft') { animId++; vista.x -= vista.w * 0.15; aplicarVista(); }
    else if (e.key === 'ArrowRight') { animId++; vista.x += vista.w * 0.15; aplicarVista(); }
    else if (e.key === 'ArrowUp') { animId++; vista.y -= vista.h * 0.15; aplicarVista(); }
    else if (e.key === 'ArrowDown') { animId++; vista.y += vista.h * 0.15; aplicarVista(); }
    else usado = false;
    if (usado) e.preventDefault();
  });

  // Tooltip (el globito que aparece al pasar el mouse)
  svg.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || e.buttons !== 0) return;
    const ciudad = e.target.closest('[data-ciudad]');
    const dep = e.target.closest('[data-dep]');
    let html = '';
    if (ciudad) {
      const c = porNombre.get(ciudad.dataset.ciudad), d = datos[c.n];
      const w = d ? clima(d.weather_code, d.is_day).emoji + ' ' : '';
      html = `<b>${c.n}</b> · ${nombreDep(c.dep)}<br>${w}${d ? grados(d.temperature_2m) + UT() : 'sin datos'}`;
      if (capaId !== 'temp' && valor(c) !== null) html += ` · ${capa().nombre.toLowerCase()} ${fmt(valor(c), true)}`;
    } else if (dep) {
      const p = promedioDep(dep.dataset.dep);
      const n = CIUDADES.filter(c => c.dep === dep.dataset.dep).length;
      html = `<b>${nombreDep(dep.dataset.dep)}</b><br>${p === null ? 'Sin datos' : 'Promedio ' + fmt(p, true)} · ${n} ciudad${n === 1 ? '' : 'es'}`;
    }
    if (!html) { ocultarTip(); return; }
    const caja = $('mapaCont').getBoundingClientRect();
    tip.innerHTML = html;
    tip.style.display = 'block';
    let x = e.clientX - caja.left + 14, y = e.clientY - caja.top + 14;
    if (x + tip.offsetWidth > caja.width - 4) x = e.clientX - caja.left - tip.offsetWidth - 14;
    if (y + tip.offsetHeight > caja.height - 4) y = e.clientY - caja.top - tip.offsetHeight - 14;
    tip.style.left = Math.max(4, x) + 'px';
    tip.style.top = Math.max(4, y) + 'px';
  });
  svg.addEventListener('pointerleave', ocultarTip);

  $('zMas').addEventListener('click', () => zoomEn(1.6, vista.x + vista.w / 2, vista.y + vista.h / 2));
  $('zMenos').addEventListener('click', () => zoomEn(1 / 1.6, vista.x + vista.w / 2, vista.y + vista.h / 2));
  $('zReset').addEventListener('click', () => irA({ x: 0, y: 0, w: W }));

  // Cartelito sobre el mapa con la ciudad elegida
  function pintarChip() {
    const c = porNombre.get(seleccionada), d = datos[c.n];
    $('chipSel').textContent = d ? `${clima(d.weather_code, d.is_day).emoji} ${c.n} · ${grados(d.temperature_2m)}` : c.n;
  }

  // Capas del mapa (botones) y leyenda de colores
  function pintarCapas() {
    $('capas').innerHTML = Object.entries(CAPAS).map(([id, c]) =>
      `<button class="capa${id === capaId ? ' on' : ''}" role="tab" aria-selected="${id === capaId}" data-capa="${id}">${c.icono} ${c.nombre}</button>`).join('');
    const c = capa(), paradas = [];
    for (let i = 0; i <= 14; i++) paradas.push(c.color(c.min + (c.max - c.min) * i / 14));
    $('grad').style.background = `linear-gradient(90deg, ${paradas.join(',')})`;
    $('legIni').textContent = fmt(c.min, true);
    $('legFin').textContent = fmt(c.max, true) + (capaId === 'lluvia' || capaId === 'viento' || capaId === 'humedad' ? '+' : '');
  }
  $('capas').addEventListener('click', e => {
    const b = e.target.closest('[data-capa]');
    if (!b || b.dataset.capa === capaId) return;
    capaId = b.dataset.capa;
    escribirHash();
    pintarCapas();
    refrescarVistas();
  });

  // ============ 6b) DESLIZADOR DE TIEMPO ============
  async function cargarHoras() {
    const nuevas = {}, base = baseCompartida();
    if (base) {                                                   // primero el archivo compartido (horas.json)
      try {
        const j = await pedir(`${base}/horas.json?v=${Math.floor(Date.now() / 300000)}`, 15000, 0);
        if (j && j.horas && esNumero(j.t) && Date.now() - j.t < 4 * 3600000) CIUDADES.forEach(c => { if (j.horas[c.n]) nuevas[c.n] = j.horas[c.n]; });
      } catch (e) { /* si falla se pide directo */ }
    }
    const faltan = CIUDADES.filter(c => !nuevas[c.n]), lotes = [];
    for (let i = 0; i < faltan.length; i += TAM_LOTE) lotes.push(faltan.slice(i, i + TAM_LOTE));
    await Promise.allSettled(lotes.map(async lote => {
      const url = `${OM.clima}?latitude=${lote.map(c => c.lat).join(',')}` +
        `&longitude=${lote.map(c => c.lon).join(',')}` +
        `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&timezone=America%2FAsuncion&forecast_days=2`;
      const json = await pedirClima(url);
      (Array.isArray(json) ? json : [json]).forEach((d, i) => { if (d && d.hourly && lote[i]) nuevas[lote[i].n] = d.hourly; });
    }));
    if (!Object.keys(nuevas).length) throw new ErrorApi('datos');
    horas = nuevas; horasT = Date.now();
  }
  function asegurarHoras() {
    if (horas && Date.now() - horasT < 30 * 60 * 1000) return Promise.resolve(true);
    if (!pHoras) pHoras = cargarHoras().then(() => true).catch(() => { aviso('No se pudo cargar el pronóstico por horas.'); return false; }).finally(() => { pHoras = null; });
    return pHoras;
  }
  // posición de "esta hora" dentro de los datos por hora de una ciudad
  function indiceAhora(n) {
    const ref = horaAsuncion();
    const i = horas[n].time.findIndex(t => t.slice(0, 13) === ref);
    return i < 0 ? new Date().getHours() : i;
  }
  function etiquetaHora() {
    if (!horaMapa || !horas) return 'Ahora';
    const n = Object.keys(horas)[0], f = new Date(horas[n].time[indiceAhora(n) + horaMapa]);
    return `${f.toLocaleDateString('es', { weekday: 'short' })} ${String(f.getHours()).padStart(2, '0')}:00 · en ${horaMapa} h`;
  }
  function irAHora(h) {
    horaMapa = h;
    $('hSlider').value = h;
    $('hEtq').textContent = etiquetaHora();
    refrescarVistas();
  }
  let relojMapa = null;
  function pararReloj() { clearInterval(relojMapa); relojMapa = null; $('hPlay').textContent = '▶'; $('hPlay').setAttribute('aria-label', 'Reproducir'); }
  $('hSlider').addEventListener('input', async e => {
    pararReloj();
    if (+e.target.value > 0) {
      $('hEtq').textContent = 'Cargando…';
      if (!(await asegurarHoras())) { irAHora(0); return; }
    }
    irAHora(+e.target.value);
  });
  $('hPlay').addEventListener('click', async () => {
    if (relojMapa) { pararReloj(); return; }
    $('hPlay').textContent = '⏸'; $('hPlay').setAttribute('aria-label', 'Pausar');
    $('hEtq').textContent = 'Cargando…';
    if (!(await asegurarHoras())) { irAHora(0); pararReloj(); return; }
    if (horaMapa >= 24) irAHora(0);
    relojMapa = setInterval(() => { if (horaMapa >= 24 || document.hidden) pararReloj(); else irAHora(horaMapa + 1); }, 700);
  });

  // ============ 6c) COMPARAR CIUDADES ============
  const NOMBRES = CIUDADES.map(c => c.n).sort((a, b) => a.localeCompare(b, 'es'));
  const COLORES_COMP = ['#fbbf24', '#38bdf8', '#f472b6'];
  const compGuardada = leerJSON('clima-py-comp', null);           // lo guardado puede no ser una lista (almacenamiento corrupto): se valida
  let compSel = Array.isArray(compGuardada) ? compGuardada.filter(n => typeof n === 'string' && porNombre.has(n)).slice(0, 3) : [];
  if (compSel.length < 2) compSel = ['Asunción', 'Encarnación', 'Ciudad del Este'];
  let tokenComp = 0;
  function pintarSelectsComp() {
    $('compSel').innerHTML = [0, 1, 2].map(i =>
      `<select data-i="${i}" aria-label="Ciudad ${i + 1}" style="border-left:4px solid ${COLORES_COMP[i]}">` +
      (i === 2 ? `<option value="">— ninguna —</option>` : '') +
      CIUDADES.map(c => c.n).sort((x, y) => x.localeCompare(y, 'es')).map(n => `<option${n === compSel[i] ? ' selected' : ''}>${n}</option>`).join('') + `</select>`).join('');
  }
  function graficoComp(items) {
    const W = 600, H = 190, X0 = 34, X1 = W - 10, Y0 = 14, Y1 = H - 26;
    const series = items.filter(x => x.d).map(x => {
      const d = x.d, i0 = Math.max(0, d.hourly.time.findIndex(t => t.slice(0, 13) === d.current.time.slice(0, 13)));
      return { col: x.col, v: d.hourly.temperature_2m.slice(i0, i0 + 25), t: d.hourly.time.slice(i0, i0 + 25) };
    });
    const todos = series.flatMap(s => s.v).filter(esNumero);
    if (!todos.length) return '';
    const lo = Math.floor(Math.min(...todos)) - 1, hi = Math.ceil(Math.max(...todos)) + 1;
    const px = i => X0 + (X1 - X0) * i / 24, py = v => Y1 - (Y1 - Y0) * (v - lo) / (hi - lo);
    const lineas = series.map(s => `<polyline fill="none" stroke="${s.col}" stroke-width="2.5" stroke-linejoin="round" points="${s.v.map((v, i) => esNumero(v) ? px(i).toFixed(1) + ',' + py(v).toFixed(1) : '').filter(Boolean).join(' ')}"/>`).join('');
    const ejeY = [lo, (lo + hi) / 2, hi].map(v => `<text x="${X0 - 5}" y="${py(v) + 4}" text-anchor="end">${Math.round(aU(v))}°</text><line x1="${X0}" x2="${X1}" y1="${py(v)}" y2="${py(v)}" stroke="currentColor" opacity=".15"/>`).join('');
    const ejeX = [0, 6, 12, 18, 24].map(i => `<text x="${px(i)}" y="${H - 8}" text-anchor="middle">${series[0].t[i] ? series[0].t[i].slice(11, 16) : ''}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="comp-graf" role="img" aria-label="Temperatura de las próximas 24 horas">${ejeY}${ejeX}${lineas}</svg>`;
  }
  async function pintarComparacion() {
    const mi = ++tokenComp, nombres = [...new Set(compSel.filter(Boolean))];
    $('compRes').innerHTML = '<div class="vacio">Cargando…</div>';
    const res = await Promise.allSettled(nombres.map(n => cargarDetalle(porNombre.get(n))));
    if (mi !== tokenComp) return;
    const items = nombres.map((n, i) => ({ c: porNombre.get(n), d: res[i].status === 'fulfilled' ? res[i].value : null, col: COLORES_COMP[compSel.indexOf(n)] }));
    const fila = (titulo, f) => `<tr><th scope="row">${titulo}</th>${items.map(x => `<td>${x.d ? f(x.d) : '--'}</td>`).join('')}</tr>`;
    const num = (v, u) => esNumero(v) ? Math.round(v) + u : '--';
    $('compRes').innerHTML = `${graficoComp(items)}
      <div class="comp-tabla"><table>
        <thead><tr><th></th>${items.map(x => `<th scope="col"><span class="comp-punto" style="background:${x.col}"></span>${x.c.n}</th>`).join('')}</tr></thead>
        <tbody>
          ${fila('Ahora', d => { const w = clima(d.current.weather_code, d.current.is_day); return `${w.emoji} ${w.texto}`; })}
          ${fila('Temperatura', d => `<b>${grados(d.current.temperature_2m) + UT()}</b>`)}
          ${fila('Sensación', d => grados(d.current.apparent_temperature) + UT())}
          ${fila('Máx. / mín. hoy', d => `${grados(d.daily.temperature_2m_max[0])} / ${grados(d.daily.temperature_2m_min[0])}`)}
          ${fila('Humedad', d => num(d.current.relative_humidity_2m, '%'))}
          ${fila('Viento', d => `${num(d.current.wind_speed_10m, ' km/h')} ${dirViento(d.current.wind_direction_10m)}`)}
          ${fila('Prob. de lluvia hoy', d => num(d.daily.precipitation_probability_max[0], '%'))}
          ${fila('Índice UV (máx. hoy)', d => num(d.daily.uv_index_max[0], ''))}
          ${fila('Presión', d => num(d.current.pressure_msl, ' hPa'))}
          ${fila('Mañana', d => { const w = clima(d.daily.weather_code[1], 1); return `${w.emoji} ${grados(d.daily.temperature_2m_max[1])} / ${grados(d.daily.temperature_2m_min[1])}`; })}
        </tbody></table></div>
      ${items.some(x => !x.d) ? '<p class="ayuda">No se pudo cargar alguna ciudad. Prueba de nuevo en un momento.</p>' : ''}`;
  }
  $('btnComparar').addEventListener('click', () => {
    const p = $('comparar');
    if (!p.hidden) { p.hidden = true; return; }
    p.hidden = false; pintarSelectsComp(); pintarComparacion();
    p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('compCerrar').addEventListener('click', () => { $('comparar').hidden = true; });
  $('compSel').addEventListener('change', e => {
    compSel[+e.target.dataset.i] = e.target.value;
    compSel = compSel.slice(0, 3);
    guardar('clima-py-comp', JSON.stringify(compSel.filter(Boolean)));
    pintarComparacion();
  });

  // ============ 6d) RADAR, RUTAS, LUGARES, TEMA Y UNIDAD ============
  const SVGNS = 'http://www.w3.org/2000/svg';
  function capaSvg(id, antesDe) {
    let g = $(id);
    if (!g) { g = document.createElementNS(SVGNS, 'g'); g.id = id; g.setAttribute('pointer-events', 'none'); svg.insertBefore(g, $(antesDe)); }
    return g;
  }
  // Radar RainViewer. Las teselas usan Web Mercator, pero se dibujan sobre la proyección
  // geográfica del mapa propio; cada fotograma vive en su grupo para evitar mezclar imágenes.
  let radarOn = false, radarIdx = 0, radarTimer = null, radarFrames = [], radarPausado = false, radarToken = 0;
  const radarOpacidad = $('radarOpacidad');
  function edadRadar(frame) {
    if (!frame || !Number.isFinite(Number(frame.time))) return '';
    const min = Math.max(0, Math.round((Date.now() / 1000 - Number(frame.time)) / 60));
    return min < 2 ? 'hace menos de 2 min' : `hace ${min} min`;
  }
  function mostrarFrameRadar() {
    const grupos = document.querySelectorAll('#gRadar .rf-frame');
    grupos.forEach((g, i) => { g.style.opacity = i === radarIdx ? '1' : '0'; });
    const frame = radarFrames[radarIdx];
    $('radarEtq').textContent = frame ? `Radar observado · ${edadRadar(frame)} · fotograma ${radarIdx + 1}/${radarFrames.length}` : 'Radar sin datos';
  }
  function estadoControlesRadar(activo) {
    $('btnRadar').classList.toggle('on', activo);
    $('btnRadar').setAttribute('aria-pressed', String(activo));
    $('btnRadarPlay').disabled = !activo;
    radarOpacidad.disabled = !activo;
    $('btnRadarPlay').textContent = radarPausado ? '▶ Reanudar' : 'Ⅱ Pausar';
    $('btnRadarPlay').setAttribute('aria-pressed', String(radarPausado));
  }
  function pararAnimacionRadar() { if (radarTimer) clearInterval(radarTimer); radarTimer = null; }
  function iniciarAnimacionRadar() {
    pararAnimacionRadar();
    if (!radarOn || radarPausado || radarFrames.length < 2) return;
    radarTimer = setInterval(() => {
      if (document.hidden || !radarOn || radarPausado) return;
      radarIdx = (radarIdx + 1) % radarFrames.length;
      mostrarFrameRadar();
    }, 850);
  }
  function pararRadar(mensaje = 'Radar desactivado') {
    radarToken++; pararAnimacionRadar(); radarOn = false; radarPausado = false; radarFrames = [];
    const g = $('gRadar'); if (g) g.remove();
    estadoControlesRadar(false); $('radarEtq').textContent = mensaje;
  }
  async function alternarRadar() {
    if (radarOn) { pararRadar(); return; }
    const token = ++radarToken;
    radarOn = true; radarPausado = false; estadoControlesRadar(true);
    $('radarEtq').textContent = 'Conectando con el radar…';
    try {
      const j = await pedir('https://api.rainviewer.com/public/weather-maps.json');
      if (token !== radarToken || !radarOn) return;
      if (!j || typeof j.host !== 'string' || !j.radar || !Array.isArray(j.radar.past)) throw new ErrorApi('datos');
      radarFrames = j.radar.past.filter(f => f && Number.isFinite(Number(f.time)) && typeof f.path === 'string').slice(-6);
      if (!radarFrames.length) throw new ErrorApi('datos');

      // La app dibuja latitud de forma lineal: convertimos los bordes Mercator de cada tesela
      // a latitudes antes de colocarlos, para que el eco no quede desplazado ni estirado.
      const Z = 6, N = 2 ** Z;
      const tx = lon => Math.floor((lon + 180) / 360 * N);
      const ty = lat => { const r = Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180; return Math.floor((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2 * N); };
      const lonT = x => x / N * 360 - 180;
      const latT = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / N))) * 180 / Math.PI;
      const x0 = Math.max(0, tx(lonMin - PAD)), x1 = Math.min(N - 1, tx(lonMax + PAD));
      const y0 = Math.max(0, ty(latMax + PAD)), y1 = Math.min(N - 1, ty(latMin - PAD));
      if (x1 < x0 || y1 < y0) throw new ErrorApi('datos');
      let h = '';
      radarFrames.forEach((f, i) => {
        let tiles = '';
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
          const L = px(lonT(x)), R = px(lonT(x + 1));
          const T = py(latT(y)), B = py(latT(y + 1));
          const href = `${j.host}${f.path}/256/${Z}/${x}/${y}/2/1_1.png`;
          tiles += `<image href="${href}" x="${L.toFixed(2)}" y="${T.toFixed(2)}" width="${(R-L).toFixed(2)}" height="${(B-T).toFixed(2)}" preserveAspectRatio="none" onerror="this.style.display='none'"/>`;
        }
        h += `<g class="rf-frame" data-f="${i}" style="opacity:0">${tiles}</g>`;
      });
      const anterior = $('gRadar'); if (anterior) anterior.remove();
      const g = capaSvg('gRadar', 'gDist'); g.style.opacity = String(Number(radarOpacidad.value) / 100); g.innerHTML = h;
      radarIdx = 0;
      mostrarFrameRadar(); estadoControlesRadar(true); iniciarAnimacionRadar();
    } catch (e) {
      if (token !== radarToken) return;
      pararRadar('No se pudo cargar el radar. Comprueba la conexión e inténtalo otra vez.');
      aviso('No se pudo cargar el radar.');
    }
  }
  $('btnRadar').addEventListener('click', alternarRadar);
  $('btnRadarPlay').addEventListener('click', () => {
    if (!radarOn) return;
    radarPausado = !radarPausado; estadoControlesRadar(true);
    if (radarPausado) pararAnimacionRadar(); else iniciarAnimacionRadar();
  });
  radarOpacidad.addEventListener('input', () => {
    $('radarOpacidadVal').textContent = `${radarOpacidad.value}%`;
    const g = $('gRadar'); if (g) g.style.opacity = String(Number(radarOpacidad.value) / 100);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) iniciarAnimacionRadar(); else pararAnimacionRadar(); });

  // Rutas principales (aproximadas: líneas rectas entre ciudades de cada ruta)
  const RUTAS = { 'Ruta 1': ['Asunción', 'Carapeguá', 'Quiindy', 'San Juan Bautista', 'San Ignacio', 'Coronel Bogado', 'Encarnación'],
    'Ruta 2': ['Asunción', 'San Lorenzo', 'Ypacaraí', 'Caacupé', 'Coronel Oviedo'], 'Ruta 7': ['Coronel Oviedo', 'Caaguazú', 'Ciudad del Este'],
    'Ruta 9': ['Asunción', 'Villa Hayes', 'Filadelfia'], 'Ruta 5': ['Concepción', 'Horqueta', 'Pedro Juan Caballero'], 'Ruta 6': ['Encarnación', 'Hohenau', 'Ciudad del Este'] };
  let rutasOn = false;
  $('btnRutas').addEventListener('click', () => {
    rutasOn = !rutasOn; $('btnRutas').classList.toggle('on', rutasOn); $('btnRutas').setAttribute('aria-pressed', String(rutasOn));
    const g = capaSvg('gRutas', 'gNomDep');
    g.innerHTML = !rutasOn ? '' : Object.values(RUTAS).map(r => {
      const pts = r.map(n => porNombre.get(n)).filter(Boolean);
      return pts.length < 2 ? '' : `<path d="M${pts.map(c => px(c.lon).toFixed(1) + ' ' + py(c.lat).toFixed(1)).join(' L')}" fill="none" stroke="#fde68a" stroke-width="1.8" stroke-dasharray="5 3" vector-effect="non-scaling-stroke" opacity="0.9"/>`;
    }).join('');
  });

  // Buscar lugares: prioriza el catálogo local verificado para evitar departamentos incorrectos del geocodificador.
  let tokenBusquedaLugar = 0;
  const normalizarNombreLugar = v => String(v || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');

  async function buscarLugar() {
    const token = ++tokenBusquedaLugar;
    const q = $('buscador').value.trim(), caja = $('lugares');
    if (q.length < 3) { aviso('Escribe al menos 3 letras del lugar.'); return; }
    caja.hidden = false;
    caja.replaceChildren();
    const cargando = document.createElement('span');
    cargando.className = 'ayuda';
    cargando.textContent = 'Buscando…';
    caja.appendChild(cargando);

    try {
      // Primero buscar en el catálogo propio, que contiene el nombre y departamento corregidos.
      const nq = normalizarNombreLugar(q);
      const locales = CIUDADES
        .filter(c => normalizarNombreLugar(c.n).includes(nq))
        .sort((a, b) => {
          const ap = normalizarNombreLugar(a.n).startsWith(nq) ? 0 : 1;
          const bp = normalizarNombreLugar(b.n).startsWith(nq) ? 0 : 1;
          return ap - bp || a.n.localeCompare(b.n, 'es');
        })
        .map(c => ({
          name: c.n, admin1: c.dep, latitude: c.lat, longitude: c.lon,
          country_code: 'PY', _local: true
        }));

      // Consultar también el geocodificador para encontrar localidades no incluidas en el catálogo.
      let resultados = [];
      try {
        const j = await pedir(`${OM.lugares}?name=${encodeURIComponent(q)}&count=10&language=es&countryCode=PY`, 12000, 0);
        resultados = j && Array.isArray(j.results) ? j.results : [];
      } catch (_) {
        try {
          const j = await pedir(`${OM.lugares}?name=${encodeURIComponent(q + ', Paraguay')}&count=10&language=es`, 12000, 0);
          resultados = j && Array.isArray(j.results) ? j.results : [];
        } catch (_) {}
      }
      if (token !== tokenBusquedaLugar || q !== $('buscador').value.trim()) return;

      const externos = resultados.filter(x =>
        x && typeof x.name === 'string' &&
        Number.isFinite(x.latitude) && Number.isFinite(x.longitude) &&
        x.latitude >= -28.5 && x.latitude <= -18.5 &&
        x.longitude >= -63.5 && x.longitude <= -53.5 &&
        (!x.country_code || x.country_code.toUpperCase() === 'PY')
      );

      // Si el proveedor devuelve el mismo nombre con otro departamento, conservar el dato local canónico.
      const nombresLocales = new Set(locales.map(x => normalizarNombreLugar(x.name)));
      const vistos = new Set();
      const r = [];
      for (const x of [...locales, ...externos.filter(x => !nombresLocales.has(normalizarNombreLugar(x.name)))]) {
        const clave = normalizarNombreLugar(x.name);
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        r.push(x);
      }

      caja.replaceChildren();
      if (r.length) {
        r.slice(0, 10).forEach((x, i) => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'btn';
          b.dataset.lugar = String(i);
          b.textContent = `${String(x.name || 'Lugar sin nombre')}${x.admin1 ? ' · ' + String(x.admin1) : ''}`;
          caja.appendChild(b);
        });
      } else {
        const msg = document.createElement('span');
        msg.className = 'ayuda';
        msg.textContent = 'No encontré ese lugar en Paraguay.';
        caja.appendChild(msg);
      }
      const cerrar = document.createElement('button');
      cerrar.type = 'button'; cerrar.className = 'btn';
      cerrar.dataset.lugar = 'x'; cerrar.textContent = '✕';
      caja.appendChild(cerrar);
      caja._r = r.slice(0, 10);
    } catch (e) {
      if (token !== tokenBusquedaLugar) return;
      caja.replaceChildren();
      const msg = document.createElement('span');
      msg.className = 'ayuda';
      msg.textContent = 'No se pudo buscar. Revisa tu conexión.';
      caja.appendChild(msg);
      const cerrar = document.createElement('button');
      cerrar.type = 'button'; cerrar.className = 'btn';
      cerrar.dataset.lugar = 'x'; cerrar.textContent = '✕';
      caja.appendChild(cerrar);
    }
  }
  $('btnLugar').addEventListener('click', buscarLugar);
  // Sugerencias automáticas mientras se escribe en el buscador.
  let temporizadorSugerenciasLugar = null;
  $('buscador').addEventListener('input', () => {
    clearTimeout(temporizadorSugerenciasLugar);
    const q = $('buscador').value.trim();
    const caja = $('lugares');
    // Invalida cualquier consulta anterior para que no sobrescriba el texto nuevo.
    tokenBusquedaLugar++;
    caja.replaceChildren();
    caja.hidden = true;
    if (q.length < 3) return;
    temporizadorSugerenciasLugar = setTimeout(() => {
      if ($('buscador').value.trim() === q) buscarLugar();
    }, 350);
  });
  $('buscador').addEventListener('keydown', e => {
    if (e.key === 'Escape') { $('lugares').hidden = true; return; }
    if (e.key === 'Enter' && !$('lugares').hidden) {
      const primera = $('lugares').querySelector('button[data-lugar]:not([data-lugar="x"])');
      if (primera) { e.preventDefault(); primera.click(); }
    }
  });
  $('lugares').addEventListener('click', e => {
    const b = e.target.closest('[data-lugar]'); if (!b) return;
    const caja = $('lugares');
    if (b.dataset.lugar !== 'x') {
      const x = caja._r && caja._r[+b.dataset.lugar];
      if (!x || !Number.isFinite(x.latitude) || !Number.isFinite(x.longitude) || !x.name) { aviso('El resultado no contiene una ubicación válida.'); caja.hidden = true; return; }
      const normalizar = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLocaleLowerCase('es');
      // Primero se busca por nombre exacto sin exigir el departamento del proveedor:
      // el geocodificador puede devolver un departamento equivocado para una ciudad conocida.
      const existente = CIUDADES.find(c => normalizar(c.n) === normalizar(x.name))
        || [...porNombre.values()].find(c => normalizar(c.n.split(',')[0]) === normalizar(x.name));
      // El nombre del proveedor se limpia: el detalle, la lista y el mapa lo insertan como HTML (con «<b>» o comillas se inyectaba marcado)
      const limpio = v => String(v || '').replace(/[<>"'`&\\]/g, '').replace(/\s+/g, ' ').trim();
      const n = existente ? existente.n : limpio(x.name) + (x.admin1 ? ', ' + limpio(x.admin1) : '');
      if (!existente && !porNombre.has(n)) porNombre.set(n, { n, lat: x.latitude, lon: x.longitude, dep: limpio(x.admin1), g: 3, extra: true });
      elegir(n);
    }
    caja.hidden = true;
  });

  // Tema claro/oscuro y °C/°F
  function pintarTema() {
    const claro = leer('clima-py-tema', 'oscuro') === 'claro';
    document.documentElement.dataset.tema = claro ? 'claro' : 'oscuro';
    $('btnTema').textContent = claro ? '🌙' : '☀️';
    $('btnTema').setAttribute('aria-label', claro ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  }
  $('btnTema').addEventListener('click', () => {
    guardar('clima-py-tema', leer('clima-py-tema', 'oscuro') === 'claro' ? 'oscuro' : 'claro'); pintarTema();
    refrescarVistas();                                             // los colores de texto cambian según el tema
    if (detalleActual && detalleActual.c.n === seleccionada) pintarDetalle();
  });
  const pintarUnidad = () => { $('btnUnidad').textContent = usaF ? '°F' : '°C'; $('btnUnidad').setAttribute('aria-label', usaF ? 'Cambiar a grados Celsius' : 'Cambiar a grados Fahrenheit'); };
  $('btnUnidad').addEventListener('click', () => {
    usaF = !usaF; guardar('clima-py-f', usaF ? '1' : '0');
    pintarUnidad(); pintarCapas(); refrescarVistas();
    if (detalleActual && detalleActual.c.n === seleccionada) pintarDetalle();
    if (!$('comparar').hidden) pintarComparacion();
  });
  pintarTema(); pintarUnidad();


  // ============ 6e) AMBIENTE: CIELO VIVO Y SONIDO ============
  // Todo se calcula con el clima de la ciudad elegida. Nada se descarga: el dibujo y el sonido se generan aquí mismo.
  const PAL = { despejado_d: ['#1b5fae', '#3b8fd4', '#78bdec'], despejado_n: ['#050914', '#0f1a3d', '#1f2f66'],
    parcial_d: ['#2a69a8', '#4d86b8', '#84a8c6'], parcial_n: ['#070c1b', '#141f40', '#26335f'],
    nublado_d: ['#46596c', '#667c92', '#93a5b6'], nublado_n: ['#0f1522', '#1c2638', '#2d3a4f'],
    lluvia_d: ['#2a3a4c', '#41576b', '#5f768a'], lluvia_n: ['#0a101c', '#17222f', '#26364a'],
    niebla_d: ['#55646f', '#74838f', '#96a3ad'], niebla_n: ['#1b232c', '#323f4a', '#4b5a66'],
    tormenta: ['#181b30', '#2d3156', '#474c7a'], dorado: ['#2b2a5e', '#b5586b', '#e99a5c'], amanecer: ['#3b4f8f', '#e39bb0', '#ffd2a8'] };
  const cv = $('cielo'), cx = cv.getContext('2d');
  let fx = leer('clima-py-fx', '1') === '1';
  const amb = { tipo: 'despejado', dia: true, dorado: false, lluvia: 0, viento: 0 };
  let ambClave = '', faseClave = '', cvW = 0, cvH = 0, gotas = [], estrellas = [], nubes = [], destello = 0, proxRayo = 0, rafCielo = 0, ultCielo = 0;

  // ---- Preferencias de la animación ----
  // Las elige cada persona (panel «Ajustes de animación») y se guardan solo en este navegador (clave 'clima-py-anim').
  // CONTRATO entre las partes del código: el paisaje, el cielo y el sonido LEEN prefsAnim; el panel la CAMBIA solo con fijarPrefAnim({...}).
  // `fx` (botón ✨) sigue siendo el interruptor general: si está apagado no se anima nada.
  const TIPOS_CIELO = ['despejado', 'parcial', 'nublado', 'lluvia', 'tormenta', 'niebla'], FASES_DIA = ['amanecer', 'dia', 'atardecer', 'noche'];
  const PREFS_ANIM_BASE = {
    intensidad: 1,        // 0.5 suave · 1 normal · 1.5 intensa: multiplica la cantidad de partículas y el brillo de los efectos
    calidad: 'auto',      // 'auto' (baja sola si el equipo va lento) · 'alta' · 'ahorro' (menos cuadros por segundo y menos partículas)
    fondo: true,          // cielo animado detrás de toda la página (canvas #cielo)
    paisaje: true,        // paisaje animado de arriba (canvas #escenaCv)
    efectos: { lluvia: true, nubes: true, estrellas: true, rayos: true, niebla: true, fauna: true, viento: true, especiales: true },
                          // fauna = aves, luciérnagas…; especiales = efectos de ocasión (arcoíris, estrellas fugaces, ondas de calor…)
    volumen: 0.6          // 0 a 1: volumen del sonido del clima
  };
  function cargarPrefsAnim() {
    const g = leerJSON('clima-py-anim', {}), p = JSON.parse(JSON.stringify(PREFS_ANIM_BASE));
    if (!g || typeof g !== 'object' || Array.isArray(g)) return p;   // lo guardado se valida campo por campo: nunca se confía a ciegas
    if ([0.5, 1, 1.5].includes(g.intensidad)) p.intensidad = g.intensidad;
    if (['auto', 'alta', 'ahorro'].includes(g.calidad)) p.calidad = g.calidad;
    for (const k of ['fondo', 'paisaje']) if (typeof g[k] === 'boolean') p[k] = g[k];
    if (g.efectos && typeof g.efectos === 'object') for (const k of Object.keys(p.efectos)) if (typeof g.efectos[k] === 'boolean') p.efectos[k] = g.efectos[k];
    if (typeof g.volumen === 'number' && g.volumen >= 0 && g.volumen <= 1) p.volumen = g.volumen;
    return p;
  }
  const prefsAnim = cargarPrefsAnim();
  prefsAnim.vistaPrevia = null;   // { tipo: TIPOS_CIELO, fase: FASES_DIA } para ver otro clima u hora sin esperar a que ocurra; NO se guarda
  // Qué se DIBUJA depende solo de los efectos elegidos; `fx` decide si se MUEVE. Así, con ✨ apagado el paisaje queda
  // quieto pero sigue mostrando el clima (nubes, luna, lluvia), en vez de un cielo vacío.
  const efectoActivo = nombre => prefsAnim.efectos[nombre] !== false;
  let ultimoAmbiente = null;      // último clima recibido por ambiente(), para volver a aplicarlo al cambiar preferencias o vista previa
  function fijarPrefAnim(cambios) {
    for (const [k, v] of Object.entries(cambios || {})) {
      if (k === 'efectos' && v && typeof v === 'object') Object.assign(prefsAnim.efectos, v);
      else if (k in prefsAnim) prefsAnim[k] = v;
    }
    const { vistaPrevia, ...guardable } = prefsAnim;
    guardar('clima-py-anim', JSON.stringify(guardable));
    if (Object.keys(cambios || {}).every(k => k === 'volumen')) { mezclar(); return; }   // el volumen solo toca el sonido: no se rearma la animación (el deslizador llama en cada movimiento)
    ambClave = ''; faseClave = '';                                  // obliga a rearmar partículas y colores con las preferencias nuevas
    if (ultimoAmbiente) ambiente(...ultimoAmbiente); else { armarParticulas(); reanudarCielo(); mezclar(); }
  }
  // Factor de calidad que usan los efectos para decidir cuántas partículas dibujar (1 = completa, menor = más liviana).
  // Lo mantiene el bucle de animación: con calidad 'auto' lo baja si el equipo va lento; con 'ahorro' es fijo y bajo.
  let nivelCalidad = prefsAnim.calidad === 'ahorro' ? 0.5 : 1;
  // Acceso para pruebas automáticas y para la consola del navegador, p. ej.:
  //   climaAnim.fijar({ vistaPrevia: { tipo: 'tormenta', fase: 'noche' } })   ·   climaAnim.fijar({ vistaPrevia: null })
  window.climaAnim = Object.freeze({ fijar: fijarPrefAnim, prefs: () => JSON.parse(JSON.stringify(prefsAnim)), estado: () => ({ ...amb, nivelCalidad }) });

  // ============ PAISAJE ANIMADO (el cuadro de arriba) ============
  // Un paisaje del río con colinas y palmeras que cambia con el clima de la ciudad elegida y con la hora. Todo se dibuja aquí mismo.
  const ec = $('escenaCv'), ex = ec.getContext('2d');
  let eW = 0, eH = 0, eD = 1, eClave = '', eFirma = '', eNubes = [], eAves = [], eLuci = [], eEstr = [], eGotas = [], eGranizo = [], eHojas = [], ePetalos = [], eOndas = [], eNiebla = [], eRayo = null, eFugaz = null;
  let eTexNiebla = null, eSprLuci = null, eSombra = null, ultRayoT = -1, reGolpe = 0;
  const hexA = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const mezcla = (a, b, k) => { const x = hexA(a), y = hexA(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
  // colores de la tierra: [colinas lejanas, colinas cercanas, orilla, palmeras]
  const TIERRA = { claro: ['#6aa88c', '#418c5a', '#2b6b40', '#1b3f2c'], nublado: ['#7e9a94', '#58786a', '#3e5a4e', '#25382f'], lluvia: ['#5f7a78', '#46625a', '#31483f', '#1c2b25'],
    tormenta: ['#2f3a58', '#222c47', '#171f35', '#0d1322'], niebla: ['#a3b2ae', '#8a9d96', '#6f847b', '#4c5e55'], dorado: ['#a5646a', '#6e4a58', '#40304a', '#1e1830'], amanecer: ['#b58ca0', '#7d6f86', '#4f4a66', '#2a2840'], noche: ['#17234a', '#101b3a', '#0b1530', '#050b1c'] };
  const estadoEscena = () => amb.tipo === 'tormenta' ? 'tormenta' : amb.tipo === 'niebla' ? 'niebla' : amb.dorado ? (amb.fase === 'amanecer' ? 'amanecer' : 'dorado') : amb.fase === 'noche' ? 'noche' : amb.tipo === 'lluvia' ? 'lluvia' : amb.tipo === 'nublado' ? 'nublado' : 'claro';
  // Paleta del cielo que corresponde AHORA (hacia ella se mezclan los colores poco a poco)
  function paletaObjetivo() {
    const t = amb.tipo;
    if (t === 'tormenta') return PAL.tormenta;
    const d = PAL[t + '_d'], n = PAL[t + '_n'];
    if (amb.fase === 'noche') return n;
    if (amb.fase === 'dia') return d;
    if (t === 'despejado' || t === 'parcial') return amb.fase === 'amanecer' ? PAL.amanecer : PAL.dorado;
    return n.map((c, i) => mezcla(c, d[i], 0.5));          // cielo cubierto al amanecer/atardecer: a medio camino entre día y noche
  }

  // ---- Lo que piden las preferencias (prefsAnim) ----
  // Cantidad de partículas = base × intensidad × nivel de calidad (redondeado a cuartos para no rearmar la escena a cada rato).
  const nivelR = () => Math.round(limitar(nivelCalidad || 1, 0.25, 1) * 4) / 4;
  const multFx = () => (prefsAnim.intensidad || 1) * nivelR();
  const cant = n => Math.round(n * multFx());
  const claveFx = () => [fx ? 1 : 0, prefsAnim.intensidad, nivelR(), Object.keys(prefsAnim.efectos).map(k => prefsAnim.efectos[k] ? 1 : 0).join('')].join(',');
  const vientoVis = () => (amb.viento || 0) + (amb.tipo === 'tormenta' ? 25 : 0);   // la tormenta siempre trae ráfagas
  const mesLapacho = () => { const m = new Date().getMonth(); return m >= 6 && m <= 8; };   // julio a septiembre: lapachos en flor
  // Edad de la luna (0 = nueva, 0,5 = llena), con la misma fórmula que el dato «Luna» del detalle
  const edadLuna = () => { const P = 29.530588853; return ((((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % P + P) % P) / P; };
  // Dibuja la luna con su fase real. En el hemisferio sur la luna creciente se ilumina por la IZQUIERDA.
  function dibujarLuna(c, x, y, r, al) {
    const f = edadLuna(), k = Math.cos(2 * Math.PI * f), lado = f < 0.5 ? -1 : 1, term = k > 0 ? lado : -lado;
    c.save(); c.globalAlpha = al * 0.16; c.fillStyle = '#c3cfee'; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill();   // luz cenicienta: el disco apenas se adivina
    c.globalAlpha = al; c.fillStyle = '#eef2fc'; c.beginPath();
    c.arc(x, y, r, -Math.PI / 2, Math.PI / 2, lado < 0);
    if (term > 0) c.ellipse(x, y, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, true); else c.ellipse(x, y, r * Math.abs(k), r, 0, Math.PI / 2, Math.PI * 1.5, false);
    c.closePath(); c.fill(); c.clip();
    c.fillStyle = 'rgba(120,135,170,0.18)';                         // los "mares" de la luna
    [[-0.3, -0.25, 0.28], [0.25, 0.1, 0.22], [-0.1, 0.38, 0.16]].forEach(([dx, dy, q]) => { c.beginPath(); c.arc(x + dx * r, y + dy * r, q * r, 0, 6.283); c.fill(); });
    c.restore();
  }

  // ---- Transición suave entre momentos del día ----
  // En vez de saltar de un color a otro, cada cuadro se acerca un poco al color objetivo (unos 3 s en total).
  const vEsc = { Ph: null, Th: null, cc: '255,255,255', br: '255,255,255', esc: [0.85, 0, 1, 0, 0, 0, 1, 0, 0], crudo: null };
  const aHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const aRgb = x => String(x).split(',').map(Number);
  const mezA = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  function objetivosVisuales() {
    const A = amb, est = estadoEscena(), fase = A.fase, cre = fase === 'amanecer' || fase === 'atardecer', abierto = A.tipo === 'despejado' || A.tipo === 'parcial';
    const medio = cre && !A.dorado && (A.tipo === 'nublado' || A.tipo === 'lluvia');          // cielo cubierto en el crepúsculo
    let T = TIERRA[est].map(aRgbHex), cc = aRgb({ tormenta: '48,54,84', lluvia: '104,120,142', dorado: '255,196,170', amanecer: '255,205,205', noche: '120,135,178', nublado: '200,208,218' }[est] || '255,255,255');
    let cca = est === 'noche' ? 0.5 : est === 'tormenta' || est === 'lluvia' ? 0.92 : 0.85;
    if (medio) { T = T.map((c, i) => mezA(c, aRgbHex(TIERRA.noche[i]), 0.4)); cc = mezA(cc, aRgb('120,135,178'), 0.4); }
    if (A.tipo === 'niebla' && fase !== 'dia') T = T.map((c, i) => mezA(c, aRgbHex(TIERRA.noche[i]), fase === 'noche' ? 0.5 : 0.2));   // la niebla de noche no brilla
    const br = fase === 'noche' ? [170, 190, 240] : cre ? [255, 196, 130] : [255, 255, 255];
    const nb = A.tipo === 'niebla' ? (fase === 'noche' ? 0.34 : cre ? 0.46 : 0.55) : A.dorado ? 0.16 : A.tipo === 'lluvia' ? 0.2 : A.tipo === 'nublado' ? 0.07 : 0;
    const estr = abierto ? (fase === 'noche' ? 1 : cre ? 0.35 : 0) : 0;
    const aves = fase === 'noche' ? 0 : cre ? 0.8 : 1;
    const luci = fase === 'noche' ? 1 : fase === 'atardecer' ? 0.6 : fase === 'amanecer' ? 0.25 : 0;
    const luna = fase === 'noche' ? 1 : cre ? 0.55 : 0, luz = fase === 'noche' ? 0 : cre ? 0.5 : 1;
    const arco = A.tipo === 'lluvia' && A.lluvia <= 0.55 && fase === 'dia' ? 1 : 0;                       // arcoíris: lluvia débil con sol de día
    const calor = fase === 'dia' && abierto && A.temp >= 35 ? limitar((A.temp - 34) / 4, 0.4, 1) : 0;      // ondas de calor desde 35 °C
    return { P: paletaObjetivo().map(aRgbHex), T, cc, br, esc: [cca, estr, aves, luci, luna, nb, luz, arco, calor] };
  }
  function aRgbHex(h) { return hexA(h); }
  function avanzarVisual(dt, quieto) {
    const o = objetivosVisuales(), c = vEsc.crudo, k = quieto || !c ? 1 : 1 - Math.exp(-dt / 1100);
    const mover = (cur, obj) => obj.map((v, i) => cur && k < 1 && cur[i] !== undefined ? (Array.isArray(v) ? mezA(cur[i], v, k) : cur[i] + (v - cur[i]) * k) : (Array.isArray(v) ? v.slice() : v));
    const n = { P: mover(c && c.P, o.P), T: mover(c && c.T, o.T), cc: mover(c && c.cc, o.cc), br: mover(c && c.br, o.br), esc: mover(c && c.esc, o.esc) };
    vEsc.crudo = n;
    vEsc.Ph = n.P.map(aHex); vEsc.Th = n.T.map(aHex);
    vEsc.cc = n.cc.map(Math.round).join(','); vEsc.br = n.br.map(Math.round).join(','); vEsc.esc = n.esc;
  }
  // Salida y puesta del sol que usan los astros: las reales o, si faltan durante una vista previa, unas típicas (6:00 y 19:00)
  function solRef() {
    if (amb.sol) return amb.sol;
    if (!amb.previa) return null;
    const h = new Date(); h.setHours(6, 0, 0, 0); return { sale: +h, pone: +h + 13 * 3600000 };
  }
  // Hora con la que se ubican el sol y la luna: la real, salvo en una vista previa de otro momento del día,
  // donde se usa una hora típica de esa fase (así no aparece el sol en una vista previa de noche).
  function horaAstros(s) {
    const t = Date.now(); if (!amb.previa) return t;
    const M = 60000, D = 86400000;
    const real = t >= s.sale - 30 * M && t <= s.sale + 45 * M ? 'amanecer' : t >= s.pone - 45 * M && t <= s.pone + 30 * M ? 'atardecer' : t >= s.sale && t < s.pone ? 'dia' : 'noche';
    if (real === amb.fase) return t;
    return { amanecer: s.sale + 40 * M, dia: s.sale + 0.72 * (s.pone - s.sale), atardecer: s.pone - 40 * M, noche: s.pone + 0.78 * (s.sale + D - s.pone) }[amb.fase] || t;
  }
  // Posición del sol y de la luna a lo largo de un arco, según la hora: el sol sale, sube, baja y se pone; la luna sale al caer la noche
  function arcoAstros() {
    const s = solRef(); if (!s) return null;
    const t = horaAstros(s), D = 86400000, fade = u => limitar(u / 0.05, 0, 1) * limitar((1 - u) / 0.05, 0, 1);
    const p = (t - s.sale) / (s.pone - s.sale);
    const ini = t >= s.pone ? s.pone : s.pone - D, fin = t >= s.pone ? s.sale + D : s.sale, q = (t - ini) / (fin - ini);
    const pos = u => { const v = limitar(u, 0, 1); return { x: 0.14 + 0.72 * v, alt: Math.sin(Math.PI * v), f: fade(u) }; };
    return { sol: pos(p), luna: pos(q) };
  }
  // Decide cuándo cae un rayo (una sola vez por cuadro, lo dibuje el fondo, el paisaje o ninguno: el trueno suena igual)
  function latidoRayo(t, dt) {
    if (t === ultRayoT) return; ultRayoT = t;
    if (amb.tipo !== 'tormenta') { destello = 0; return; }
    if (t > proxRayo) { destello = 1; eRayo = null; reGolpe = Math.random() < 0.6 ? t + 110 + Math.random() * 90 : 0; trueno(); proxRayo = t + 7000 + Math.random() * 9000; }
    else if (reGolpe && t > reGolpe) { destello = Math.max(destello, 0.8); reGolpe = 0; }     // el rayo parpadea: un segundo golpe enseguida
    else if (destello > 0.02) destello *= Math.pow(0.86, dt / 33); else destello = 0;
  }
  // Un rayo ramificado: el tronco baja zigzagueando hasta el río y de él salen ramas más finas
  function armarRayo(yFin) {
    const trazos = [];
    const rama = (x, y, dir, pasos, w, prof) => {
      const pts = [[x, y]];
      for (let i = 0; i < pasos && y < yFin; i++) {
        x += (Math.random() - 0.5) * eH * 0.09 + dir * eH * 0.035; y += eH * (0.035 + Math.random() * 0.04); pts.push([x, y]);
        if (prof < 2 && i > 0 && Math.random() < (prof ? 0.18 : 0.3)) rama(x, y, (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random()), Math.round(pasos * 0.35), w * 0.55, prof + 1);
      }
      trazos.push({ pts, w });
    };
    rama(eW * (0.18 + Math.random() * 0.64), eH * 0.08, (Math.random() - 0.5) * 0.4, 40, 2.2, 0);
    return trazos;
  }
  // Altura de las colinas cercanas en x (la misma curva que dibuja colinaEsc), para apoyar los lapachos
  const altColina = x => eH * 0.65 - eH * 0.07 * (Math.sin(x / eW * 6.283 * 3 + 2.1) * 0.6 + Math.sin(x / eW * 6.283 * 7 + 2.1 * 2.3) * 0.4);
  const LAPACHOS = [[0.36, '#e0569d'], [0.555, '#f2c230'], [0.64, '#d9649f']];       // lapacho rosado, amarillo y rosado
  function texturaNiebla() {                                     // una tira de niebla que empalma consigo misma (se dibuja una vez)
    const c = document.createElement('canvas'), W = 512, H = 128, g = c.getContext('2d'); c.width = W; c.height = H;
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * W, y = 44 + Math.random() * 40, r = 18 + Math.random() * 26, a = 0.18 + Math.random() * 0.22;
      for (const dx of [-W, 0, W]) { const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, r); gr.addColorStop(0, `rgba(232,238,244,${a})`); gr.addColorStop(1, 'rgba(232,238,244,0)'); g.fillStyle = gr; g.fillRect(x + dx - r, y - r, r * 2, r * 2); }
    }
    return c;
  }
  function spriteLuci() {                                        // el brillo de una luciérnaga, dibujado una vez y reutilizado
    const c = document.createElement('canvas'); c.width = c.height = 36; const g = c.getContext('2d'), gr = g.createRadialGradient(18, 18, 0, 18, 18, 18);
    gr.addColorStop(0, 'rgba(230,255,120,1)'); gr.addColorStop(0.25, 'rgba(230,255,120,0.55)'); gr.addColorStop(1, 'rgba(230,255,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, 36, 36);
    return c;
  }

  function armarEscena() {
    const A = amb, simple = !prefsAnim.paisaje || !fx, part = g => !simple && efectoActivo(g);
    const grandes = A.tipo === 'nublado' || A.tipo === 'lluvia' || A.tipo === 'tormenta', abierto = A.tipo === 'despejado' || A.tipo === 'parcial';
    const nN = { despejado: 2, parcial: 4, nublado: 6, niebla: 0, lluvia: 7, tormenta: 7 }[A.tipo];
    // las nubes dicen qué clima hace: su cantidad varía menos que la de las demás partículas
    eNubes = efectoActivo('nubes') ? Array.from({ length: Math.round(nN * limitar(multFx(), 0.7, 1.3)) }, () => ({
      x: Math.random() * eW, y: eH * (grandes ? 0.07 + Math.random() * 0.2 : 0.08 + Math.random() * 0.3), r: eH * (0.06 + Math.random() * 0.06) * (grandes ? 1.6 : 1), v: 0.008 + Math.random() * 0.014 })) : [];
    eAves = part('fauna') && A.tipo !== 'lluvia' && A.tipo !== 'tormenta' && A.tipo !== 'niebla' ? Array.from({ length: Math.max(1, cant(4)) }, () => ({ x: Math.random() * eW, y: eH * (0.12 + Math.random() * 0.25), v: 0.03 + Math.random() * 0.03, f: Math.random() * 6.28, s: eH * (0.025 + Math.random() * 0.02) })) : [];
    eLuci = part('fauna') && A.lluvia === 0 && A.tipo !== 'niebla' ? Array.from({ length: cant(16) }, () => ({ x: Math.random() * eW, y: eH * (0.55 + Math.random() * 0.4), f: Math.random() * 6.28, v: 0.0004 + Math.random() * 0.0006 })) : [];
    eEstr = part('estrellas') && abierto ? Array.from({ length: cant(45) }, () => ({ x: Math.random() * eW, y: Math.random() * eH * 0.5, r: 0.4 + Math.random() * 1.1 })) : [];
    eGotas = part('lluvia') ? Array.from({ length: cant(A.lluvia * 70 * (A.granizo ? 0.6 : 1)) }, () => ({ x: Math.random() * eW, y: Math.random() * eH, l: eH * (0.05 + Math.random() * 0.05), v: 0.6 + Math.random() * 0.5 })) : [];
    const yAgua = eH * 0.74;
    const nuevoGranizo = g => Object.assign(g, { x: Math.random() * eW, y: -Math.random() * eH * 0.4, vy: 0.3 + Math.random() * 0.2, vx: vientoVis() / 900, r: 1 + Math.random() * 1.3, suelo: yAgua + 3 + Math.random() * (eH - yAgua - 6), reb: 0 });
    eGranizo = part('lluvia') && A.granizo ? Array.from({ length: cant(34) }, () => { const g = nuevoGranizo({ nuevo: nuevoGranizo }); g.y = Math.random() * eH * 0.7; return g; }) : [];
    eHojas = part('viento') ? Array.from({ length: cant(limitar((vientoVis() - 12) / 25, 0, 1) * 18) }, () => ({ x: Math.random() * eW, y: eH * (0.35 + Math.random() * 0.6), v: 0.6 + Math.random() * 0.7, f: Math.random() * 6.28, a: Math.random() * 6.28, g: (Math.random() - 0.5) * 0.02, l: 1.6 + Math.random() * 1.8 })) : [];
    ePetalos = part('especiales') && mesLapacho() ? Array.from({ length: cant(10) }, (_, i) => ({ i: i % 3, x: eW * LAPACHOS[i % 3][0], y: eH * (0.5 + Math.random() * 0.3), v: 0.5 + Math.random() * 0.5, f: Math.random() * 6.28 })) : [];
    if (!eTexNiebla) eTexNiebla = texturaNiebla();
    const tw = Math.max(eW * 0.7, eH * 3);
    // cada capa de niebla se escala UNA vez a su tamaño final: al pintarla solo se copia (mucho más barato que estirarla en cada cuadro)
    eNiebla = efectoActivo('niebla') && (A.tipo === 'niebla' || A.tipo === 'lluvia' || A.tipo === 'nublado' || abierto) ? Array.from({ length: 3 }, (_, i) => {
      const h = eH * (0.3 + i * 0.08), c = document.createElement('canvas'); c.width = Math.ceil(tw * eD); c.height = Math.ceil(h * eD);
      c.getContext('2d').drawImage(eTexNiebla, 0, 0, c.width, c.height);
      return { x: Math.random() * tw, y: eH * (0.44 + i * 0.14), h, tw, c, v: 0.005 + i * 0.006, a: 0.55 + i * 0.22 };
    }) : [];
    eOndas = []; eFugaz = null; eRayo = null;
    if (!eSprLuci) eSprLuci = spriteLuci();
    eSombra = ex.createLinearGradient(0, 0, 0, eH * 0.4); eSombra.addColorStop(0, 'rgba(0,0,0,0.28)'); eSombra.addColorStop(1, 'rgba(0,0,0,0)');
  }
  function nubeEsc(x, y, r) {                                      // una nube: varias bolitas que se funden en una sola forma
    ex.beginPath();
    [[0, 0, 1], [-0.9, 0.2, 0.7], [0.9, 0.15, 0.75], [-0.4, -0.45, 0.65], [0.45, -0.4, 0.6], [1.5, 0.3, 0.5], [-1.5, 0.3, 0.5]].forEach(([dx, dy, k]) => { ex.moveTo(x + dx * r + r * k, y + dy * r); ex.arc(x + dx * r, y + dy * r, r * k, 0, 6.283); });
    ex.fill();
  }
  function colinaEsc(y0, amp, f1, f2, ph, color) {
    ex.fillStyle = color; ex.beginPath(); ex.moveTo(0, eH);
    for (let x = 0; x <= eW + 8; x += 8) { const u = x / eW * 6.283; ex.lineTo(x, y0 - amp * (Math.sin(u * f1 + ph) * 0.6 + Math.sin(u * f2 + ph * 2.3) * 0.4)); }
    ex.lineTo(eW, eH); ex.closePath(); ex.fill();
  }
  function palmaEsc(x, y, s, t, color, v) {                        // palmera: tronco curvo y hojas que se mecen (y se inclinan) con el viento
    const raf = 0.6 + 0.4 * Math.sin(t / 2300 + x * 0.01), lean = Math.min(0.09, v / 700) * raf;
    const bal = Math.sin(t / 1700 + x) * (0.012 + v / 600) * s, tx = x + s * 0.05 + bal + lean * s, ty = y - s;
    ex.strokeStyle = color; ex.lineCap = 'round'; ex.lineWidth = Math.max(2, s * 0.05);
    ex.beginPath(); ex.moveTo(x, y); ex.quadraticCurveTo(x + s * 0.01, y - s * 0.55, tx, ty); ex.stroke();
    ex.lineWidth = Math.max(1.4, s * 0.028);
    const giro = Math.min(0.45, v / 110) * raf;                    // con viento las hojas se van hacia un lado
    for (let i = 0; i < 9; i++) {
      const ang = -Math.PI / 2 + (i - 4) * 0.4 * (1 - giro * 0.3) + giro + Math.sin(t / (900 - Math.min(500, v * 8)) + i + x) * 0.035 * (1 + v / 15), L = s * 0.4 * (0.85 + 0.15 * Math.cos(i * 1.3));
      ex.beginPath(); ex.moveTo(tx, ty);
      ex.quadraticCurveTo(tx + Math.cos(ang) * L * 0.55, ty + Math.sin(ang) * L * 0.75 - L * 0.12, tx + Math.cos(ang) * L, ty + Math.sin(ang) * L * 0.55 + L * 0.42); ex.stroke();
    }
  }
  function pintarEscena(t, dt, quieto) {
    const w = ec.clientWidth, h = ec.clientHeight;
    if (!w || !h) return;
    if (!quieto) latidoRayo(t, dt || 0);
    const simple = !prefsAnim.paisaje || !fx, d = Math.min(window.devicePixelRatio || 1, nivelR() < 0.75 ? 1 : 2);   // con calidad baja, menos píxeles
    if (w !== eW || h !== eH || d !== eD) { eW = w; eH = h; eD = d; ec.width = Math.round(w * d); ec.height = Math.round(h * d); ex.setTransform(d, 0, 0, d, 0, 0); eClave = ''; }
    const clave = [ambClave, eW, eH, claveFx(), simple ? 1 : 0, amb.granizo ? 1 : 0, Math.round(vientoVis() / 8), mesLapacho() ? 1 : 0].join('|');
    if (eClave !== clave) { eClave = clave; eFirma = ''; armarEscena(); }
    if (!vEsc.Ph) avanzarVisual(0, true);
    if (simple && !quieto) {                                      // paisaje apagado: un cuadro quieto que se repinta solo si cambian los colores (o cada minuto, por el sol)
      const firma = vEsc.Ph.join() + vEsc.Th[0] + Math.floor(Date.now() / 60000);
      if (firma === eFirma) return;
      eFirma = firma;
    }
    if (quieto || simple) dt = 0;
    const anim = !quieto && !simple;
    const A = amb, P = vEsc.Ph, T = vEsc.Th, yAgua = eH * 0.74, vis = A.tipo === 'despejado' || A.tipo === 'parcial';
    const [kCca, kEstr, kAves, kLuci, kLuna, kNb, kLuz, kArco = 0, kCalor = 0] = vEsc.esc, ast = arcoAstros(), esp = efectoActivo('especiales');
    // cielo
    const g = ex.createLinearGradient(0, 0, 0, yAgua); g.addColorStop(0, P[0]); g.addColorStop(0.55, P[1]); g.addColorStop(1, P[2]);
    ex.fillStyle = g; ex.fillRect(0, 0, eW, eH);
    if (eEstr.length && kEstr > 0.01) {                            // estrellas: en 4 grupos que titilan a destiempo (4 trazos en vez de uno por estrella)
      ex.fillStyle = '#fff';
      for (let k = 0; k < 4; k++) { ex.globalAlpha = kEstr * (0.3 + 0.55 * Math.sin(t / 900 + k * 1.7) ** 2); ex.beginPath(); for (let i = k; i < eEstr.length; i += 4) { const s = eEstr[i]; ex.moveTo(s.x + s.r, s.y); ex.arc(s.x, s.y, s.r, 0, 6.283); } ex.fill(); }
      ex.globalAlpha = 1;
    }
    // estrella fugaz de vez en cuando, en noche despejada
    if (esp && anim && eEstr.length && kEstr > 0.6) {
      if (!eFugaz && Math.random() < dt / 9000 * prefsAnim.intensidad) { const dir = Math.random() < 0.5 ? -1 : 1; eFugaz = { x: eW * (0.25 + Math.random() * 0.6), y: eH * (0.05 + Math.random() * 0.2), vx: dir * (0.3 + Math.random() * 0.2), vy: 0.1 + Math.random() * 0.07, vida: 0, dur: 650 + Math.random() * 350 }; }
      if (eFugaz) {
        const f = eFugaz; f.vida += dt; f.x += f.vx * dt; f.y += f.vy * dt;
        const u = f.vida / f.dur, n = Math.hypot(f.vx, f.vy), L = eH * 0.22;
        if (u >= 1) eFugaz = null;
        else { const a = Math.sin(Math.PI * u) * kEstr, x2 = f.x - f.vx / n * L, y2 = f.y - f.vy / n * L, gf = ex.createLinearGradient(f.x, f.y, x2, y2); gf.addColorStop(0, `rgba(255,255,255,${a})`); gf.addColorStop(1, 'rgba(255,255,255,0)'); ex.strokeStyle = gf; ex.lineWidth = 1.4; ex.lineCap = 'round'; ex.beginPath(); ex.moveTo(f.x, f.y); ex.lineTo(x2, y2); ex.stroke(); }
      }
    }
    // sol y luna: recorren un arco según la hora (el sol sale, sube, baja y se pone; la luna sale al caer la noche)
    const R = eH * 0.075, yHor = eH * 0.62, aMax = eH * 0.44, S = ast && ast.sol, L = ast && ast.luna;
    const sx = S ? eW * S.x : eW * 0.72, sy = S ? yHor - S.alt * aMax : eH * 0.22, altSol = S ? S.alt : 1, sobre = S ? S.f : A.fase === 'noche' ? 0 : 1;
    if (sobre > 0.01 && (vis || A.tipo === 'nublado' || A.tipo === 'niebla')) {
      const k = limitar(altSol / 0.45, 0, 1);                     // sol bajo = naranja; sol alto = amarillo claro
      const al = (vis ? 1 : A.tipo === 'nublado' ? 0.45 : 0.3) * sobre, col = `255,${Math.round(150 + 86 * k)},${Math.round(80 + 90 * k)}`;
      const gl = ex.createRadialGradient(sx, sy, 0, sx, sy, R * 5); gl.addColorStop(0, `rgba(${col},${0.55 * al})`); gl.addColorStop(1, `rgba(${col},0)`);
      ex.fillStyle = gl; ex.fillRect(sx - R * 5, sy - R * 5, R * 10, R * 10);
      if (vis && k > 0.7) { ex.save(); ex.globalAlpha = (k - 0.7) / 0.3 * sobre; ex.translate(sx, sy); ex.rotate(t / 9000); ex.fillStyle = 'rgba(255,240,190,0.07)'; for (let i = 0; i < 12; i++) { ex.rotate(0.5236); ex.beginPath(); ex.moveTo(0, 0); ex.lineTo(-R * 0.5, -R * 6.5); ex.lineTo(R * 0.5, -R * 6.5); ex.fill(); } ex.restore(); }
      ex.fillStyle = mezcla('#ffb982', '#fff6cf', k); ex.globalAlpha = al; ex.beginPath(); ex.arc(sx, sy, R, 0, 6.283); ex.fill(); ex.globalAlpha = 1;
    }
    if (efectoActivo('estrellas') && L && L.f > 0.01 && kLuna > 0.01 && A.tipo !== 'lluvia' && A.tipo !== 'tormenta') {
      const mx = eW * L.x, my = yHor - L.alt * aMax;
      const il = (1 - Math.cos(2 * Math.PI * edadLuna())) / 2, al = (A.tipo === 'niebla' ? 0.4 : A.tipo === 'nublado' ? 0.6 : 1) * kLuna * L.f;
      const gl = ex.createRadialGradient(mx, my, 0, mx, my, R * 4.5); gl.addColorStop(0, `rgba(190,208,255,${0.34 * al * il})`); gl.addColorStop(1, 'rgba(190,208,255,0)');
      ex.fillStyle = gl; ex.fillRect(mx - R * 4.5, my - R * 4.5, R * 9, R * 9);
      dibujarLuna(ex, mx, my, R * 0.85, al);
    }
    // nubes y aves
    ex.fillStyle = `rgba(${vEsc.cc},${kCca})`;
    eNubes.forEach(n => { n.x += n.v * dt * (1 + A.viento / 20); if (n.x - n.r * 3 > eW) n.x = -n.r * 3; nubeEsc(n.x, n.y, n.r); });
    // arcoíris: lluvia débil con sol de día, del lado opuesto al sol
    if (esp && kArco > 0.01) {
      const ax = eW * limitar(1 - (S ? S.x : 0.72), 0.3, 0.7), ar = Math.min(eW * 0.42, eH * 0.62), ay = yHor + eH * 0.1, a = 0.26 * kArco * Math.min(1.2, prefsAnim.intensidad);
      const ga = ex.createRadialGradient(ax, ay, ar * 0.84, ax, ay, ar);
      [[0, '150,80,200', 0], [0.14, '150,80,200', 0.55], [0.3, '70,110,235', 1], [0.47, '80,200,110', 1], [0.63, '250,232,80', 1], [0.8, '255,150,60', 1], [0.92, '240,70,60', 0.9], [1, '240,70,60', 0]].forEach(([o, c, m]) => ga.addColorStop(o, `rgba(${c},${a * m})`));
      ex.fillStyle = ga; ex.beginPath(); ex.arc(ax, ay, ar, Math.PI, 0); ex.arc(ax, ay, ar * 0.84, 0, Math.PI, true); ex.fill();
    }
    ex.strokeStyle = `rgba(25,35,50,${0.75 * kAves})`; ex.lineWidth = 1.6; ex.lineCap = 'round';
    if (kAves > 0.02) eAves.forEach(b => {
      b.x += b.v * dt; if (b.x > eW + 20) b.x = -20;
      const f = Math.sin(t / 140 + b.f) * b.s * 0.45, y = b.y + Math.sin(t / 1500 + b.f) * 4;
      ex.beginPath(); ex.moveTo(b.x - b.s, y - f); ex.quadraticCurveTo(b.x - b.s * 0.4, y - b.s * 0.3 - f * 0.4, b.x, y); ex.quadraticCurveTo(b.x + b.s * 0.4, y - b.s * 0.3 - f * 0.4, b.x + b.s, y - f); ex.stroke();
    });
    // colinas lejanas y cercanas
    colinaEsc(eH * 0.56, eH * 0.07, 2, 5, 0.6, T[0]);
    colinaEsc(eH * 0.65, eH * 0.07, 3, 7, 2.1, T[1]);
    // lapachos en flor sobre la colina (julio a septiembre): pequeños y apagados según la luz, para que sean un detalle
    if (esp && mesLapacho()) {
      const os = 1 - kLuz, s = eH * 0.05;
      LAPACHOS.forEach(([fx0, col]) => {
        const x = eW * fx0, y = altColina(x) + 2, c = mezcla(mezcla(col, T[1], 0.2 + os * 0.55), '#dfe6ea', kNb * 0.6);
        ex.strokeStyle = T[2]; ex.lineWidth = Math.max(1.2, s * 0.09); ex.beginPath(); ex.moveTo(x, y); ex.lineTo(x, y - s * 0.75); ex.stroke();
        ex.fillStyle = c; ex.beginPath();
        [[0, -1, 0.5], [-0.42, -0.82, 0.38], [0.44, -0.84, 0.36], [-0.15, -1.25, 0.34], [0.22, -1.18, 0.33]].forEach(([dx, dy, k]) => { ex.moveTo(x + dx * s + k * s, y + dy * s); ex.arc(x + dx * s, y + dy * s, k * s, 0, 6.283); });
        ex.fill();
      });
      if (ePetalos.length) {
        const vv = vientoVis(); ex.fillStyle = mezcla('#f08cbf', T[1], 0.2 + os * 0.5); ex.beginPath();
        ePetalos.forEach(p => {
          if (dt) { p.x += (0.004 + vv / 3000) * p.v * dt; p.y += 0.006 * p.v * dt; p.f += dt / 500; if (p.y > yAgua || p.x > eW) { const lx = eW * LAPACHOS[p.i][0]; p.x = lx + (Math.random() - 0.5) * eH * 0.05; p.y = altColina(lx) - eH * 0.05; } }
          const x = p.x + Math.sin(p.f) * 3; ex.moveTo(x + 1.3, p.y); ex.arc(x, p.y, 1.3, 0, 6.283);
        });
        ex.fill();
      }
    }
    // ondas de calor: el aire sobre las colinas tiembla (se corre en franjas finas, como un espejismo)
    if (esp && anim && kCalor > 0.02) {
      const y0 = Math.round(eH * 0.47), y1 = Math.round(yAgua), paso = 3;
      for (let y = y0; y < y1; y += paso) ex.drawImage(ec, 0, y * eD, ec.width, paso * eD, Math.sin(y * 0.55 + t / 170) * 2 * kCalor, y, eW, paso);
      const gc = ex.createLinearGradient(0, y0, 0, y1); gc.addColorStop(0, 'rgba(255,214,160,0)'); gc.addColorStop(1, `rgba(255,214,160,${0.1 * kCalor})`); ex.fillStyle = gc; ex.fillRect(0, y0, eW, y1 - y0);
    }
    // río: toma el color del cielo, con destellos que se mueven
    const ga = ex.createLinearGradient(0, yAgua, 0, eH); ga.addColorStop(0, mezcla(P[2], '#0b1c2c', 0.18)); ga.addColorStop(1, mezcla(P[1], '#06101c', 0.55));
    ex.fillStyle = ga; ex.fillRect(0, yAgua, eW, eH - yAgua);
    const brillo = vEsc.br, hAg = eH - yAgua;
    for (let i = 0; i < 26; i++) {
      const cerca = vis && sobre > 0.3 && altSol > 0 && i % 3 === 0, x = cerca ? sx + Math.sin(i * 7.1 + t / 1800) * eW * 0.04 : (i * 97 + t * 0.012 * (i % 3 + 1)) % eW, y = yAgua + ((i * 37) % 100) / 100 * hAg;
      ex.fillStyle = `rgba(${brillo},${(cerca ? 0.2 : 0.06) + 0.06 * Math.sin(t / 700 + i)})`; ex.fillRect(x, y, 10 + (i * 13) % 26, 1.6);
    }
    if (eGotas.length || eOndas.length) {                         // anillos y salpicaduras de la lluvia sobre el río
      if (anim && eGotas.length && Math.random() < A.lluvia * 0.55 * multFx() * dt / 16) eOndas.push({ x: Math.random() * eW, y: yAgua + 6 + Math.random() * (hAg - 10), r: 0, a: 0.5 });
      ex.lineWidth = 1; eOndas = eOndas.filter(o => o.a > 0.02);
      eOndas.forEach(o => {
        o.r += dt * 0.012; o.a -= dt * 0.0007; ex.strokeStyle = `rgba(220,235,255,${o.a})`; ex.beginPath(); ex.ellipse(o.x, o.y, o.r, o.r * 0.35, 0, 0, 6.283);
        if (o.r < 2) { const s = (2 - o.r) * 0.7; ex.moveTo(o.x - 0.8, o.y - 0.5); ex.lineTo(o.x - 0.8 - s, o.y - 0.5 - s * 1.5); ex.moveTo(o.x + 0.8, o.y - 0.5); ex.lineTo(o.x + 0.8 + s, o.y - 0.5 - s * 1.5); }   // la gota que salta
        ex.stroke();
      });
    }
    // orillas y palmeras
    ex.fillStyle = T[2];
    ex.beginPath(); ex.moveTo(0, eH); ex.lineTo(0, yAgua - eH * 0.05); ex.quadraticCurveTo(eW * 0.2, yAgua - eH * 0.02, eW * 0.3, eH); ex.fill();
    ex.beginPath(); ex.moveTo(eW, eH); ex.lineTo(eW, yAgua - eH * 0.04); ex.quadraticCurveTo(eW * 0.84, yAgua - eH * 0.01, eW * 0.72, eH); ex.fill();
    const vp = efectoActivo('viento') && !simple ? vientoVis() : 0;
    palmaEsc(eW * 0.08, yAgua - eH * 0.04, eH * 0.7, t, T[3], vp); palmaEsc(eW * 0.17, yAgua - eH * 0.01, eH * 0.44, t + 900, T[3], vp);
    palmaEsc(eW * 0.92, yAgua - eH * 0.035, eH * 0.62, t + 400, T[3], vp); palmaEsc(eW * 0.84, yAgua - eH * 0.005, eH * 0.4, t + 1600, T[3], vp);
    // luciérnagas
    if (kLuci > 0.02 && eLuci.length) eLuci.forEach(l => {
      l.x += Math.sin(t * l.v + l.f) * 0.35 * (dt / 16); l.y += Math.cos(t * l.v * 1.3 + l.f) * 0.25 * (dt / 16);
      ex.globalAlpha = kLuci * (0.25 + 0.75 * Math.max(0, Math.sin(t / 700 + l.f * 3))); ex.drawImage(eSprLuci, l.x - 9, l.y - 9, 18, 18);
    });
    ex.globalAlpha = 1;
    // hojas y polvo que arrastra el viento
    if (eHojas.length) {
      const vv = vientoVis(), vel = 0.03 + vv / 450;
      ex.strokeStyle = mezcla(T[2], '#a07c3c', 0.45); ex.lineWidth = 2.2; ex.lineCap = 'round'; ex.beginPath();
      eHojas.forEach(l => {
        if (dt) {
          l.x += vel * l.v * dt; l.y += (Math.sin(t / 380 + l.f) * 0.025 + l.g) * dt; l.a += (0.004 + vv / 6000) * l.v * dt;
          if (l.x > eW + 10 || l.y > eH || l.y < eH * 0.2) { l.x = -10 - Math.random() * eW * 0.3; l.y = eH * (0.35 + Math.random() * 0.6); }
        }
        const c = Math.cos(l.a) * l.l, s = Math.sin(l.a) * l.l * 0.6; ex.moveTo(l.x - c, l.y - s); ex.lineTo(l.x + c, l.y + s);
      });
      ex.stroke();
    }
    // niebla: capas que se desplazan despacio, cada una a su velocidad
    const nb = efectoActivo('niebla') ? kNb : 0;
    if (nb > 0.005) {
      const cn = mezA([225, 232, 238], [120, 134, 156], (1 - kLuz) * 0.6).map(Math.round).join(',');   // de noche la niebla es gris azulada
      const gf = ex.createLinearGradient(0, eH * 0.35, 0, eH); gf.addColorStop(0, `rgba(${cn},0)`); gf.addColorStop(0.55, `rgba(${cn},${nb * 0.55})`); gf.addColorStop(1, `rgba(${cn},${nb * 0.3})`);
      ex.fillStyle = gf; ex.fillRect(0, eH * 0.35, eW, eH * 0.65);
      eNiebla.forEach(f => {
        const tw = f.tw; f.x = (f.x + f.v * dt) % tw;
        ex.globalAlpha = Math.min(1, nb * f.a * (1 + 0.6 * kLuz));
        for (let x = Math.round((f.x - tw) * eD) / eD; x < eW; x += tw) ex.drawImage(f.c, x, Math.round((f.y - f.h / 2) * eD) / eD, tw, f.h);
      });
      ex.globalAlpha = 1;
    }
    // lluvia
    if (eGotas.length) {
      const r = limitar(vientoVis() / 60, 0, 0.5); ex.strokeStyle = 'rgba(205,225,255,0.38)'; ex.lineWidth = 1; ex.beginPath();
      eGotas.forEach(d => { d.y += d.v * dt * 0.7; d.x += d.v * dt * 0.7 * r; if (d.y > eH) { d.y = -d.l; d.x = Math.random() * eW; } if (d.x > eW) d.x -= eW; ex.moveTo(d.x, d.y); ex.lineTo(d.x - d.l * r, d.y - d.l); });
      ex.stroke();
    }
    // granizo (tormenta con granizo): cae rápido, rebota en las orillas y salpica en el río
    if (eGranizo.length) {
      ex.strokeStyle = 'rgba(225,235,255,0.35)'; ex.lineWidth = 1.2; ex.beginPath();   // estela corta: así el granizo se lee cayendo y no como estrellas
      eGranizo.forEach(g => { if (g.vy > 0.25) { ex.moveTo(g.x, g.y - g.r); ex.lineTo(g.x - g.vx * 14, g.y - g.vy * 14); } });
      ex.stroke();
      ex.fillStyle = 'rgba(236,243,255,0.92)'; ex.beginPath();
      eGranizo.forEach(g => {
        if (dt) {
          g.vy += 0.0016 * dt; g.y += g.vy * dt; g.x += g.vx * dt;
          if (g.y >= g.suelo && g.vy > 0) {
            const agua = g.x > eW * 0.3 && g.x < eW * 0.72;
            if (!agua && g.reb < 2) { g.y = g.suelo; g.vy *= -0.32; g.vx = (Math.random() - 0.5) * 0.12; g.reb++; }
            else { if (agua && eOndas.length < 40) eOndas.push({ x: g.x, y: g.suelo, r: 0, a: 0.45 }); g.nuevo(g); }
          }
          if (g.x > eW) g.x -= eW;
        }
        ex.moveTo(g.x + g.r, g.y); ex.arc(g.x, g.y, g.r, 0, 6.283);
      });
      ex.fill();
    }
    // relámpago: se ilumina todo y cae un rayo ramificado (a veces el destello queda dentro de las nubes)
    if (A.tipo === 'tormenta' && efectoActivo('rayos') && !simple) {
      if (destello > 0.8 && !eRayo) eRayo = Math.random() < 0.7 ? armarRayo(yAgua - 2) : [];
      if (destello > 0.05) {
        ex.fillStyle = `rgba(215,225,255,${destello * 0.3})`; ex.fillRect(0, 0, eW, eH);
        if (eRayo && eRayo.length) {
          ex.lineCap = 'round'; ex.lineJoin = 'round';
          for (const [ancho, col] of [[5, `rgba(160,190,255,${0.22 * destello})`], [1, `rgba(248,250,255,${Math.min(1, destello * 1.3)})`]]) {
            ex.strokeStyle = col;
            eRayo.forEach(r => { ex.lineWidth = r.w * ancho; ex.beginPath(); r.pts.forEach((p, i) => i ? ex.lineTo(p[0], p[1]) : ex.moveTo(p[0], p[1])); ex.stroke(); });
          }
        }
      } else eRayo = null;
    }
    ex.fillStyle = eSombra; ex.fillRect(0, 0, eW, eH * 0.4);   // sombra arriba para que se lean las etiquetas
  }
  function etiquetaEscena(a) {                                     // las etiquetas sobre el cuadro: ciudad, clima y momento del día
    // en una vista previa se muestra el clima elegido (con el mismo texto que la app usa para un código típico de ese clima), no el real
    const c0 = a.weather_code, real = [95, 96, 99].includes(c0) ? 'tormenta' : c0 >= 51 && c0 <= 86 ? 'lluvia' : c0 === 45 || c0 === 48 ? 'niebla' : c0 === 3 ? 'nublado' : c0 === 2 ? 'parcial' : 'despejado';
    const cod = amb.previa && real !== amb.tipo ? { despejado: 0, parcial: 2, nublado: 3, lluvia: 63, tormenta: 95, niebla: 45 }[amb.tipo] : c0;   // si coincide con el real, se deja el texto real (p. ej. «Tormenta con granizo»)
    const w = clima(cod, amb.previa ? (amb.fase === 'noche' ? 0 : 1) : a.is_day), tx = [`📍 ${seleccionada}`, `${w.emoji} ${w.texto}`, { amanecer: '🌅 Amanecer', dia: '☀️ Día', atardecer: '🌇 Atardecer', noche: '🌙 Noche' }[amb.fase] || '☀️ Día'], caja = $('escenaEtq');
    caja.textContent = ''; tx.forEach(s => { const e = document.createElement('span'); e.textContent = s; caja.appendChild(e); });
  }
  // Barra de navegación del celular
  document.querySelectorAll('.barra-nav [data-ir]').forEach(b => b.addEventListener('click', () => { const s = $(b.dataset.ir); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  $('navComparar').addEventListener('click', () => $('btnComparar').click());
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) document.querySelectorAll('.barra-nav [data-ir]').forEach(b => b.classList.toggle('on', b.dataset.ir === e.target.id)); }), { rootMargin: '-40% 0px -50% 0px' });
    ['detalle', 'seccionMapa', 'seccionLista'].forEach(id => { if ($(id)) io.observe($(id)); });
  }

  function ajustarCielo() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cvW = innerWidth; cvH = innerHeight;
    cv.width = Math.round(cvW * dpr); cv.height = Math.round(cvH * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cieloLimpio = false;
    armarParticulas();
  }
  let cClave = '', cieloLimpio = false, cAcum = 0, cDestello = 0;
  const claveCielo = () => [amb.tipo, cvW, cvH, claveFx()].join('|');
  function armarParticulas() {
    cClave = claveCielo();
    const area = cvW * cvH, abierto = amb.tipo === 'despejado' || amb.tipo === 'parcial';
    gotas = [];                                                    // la lluvia se dibuja solo en el paisaje de arriba (no sobre los datos)
    estrellas = abierto && efectoActivo('estrellas')
      ? Array.from({ length: cant(area / 9000) }, () => ({ x: Math.random() * cvW, y: Math.random() * cvH * 0.7, r: 0.3 + Math.random() * 1.1 })) : [];
    const n = { despejado: 0, parcial: 3, nublado: 5, niebla: 5, lluvia: 5, tormenta: 5 }[amb.tipo];
    nubes = efectoActivo('nubes') ? Array.from({ length: Math.round(n * limitar(multFx(), 0.7, 1.3)) }, () => ({ x: Math.random() * cvW, y: cvH * (0.05 + Math.random() * 0.45), r: cvW * (0.18 + Math.random() * 0.18), v: 0.01 + Math.random() * 0.02 })) : [];
  }
  function pintarCielo(t, dt, quieto) {
    if (!quieto) latidoRayo(t, dt || 0);
    if (!prefsAnim.fondo) { if (!cieloLimpio) { cx.clearRect(0, 0, cvW, cvH); cieloLimpio = true; } return; }   // fondo apagado: el lienzo queda limpio
    // El fondo cambia muy despacio (nubes de menos de 1 px por cuadro) y repintarlo obliga al navegador a recomponer toda la página
    // (los paneles translúcidos se apoyan en él): basta con repintarlo ~15 veces por segundo, salvo durante un relámpago.
    if (!quieto) {
      cAcum += dt || 0;
      if (cAcum < 62 && !cieloLimpio && cClave === claveCielo() && destello <= 0.02 && cDestello <= 0.02) return;
      dt = cAcum; cAcum = 0;
    }
    cDestello = destello;
    cieloLimpio = false;
    if (cClave !== claveCielo()) armarParticulas();
    if (!vEsc.Ph) avanzarVisual(0, true);
    const A = amb, kEstr = vEsc.esc[1], kLuna = vEsc.esc[4], luz = vEsc.esc[6], ast = arcoAstros();
    cx.clearRect(0, 0, cvW, cvH);
    if (A.tipo === 'despejado' || A.tipo === 'parcial' || A.tipo === 'nublado') {      // sol o luna: un resplandor suave que sigue su arco
      const r = Math.max(cvW, cvH) * 0.34, brillar = (x, y, col, a) => {
        const g = cx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
        cx.fillStyle = g; cx.fillRect(x - r, y - r, r * 2, r * 2);   // solo el cuadrado del resplandor: fuera de él no hay nada que pintar
      };
      const S = ast && ast.sol, L = ast && ast.luna, pulso = 1 + 0.05 * Math.sin(t / 2600), cub = A.tipo === 'nublado' ? 0.45 : 1;
      if (!ast && A.fase !== 'noche') brillar(cvW * 0.8, cvH * 0.13, '255,228,150', 0.36 * cub * pulso);
      if (S && S.f > 0.02) { const k = limitar(S.alt / 0.45, 0, 1); brillar(cvW * S.x, cvH * (0.5 - 0.4 * S.alt), `255,${Math.round(150 + 78 * k)},${Math.round(80 + 70 * k)}`, 0.36 * cub * S.f * pulso); }
      if (efectoActivo('estrellas') && L && L.f > 0.02 && kLuna > 0.01) {
        const il = (1 - Math.cos(2 * Math.PI * edadLuna())) / 2;   // con luna llena el resplandor es mayor que con luna nueva
        brillar(cvW * L.x, cvH * (0.5 - 0.4 * L.alt), '190,205,255', 0.16 * cub * kLuna * L.f * pulso * (0.3 + 0.7 * il));
      }
    }
    if (estrellas.length && kEstr > 0.01) {                        // estrellas en 4 grupos que titilan a destiempo
      cx.fillStyle = '#fff';
      for (let k = 0; k < 4; k++) { cx.globalAlpha = kEstr * (0.35 + 0.45 * Math.sin(t / 900 + k * 1.7) ** 2); cx.beginPath(); for (let i = k; i < estrellas.length; i += 4) { const s = estrellas[i]; cx.moveTo(s.x + s.r, s.y); cx.arc(s.x, s.y, s.r, 0, 6.283); } cx.fill(); }
      cx.globalAlpha = 1;
    }
    const oscuras = A.tipo === 'lluvia' || A.tipo === 'tormenta';
    const ca = A.tipo === 'tormenta' ? 0.34 : A.tipo === 'niebla' ? 0.24 : 0.12 + 0.05 * luz;
    const cc = oscuras ? '40,50,70' : `${Math.round(150 + 105 * luz)},${Math.round(165 + 90 * luz)},${Math.round(200 + 55 * luz)}`;
    nubes.forEach(n => {
      if (!quieto) { n.x += n.v * dt * (1 + A.viento / 25); if (n.x - n.r * 1.8 > cvW) n.x = -n.r * 1.8; }
      const g = cx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, `rgba(${cc},${ca})`); g.addColorStop(1, `rgba(${cc},0)`);
      cx.save(); cx.translate(n.x, n.y); cx.scale(1.8, 0.55); cx.translate(-n.x, -n.y);
      cx.fillStyle = g; cx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2); cx.restore();   // el recuadro de la nube, no un círculo trazado
    });
    if (quieto) return;
    if (A.tipo === 'tormenta' && destello > 0.02 && efectoActivo('rayos')) { cx.fillStyle = `rgba(220,230,255,${destello * 0.16})`; cx.fillRect(0, 0, cvW, cvH); }   // relámpago: se aclara todo el cielo
  }
  // ---- Bucle de animación y calidad ----
  // Un solo requestAnimationFrame pinta el cielo de fondo y el paisaje. prefsAnim.calidad decide cuántos cuadros por segundo y cuántas partículas:
  //   'alta' → ~30 cuadros/s y nivelCalidad 1 · 'ahorro' → ~20 cuadros/s y nivelCalidad 0.5
  //   'auto' → empieza en el escalón 0 y mide, en ventanas de ~2 s, (a) cada cuánto llama el navegador a requestAnimationFrame
  //            comparado con lo mejor que logró antes en este equipo (si el hilo principal no da abasto, los rAF se espacian) y
  //            (b) cuánto tarda de verdad pintar un cuadro. Si va lento ~4 s seguidos baja un escalón; si va holgado un buen rato sube uno.
  //            Cada vez que vuelve a caer poco después de subir, espera el doble antes de reintentar (15 s, 30 s… hasta 4 min): no oscila.
  // `ms` es el intervalo objetivo entre cuadros (con rAF cada ~16,7 ms, a 60 Hz: 33 → 30/s, 40 → ~25/s, 50 → 20/s, 66 → 15/s).
  const ESCALONES_CAL = [{ nivel: 1, ms: 33 }, { nivel: 0.7, ms: 40 }, { nivel: 0.45, ms: 50 }, { nivel: 0.45, ms: 66 }];
  const CAL_FIJA = { alta: { nivel: 1, ms: 33 }, ahorro: { nivel: 0.5, ms: 50 } };
  const VENTANA_CAL = 2000;                                        // se juzga cada ~2 s de animación, no cuadro a cuadro
  const autoCal = { escalon: 0, ini: 0, nRaf: 0, sumaRaf: 0, n: 0, costo: 0, base: 0, calentar: 0, lentas: 0, rapidas: 0, espera: 15000, desde: 0, subidaEn: -1e9, pref: prefsAnim.calidad };
  let msCuadro = 33, ultRaf = 0;
  function aplicarCalidad() {                                      // fija msCuadro y nivelCalidad según la preferencia; rearma el fondo si cambió el nivel
    if (autoCal.pref !== prefsAnim.calidad) {                      // se eligió otra calidad: 'auto' vuelve a empezar desde arriba
      autoCal.pref = prefsAnim.calidad;
      Object.assign(autoCal, { escalon: 0, lentas: 0, rapidas: 0, espera: 15000, desde: performance.now(), subidaEn: -1e9 });
    }
    const c = CAL_FIJA[prefsAnim.calidad] || ESCALONES_CAL[autoCal.escalon];
    msCuadro = c.ms;
    if (c.nivel !== nivelCalidad) { nivelCalidad = c.nivel; armarParticulas(); }
  }
  function reiniciarMedicion(t) { Object.assign(autoCal, { ini: t, nRaf: 0, sumaRaf: 0, n: 0, costo: 0 }); }
  function pausarMedicion() { autoCal.ini = 0; autoCal.calentar = 4; }   // tras una pausa o un rearmado se descartan los primeros rAF
  function medirCalidad(t, raf, costo) {                           // se llama en CADA rAF; costo = ms de pintado, o null si este rAF no pintó
    if (prefsAnim.calidad !== 'auto') return;
    if (autoCal.calentar > 0) { autoCal.calentar--; return; }
    if (!autoCal.ini) { reiniciarMedicion(t); return; }
    autoCal.nRaf++; autoCal.sumaRaf += raf;
    if (costo !== null) { autoCal.n++; autoCal.costo += costo; }
    if (t - autoCal.ini < VENTANA_CAL || autoCal.n < 10) return;
    const medio = autoCal.costo / autoCal.n, rafMedio = autoCal.sumaRaf / autoCal.nRaf;
    // referencia: el mejor ritmo de rAF visto en este equipo; se relaja un 1 % por ventana por si cambia la pantalla (p. ej. de 120 a 60 Hz)
    autoCal.base = autoCal.base ? Math.min(rafMedio, autoCal.base * 1.01) : rafMedio;
    const ritmo = rafMedio / autoCal.base;                         // 1 = el navegador va tan fluido como en su mejor momento
    // lento: los rAF llegan un 30 % más espaciados que lo normal en este equipo, o pintar se come el 40 % del presupuesto del cuadro
    const lenta = ritmo > 1.3 || medio > msCuadro * 0.4;
    // holgado: los rAF van a su ritmo normal y pintar usa poco del presupuesto
    const rapida = ritmo < 1.12 && medio < msCuadro * 0.15;
    autoCal.lentas = lenta ? autoCal.lentas + 1 : 0;
    autoCal.rapidas = rapida ? autoCal.rapidas + 1 : 0;
    if (autoCal.lentas >= 2 && autoCal.escalon < ESCALONES_CAL.length - 1) {   // ~4 s seguidos lento → un escalón más liviano
      if (t - autoCal.subidaEn < 30000) autoCal.espera = Math.min(autoCal.espera * 2, 240000);   // volvió a caer poco después de subir: esperar más antes de reintentar
      autoCal.escalon++; autoCal.lentas = autoCal.rapidas = 0; autoCal.desde = t; aplicarCalidad(); pausarMedicion(); return;
    }
    if (autoCal.escalon > 0 && autoCal.rapidas * VENTANA_CAL >= autoCal.espera && t - autoCal.desde >= autoCal.espera) {   // mucho rato holgado → subir uno, despacio
      autoCal.escalon--; autoCal.lentas = autoCal.rapidas = 0; autoCal.desde = autoCal.subidaEn = t; aplicarCalidad(); pausarMedicion(); return;
    }
    reiniciarMedicion(t);
  }
  function bucleCielo(t) {
    rafCielo = requestAnimationFrame(bucleCielo);
    const raf = t - ultRaf, intervalo = t - ultCielo; ultRaf = t;
    if (intervalo < msCuadro - 4) { medirCalidad(t, raf, null); return; }   // margen de 4 ms por el temblor de los rAF
    const dt = Math.min(64, intervalo); ultCielo = t;
    const t0 = performance.now();
    avanzarVisual(dt, false);
    if (prefsAnim.fondo) pintarCielo(t, dt);
    if (prefsAnim.paisaje) pintarEscena(t, dt, false);
    medirCalidad(t, raf, performance.now() - t0);
  }
  function reanudarCielo() {
    cancelAnimationFrame(rafCielo);
    aplicarCalidad();
    const ahora = performance.now();
    if (!fx) { cx.clearRect(0, 0, cvW, cvH); avanzarVisual(0, true); pintarEscena(ahora, 0, true); return; }
    // Partes que no se animan: un solo dibujo fijo (el cielo de fondo apagado queda transparente: se ve el degradado de la página)
    const animar = !REDUCIDO && !document.hidden, fondoVivo = animar && prefsAnim.fondo, paisajeVivo = animar && prefsAnim.paisaje;
    if (!fondoVivo || !paisajeVivo) avanzarVisual(0, true);
    if (!fondoVivo) { if (prefsAnim.fondo) pintarCielo(ahora, 0, true); else cx.clearRect(0, 0, cvW, cvH); }
    if (!paisajeVivo) pintarEscena(ahora, 0, true);
    if (!fondoVivo && !paisajeVivo) return;                        // nada que animar: el bucle queda detenido (cero CPU)
    ultCielo = ahora - msCuadro; ultRaf = ahora; pausarMedicion();                // tras una pausa, la medición empieza de cero
    rafCielo = requestAnimationFrame(bucleCielo);
  }

  // ---- Sol y hora reales (no dependen de que la API se haya actualizado hace poco) ----
  // Amanecer/atardecer calculados con la posición del sol (fórmula NOAA) para las coordenadas de la ciudad.
  function solHoy(lat, lon, ahora) {
    const rad = Math.PI / 180, f = new Date(ahora || Date.now());
    const dia0 = Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate());
    const N = Math.floor((dia0 - Date.UTC(f.getUTCFullYear(), 0, 0)) / 86400000);
    const g = 2 * Math.PI / 365 * (N - 1);
    const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const cosH = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(dec)) - Math.tan(lat * rad) * Math.tan(dec);
    if (!isFinite(cosH) || cosH < -1 || cosH > 1) return null;
    const ha = Math.acos(cosH) / rad;
    return { sale: dia0 + (720 - 4 * (lon + ha) - eqt) * 60000, pone: dia0 + (720 - 4 * (lon - ha) - eqt) * 60000 };
  }
  // Momento del día en una ciudad AHORA: { fase, dia, dorado, sol }.
  // fase: amanecer (de 30 min antes a 45 min después de salir el sol), día, atardecer (de 45 min antes a 30 min después de la puesta) o noche.
  function momentoDia(c, ahora) {
    const t = ahora || Date.now(), sol = c && solHoy(c.lat, c.lon, t);
    if (!sol) return null;
    const M = 60000;
    const amanecer = t >= sol.sale - 30 * M && t <= sol.sale + 45 * M, atardecer = t >= sol.pone - 45 * M && t <= sol.pone + 30 * M;
    const arriba = t >= sol.sale && t < sol.pone;
    return { fase: amanecer ? 'amanecer' : atardecer ? 'atardecer' : arriba ? 'dia' : 'noche', dia: arriba, dorado: amanecer || atardecer, sol };
  }
  // Pone is_day al valor real en cada ciudad. Devuelve true si cambió alguna (para volver a pintar).
  function sincronizarDia() {
    let cambio = false;
    CIUDADES.forEach(c => {
      const a = datos[c.n], m = momentoDia(c);
      if (!a || !m) return;
      const v = m.dia ? 1 : 0;
      if (a.is_day !== v) { a.is_day = v; cambio = true; }
    });
    if (detalleActual && detalleActual.d.current) {
      const m = momentoDia(detalleActual.c);
      if (m) detalleActual.d.current.is_day = m.dia ? 1 : 0;
    }
    return cambio;
  }
  // Hora actual de Asunción como "AAAA-MM-DDTHH" (para ubicar la hora actual dentro del pronóstico por horas)
  function horaAsuncion() {
    const p = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
    return `${p.year}-${p.month}-${p.day}T${p.hour}`;
  }

  // Traduce el clima actual a un "tipo de cielo" y lo aplica (colores, partículas y sonido)
  function ambiente(a, d) {
    if (!a || a.weather_code === undefined) return;
    ultimoAmbiente = [a, d];
    const cod = a.weather_code, p = a.precipitation || 0;
    const m = momentoDia(porNombre.get(seleccionada));                // momento del día calculado con el sol y la hora real
    let tipo = [95, 96, 99].includes(cod) ? 'tormenta' : cod >= 51 && cod <= 86 ? 'lluvia' : cod === 45 || cod === 48 ? 'niebla'
      : cod === 3 ? 'nublado' : cod === 2 ? 'parcial' : 'despejado';
    let fase = m ? m.fase : (a.is_day !== 0 ? 'dia' : 'noche');
    const vp = prefsAnim.vistaPrevia;                                 // vista previa elegida en los ajustes: reemplaza el clima y/o la hora reales
    if (vp && TIPOS_CIELO.includes(vp.tipo)) tipo = vp.tipo;
    if (vp && FASES_DIA.includes(vp.fase)) fase = vp.fase;
    const dia = fase !== 'noche';
    const dorado = (fase === 'amanecer' || fase === 'atardecer') && (tipo === 'despejado' || tipo === 'parcial');   // colores de amanecer/atardecer (solo con cielo abierto)
    document.body.classList.toggle('noche', fase === 'noche');
    const lluvia = tipo === 'tormenta' ? 1 : tipo === 'lluvia' ? limitar(0.3 + p / 3, 0.3, 1) : 0;
    const clave = [tipo, Math.round(lluvia * 4)].join(), claveFase = [tipo, fase].join();
    Object.assign(amb, { tipo, fase, dia, dorado, lluvia, sol: m ? m.sol : null, viento: a.wind_speed_10m || 0, temp: a.temperature_2m, previa: !!vp, granizo: tipo === 'tormenta' && (cod === 96 || cod === 99) });
    const nuevaEstructura = clave !== ambClave, nuevaFase = claveFase !== faseClave;
    if (nuevaEstructura) { ambClave = clave; armarParticulas(); proxRayo = performance.now() + 3000; }   // las nubes y aves solo se vuelven a sortear si cambia el clima, no por el paso del día
    if (nuevaFase) {
      faseClave = claveFase;
      const c = paletaObjetivo();
      ['--c1', '--c2', '--c3'].forEach((k, i) => document.body.style.setProperty(k, c[i]));
      document.body.dataset.cielo = tipo;
      const meta = document.querySelector('meta[name=theme-color]');
      if (meta && document.documentElement.dataset.tema !== 'claro') meta.content = c[0];
    }
    if (nuevaEstructura || nuevaFase) reanudarCielo();
    mezclar(); etiquetaEscena(a);
  }

  // ============ SONIDO DEL CLIMA ============
  // Un paisaje sonoro que cambia con el clima de la ciudad elegida (o con la vista previa). Todo se fabrica aquí mismo con el navegador
  // (Web Audio: ruido y osciladores, no se descarga nada) y solo suena si la persona toca 🔈.
  // MEZCLA LIMPIA: en cada estado suena UNA cama (el fondo: brisa, lluvia o grillos de noche) y como mucho DOS acentos
  // (aves, chicharras, ranas, ráfagas, granizo, truenos), elegidos por prioridad en escena(); el resto calla del todo.
  //  ☀️ día: brisa y aves; con calor de verano (≥ 28 °C, de noviembre a marzo) chicharras · 🌇 hora dorada: coro de aves
  //  🌙 noche (≥ 12 °C): grillos (más rápidos cuanto más calor) y ranas · ☁️ nublado: brisa y aves lejanas · 🌫️ niebla: todo amortiguado
  //  🌧️ lluvia: siseo y gotas según la intensidad; la lluvia fuerte saca a las aves y los insectos · ⛈️ tormenta: lluvia fuerte y truenos
  //  (con granizo, códigos 96/99, golpeteo sobre el techo) · 💨 viento: brisa desde 3 km/h, ráfagas desde 15 km/h, silbido desde 35 km/h
  // Niveles: cada capa tiene un nivel de referencia (REF) con el que, sola, suena a la misma sonoridad; la escena reparte dB RELATIVOS
  // a esa referencia, así la tormenta no suena el triple que una noche tranquila. Los cambios de estado son fundidos de 2,5 a 3,5 s.
  // Un trueno «agacha» (ducking) la cama y, más, los acentos mientras retumba. Cadena final: volumen (≤ 1) → filtro → limitador → salida.
  // Las capas continuas se crean UNA vez; los sonidos sueltos (aves, ranas, gotas, granizo, truenos) se liberan solos y tienen un tope.
  let au = null, sonando = false;
  const azar = (a, b) => a + Math.random() * (b - a);
  const gananciaVolumen = () => limitar(Number(prefsAnim.volumen) || 0, 0, 1);   // la ganancia maestra nunca pasa de 1
  // ¿Granizo? Solo con tormenta real con granizo (códigos 96/99); una vista previa que elige otro tipo de clima no lo hereda
  const hayGranizo = () => amb.tipo === 'tormenta' && !!ultimoAmbiente && [96, 99].includes(ultimoAmbiente[0].weather_code) && !(prefsAnim.vistaPrevia && prefsAnim.vistaPrevia.tipo);
  let mesCache = { t: -1e9, verano: false };
  const mesVerano = () => {                                        // noviembre a marzo (en Asunción); se recalcula cada 10 min como mucho
    if (performance.now() - mesCache.t > 600000) { const m = +horaAsuncion().slice(5, 7); mesCache = { t: performance.now(), verano: m >= 11 || m <= 3 }; }
    return mesCache.verano;
  };
  // Ganancia con la que cada capa SOLA suena a la sonoridad de referencia (≈ −15 LUFS con volumen 1, medida con
  // herramientas/audio/medir-mezcla.js --solo). Aves y ranas: con su tasa de referencia (1 y 0,5); la lluvia: siseo + murmullo + gotas a pleno.
  const REF = { viento: 0.6, rafagas: 1.3, silbido: 0.1, lluvia: 0.32, lluviaBajo: 0.43, gotas: 0.65, granizo: 2, chicharras: 3.2, grillos: 0.076, aves: 1.6, ranas: 5, truenos: 1.8 };
  const TOPE_FUENTES = 150;                                        // sonidos sueltos vivos a la vez, como mucho (nada crece sin límite)
  const TRUENO_SEPARACION = 6;                                     // s mínimos entre el comienzo de dos truenos (y nunca dos encimados)

  // ---- Música navideña opcional: una «caja de música» sintetizada (nada se descarga) ----
  // Solo melodías de dominio público, escritas nota por nota aquí: «Noche de paz» (Gruber, 1818), «Los peces en el río» y
  // «Campana sobre campana» (villancicos tradicionales, versiones simplificadas) y «Jingle Bells» (Pierpont, 1857). Se alternan en bucle.
  // Suena solo si la persona la activó (fijarMusicaNavidad(true), preferencia 'clima-py-navidad-musica') Y la decoración navideña
  // está activa (<html class="navidad">). Con el sonido del clima a la vez, la música queda al frente y el ambiente baja ~10 dB.
  // Las notas se programan por tandas de ~1,5 s con el reloj del audio (nunca hay más de TOPE_NOTAS sonando).
  const MUSICA_CLAVE = 'clima-py-navidad-musica', MUSICA_NIVEL = 1.8, TOPE_NOTAS = 48, PAUSA_CANCIONES = 2.5, AMBIENTE_CON_MUSICA = 0.32;   // 0,32 ≈ −10 dB
  let musicaPedida = leer(MUSICA_CLAVE, 'no') === 'si';
  const mus = { activa: false, cancion: 0, ev: 0, inicio: 0, temporizador: 0, notasVivas: 0, canciones: 0 };
  // Notación: «nota+octava:duración en pulsos» (R = silencio); acordes: uno por compás (m = menor).
  const CANCIONES = [
    { nombre: 'Noche de paz', bpm: 84, compas: 3,
      notas: 'G5:1.5 A5:.5 G5:1 E5:3 G5:1.5 A5:.5 G5:1 E5:3 D6:2 D6:1 B5:3 C6:2 C6:1 G5:3 A5:2 A5:1 C6:1.5 B5:.5 A5:1 G5:1.5 A5:.5 G5:1 E5:3 ' +
        'A5:2 A5:1 C6:1.5 B5:.5 A5:1 G5:1.5 A5:.5 G5:1 E5:3 D6:2 D6:1 F6:1.5 D6:.5 B5:1 C6:3 E6:3 C6:1.5 G5:.5 E5:1 G5:1.5 F5:.5 D5:1 C5:3 R:3',
      acordes: 'C C C C G G C C F F C C F F C C G G C C C G C C' },
    { nombre: 'Los peces en el río', bpm: 104, compas: 2,
      notas: 'A5:.5 A5:.5 A5:.5 A5:.5 Bb5:.5 A5:.5 G5:.5 A5:.5 F5:.5 G5:.5 A5:.5 G5:.5 F5:.5 E5:.5 D5:1 ' +
        'A5:.5 A5:.5 A5:.5 A5:.5 Bb5:.5 A5:.5 G5:.5 A5:.5 F5:.5 G5:.5 A5:.5 G5:.5 F5:.5 E5:.5 D5:1 ' +
        'D6:.5 D6:.5 C6:.5 Bb5:.5 A5:1 A5:1 G5:.5 G5:.5 F5:.5 E5:.5 F5:1 A5:1 F5:.5 G5:.5 A5:.5 G5:.5 F5:.5 E5:.5 D5:1 E5:.5 F5:.5 E5:.5 C#5:.5 D5:2',
      acordes: 'Dm Gm Dm Dm Dm Gm A Dm Gm Dm A Dm Dm Dm A Dm' },
    { nombre: 'Campana sobre campana', bpm: 100, compas: 2,
      notas: 'D6:.5 D6:.5 D6:.5 E6:.5 D6:.5 C6:.5 B5:1 B5:.5 B5:.5 B5:.5 C6:.5 B5:.5 A5:.5 G5:1 A5:.5 A5:.5 A5:.5 B5:.5 C6:.5 B5:.5 A5:1 B5:.5 A5:.5 G5:.5 F#5:.5 G5:2 ' +
        'D6:1.5 B5:.5 D6:1 B5:1 C6:.5 B5:.5 A5:.5 G5:.5 A5:2 D6:1.5 B5:.5 D6:1 B5:1 C6:.5 B5:.5 A5:.5 F#5:.5 G5:2',
      acordes: 'G G G G D D D G G G C D G G D G' },
    { nombre: 'Jingle Bells', bpm: 112, compas: 4,
      notas: 'B5:1 B5:1 B5:2 B5:1 B5:1 B5:2 B5:1 D6:1 G5:1.5 A5:.5 B5:4 C6:1 C6:1 C6:1.5 C6:.5 C6:1 B5:1 B5:1 B5:.5 B5:.5 B5:1 A5:1 A5:1 B5:1 A5:2 D6:2 ' +
        'B5:1 B5:1 B5:2 B5:1 B5:1 B5:2 B5:1 D6:1 G5:1.5 A5:.5 B5:4 C6:1 C6:1 C6:1.5 C6:.5 C6:1 B5:1 B5:1 B5:.5 B5:.5 D6:1 D6:1 C6:1 A5:1 G5:4',
      acordes: 'G G G G C G A D G G G G C G D G' }
  ].map(compilarCancion);
  // Pasa la notación a eventos [pulso, midi, duración en pulsos, voz] ordenados; 'a' = acompañamiento (bajo y arpegio suave)
  function compilarCancion(c) {
    const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }, midi = n => { const m = /^([A-G])([#b]?)(\d)$/.exec(n); return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
    const ev = []; let t = 0;
    for (const tok of c.notas.trim().split(/\s+/)) { const [n, d] = tok.split(':'); if (n !== 'R') ev.push([t, midi(n), +d, 'm']); t += +d; }
    const patron = { 2: [[0, 0], [1, 7]], 3: [[0, 0], [1, 7], [2, 16]], 4: [[0, 0], [1, 7], [2, 12], [3, 7]] }[c.compas];
    c.acordes.trim().split(/\s+/).forEach((a, i) => {
      const raiz = 12 * 5 + PC[a[0]] - (PC[a[0]] > 7 ? 12 : 0), menor = a.endsWith('m');
      patron.forEach(([p, int]) => ev.push([i * c.compas + p, raiz + (int === 16 ? (menor ? 15 : 16) : int), 1, 'a']));
    });
    ev.sort((x, y) => x[0] - y[0]);
    return { nombre: c.nombre, spb: 60 / c.bpm, largo: Math.max(t, c.acordes.trim().split(/\s+/).length * c.compas), ev };
  }
  // Una nota de caja de música: parciales de una lengüeta metálica (1 : 2,76 : 5,4) que se apagan rápido, con un golpe suave
  function notaCaja(ctx, dest, t, m, dur, voz, alTerminar) {
    const f = 440 * Math.pow(2, (m - 69) / 12), acomp = voz === 'a', largo = acomp ? 1.8 : 1.4 + Math.min(dur, 2) * 0.35;
    const vol = (acomp ? 0.055 : 0.12) * (f > 1300 ? 0.75 : 1);
    const parciales = acomp ? [[1, 1, 1], [2, 0.2, 0.5]] : [[1, 1, 1], [2.76, 0.16, 0.35], [5.4, 0.05, 0.18]];
    let ultimo = null;
    for (const [k, a, d] of parciales) {
      if (f * k > 12000) continue;
      const o = ctx.createOscillator(), g = ctx.createGain(), fin = t + largo * d;
      o.type = 'sine'; o.frequency.value = f * k;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * a, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, fin);
      o.connect(g); g.connect(dest); o.start(t); o.stop(fin + 0.05); ultimo = o;
    }
    if (ultimo && alTerminar) ultimo.onended = alTerminar;
  }
  // Recorre las canciones programando lo que cae antes de `hasta` (s del reloj del audio); `e` guarda por dónde va
  function recorrerMusica(e, hasta, tocar) {
    for (let guarda = 0; guarda < 2000; guarda++) {
      const c = CANCIONES[e.cancion], ev = c.ev[e.ev];
      if (!ev) { e.inicio += c.largo * c.spb + PAUSA_CANCIONES; e.cancion = (e.cancion + 1) % CANCIONES.length; e.ev = 0; e.canciones++; continue; }
      const t = e.inicio + ev[0] * c.spb;
      if (t > hasta) return;
      tocar(t, ev, c);
      e.ev++;
    }
  }
  function programarMusica() {
    if (!au || !mus.activa || au.ctx.state !== 'running') return;
    const ahora = au.ctx.currentTime;
    recorrerMusica(mus, ahora + 1.5, (t, ev, c) => {
      if (t < ahora - 0.05 || mus.notasVivas >= TOPE_NOTAS) return;   // notas atrasadas (tras una pausa) o demasiadas: se saltan, sin ráfagas
      mus.notasVivas++;
      notaCaja(au.ctx, au.musG, t, ev[1], ev[2] * c.spb, ev[3], () => { mus.notasVivas = Math.max(0, mus.notasVivas - 1); });
    });
  }
  const navidadActiva = () => document.documentElement.classList.contains('navidad');
  // Enciende o apaga la música según lo pedido y la decoración; mezclar() hace los fundidos (entrada y salida de 1,5 s)
  function actualizarMusica() {
    const debe = !!au && musicaPedida && navidadActiva();
    if (debe && !mus.activa) {
      mus.activa = true; mus.ev = 0; mus.inicio = au.ctx.currentTime + 0.5;
      clearInterval(mus.temporizador); mus.temporizador = setInterval(programarMusica, 250); programarMusica();
    } else if (!debe && mus.activa) {
      mus.activa = false; clearInterval(mus.temporizador); mus.temporizador = 0;
      mus.cancion = (mus.cancion + 1) % CANCIONES.length; mus.ev = 0;   // la próxima vez empieza con otra canción
      if (au && !sonando) setTimeout(() => { if (au && !sonando && !mus.activa) au.ctx.suspend(); }, 3500);
    }
    mezclar();
  }
  // CONTRATO: el interruptor del panel (sección Navidad) llama a fijarMusicaNavidad(true|false) desde el clic (gesto de la persona,
  // necesario para crear el AudioContext). Devuelve si la música quedó sonando.
  async function fijarMusicaNavidad(encendida) {
    musicaPedida = !!encendida; guardar(MUSICA_CLAVE, musicaPedida ? 'si' : 'no');
    if (musicaPedida && navidadActiva()) {
      if (!au) { au = crearAudio(); if (!au) { aviso('Tu navegador no permite reproducir sonido.'); return false; } }
      try { await au.ctx.resume(); } catch (_) {}
    }
    actualizarMusica();
    return mus.activa;
  }
  // Con la preferencia guardada en «sí», la música vuelve con el primer toque o tecla de la visita (el navegador no deja sonar antes)
  const arrancarMusicaGuardada = () => { if (musicaPedida && navidadActiva() && !mus.activa) fijarMusicaNavidad(true); };
  document.addEventListener('pointerdown', arrancarMusicaGuardada, { once: true, capture: true });
  document.addEventListener('keydown', arrancarMusicaGuardada, { once: true, capture: true });
  // La decoración la maneja la sección 6g: si se apaga o se enciende (p. ej. el 7 de enero), la música la sigue
  new MutationObserver(() => { if (au && (mus.activa || musicaPedida)) actualizarMusica(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  // Solo para medir: la música sola durante `seg` s en un OfflineAudioContext (48 kHz), con el volumen actual y un limitador igual
  async function renderizarMusica(seg) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, sr = 48000;
    seg = limitar(Number(seg) || 20, 1, 120);
    const off = new OAC(2, Math.round(sr * seg), sr), g = off.createGain(), lim = off.createDynamicsCompressor();
    g.gain.value = gananciaVolumen() * MUSICA_NIVEL;
    lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.25;
    g.connect(lim); lim.connect(off.destination);
    const e = { cancion: 0, ev: 0, inicio: 0.1, canciones: 0 }; let notas = 0;
    recorrerMusica(e, seg, (t, ev, c) => { notas++; notaCaja(off, g, t, ev[1], ev[2] * c.spb, ev[3]); });
    const buf = await off.startRendering();
    buf.info = { notas, canciones: e.canciones };
    return buf;
  }
  // Estallido suave para los fuegos artificiales de Año Nuevo: el paisaje puede llamar a climaSonido.estallido(0..1) al estallar
  // cada uno. Ruido grave y breve + chisporroteo; como mucho 4 por segundo (anti-ráfaga) y solo con el sonido del clima encendido.
  function estallido(fuerza) {
    if (!au || !sonando || au.ctx.state !== 'running' || !hayLugar(8)) return false;
    const ahora = performance.now(); if (ahora - (au.ultEstallido || 0) < 250) return false; au.ultEstallido = ahora;
    const { ctx, buf } = au, T = ctx.currentTime + 0.02, k = limitar(Number(fuerza) || 0.6, 0.1, 1), sal = salida(au.duckAcentos);
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, T); fl.frequency.exponentialRampToValueAtTime(120, T + 0.6);
    g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(0.5 * k, T + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, T + 0.7);
    s.connect(fl); fl.connect(g); g.connect(sal); vigilar(s).start(T, Math.random() * 4, 0.8);
    for (let i = 0; i < 5; i++) {                                  // chispas: golpecitos agudos que caen después del estallido
      const t = T + 0.15 + Math.random() * 0.5, c = ctx.createBufferSource(), h = ctx.createBiquadFilter(), cg = ctx.createGain();
      c.buffer = buf; h.type = 'highpass'; h.frequency.value = azar(3500, 7000);
      cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(0.12 * k, t + 0.002); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      c.connect(h); h.connect(cg); cg.connect(sal); vigilar(c).start(t, Math.random() * 4, 0.05);
    }
    return true;
  }

  // ctxDado: un OfflineAudioContext para medir (climaSonido.renderizar); sin él se crea el contexto real que suena
  function crearAudio(ctxDado) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!ctxDado && !AC) return null;
    const ctx = ctxDado || new AC(), master = ctx.createGain(), suave = ctx.createBiquadFilter(), lim = ctx.createDynamicsCompressor();
    master.gain.value = 0; suave.type = 'lowpass'; suave.frequency.value = 16000;
    // Limitador: casi no actúa en la mezcla normal; solo frena los picos (truenos cercanos) para que nunca sature
    lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.25;
    master.connect(suave); suave.connect(lim); lim.connect(ctx.destination);
    // Tres grupos: la cama, los acentos y los truenos. Los dos primeros pasan por un "agachador" que mueve el trueno (ducking).
    const duckCama = ctx.createGain(), duckAcentos = ctx.createGain(), busTruenos = ctx.createGain();
    // ambG: todo el sonido del clima (se apaga o baja ~10 dB cuando suena la música navideña); musG: la música
    const ambG = ctx.createGain(), musG = ctx.createGain();
    ambG.gain.value = 0; musG.gain.value = 0; ambG.connect(master); musG.connect(master);
    busTruenos.gain.value = 0; duckCama.connect(ambG); duckAcentos.connect(ambG); busTruenos.connect(ambG);

    // Ruido rosa (más grave y natural que el blanco): es la materia prima del viento, la lluvia, las chicharras, el granizo y los truenos
    const N = ctx.sampleRate * 6, F = Math.round(ctx.sampleRate * 0.5), buf = ctx.createBuffer(1, N, ctx.sampleRate), ch = buf.getChannelData(0), x = new Float32Array(N + F);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < x.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
    for (let i = 0; i < N; i++) ch[i] = i < F ? x[i] * (i / F) + x[N + i] * (1 - i / F) : x[i];

    // Un poco de eco de espacio abierto para las aves y las ranas (vuelve por el grupo de acentos: el trueno también lo agacha)
    const rev = ctx.createConvolver(), irN = Math.round(ctx.sampleRate * 1.8), ir = ctx.createBuffer(2, irN, ctx.sampleRate), revG = ctx.createGain();
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < irN; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irN, 2.6); }
    rev.buffer = ir; revG.gain.value = 0.6; rev.connect(revG); revG.connect(duckAcentos);
    const bus = (destino, eco) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(destino); if (eco) { const e = ctx.createGain(); e.gain.value = eco; g.connect(e); e.connect(rev); } return g; };
    const aves = bus(duckAcentos, 0.5), ranas = bus(duckAcentos, 1), gotas = bus(duckCama), busGranizo = bus(duckCama);

    // Una capa de ruido filtrado: fuente → filtros → env (envolvente propia: brisa que respira, ráfagas) → g (nivel de la escena)
    // Como el nivel va DESPUÉS de la envolvente, con nivel 0 la capa queda en silencio real.
    const capa = (tipo, f, q, alto) => {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), env = ctx.createGain(), g = ctx.createGain();
      s.buffer = buf; s.loop = true; fl.type = tipo; fl.frequency.value = f; fl.Q.value = q; hp.type = 'highpass'; hp.frequency.value = alto || 20; g.gain.value = 0;
      s.connect(fl); fl.connect(hp); hp.connect(env); env.connect(g); g.connect(duckCama); s.start(0, Math.random() * 3);
      return { g, fl, env };
    };
    const lfo = (hz, prof, destino) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = hz; g.gain.value = prof; o.connect(g); g.connect(destino); o.start(); };
    // Brisa: el filtro y la envolvente suben y bajan despacio (la envolvente oscila alrededor de 1; el nivel la multiplica)
    const viento = capa('bandpass', 400, 0.6, 60);
    lfo(0.11, 140, viento.fl.frequency); lfo(0.043, 0.3, viento.env.gain);
    // Ráfagas: su envolvente se programa a saltos irregulares (programarRafaga); con viento fuerte, además un silbido
    const rafaga = capa('bandpass', 520, 0.9, 90), silbido = capa('bandpass', 1100, 14, 400);
    rafaga.env.gain.value = 0.15; silbido.env.gain.value = 0;
    // Lluvia: un "siseo" parejo + un murmullo grave (más presente cuanto más llueve)
    const lluvia = capa('lowpass', 7500, 0.2, 1400), lluviaBajo = capa('lowpass', 700, 0.4, 120);
    // Chicharras: ruido agudo que "vibra" ~60-80 veces por segundo y se hincha y se apaga despacio
    const cigarra = (f, hz) => {
      const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), am = ctx.createGain(), sw = ctx.createGain(), nivel = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
      s.buffer = buf; s.loop = true; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 5;
      am.gain.value = 0.5; l.type = 'sawtooth'; l.frequency.value = hz; lg.gain.value = 0.5; l.connect(lg); lg.connect(am.gain);
      sw.gain.value = 0.65; lfo(azar(0.05, 0.12), 0.35, sw.gain);
      nivel.gain.value = 0; s.connect(bp); bp.connect(am); am.connect(sw); sw.connect(nivel); nivel.connect(duckAcentos); s.start(0, Math.random() * 3); l.start();
      return nivel;
    };
    const cig = [cigarra(4900, 62), cigarra(6200, 77)];
    // Grillos: un tono agudo que "late" en pulsos rápidos agrupados en cantos; tres grillos desfasados hacen un coro.
    // El ritmo de los cantos (grupo) se ajusta con la temperatura en mezclar().
    const grillo = (f, pulso, grupo) => {
      const o = ctx.createOscillator(), am = ctx.createGain(), gate = ctx.createGain(), nivel = ctx.createGain();
      const onda = (hz, corte) => { const p = ctx.createOscillator(), pf = ctx.createBiquadFilter(), pg = ctx.createGain(); p.type = 'square'; p.frequency.value = hz; pf.type = 'lowpass'; pf.frequency.value = corte; pg.gain.value = 0.5; p.connect(pf); pf.connect(pg); p.start(); return { pg, p }; };
      o.type = 'sine'; o.frequency.value = f; am.gain.value = 0.5; gate.gain.value = 0.5; nivel.gain.value = 0;
      const pu = onda(pulso, 70), gr = onda(grupo, 14);
      pu.pg.connect(am.gain); gr.pg.connect(gate.gain);
      o.connect(am); am.connect(gate); gate.connect(nivel); nivel.connect(duckAcentos); o.start();
      return { nivel, ritmo: gr.p.frequency, grupo };
    };
    const gri = [grillo(4300, 29, 1.9), grillo(4650, 33, 2.3), grillo(5050, 27, 1.6)];

    // Cada 250 ms: aves, ranas, ráfagas y el trueno de reserva; cada 100 ms: gotas y granizo (repartidos dentro de esos 100 ms con el
    // reloj del audio, sin temporizadores sueltos). Nada se crea si el contexto no está corriendo (suspendido o interrumpido): sus
    // sonidos no terminarían nunca y se acumularían.
    const listo = () => sonando && !document.hidden && ctx.state === 'running' && au && au.ctx === ctx;
    const pulsoLento = () => {
      if (Math.random() < au.tasaAves * 0.07) llamadaAve();
      if (Math.random() < au.tasaRanas * 0.12) rana();
      if (ctx.currentTime >= au.proxRafaga) programarRafaga();
      // si el cielo no está dibujando relámpagos (fondo apagado, movimiento reducido…), los truenos llegan solos de vez en cuando
      if (amb.tipo === 'tormenta' && performance.now() - au.ultTrueno > au.esperaTrueno) trueno();
    };
    const pulsoRapido = () => {
      if (au.tasaGotas > 0) { const n = Math.round(au.tasaGotas * (1 + Math.random() * 3)); for (let i = 0; i < n; i++) gota(Math.random() * 0.1); }
      if (au.hayPiedras) { const n = Math.round(azar(1, 4)); for (let i = 0; i < n; i++) piedra(Math.random() * 0.1); }
    };
    const intervaloAves = ctxDado ? 0 : setInterval(() => { if (listo()) pulsoLento(); }, 250);
    const intervaloGotas = ctxDado ? 0 : setInterval(() => { if (listo()) pulsoRapido(); }, 100);
    // Un poco de sala para la música (un eco corto propio: el de las aves pasa por el ambiente, que la música baja)
    const salaM = ctx.createConvolver(), irM = ctx.createBuffer(2, Math.round(ctx.sampleRate * 1.2), ctx.sampleRate), salaG = ctx.createGain();
    for (let c = 0; c < 2; c++) { const d = irM.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
    salaM.buffer = irM; salaG.gain.value = 0.18; musG.connect(salaM); salaM.connect(salaG); salaG.connect(master);
    return { ctx, offline: !!ctxDado, pulsoLento, pulsoRapido, master, suave, lim, ambG, musG, duckCama, duckAcentos, busTruenos, viento, rafaga, silbido, lluvia, lluviaBajo, cig, gri, aves, ranas, gotas, busGranizo, rev, buf,
      intervaloAves, intervaloGotas, tasaAves: 0, tasaRanas: 0, tasaGotas: 0, hayPiedras: false, proxRafaga: 0, ultTrueno: performance.now(), esperaTrueno: 15000,
      truenoLibre: 0, truenos: [], truenosTotal: 0, truenosDescartados: 0, fuentes: 0, objetivo: new WeakMap(), escena: null, niveles: {}, solo: null };
  }

  // Cuenta los sonidos sueltos vivos (para el tope) y los descuenta cuando terminan
  function vigilar(src) { au.fuentes++; const a = au; src.onended = () => { a.fuentes--; }; return src; }
  const hayLugar = (n) => au && au.fuentes + (n || 1) <= TOPE_FUENTES;
  function salida(destino) {                                       // un punto al azar del estéreo
    const { ctx } = au; if (!ctx.createStereoPanner) return destino;
    const p = ctx.createStereoPanner(); p.pan.value = azar(-0.9, 0.9); p.connect(destino); return p;
  }
  // Una nota de ave: un tono que se desliza de f0 a f1 (opcionalmente con vibrato)
  function tono(dest, f0, f1, t0, dur, vol, vib) {
    const { ctx } = au, T = ctx.currentTime + t0, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, T); o.frequency.exponentialRampToValueAtTime(f1, T + dur);
    if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vib.hz; lg.gain.value = vib.prof; l.connect(lg); lg.connect(o.frequency); l.start(T); l.stop(T + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(vol, T + Math.min(0.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, T + dur);
    o.connect(g); g.connect(dest); vigilar(o).start(T); o.stop(T + dur + 0.05);
  }
  function llamadaAve() {
    if (!hayLugar(16)) return;
    const sal = salida(au.aves), v = azar(0.4, 1), r = Math.random();
    if (r < 0.38) {                                                // silbido de 2 a 5 notas
      const n = Math.round(azar(2, 5)), base = azar(2200, 3800), dir = Math.random() < 0.5 ? 1 : -1; let t = 0;
      for (let i = 0; i < n; i++) { const f0 = base * (1 + dir * i * 0.06), d = azar(0.07, 0.16); tono(sal, f0, f0 * azar(1.15, 1.5), t, d, 0.075 * v); t += d + azar(0.05, 0.11); }
    } else if (r < 0.58) {                                         // trino rápido
      const n = Math.round(azar(8, 16)), f = azar(3000, 5200);
      for (let i = 0; i < n; i++) tono(sal, i % 2 ? f * 1.1 : f, i % 2 ? f : f * 1.1, i * 0.05, 0.04, 0.045 * v);
    } else if (r < 0.82) {                                         // arrullo de paloma: cu-CU-cu-cuuu
      const f = azar(380, 470); let t = 0;
      [[0.35, 1], [0.16, 1.08], [0.16, 1.08], [0.42, 0.98]].forEach(([d, k]) => { tono(sal, f * k, f * k * 0.93, t, d, 0.15 * v, { hz: 5.5, prof: 6 }); t += d + 0.07; });
    } else {                                                       // dos "píos" que suben
      tono(sal, azar(1600, 2400), azar(3800, 5200), 0, azar(0.1, 0.17), 0.075 * v);
      tono(sal, azar(1700, 2500), azar(4000, 5400), 0.22, azar(0.1, 0.17), 0.068 * v);
    }
  }
  function rana() {                                                // 2 a 5 croares graves, "pulsados" como una rana de verdad
    if (!hayLugar(10)) return;
    const { ctx } = au, sal = salida(au.ranas), n = Math.round(azar(2, 5)), f = azar(150, 240); let t = 0;
    for (let i = 0; i < n; i++) {
      const T = ctx.currentTime + t, d = azar(0.1, 0.2), o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), mod = ctx.createGain(), am = ctx.createOscillator(), ag = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.1, T); o.frequency.exponentialRampToValueAtTime(f * 0.8, T + d);
      bp.type = 'bandpass'; bp.frequency.value = f * 3.2; bp.Q.value = 2.5;
      mod.gain.value = 0.5; am.frequency.value = azar(28, 40); ag.gain.value = 0.5; am.connect(ag); ag.connect(mod.gain);
      g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(0.1, T + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, T + d);
      o.connect(bp); bp.connect(mod); mod.connect(g); g.connect(sal);
      vigilar(o).start(T); am.start(T); o.stop(T + d + 0.05); am.stop(T + d + 0.05);
      t += azar(0.17, 0.25);
    }
  }
  function gota(retraso) {                                         // una gota: un toque corto y apagado
    if (!au || !hayLugar()) return;
    const { ctx, buf } = au, T = ctx.currentTime + (retraso || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 3200; f.Q.value = 6;
    g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(0.15 + Math.random() * 0.25, T + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, T + 0.05 + Math.random() * 0.05);
    s.connect(f); f.connect(g); g.connect(salida(au.gotas)); vigilar(s).start(T, Math.random() * 4, 0.12);
  }
  // Granizo: un golpe seco y agudo (piedra sobre chapa o tejas), a veces con un "toc" más grave
  function piedra(retraso) {
    if (!au || !hayLugar()) return;
    const { ctx, buf } = au, T = ctx.currentTime + (retraso || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), d = azar(0.012, 0.03);
    s.buffer = buf; f.type = Math.random() < 0.25 ? 'bandpass' : 'highpass'; f.frequency.value = f.type === 'bandpass' ? azar(700, 1300) : azar(3200, 6500); f.Q.value = 3;
    g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(azar(0.18, 0.45), T + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, T + d);
    s.connect(f); f.connect(g); g.connect(salida(au.busGranizo)); vigilar(s).start(T, Math.random() * 4, d + 0.02);
  }
  // Ráfagas de viento: cada pocos segundos la envolvente y el tono de la capa de ráfagas suben y bajan; cuanto más viento, más seguidas
  // y marcadas. El nivel general de las ráfagas lo fija la escena (au.rafaga.g): si no hay ráfagas, la capa calla aunque la envolvente se mueva.
  function programarRafaga() {
    const { ctx, rafaga, silbido } = au, T = ctx.currentTime, v = amb.viento || 0, k = limitar((v - 15) / 35, 0, 1);
    au.proxRafaga = T + azar(2.5, 7) / (0.6 + k * 1.4);
    if (!((au.niveles.rafagas || 0) > 0)) return;                 // sin ráfagas en la escena no se programa nada
    const sube = azar(0.5, 1.4), dura = azar(1.2, 3.5) * (1.2 - k * 0.4), pico = azar(0.6, 1);
    const sostener = p => { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(T); else { p.cancelScheduledValues(T); p.setValueAtTime(p.value, T); } };
    sostener(rafaga.env.gain); rafaga.env.gain.setTargetAtTime(pico, T, sube / 3); rafaga.env.gain.setTargetAtTime(0.15, T + sube + dura * 0.4, dura / 3);
    sostener(rafaga.fl.frequency); rafaga.fl.frequency.setTargetAtTime(380 + 600 * Math.max(k, 0.3) * azar(0.7, 1.2), T, sube / 2); rafaga.fl.frequency.setTargetAtTime(380, T + sube + dura * 0.4, dura / 2);
    if (v >= 35) {                                                 // viento fuerte: un silbido que sube y baja con la ráfaga
      sostener(silbido.env.gain); silbido.env.gain.setTargetAtTime(azar(0.5, 1), T, sube / 2); silbido.env.gain.setTargetAtTime(0, T + sube + dura * 0.3, dura / 3);
      sostener(silbido.fl.frequency); silbido.fl.frequency.setTargetAtTime(azar(900, 1500), T, sube);
    }
  }
  // Agacha la cama y los acentos mientras retumba un trueno (ducking) y los devuelve despacio
  function agachar(T, largo) {
    for (const [g, hondo] of [[au.duckCama, 0.5], [au.duckAcentos, 0.25]]) {
      const p = g.gain, ahora = au.ctx.currentTime;
      if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(ahora); else { p.cancelScheduledValues(ahora); p.setValueAtTime(p.value, ahora); }
      p.linearRampToValueAtTime(1, Math.max(ahora + 0.02, T - 0.05));
      p.linearRampToValueAtTime(hondo, T + 0.15);
      p.setValueAtTime(hondo, T + 0.15 + largo);
      p.linearRampToValueAtTime(1, T + 0.15 + largo + 2.5);
    }
  }
  function soltarAgachado() {                                      // al salir de la tormenta, la cama y los acentos vuelven a su nivel
    for (const g of [au.duckCama, au.duckAcentos]) { const p = g.gain, T = au.ctx.currentTime; if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(T); else { p.cancelScheduledValues(T); p.setValueAtTime(p.value, T); } p.linearRampToValueAtTime(1, T + 1); }
  }
  // Trueno: ÚNICO punto de entrada (lo llaman el relámpago del paisaje y la reserva de crearAudio). Anti-rebote: nunca dos encimados
  // y al menos TRUENO_SEPARACION s entre comienzos; si llega otro pedido antes, se descarta (un relámpago lejano sin trueno audible).
  // Llega después del relámpago con un retraso según la distancia (unos 0,3 s por km, comprimido: en la realidad son ~3 s por km).
  // Cerca: chasquido seco y retumbo fuerte; lejos: solo un rumor grave, más largo y más bajo.
  function trueno() {
    if (!au || !sonando || amb.tipo !== 'tormenta' || (au.ctx.state !== 'running' && !au.offline)) return false;
    const { ctx, buf } = au, ahora = ctx.currentTime;
    au.truenos = au.truenos.filter(f => f > ahora);
    if (ahora < au.truenoLibre || au.truenos.length || !hayLugar(4)) { au.truenosDescartados++; return false; }
    au.ultTrueno = performance.now(); au.esperaTrueno = azar(14000, 24000);
    const km = azar(0.6, 8), T = ahora + 0.2 + km * 0.3, cerca = limitar(1.15 - km / 10, 0.3, 1), sal = salida(au.busTruenos), R = REF.truenos;
    const ruido = (t, tipo, f0, f1, vol, dur, ataque) => {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = buf; s.loop = true; fl.type = tipo; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(sal); vigilar(s).start(t, Math.random() * 3); s.stop(t + dur + 0.1);
      return t + dur + 0.1;
    };
    let fin = T;
    if (km < 2.5) fin = Math.max(fin, ruido(T, 'highpass', 1800, 900, 0.35 * cerca * R, 0.3, 0.008));      // el chasquido, solo si cayó cerca
    const corte = 300 - km * 18, largo = azar(2.8, 4) + km * 0.12;                                          // cuanto más lejos, más grave
    fin = Math.max(fin, ruido(T, 'lowpass', corte, 50, cerca * R, largo, 0.12 + km * 0.05));               // el retumbo largo
    fin = Math.max(fin, ruido(T + azar(0.7, 1.4), 'lowpass', corte * 0.8, 45, 0.6 * cerca * R * azar(0.6, 1), azar(2, 2.8), 0.3));   // y su eco
    au.truenos.push(fin); au.truenosTotal++;
    au.truenoLibre = Math.max(fin, ahora + TRUENO_SEPARACION);
    agachar(T, Math.min(largo * 0.5, 2.5));
    return true;
  }

  // ---- La escena: qué suena en cada estado ----
  // Devuelve { cama, acentos, db } donde db = dB relativos a REF de cada capa que suena (las que no están, callan).
  // cama: 'lluvia' | 'grillos' | 'viento' | 'calma' (sin viento ni lluvia: no hay fondo). Acentos: los 2 de mayor prioridad.
  function escena() {
    const { tipo, fase, dia, dorado } = amb, ll = amb.lluvia || 0, v = amb.viento || 0, temp = amb.temp === undefined || amb.temp === null ? 25 : amb.temp;
    const abierto = tipo === 'despejado' || tipo === 'parcial', fuerte = ll >= 0.6, tormenta = tipo === 'tormenta';
    const kv = limitar((v - 2) / 28, 0, 1), kr = limitar((v - 15) / 35, 0, 1);
    const db = {}, cand = [];
    const tasaAves = { despejado: 1, parcial: 0.8, nublado: 0.45, niebla: 0.3, lluvia: 0.15 }[tipo] || 0;
    let cama = 'calma';
    if (ll > 0) { cama = 'lluvia'; db.lluvia = tormenta ? 0 : -1 + limitar((ll - 0.3) / 0.7, 0, 1); }
    else if (!dia && temp >= 12 && tipo !== 'niebla') { cama = 'grillos'; db.grillos = abierto ? 0 : -3; }
    else if (kv > 0) { cama = 'viento'; db.viento = -3 + 3 * Math.sqrt(kv) + (tipo === 'niebla' ? 2 : 0); }   // la brisa floja suena algo más baja; en la niebla se compensa el filtro
    // Acentos posibles: [capa, prioridad, dB]
    if (tormenta) cand.push(['truenos', 100, 0]);
    if (hayGranizo()) cand.push(['granizo', 90, -5]);
    if (kr > 0) cand.push(['rafagas', 50 + 40 * kr, -8 + 6 * kr]);
    if (dia && !fuerte && !tormenta && tasaAves) cand.push(['aves', dorado ? 80 : 40 + 25 * tasaAves, dorado ? -5 : { despejado: -2, parcial: -3, nublado: -4, niebla: -6, lluvia: -4 }[tipo]]);
    if (fase === 'dia' && !ll && temp >= 28 && mesVerano() && (abierto || tipo === 'nublado'))
      cand.push(['chicharras', 70, (tipo === 'despejado' ? -3 : tipo === 'parcial' ? -5 : -9) + 4 * (limitar((temp - 27) / 7, 0.3, 1) - 1)]);
    if (fase === 'atardecer' && abierto && temp >= 12) cand.push(['grillos', 35, -9]);
    if (!dia && !fuerte) cand.push(['ranas', ll > 0 ? 65 : 55, ll > 0 ? -4 : abierto && temp >= 12 ? -6 : -10]);
    if (cama !== 'viento' && kv > 0 && v >= 18) cand.push(['viento', 30, -10 + 6 * kv]);
    cand.sort((a, b) => b[1] - a[1]);
    const acentos = [];
    for (const [c, , d] of cand) { if (acentos.length >= 2 || acentos.includes(c) || c === cama) continue; acentos.push(c); db[c] = d + (cama === 'calma' ? 3 : 0); }
    return { cama, acentos, db, tasaAves: db.aves !== undefined ? tasaAves * (dorado ? 2.2 : 1) : 0, tasaRanas: db.ranas !== undefined ? (ll > 0 ? 0.9 : abierto ? 0.4 : 0.2) : 0 };
  }
  // Une palabras a la española: «a», «a y b», «a, b y c»
  const unirY = l => l.length < 2 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1];
  // Texto de lo que suena: se arma con la MISMA escena que manda el sonido, así nunca promete algo que no suena
  function describirSonido() {
    const e = escena(), { tipo, dia, dorado } = amb, v = amb.viento || 0, ll = amb.lluvia || 0, temp = amb.temp == null ? 25 : amb.temp;
    const abierto = tipo === 'despejado' || tipo === 'parcial', ventoso = v >= 32;
    const titulo = tipo === 'tormenta' ? (hayGranizo() ? 'Tormenta con granizo' : 'Tormenta')
      : tipo === 'lluvia' ? (dia ? (ll >= 0.7 ? 'Lluvia fuerte' : 'Lluvia') : (ll >= 0.7 ? 'Noche de lluvia fuerte' : 'Noche de lluvia'))
      : tipo === 'niebla' ? 'Niebla'
      : !dia ? (ventoso ? 'Noche ventosa' : abierto ? (temp >= 12 ? 'Noche tranquila' : 'Noche fresca') : 'Noche nublada')
      : dorado ? 'Hora dorada' : tipo === 'nublado' ? 'Cielo nublado' : ventoso ? 'Día ventoso' : e.acentos.includes('chicharras') ? 'Día caluroso de verano' : 'Día tranquilo';
    const nombre = c => ({
      viento: v >= 35 ? 'viento fuerte' : v >= 18 ? 'viento' : 'brisa suave',
      lluvia: tipo === 'tormenta' ? 'lluvia fuerte' : ll >= 0.7 ? 'aguacero' : 'gotas sobre las hojas',
      grillos: e.db.grillos !== undefined && e.db.grillos < -2 ? 'grillos lejanos' : 'grillos',
      aves: dorado ? 'coro de aves' : e.tasaAves < 0.5 ? 'aves lejanas' : 'aves',
      ranas: e.db.ranas !== undefined && e.db.ranas <= -9 ? 'ranas lejanas' : 'ranas',
      rafagas: v >= 35 ? 'ráfagas fuertes de viento' : 'ráfagas de viento',
      chicharras: 'chicharras', granizo: 'golpeteo de granizo', truenos: 'truenos'
    })[c];
    const partes = (e.cama === 'calma' ? [] : [nombre(e.cama)]).concat(e.acentos.map(nombre));
    if (tipo === 'niebla') partes.unshift('sonido amortiguado');
    return titulo + ': ' + (partes.length ? unirY(partes) : 'calma');
  }
  // Lleva un parámetro a un valor con un fundido lineal de `dur` s, sin acumular eventos (sostiene el valor actual y borra lo que había
  // por delante). Si el objetivo no cambió, no toca nada: mezclar() puede llamarse a menudo sin reiniciar los fundidos.
  function fundir(p, val, dur) {
    const ant = au.objetivo.get(p);
    if (ant !== undefined && Math.abs(ant - val) < 1e-5) return;
    au.objetivo.set(p, val);
    const T = au.ctx.currentTime;
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(T); else { p.cancelScheduledValues(T); p.setValueAtTime(p.value, T); }
    p.linearRampToValueAtTime(val, T + Math.max(0.02, dur));
  }
  function mezclar() {                                             // ajusta cada capa a la escena actual con fundidos cruzados
    if (!au) return;
    $('btnSonido').title = describirSonido();
    const musica = mus.activa && !au.offline, algo = sonando || musica;
    fundir(au.master.gain, algo ? gananciaVolumen() : 0, algo ? 0.25 : 0.8);   // volumen general: barato (un solo nodo)
    fundir(au.ambG.gain, sonando ? (musica ? AMBIENTE_CON_MUSICA : 1) : 0, 1.5);   // con música, el ambiente queda detrás (~−10 dB)
    fundir(au.musG.gain, musica ? MUSICA_NIVEL : 0, 1.5);                           // entrada y salida de la música: 1,5 s
    const e = au.solo ? { cama: au.solo, acentos: [], db: { [au.solo]: 0 }, tasaAves: au.solo === 'aves' ? 1 : 0, tasaRanas: au.solo === 'ranas' ? 0.5 : 0 } : escena();
    const { tipo, lluvia: ll } = amb, v = amb.viento || 0, temp = amb.temp === undefined || amb.temp === null ? 25 : amb.temp;
    const lin = c => e.db[c] === undefined ? 0 : Math.pow(10, e.db[c] / 20);   // nivel relativo (1 = referencia, 0 = calla)
    const nv = {};
    // Fundido cruzado: lo que entra sube en 3,5 s y lo que sale baja en 2,5 s (así la escena nueva no se suma de golpe a la vieja)
    const ir = (p, val) => fundir(p, val, val > (au.objetivo.get(p) || 0) ? 3.5 : 2.5);
    nv.viento = lin('viento'); ir(au.viento.g.gain, nv.viento * REF.viento); fundir(au.viento.fl.frequency, 260 + v * 12, 3);
    nv.rafagas = lin('rafagas'); ir(au.rafaga.g.gain, nv.rafagas * REF.rafagas); ir(au.silbido.g.gain, v >= 35 ? nv.rafagas * REF.silbido : 0);
    const lluviaPlena = au.solo === 'lluvia' ? 1 : ll;
    nv.lluvia = lin('lluvia'); nv.lluviaBajo = nv.lluvia * lluviaPlena * lluviaPlena;
    ir(au.lluvia.g.gain, nv.lluvia * REF.lluvia); ir(au.lluviaBajo.g.gain, nv.lluviaBajo * REF.lluviaBajo); fundir(au.lluvia.fl.frequency, 4500 + lluviaPlena * 4000, 3);
    ir(au.gotas.gain, nv.lluvia * REF.gotas); au.tasaGotas = nv.lluvia > 0 ? Math.max(lluviaPlena, 0.3) : 0;
    nv.chicharras = lin('chicharras'); au.cig.forEach(n => ir(n.gain, nv.chicharras * REF.chicharras));
    nv.grillos = lin('grillos');
    // ritmo de los cantos según la temperatura (ley de Dolbear: con calor cantan más rápido); 1 = el ritmo de base a ~24 °C
    const ritmo = limitar((4 * ((temp * 9 / 5 + 32) - 50) + 40) / 147, 0.5, 1.35);
    au.gri.forEach(g => { ir(g.nivel.gain, nv.grillos * REF.grillos); fundir(g.ritmo, g.grupo * ritmo, 1); });
    nv.granizo = e.db.granizo !== undefined; au.hayPiedras = nv.granizo; ir(au.busGranizo.gain, lin('granizo') * REF.granizo);
    nv.aves = e.tasaAves; au.tasaAves = e.tasaAves; ir(au.aves.gain, lin('aves') * REF.aves);
    nv.ranas = e.tasaRanas; au.tasaRanas = e.tasaRanas; ir(au.ranas.gain, lin('ranas') * REF.ranas);
    nv.truenos = e.db.truenos !== undefined ? 1 : 0;
    fundir(au.busTruenos.gain, nv.truenos, nv.truenos ? 0.3 : 2.5);   // al salir de la tormenta, el trueno que quedaba rodando se apaga
    if (!nv.truenos && au.escena && au.escena.db.truenos !== undefined) soltarAgachado();
    fundir(au.suave.frequency, tipo === 'niebla' ? 2600 : tipo === 'lluvia' || tipo === 'tormenta' ? 9000 : 16000, 2);
    au.escena = e; au.niveles = nv;
  }
  // Para pruebas automáticas y la consola: lo que el sonido está haciendo ahora (null si nunca se activó)
  window.climaSonido = Object.freeze({
    estado: () => {
      if (!au) return null;
      const ahora = au.ctx.currentTime, e = au.escena || { cama: 'calma', acentos: [] };
      return { sonando, volumen: sonando ? gananciaVolumen() : 0, cama: e.cama, acentos: e.acentos.slice(), audibles: (e.cama === 'calma' ? [] : [e.cama]).concat(e.acentos),
        capas: { ...au.niveles }, ganancias: ganancias(au), ducking: { cama: +au.duckCama.gain.value.toFixed(3), acentos: +au.duckAcentos.gain.value.toFixed(3) },
        truenos: au.truenos.filter(f => f > ahora).length, truenosTotal: au.truenosTotal, truenosDescartados: au.truenosDescartados, fuentesSueltas: au.fuentes,
        limitador: { umbral: au.lim.threshold.value, ratio: au.lim.ratio.value, reduccion: au.lim.reduction }, contexto: au.ctx.state, descripcion: describirSonido(),
        musica: { pedida: musicaPedida, suena: mus.activa, cancion: CANCIONES[mus.cancion].nombre, notasVivas: mus.notasVivas, canciones: mus.canciones,
          ambiente: +au.ambG.gain.value.toFixed(3), nivel: +au.musG.gain.value.toFixed(3) } };
    },
    // Solo para medir: deja sonar UNA capa a su nivel de referencia (null vuelve a la escena del clima)
    solo: nombre => { if (au) { au.solo = nombre || null; mezclar(); } },
    // Solo para medir: fabrica el paisaje sonoro del estado actual en un OfflineAudioContext (48 kHz, estéreo) y devuelve el AudioBuffer
    // de `seg` segundos (los primeros ~3,5 s son el fundido de entrada). No toca el sonido real.
    renderizar: seg => renderizarAmbiente(seg),
    // Música navideña: encender/apagar (lo mismo que hará el interruptor del panel) y, para medir, su render sin conexión
    musicaNavidad: encendida => fijarMusicaNavidad(encendida),
    renderizarMusica: seg => renderizarMusica(seg),
    canciones: () => CANCIONES.map(c => c.nombre),
    // Para el paisaje: un estallido suave por cada fuego artificial (fuerza 0 a 1)
    estallido: fuerza => estallido(fuerza)
  });
  // Ganancias REALES de cada capa en este instante (con fundidos y ducking incluidos), para las pruebas
  function ganancias(A) {
    const r = x => +x.toFixed(4);
    return { master: r(A.master.gain.value), viento: r(A.viento.g.gain.value), rafagas: r(A.rafaga.g.gain.value), lluvia: r(A.lluvia.g.gain.value), lluviaBajo: r(A.lluviaBajo.g.gain.value),
      gotas: r(A.gotas.gain.value), granizo: r(A.busGranizo.gain.value), chicharras: r(A.cig[0].gain.value), grillos: r(A.gri[0].nivel.gain.value), aves: r(A.aves.gain.value),
      ranas: r(A.ranas.gain.value), truenos: r(A.busTruenos.gain.value), ambiente: r(A.ambG.gain.value), musica: r(A.musG.gain.value), duckCama: r(A.duckCama.gain.value), duckAcentos: r(A.duckAcentos.gain.value) };
  }
  // Mientras se arma o avanza la versión de prueba, `au` apunta a ella solo durante ese bloque sincrónico (el sonido real no lo ve)
  async function renderizarAmbiente(seg) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, sr = 48000;
    seg = limitar(Number(seg) || 8, 1, 30);
    const off = new OAC(2, Math.round(sr * seg), sr), A = crearAudio(off);
    const conA = f => { const r = au, s = sonando; au = A; sonando = true; try { f(); } finally { au = r; sonando = s; } };
    conA(mezclar);
    // cada 0,1 s del reloj del audio avanzan los sonidos sueltos; en tormenta se pide un trueno a los 4 s (y otro a los 4,5 s, que el
    // anti-rebote debe descartar)
    for (let k = 1; k * 0.1 < seg; k++) off.suspend(+(k * 0.1).toFixed(3)).then(() => {
      conA(() => { A.pulsoRapido(); if (k % 2 === 0) A.pulsoLento(); if (k === 40 || k === 45) trueno(); });
      off.resume();
    });
    const buf = await off.startRendering();
    buf.info = { truenos: A.truenosTotal, descartados: A.truenosDescartados };
    return buf;
  }
  function visibilidadSonido() { if (au && (sonando || mus.activa)) { if (document.hidden) au.ctx.suspend(); else au.ctx.resume().catch(() => {}); } }
  function pintarBotonSonido() {
    const b = $('btnSonido');
    b.textContent = sonando ? '🔊' : '🔈'; b.classList.toggle('on', sonando); b.setAttribute('aria-pressed', sonando);
    b.setAttribute('aria-label', sonando ? 'Silenciar el sonido del clima' : 'Activar el sonido del clima');
  }
  // Al salir de la página se libera el audio. Si la página vuelve desde la caché del navegador (atrás/adelante), el botón
  // queda apagado y coherente (antes seguía en 🔊 sin sonar, y una segunda salida ya no liberaba nada).
  window.addEventListener('pagehide', () => {
    sonando = false; mus.activa = false; clearInterval(mus.temporizador); mus.temporizador = 0;
    if (au) { clearInterval(au.intervaloAves); clearInterval(au.intervaloGotas); try { au.ctx.close(); } catch (_) {} au = null; }
    pintarBotonSonido();
  });
  $('btnSonido').addEventListener('click', async () => {
    if (!au) { au = crearAudio(); if (!au) { aviso('Tu navegador no permite reproducir sonido.'); return; } }
    sonando = !sonando;
    pintarBotonSonido();
    if (sonando) { try { await au.ctx.resume(); } catch (_) {} }
    if (!sonando) setTimeout(() => { if (!sonando && !mus.activa && au) au.ctx.suspend(); }, 3500);
    mezclar();
    if (sonando) aviso('🔊 ' + describirSonido());
  });
  $('btnFx').addEventListener('click', () => {
    fx = !fx; guardar('clima-py-fx', fx ? '1' : '0');
    $('btnFx').classList.toggle('on', fx); $('btnFx').setAttribute('aria-pressed', fx);
    reanudarCielo();
  });
  $('btnFx').classList.toggle('on', fx); $('btnFx').setAttribute('aria-pressed', fx);


  document.addEventListener('visibilitychange', () => {
    reanudarCielo();
    visibilidadSonido();
  });
  let tAjuste;
  window.addEventListener('resize', () => {                        // el cielo solo se rehace si cambió de verdad el tamaño (no con la barra del navegador)
    clearTimeout(tAjuste);
    tAjuste = setTimeout(() => { if (Math.abs(innerWidth - cvW) > 1 || Math.abs(innerHeight - cvH) > 150) { ajustarCielo(); reanudarCielo(); } }, 200);
  });
  ajustarCielo();

  // ============ 6f) AJUSTES DE ANIMACIÓN ============
  // Panel (botón ⚙️) para que cada persona elija cómo se anima el clima. Solo LEE prefsAnim y la CAMBIA con fijarPrefAnim({...}).
  // El interruptor «Animación» es el mismo que el botón ✨ (`fx`): se mantienen sincronizados.
  const dlgAnim = $('dlgAnim'), $$a = sel => dlgAnim.querySelectorAll(sel);
  const NOMBRE_TIPO = { despejado: 'Despejado', parcial: 'Parcialmente nublado', nublado: 'Nublado', lluvia: 'Lluvia', tormenta: 'Tormenta', niebla: 'Niebla' };
  const NOMBRE_FASE = { amanecer: 'Amanecer', dia: 'Día', atardecer: 'Atardecer', noche: 'Noche' };
  const AYUDA_CALIDAD = {
    auto: 'Usa todo el detalle y lo baja sola si tu equipo va lento.',
    alta: 'Siempre con todo el detalle, aunque gaste más batería.',
    ahorro: 'Menos partículas y movimiento más pausado para cuidar la batería.'
  };
  function marcarRadio(nombre, valor) { $$a(`input[name="${nombre}"]`).forEach(r => { r.checked = valor != null && r.value === String(valor); }); }
  function sincronizarPrevia() {                                   // aviso sobre el paisaje y estado de la vista previa en el panel
    const vp = prefsAnim.vistaPrevia, caja = $('escenaPrevia');
    if (vp) {
      const t = TIPOS_CIELO.includes(vp.tipo) ? vp.tipo : amb.tipo, f = FASES_DIA.includes(vp.fase) ? vp.fase : amb.fase;
      $('epTipo').textContent = NOMBRE_TIPO[t] || ''; $('epFase').textContent = NOMBRE_FASE[f] || '';
      $('daPreviaEstado').textContent = `Vista previa activa: ${NOMBRE_TIPO[t] || ''} · ${NOMBRE_FASE[f] || ''}.`;
      marcarRadio('daTipo', t); marcarRadio('daFase', f);
    } else {
      $('daPreviaEstado').textContent = 'Mostrando el clima real.';
      marcarRadio('daTipo', null); marcarRadio('daFase', null);
    }
    caja.hidden = !vp; $('escena').classList.toggle('en-previa', !!vp);
    $('daPreviaVolver').disabled = !vp;
  }
  function sincronizarPanel() {                                    // los controles muestran siempre lo guardado
    const p = prefsAnim;
    $('daFx').checked = fx; $('daFondo').checked = p.fondo; $('daPaisaje').checked = p.paisaje;
    marcarRadio('daIntensidad', p.intensidad); marcarRadio('daCalidad', p.calidad);
    $('daCalidadAyuda').textContent = AYUDA_CALIDAD[p.calidad] || '';
    $$a('[data-efecto]').forEach(c => { c.checked = p.efectos[c.dataset.efecto] !== false; });
    const v = Math.round(p.volumen * 100);
    $('daVolumen').value = v; $('daVolumenVal').textContent = v + '%'; $('daVolumen').setAttribute('aria-valuetext', v + '%');
    dlgAnim.classList.toggle('apagada', !fx);
    sincronizarPrevia();
  }
  function cambiarAnim(cambios) { fijarPrefAnim(cambios); sincronizarPanel(); }
  function salirPrevia() { if (prefsAnim.vistaPrevia) { cambiarAnim({ vistaPrevia: null }); anunciar('Volviste al clima real.'); } }

  $('daReducido').hidden = !REDUCIDO;
  $('btnAjustesAnim').addEventListener('click', () => {
    sincronizarPanel();
    if (typeof dlgAnim.showModal === 'function') dlgAnim.showModal(); else dlgAnim.setAttribute('open', '');
  });
  dlgAnim.addEventListener('close', () => { $('btnAjustesAnim').focus(); });
  dlgAnim.addEventListener('click', e => { if (e.target === dlgAnim) dlgAnim.close(); });   // tocar fuera de la hoja la cierra
  $('daFx').addEventListener('change', e => { if (e.target.checked !== fx) $('btnFx').click(); });
  $('btnFx').addEventListener('click', sincronizarPanel);          // corre después del manejador de ✨, que ya cambió `fx`
  $('daFondo').addEventListener('change', e => cambiarAnim({ fondo: e.target.checked }));
  $('daPaisaje').addEventListener('change', e => cambiarAnim({ paisaje: e.target.checked }));
  $$a('input[name="daIntensidad"]').forEach(r => r.addEventListener('change', () => { if (r.checked) cambiarAnim({ intensidad: Number(r.value) }); }));
  $$a('input[name="daCalidad"]').forEach(r => r.addEventListener('change', () => { if (r.checked) cambiarAnim({ calidad: r.value }); }));
  $$a('[data-efecto]').forEach(c => c.addEventListener('change', () => cambiarAnim({ efectos: { [c.dataset.efecto]: c.checked } })));
  $('daVolumen').addEventListener('input', e => {
    const v = Math.round(Number(e.target.value)) || 0;
    $('daVolumenVal').textContent = v + '%'; e.target.setAttribute('aria-valuetext', v + '%');
    fijarPrefAnim({ volumen: limitar(v / 100, 0, 1) });
  });
  function elegirPrevia() {
    const t = dlgAnim.querySelector('input[name="daTipo"]:checked'), f = dlgAnim.querySelector('input[name="daFase"]:checked');
    cambiarAnim({ vistaPrevia: { tipo: t ? t.value : amb.tipo, fase: f ? f.value : amb.fase } });
  }
  $$a('input[name="daTipo"], input[name="daFase"]').forEach(r => r.addEventListener('change', () => { if (r.checked) elegirPrevia(); }));
  $('daPreviaVolver').addEventListener('click', salirPrevia);
  $('epVolver').addEventListener('click', salirPrevia);
  $('daRestablecer').addEventListener('click', () => {
    const base = JSON.parse(JSON.stringify(PREFS_ANIM_BASE));
    cambiarAnim({ ...base, vistaPrevia: null });
    if (!fx) $('btnFx').click();                                   // los valores predeterminados incluyen la animación encendida
    aviso('Ajustes de animación restablecidos');
  });
  // El paisaje reescribe sus etiquetas cada vez que se aplica el clima: sirve de aviso para refrescar la vista previa
  // también si se cambió desde otro lado (p. ej. climaAnim.fijar en la consola).
  if ('MutationObserver' in window) new MutationObserver(sincronizarPrevia).observe($('escenaEtq'), { childList: true });
  sincronizarPanel();

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
  const LOGO_NORMAL = 'icono-192.png', LOGO_NAVIDAD = 'icono-navidad.svg';
  function aplicarNavidad() {
    const hoy = fechaPY(), activa = modoNavidad === 'si' || (modoNavidad === 'auto' && enNavidad(hoy));
    document.documentElement.classList.toggle('navidad', activa);
    const logo = document.querySelector('header .logo'), ico = document.querySelector('link[rel="icon"]');
    if (logo && !logo.getAttribute('src').endsWith(activa ? LOGO_NAVIDAD : LOGO_NORMAL)) logo.src = activa ? LOGO_NAVIDAD : LOGO_NORMAL;
    if (ico && !ico.getAttribute('href').endsWith(activa ? LOGO_NAVIDAD : LOGO_NORMAL)) { ico.type = activa ? 'image/svg+xml' : 'image/png'; ico.href = activa ? LOGO_NAVIDAD : LOGO_NORMAL; }
    const clave = `${hoy.a}-${hoy.m}-${hoy.d}`;
    $('saludoNavidad').hidden = !activa || leer('clima-py-navidad-saludo', '') === clave;
    marcarRadio('daNavidad', modoNavidad);
  }
  $('saludoCerrar').addEventListener('click', () => {
    const h = fechaPY(); guardar('clima-py-navidad-saludo', `${h.a}-${h.m}-${h.d}`);   // no vuelve a aparecer hasta mañana
    $('saludoNavidad').hidden = true;
  });
  $$a('input[name="daNavidad"]').forEach(r => r.addEventListener('change', () => {
    if (!r.checked || !MODOS_NAVIDAD.includes(r.value)) return;
    modoNavidad = r.value; guardar('clima-py-navidad', modoNavidad); aplicarNavidad();
  }));
  $('btnAjustesAnim').addEventListener('click', () => marcarRadio('daNavidad', modoNavidad));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) aplicarNavidad(); });   // por si la página quedó abierta de un día para otro
  setInterval(aplicarNavidad, 30 * 60e3);
  aplicarNavidad();

  // ============ 7) RESUMEN, LISTA Y DETALLE ============
  function dibujarStats() {
    const con = CIUDADES.filter(c => valor(c) !== null);
    if (!con.length) { $('stats').innerHTML = ''; return; }
    const c = capa();
    const alta = con.reduce((a, b) => valor(b) > valor(a) ? b : a);
    const baja = con.reduce((a, b) => valor(b) < valor(a) ? b : a);
    const prom = con.reduce((s, x) => s + valor(x), 0) / con.length;
    const conLluvia = CIUDADES.filter(x => datos[x.n] && datos[x.n].precipitation > 0);
    const secas = CIUDADES.filter(x => datos[x.n] && esNumero(datos[x.n].precipitation) && datos[x.n].precipitation === 0).length;
    const tarjeta = (titulo, v, sub, ir, color) =>
      `<${ir ? 'button' : 'div'} class="stat"${ir ? ` data-ir="${ir}"` : ''}><small>${titulo}</small><b${color ? ` style="color:${color}"` : ''}>${v}</b><span>${sub}</span></${ir ? 'button' : 'div'}>`;
    $('stats').innerHTML =
      tarjeta(`Promedio · ${c.nombre.toLowerCase()}`, c.dec ? prom.toFixed(c.dec) + c.largo : Math.round(prom * 10) / 10 + c.largo, `${con.length} ciudades`, '', paraTexto(colorValor(prom))) +
      tarjeta(c.alto, fmt(valor(alta), true), alta.n, alta.n, paraTexto(colorValor(valor(alta)))) +
      (capaId === 'lluvia'
        ? tarjeta('☀️ Sin lluvia ahora', secas, 'ciudades secas', '', '')
        : tarjeta(c.bajo, fmt(valor(baja), true), baja.n, baja.n, paraTexto(colorValor(valor(baja))))) +
      (conLluvia.length ? tarjeta('🌧️ Con lluvia ahora', conLluvia.length, 'ej.: ' + conLluvia[0].n, conLluvia[0].n, '')
                        : tarjeta('🌧️ Con lluvia ahora', 0, 'ninguna ciudad', '', ''));
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
        <button class="item-main" data-ciudad="${c.n}">
          <span class="nom"><span class="e">${d ? clima(d.weather_code, d.is_day).emoji : '⏳'}</span> ${c.n}<small>${nombreDep(c.dep)}</small></span>
          <span class="t" style="color:${x === null ? 'var(--suave)' : paraTexto(colorValor(x))}">${fmt(x)}</span>
        </button>
        <button class="estrella${fav ? ' on' : ''}" data-fav="${c.n}" aria-label="${fav ? 'Quitar ' + c.n + ' de favoritas' : 'Marcar ' + c.n + ' como favorita'}">${fav ? '★' : '☆'}</button>
      </div>`;
    };
    const cont = $('lista'), scroll = cont.scrollTop;
    $('contador').textContent = `(${lista.length})`;
    cont.innerHTML = lista.length
      ? (favs.length ? '<div class="sep">★ Favoritas</div>' + favs.map(fila).join('') : '') +
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
    if (b && b.dataset.fav === n) { b.classList.toggle('on', favoritas.has(n)); b.textContent = favoritas.has(n) ? '★' : '☆'; }
  }

  // --- Detalle de la ciudad elegida ---
  // La cabecera (nombre, temperatura, datos) se arma igual con datos parciales o completos
  function luna() {
    const P = 29.530588853, e = (((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % P + P) % P, i = Math.round(e / P * 8) % 8;
    return { e: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'][i], ilum: Math.round((1 - Math.cos(2 * Math.PI * e / P)) / 2 * 100),
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
    const a = v.aqi, [t, e] = a <= 50 ? ['Buena', '🟢'] : a <= 100 ? ['Moderada', '🟡'] : a <= 150 ? ['Dañina para sensibles', '🟠'] : a <= 200 ? ['Dañina', '🔴'] : a <= 300 ? ['Muy dañina', '🟣'] : ['Peligrosa', '🟤'];
    return `${e} ${Math.round(a)} · ${t}`;
  }
  function llenarAire(c) {
    const poner = t => { const el = document.querySelector('#aireDato b'); if (el && seleccionada === c.n) el.textContent = t; };
    const g = cacheAire.get(c.n);
    if (g) poner(textoAire(g.v));
    cargarAire(c).then(v => poner(textoAire(v))).catch(() => poner('--'));
  }
  function htmlCabecera(c, a, d, error) {
    const L = luna();
    const w = a ? clima(a.weather_code, a.is_day) : (error ? { emoji: '⚠️', texto: 'Sin datos por ahora' } : { emoji: '⏳', texto: 'Cargando…' });
    const t = a ? a.temperature_2m : null;
    const fav = favoritas.has(c.n);
    const esq = x => d ? x : '<span class="esq">0000</span>';
    const dato = (titulo, v) => `<div class="dato"><small>${titulo}</small><b>${d ? v : '<span class="esq">0000000</span>'}</b></div>`;
    const alertasHtml = d ? alertas(a, d).map(t2 => `<span class="alerta">${t2}</span>`).join('') : '';
    return `
      <div class="actual">
        <div class="icono-grande" aria-hidden="true">${w.emoji}</div>
        <div>
          <div class="ciudad-fila">
            <span class="ciudad-nombre">${c.n}</span>
            <button class="estrella${fav ? ' on' : ''}" data-fav="${c.n}" aria-label="Favorita">${fav ? '★' : '☆'}</button>
            ${d ? `<button class="btn" data-compartir="1" aria-label="Compartir el clima de esta ciudad">📤 Compartir</button>` : ''}
            ${d && !navigator.share ? `<button class="btn" data-compartir="wa" aria-label="Enviar el clima por WhatsApp">WhatsApp</button>` : ''}
          </div>
          <div class="dep-nombre">${c.dep === 'Asunción' ? 'Capital del país' : 'Departamento ' + c.dep}</div>
          <div class="temp-fila">
            <span class="temp-grande" style="color:${esNumero(t) ? paraTexto(capaTemp(t)) : 'inherit'}">${esNumero(t) ? Math.round(aU(t)) + '°' + UT() : '--'}</span>
            <span class="minmax">${d ? `↑ ${grados(d.daily.temperature_2m_max[0])} ↓ ${grados(d.daily.temperature_2m_min[0])}` : ''}</span>
          </div>
          <div class="estado">${w.texto}</div>
          ${d && d.rangoDia && d.rangoDia.max[0] ? `<div class="rango-prob" title="Rango del 10 % al 90 % de las simulaciones de 4 modelos">Máx. probable ${Math.round(aU(d.rangoDia.max[0][0])) === Math.round(aU(d.rangoDia.max[0][1])) ? grados(d.rangoDia.max[0][0]) + ' (muy segura)' : grados(d.rangoDia.max[0][0]) + '–' + grados(d.rangoDia.max[0][1])}</div>` : ''}
        </div>
        <div class="datos">
          ${dato('Sensación térmica', d ? grados(a.apparent_temperature) + UT() : '')}
          ${dato('Humedad', d && esNumero(a.relative_humidity_2m) ? a.relative_humidity_2m + '%' : '--')}
          ${dato('Viento', d && esNumero(a.wind_speed_10m) ? Math.round(a.wind_speed_10m) + ' km/h ' + dirViento(a.wind_direction_10m) : '--')}
          ${dato('Presión', d && esNumero(a.pressure_msl) ? Math.round(a.pressure_msl) + ' hPa' : '--')}
          ${dato('Lluvia ahora', d && esNumero(a.precipitation) ? a.precipitation + ' mm' : '--')}
          ${dato('Índice UV (máx. hoy)', d && esNumero(d.daily.uv_index_max[0]) ? Math.round(d.daily.uv_index_max[0]) : '--')}
          ${dato('Amanecer', d ? '🌅 ' + String(d.daily.sunrise[0]).slice(11) : '')}
          ${dato('Atardecer', d ? '🌇 ' + String(d.daily.sunset[0]).slice(11) : '')}
          ${dato('Luna', d ? `${L.e} ${L.t} · ${L.ilum}%` : '')}
          ${d ? `<div class="dato" id="aireDato"><small>Calidad del aire</small><b>…</b></div>` : ''}
        </div>
      </div>
      ${alertasHtml ? `<div class="alertas">${alertasHtml}</div>` : ''}
      ${d ? htmlObs(c, a) : ''}`;
  }
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
    if (calorExtremo) r.push('🔥 Calor extremo: hidrátate y evita el sol en las horas centrales del día');
    else if (esNumero(a.apparent_temperature) && a.apparent_temperature >= 35) r.push('🥵 Sensación térmica muy alta: hidrátate y evita el sol del mediodía');
    if (frioIntenso) r.push('🥶 Frío intenso: abrígate bien');
    else if (esNumero(a.apparent_temperature) && a.apparent_temperature <= 5) r.push('🥶 Sensación de frío intenso: abrígate bien');
    const px = d.proxh;
    if (px && Date.now() - px.t < 20 * 60000) {                    // solo si el dato es reciente (20 min)
      if (px.k === 0) r.push(`🌧️ Está lloviendo ahora (unos ${px.mm} mm en la próxima hora)`);
      else if (px.k > 0) r.push(`🌦️ Lluvia en unos ${px.k * 15} min (unos ${px.mm} mm en la próxima hora)`);
    }
    const uvMax = d.daily.uv_index_max[0];
    if (esNumero(uvMax) && uvMax >= 3) {
      let tramo = '';
      if (Array.isArray(d.hourly.uv_index)) {
        const hoy = String(d.daily.time[0]), hs = [];
        d.hourly.time.forEach((h, k) => { if (String(h).startsWith(hoy) && d.hourly.uv_index[k] >= 3) hs.push(+String(h).slice(11, 13)); });
        if (hs.length) tramo = ` entre las ${String(Math.min(...hs)).padStart(2, '0')}:00 y las ${String(Math.max(...hs) + 1).padStart(2, '0')}:00`;
      }
      r.push(`☀️ UV ${NIVEL_UV(uvMax)} hoy (${Math.round(uvMax)}): usa protector solar${tramo}${uvMax >= 8 ? ', gorra y busca sombra' : ''}`);
    }
    if ([95, 96, 99].includes(a.weather_code)) r.push('⛈️ Tormenta eléctrica en la zona ahora');
    if (esNumero(a.wind_speed_10m) && a.wind_speed_10m >= UMBRAL_VIENTO_FUERTE) r.push(`💨 Viento fuerte: ${Math.round(a.wind_speed_10m)} km/h`);
    else if (esNumero(a.wind_speed_10m) && a.wind_speed_10m >= 40) r.push('💨 Viento fuerte');
    const i = horaInicio(d);
    const prox = d.hourly.precipitation_probability.slice(i, i + 4).filter(esNumero);
    if (prox.length && Math.max(...prox) >= 70) r.push('🌧️ Alta probabilidad de lluvia en las próximas horas');
    return r;
  }

  function pintarPrevio(c) {
    $('detalle').innerHTML = htmlCabecera(c, datos[c.n] || null, null);
    if (datos[c.n]) ambiente(datos[c.n]);
  }
  function pintarErrorDetalle(c, e) {
    const msg = e && e.tipo === 'limite'
      ? 'Open-Meteo recibió demasiadas consultas. Espera un minuto e inténtalo de nuevo.'
      : 'No se pudo cargar el pronóstico de ' + c.n + '. Revisa tu conexión.';
    $('detalle').innerHTML = htmlCabecera(c, datos[c.n] || null, null, true).replace(/<span class="esq">[^<]*<\/span>/g, '--') +
      `<div class="vacio">⚠️ ${msg}<br><button class="btn" id="reintentar">Reintentar</button></div>`;
    $('reintentar').addEventListener('click', () => { if (hayDatos) dibujarDetalle(); else actualizarTodo(true); });
  }

  async function dibujarDetalle() {
    const c = porNombre.get(seleccionada);
    const mi = ++tokenDetalle;
    const previo = detalleActual && detalleActual.c.n === c.n;
    if (!previo) pintarPrevio(c);               // enseguida se ve la ciudad elegida, con lo que ya sabemos
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
    $('detalle').innerHTML = htmlCabecera(c, d.current, d) + `
      <div class="pestanas" role="tablist" aria-label="Vista del pronóstico">
        <button class="pestana${pestana === 'horas' ? ' on' : ''}" data-tab="horas" role="tab" aria-selected="${pestana === 'horas'}">Próximas horas</button>
        <button class="pestana${pestana === 'grafico' ? ' on' : ''}" data-tab="grafico" role="tab" aria-selected="${pestana === 'grafico'}">Gráfico 24 h</button>
        <button class="pestana${pestana === 'dias' ? ' on' : ''}" data-tab="dias" role="tab" aria-selected="${pestana === 'dias'}">Próximos días</button>
      </div>
      <div id="pronostico">${htmlPronostico(d)}</div>`;
    llenarAire(c);
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
    if (tab && detalleActual) { pestana = tab.dataset.tab; pintarDetalle(); }
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
        return `<div class="mini"><div>${String(h).slice(11, 16)}</div><div class="e">${w.emoji}</div>
          <b>${grados(d.hourly.temperature_2m[k])}</b><div class="lluvia">💧${d.hourly.precipitation_probability[k] ?? 0}%</div></div>`;
      }).join('') + '</div>';
    }
    if (pestana === 'grafico') return graficoHoras(d, inicio);
    const nombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const mins = d.daily.temperature_2m_min.filter(esNumero), maxs = d.daily.temperature_2m_max.filter(esNumero);
    const rd = d.rangoDia, bajos = mins.slice(), altos = maxs.slice();
    if (rd) { rd.min.forEach(r => r && bajos.push(r[0])); rd.max.forEach(r => r && altos.push(r[1])); }
    const minG = Math.min(...bajos), maxG = Math.max(...altos), rango = (maxG - minG) || 1;
    return '<div class="dias">' + d.daily.time.map((f, i) => {
      const fecha = new Date(f + 'T12:00:00');
      const w = clima(d.daily.weather_code[i], 1);
      const mn = d.daily.temperature_2m_min[i], mx = d.daily.temperature_2m_max[i];
      const izq = esNumero(mn) ? (mn - minG) / rango * 100 : 0, ancho = esNumero(mn) && esNumero(mx) ? Math.max(8, (mx - mn) / rango * 100) : 8;
      const rMx = rd && rd.max[i], rMn = rd && rd.min[i];
      const izqI = rMx && rMn ? Math.max(0, (rMn[0] - minG) / rango * 100) : 0, anchoI = rMx && rMn ? Math.max(6, (rMx[1] - rMn[0]) / rango * 100) : 0;
      const inc = rMx && rMn ? `<i class="inc" style="left:${izqI.toFixed(0)}%;width:${Math.min(anchoI, 100 - izqI).toFixed(0)}%"></i>` : '';
      const tip = rMx && rMn ? ` title="Máxima probable ${grados(rMx[0])} a ${grados(rMx[1])} · mínima probable ${grados(rMn[0])} a ${grados(rMn[1])}"` : '';
      return `<div class="mini"${tip}><div>${i === 0 ? 'Hoy' : nombres[fecha.getDay()] + ' ' + fecha.getDate()}</div><div class="e">${w.emoji}</div>
        <b>${grados(mx)}</b> <span style="color:var(--suave)">${grados(mn)}</span>
        <div class="barra-rango">${inc}<i style="left:${izq.toFixed(0)}%;width:${Math.min(ancho, 100 - izq).toFixed(0)}%"></i></div>
        <div class="lluvia">💧${d.daily.precipitation_probability_max[i] ?? 0}%</div></div>`;
    }).join('') + '</div>';
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

  // ============ 8) ACCIONES DEL USUARIO ============
  function escribirHash() {
    try {
      const p = new URLSearchParams();
      p.set('c', seleccionada);
      if (capaId !== 'temp') p.set('capa', capaId);
      history.replaceState(null, '', '#' + p.toString());
    } catch (e) { /* algunos navegadores no permiten cambiar la dirección en archivos locales */ }
  }

  // Franja fija de ciudades favoritas (con ícono y temperatura de ahora)
  function pintarFavs() {
    const caja = $('favs'), lista = CIUDADES.filter(c => favoritas.has(c.n)).sort((a, b) => a.n.localeCompare(b.n, 'es'));
    caja.hidden = !lista.length;
    caja.innerHTML = lista.map(c => {
      const d = datos[c.n];
      return `<button class="fav-chip${c.n === seleccionada ? ' activo' : ''}" data-ciudad="${escObs(c.n)}" aria-label="${escObs(c.n)}: ${d ? grados(d.temperature_2m) + ', ' + clima(d.weather_code, d.is_day).texto : 'sin datos'}">` +
        `<span class="e">${d ? clima(d.weather_code, d.is_day).emoji : '⏳'}</span><b>${escObs(c.n)}</b><small>${d ? grados(d.temperature_2m) : '--'}</small></button>`;
    }).join('');
  }
  $('favs').addEventListener('click', e => { const b = e.target.closest('[data-ciudad]'); if (b) elegir(b.dataset.ciudad, { zoom: true }); });

  function refrescarVistas() {
    pintarFavs();
    pintarDeps();
    dibujarPuntos();
    dibujarLista();
    dibujarStats();
    pintarChip();
  }

  function elegir(nombre, op) {
    op = op || {};
    const c = porNombre.get(nombre);
    if (!c) return;
    seleccionada = nombre;
    guardar('clima-py-ultima', nombre);
    pintarFavs();
    escribirHash();
    // Si la ciudad es chica y el mapa está lejos, nos acercamos; si ya hay zoom, solo se centra
    if (!op.desdeMapa && c.g >= 3 && nivelZoom() < 1.7) centrarEn(c, 3);
    else centrarEn(c);
    dibujarPuntos();
    dibujarLista();
    pintarChip();
    dibujarDetalle();
    // Si el panel de detalle quedó fuera de la pantalla (arriba), subimos hasta él
    if ($('detalle').getBoundingClientRect().bottom < 60) $('detalle').scrollIntoView({ behavior: REDUCIDO ? 'auto' : 'smooth', block: 'start' });
  }

  function filtrarDep(nombre) {
    depFiltro = nombre;
    $('filtroDep').value = nombre;
    pintarDeps();
    if (nombre) ajustarA(infoDep[nombre]); else irA({ x: 0, y: 0, w: W });
    dibujarPuntos();
    dibujarLista();
  }
  function limpiarFiltros() {
    consulta = '';
    $('buscador').value = '';
    filtrarDep('');
  }

  $('buscador').addEventListener('input', e => {
    consulta = e.target.value.trim().toLowerCase();
    dibujarPuntos();
    dibujarLista();
  });
  $('buscador').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (e.defaultPrevented) return;                            // ya eligió una sugerencia del buscador de lugares: no elegir otra encima
      const primera = CIUDADES.filter(coincide).sort((a, b) => a.n.localeCompare(b.n, 'es'))[0];
      if (primera) elegir(primera.n, { zoom: true });
    } else if (e.key === 'Escape') { limpiarFiltros(); }
  });
  $('orden').addEventListener('change', dibujarLista);
  $('filtroDep').addEventListener('change', e => filtrarDep(e.target.value));

  $('btnUbicacion').addEventListener('click', async () => {
    const boton = $('btnUbicacion');
    if (!navigator.geolocation || !window.isSecureContext) {
      aviso('El navegador solo puede pedir ubicación en un contexto seguro. Abre Clima PY desde una dirección HTTPS (no desde una vista previa) y vuelve a pulsar “Cerca de mí”.');
      $('buscador').focus();
      return;
    }

    // Si el permiso ya fue bloqueado, el navegador no volverá a mostrar el diálogo
    // desde JavaScript. Detectarlo evita que parezca que el botón no funciona.
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permiso = await navigator.permissions.query({ name: 'geolocation' });
        if (permiso.state === 'denied') {
          aviso('La ubicación está bloqueada para esta página, por eso el navegador no muestra “Permitir”. Pulsa el candado junto a la dirección → Permisos del sitio → Ubicación → Permitir; después recarga la página y vuelve a pulsar “Cerca de mí”.');
          return;
        }
      } catch (_) { /* Algunos navegadores no permiten consultar este estado; se intenta normalmente. */ }
    }

    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
    aviso('Solicitando permiso de ubicación… Si aparece el aviso del navegador, pulsa “Permitir”.');
    navigator.geolocation.getCurrentPosition(pos => {
      boton.disabled = false;
      boton.removeAttribute('aria-busy');
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      const precision = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : Infinity;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        aviso('No pude leer la ubicación. Si hay un error, selecciona tu ciudad manualmente.');
        $('buscador').focus();
        return;
      }
      let mejor = null, dmin = Infinity;
      CIUDADES.forEach(c => {
        const km = distanciaKm(lat, lon, c.lat, c.lon);
        if (Number.isFinite(km) && km < dmin) { dmin = km; mejor = c; }
      });
      if (!mejor) {
        aviso('No pude encontrar una ciudad cercana. Selecciona tu ciudad manualmente.');
        $('buscador').focus();
        return;
      }
      const segunda = CIUDADES.reduce((best, c) => {
        if (c === mejor) return best;
        const km = distanciaKm(lat, lon, c.lat, c.lon);
        return Number.isFinite(km) && km < best ? km : best;
      }, Infinity);
      if (precision > 15000 || (Number.isFinite(precision) && segunda - dmin < precision / 1000)) {
        aviso(`Ubicación aproximada (±${(precision / 1000).toFixed(1)} km). Si hay un error, selecciona tu ciudad manualmente.`);
        $('buscador').focus();
        return;
      }
      if (filtroActivo()) limpiarFiltros();
      elegir(mejor.n, { zoom: true });
      aviso(`Ciudad encontrada: ${mejor.n}. Si hay un error, selecciona tu ciudad manualmente.`);
    }, err => {
      boton.disabled = false;
      boton.removeAttribute('aria-busy');
      if (err && err.code === 1) {
        aviso('El navegador no concedió el permiso y no puede volver a mostrar “Permitir” mientras siga bloqueado. Pulsa el candado junto a la dirección → Permisos del sitio → Ubicación → Permitir, recarga y vuelve a intentarlo.');
      } else if (err && err.code === 2) {
        aviso('No se pudo determinar tu ubicación. Activa el GPS o la ubicación del dispositivo; si hay un error, selecciona tu ciudad manualmente.');
      } else {
        aviso('La ubicación tardó demasiado o no está disponible. Inténtalo otra vez; si hay un error, selecciona tu ciudad manualmente.');
      }
      $('buscador').focus();
    }, { timeout: 15000, maximumAge: 0, enableHighAccuracy: true });
  });


  // Indicador de estado de los datos (en vivo / viejos / sin conexión)
  function pintarEstado() {
    const el = $('estado');
    let clase, texto;
    if (!ultimaOk) { clase = cargando ? 'carga' : 'error'; texto = cargando ? 'Cargando…' : 'Sin datos'; }
    else {
      const min = Math.round((Date.now() - ultimaOk) / 60000), hora = fmtHora(new Date(ultimaOk));
      if (ultimoError) { clase = 'error'; texto = `Sin conexión · datos de las ${hora}`; }
      else if (min >= 45) { clase = 'viejo'; texto = `Datos de hace ${min} min`; }
      else { clase = 'ok'; texto = `En vivo · actualizado ${hora}`; }
    }
    el.className = 'pill ' + clase;
    el.textContent = '● ' + texto;
  }

  let reintentoAuto = 0;
  async function actualizarTodo(manual) {
    if (cargando) return;
    // Límite anti-spam: no se aplica si el último intento falló (así "Reintentar" siempre funciona)
    if (manual === true && !ultimoError && Date.now() - ultimoIntento < 15000) { aviso('Ya se actualizó hace unos segundos.'); return; }
    cargando = true;
    ultimoIntento = Date.now();
    $('btnActualizar').disabled = true;
    clearTimeout(reintentoAuto);
    pintarEstado();
    let ok = false, errorFinal = null;
    try {
      const [r] = await Promise.all([cargarTodas(manual === true), cargarObservaciones()]);   // modelo + aeropuertos al mismo tiempo
      CIUDADES.forEach(c => { if (datos[c.n]) datos[c.n] = conObservacion(c, datos[c.n]); });
      sincronizarDia();
      ultimaOk = r.omitido ? ultimaOk : (r.t || Date.now()); ultimoError = false; ok = true; hayDatos = true;
      guardar('clima-py-datos', JSON.stringify({ t: ultimaOk, datos }));
      if (r.ok < r.total) aviso('Algunas ciudades no se pudieron actualizar.');
    } catch (e) {
      errorFinal = e;
      ultimoError = true;
      aviso(e && e.tipo === 'limite' ? 'Open-Meteo recibió demasiadas consultas. Espera un minuto.' : 'No se pudo actualizar el clima. Revisa tu conexión.');
      reintentoAuto = setTimeout(() => { if (!document.hidden) actualizarTodo(); }, 60000 + Math.random() * 60000);   // vuelve a intentar en 1 o 2 minutos (distinto para cada visitante, para no chocar todos a la vez)
    }
    cargando = false;
    $('btnActualizar').disabled = false;
    pintarEstado();
    refrescarVistas();
    if (ok) avisarTormentas();
    if (ok && !lugaresListo && !usoCompartido) { lugaresListo = true; setTimeout(completarLugares, 15000 + Math.random() * 30000); }   // con datos compartidos las localidades extra ya vienen resueltas
    if (ok) { cacheDetalle.clear(); dibujarDetalle(); }
    else if (!detalleActual) {                         // primer arranque sin datos: error claro con "Reintentar"
      tokenDetalle++;
      pintarErrorDetalle(porNombre.get(seleccionada), errorFinal);
      $('detalle').setAttribute('aria-busy', 'false');
    }
  }
  $('btnActualizar').addEventListener('click', () => actualizarTodo(true));

  // Solo se actualiza sola si la pestaña está visible (así no se gastan consultas a la API)
  const intervaloActualizacion = setInterval(() => { if (!document.hidden) actualizarTodo(); }, INTERVALO);
  // Si la página queda en la caché atrás/adelante (persisted), los temporizadores se congelan solos y deben seguir al volver:
  // antes se borraban y, al regresar con «atrás», la app ya no se actualizaba ni pasaba del día a la noche.
  window.addEventListener('pagehide', e => { if (e.persisted) return; clearInterval(intervaloActualizacion); clearInterval(intervaloEstado); clearInterval(intervaloCielo); clearTimeout(reintentoAuto); clearTimeout(temporizador); pararAnimacionRadar(); pararReloj(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - ultimaOk > INTERVALO) actualizarTodo();
  });
  const intervaloEstado = setInterval(pintarEstado, 30000);

  // ---- Botón "Instalar app" ----
  let promptInstalar = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptInstalar = e; $('btnInstalar').hidden = false; });
  window.addEventListener('appinstalled', () => { promptInstalar = null; $('btnInstalar').hidden = true; });
  $('btnInstalar').addEventListener('click', async () => {
    if (!promptInstalar) return;
    promptInstalar.prompt();
    try { await promptInstalar.userChoice; } catch (e) { /* cerró el cuadro */ }
    promptInstalar = null; $('btnInstalar').hidden = true;
  });

  // ---- Avisos de tormenta en las ciudades favoritas ----
  // Funcionan mientras la app esté abierta (aunque sea en segundo plano). Con la app cerrada haría falta un servidor de notificaciones push.
  let avisosOn = leer('clima-py-avisos', '0') === '1' && 'Notification' in window && Notification.permission === 'granted';
  const pintarAvisos = () => { $('btnAvisos').classList.toggle('on', avisosOn); $('btnAvisos').setAttribute('aria-pressed', String(avisosOn)); };
  pintarAvisos();
  $('btnAvisos').addEventListener('click', async () => {
    if (!('Notification' in window)) { aviso('Este navegador no permite notificaciones.'); return; }
    if (avisosOn) { avisosOn = false; guardar('clima-py-avisos', '0'); pintarAvisos(); aviso('Avisos de tormenta desactivados.'); return; }
    let permiso = Notification.permission;
    if (permiso === 'default') permiso = await Notification.requestPermission();
    if (permiso !== 'granted') { aviso('Los avisos están bloqueados: actívalos en los permisos del navegador.'); return; }
    avisosOn = true; guardar('clima-py-avisos', '1'); pintarAvisos();
    aviso(favoritas.size ? 'Te avisaré si hay tormenta en tus favoritas mientras la app esté abierta.' : 'Activados. Marca ciudades con ★ para recibir avisos de ellas.');
  });
  async function avisarTormentas() {
    if (!avisosOn || !('Notification' in window) || Notification.permission !== 'granted') return;
    let hechos = {};
    try { hechos = JSON.parse(leer('clima-py-avisados', '{}')) || {}; } catch (e) { hechos = {}; }
    for (const n of favoritas) {
      const a = datos[n];
      if (!a || ![95, 96, 99].includes(a.weather_code) || Date.now() - (hechos[n] || 0) < 3 * 3600 * 1000) continue;   // un aviso por ciudad cada 3 h
      hechos[n] = Date.now();
      const opc = { body: `${tr(clima(a.weather_code, a.is_day).texto)} · ${grados(a.temperature_2m)}`, icon: 'icono-192.png', tag: 'tormenta-' + n };
      try {
        const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
        if (reg) await reg.showNotification(tr('⛈️ Tormenta en ' + n), opc); else new Notification(tr('⛈️ Tormenta en ' + n), opc);
      } catch (e) { /* si no se puede mostrar, se ignora */ }
    }
    guardar('clima-py-avisados', JSON.stringify(hechos));
  }

  // Reloj del ciclo día/noche: cada 30 s (y al volver a la pestaña) se recalcula el momento del día sin pedir nada a internet
  function relojCielo() {
    const cambio = sincronizarDia();
    const a = detalleActual && detalleActual.c.n === seleccionada ? detalleActual.d.current : datos[seleccionada];
    if (a) ambiente(a, detalleActual && detalleActual.c.n === seleccionada ? detalleActual.d : undefined);
    if (cambio) refrescarVistas();
  }
  const intervaloCielo = setInterval(relojCielo, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) relojCielo(); });


  let temporizador;
  window.addEventListener('resize', () => { clearTimeout(temporizador); temporizador = setTimeout(dibujarPuntos, 150); });


  // Conectividad: informa de forma clara si el navegador pierde o recupera internet.
  // No reemplaza la comprobación real de la API; solo refleja el estado de red del dispositivo.
  window.addEventListener('offline', () => {
    aviso('Sin conexión a internet. Se conservarán los últimos datos guardados.');
    const estado = $('estado');
    if (estado && ultimaOk) {
      estado.className = 'pill error';
      estado.textContent = '● Sin conexión · usando datos guardados';
    }
  });
  window.addEventListener('online', () => {
    aviso('Conexión recuperada. Actualizando el clima…');
    if (!document.hidden) actualizarTodo();
  });

  // ============ IDIOMA: español / guaraní (Avañe'ẽ) ============
  // Todas las traducciones están juntas en GN, GN_PATRONES y GN_REEMPL para poder corregirlas fácilmente.
  // Lo que no tiene traducción se queda en español. Los nombres de ciudades no se traducen.
  let idioma = leer('clima-py-idioma', 'es') === 'gn' ? 'gn' : 'es';
  const GN = {
    // --- pantalla principal ---
    "● Cargando…": "● Eha'ãrõ…", "● Sin conexión · usando datos guardados": "● Ndaipóri internet · oñemoĩ marandu oñeñongatúva",
    "📲 Instalar": "📲 Emoĩ", "Buscar lugar": "Eheka tenda", "Comparar": "Ñembojoja", "Cerca de mí": "Che ag̃ui", "Actualizar": "Mbopyahu",
    "Cargando el clima…": "Oñembyaty ára marandu…", "⚖️ Comparar ciudades": "⚖️ Ñembojoja táva",
    "Usa Ctrl + rueda para hacer zoom": "Eipuru Ctrl + rueda embotuicha térã emomichĩ hag̃ua",
    "Ahora": "Ko'ág̃a", "📡 Radar de lluvia": "📡 Radar ama rehegua", "Ⅱ Pausar": "Ⅱ Mbopyta", "Pausar": "Mbopyta", "▶ Reanudar": "▶ Eñepyrũ jey",
    "Reproducir": "Emboguata", "🛣️ Rutas": "🛣️ Tape", "Radar desactivado": "Radar oñemboyke", "Radar sin datos": "Radar ndaipóri marandu",
    "Conectando con el radar…": "Ojejoaju radar ndive…",
    "Ctrl + rueda o pellizca para zoom · arrastra para mover · toca un departamento para filtrar · con zoom se ven los distritos":
      "Ctrl + rueda térã pellizca embotuicha hag̃ua · egueru emongu'e hag̃ua · epoko peteĩ departamento emoĩporã hag̃ua · embotuicha vove ojehecha umi distrito",
    "Ciudades": "Táva", "Orden: nombre": "Ñemohenda: téra", "Mayor valor primero": "Tuichavéva peteĩha", "Menor valor primero": "Michĩvéva peteĩha",
    "Datos del clima:": "Ára marandu:", "(modelos ECMWF, GFS, ICON y GEM) · observaciones:": "(modelo ECMWF, GFS, ICON ha GEM) · ojehecháva:",
    "(METAR de aeropuertos) · radar:": "(METAR aeropuerto-gua) · radar:", "Límites:": "Rembe'y:", "(dominio público)": "(opavavepegua)",
    "Se actualiza solo cada 30 minutos mientras la página está visible": "Ijehegui oñemopyahu opa 30 minuto ko página ojehecha aja",
    "Mapa": "Yvy ra'ãnga", "Opacidad": "Opacidad",
    // --- textos de ayuda (atributos title / aria-label / placeholder) ---
    "Acercar": "Embotuicha", "Alejar": "Emomichĩ", "Activar el sonido del clima": "Emoñepyrũ ára pu", "Silenciar el sonido del clima": "Emokirirĩ ára pu",
    "Avisar de tormentas en tus ciudades favoritas (con la app abierta)": "Emomarandu aratiri rehe nde táva jeporavopyre-pe (app ojeipe'a aja)",
    "Avisos de tormenta": "Ñemomarandu aratiri rehegua", "Busca cualquier pueblo o barrio de Paraguay": "Eheka oimeraẽ távaha térã barrio Paraguáipe",
    "Buscar ciudad": "Eheka táva", "Buscar ciudad o lugar…": "Eheka táva térã tenda…", "Capa del mapa": "Mapa capa", "Cerrar comparación": "Emboty ñembojoja",
    "Ciudades favoritas": "Táva jeporavopyre", "Comparar ciudades": "Ñembojoja táva", "Comparar dos o tres ciudades": "Embojoja mokõi térã mbohapy táva",
    "Efectos del cielo": "Yvága efecto", "Filtrar por departamento": "Emoĩporã departamento rupi", "Hora del pronóstico en el mapa": "Aravo ára marandu rehegua mapa-pe",
    "Instalar Clima PY como app": "Emoĩ Clima PY app-ramo", "Ir a una sección": "Eho peteĩ pehẽme", "Mostrar u ocultar el radar de lluvia": "Ehechauka térã eñomi radar ama rehegua",
    "Ordenar ciudades": "Emohenda táva", "Paisaje del clima actual": "Ára ko'ág̃a ra'ãnga", "Pausar la animación del radar": "Emopyta radar animación",
    "Resumen nacional": "Tetã rehegua mbykymi", "Rutas principales (aproximadas)": "Tape guasu (jerére)", "Selecciona la ciudad más cercana a ti": "Eporavo pe táva ag̃uĩvéva ndéve",
    "Sonido ambiente según el clima": "Ára pu ára rehe oĩva", "Ver todo el país": "Ehecha tetã tuichakue", "Favorita": "Jeporavopyre",
    "Mapa de Paraguay por departamentos. Usa + y - para el zoom y las flechas para moverte.": "Paraguay mapa departamento rupi. Eipuru + ha - embotuicha térã emomichĩ hag̃ua, ha flecha eguata hag̃ua.",
    "Cambiar a modo claro": "Emoambue modo hesakãme", "Cambiar a modo oscuro": "Emoambue modo pytũme", "Temperatura de las próximas 24 horas": "Hakuha 24 aravo oúva",
    // --- capas, resumen y lista ---
    "Temperatura": "Hakuha", "Humedad": "Humedad", "Viento": "Yvytu", "Lluvia": "Ama",
    "🔥 Más calurosa": "🔥 Hakuvéva", "❄️ Más fría": "❄️ Ro'yvéva", "💧 Más húmeda": "💧 Humedad ijyvatevéva", "🏜️ Más seca": "🏜️ Ipiruvéva",
    "💨 Más ventosa": "💨 Yvytu hatãvéva", "🍃 Más calma": "🍃 Kirirĩvéva", "🌧️ Más lluvia": "🌧️ Ama hetavéva", "☀️ Más seca": "☀️ Ipiruvéva",
    "🌧️ Con lluvia ahora": "🌧️ Oky ko'ág̃a", "☀️ Sin lluvia ahora": "☀️ Ndaipóri ama ko'ág̃a", "ciudades secas": "táva ndaipóri ama", "ninguna ciudad": "ni peteĩ táva",
    "★ Favoritas": "★ Jeporavopyre", "Todas": "Opavave", "Ciudades principales": "Táva tuichavéva", "Ver todas las ciudades": "Ehecha opaite táva", "No hay ciudades con ese filtro.": "Ndaipóri táva ko filtro ndive.", "Quitar filtros": "Emboguete filtro",
    "Sin datos": "Ndaipóri marandu", "sin datos": "ndaipóri marandu", "Sin datos por ahora": "Ndaipóri marandu ko'ág̃a", "Cargando…": "Eha'ãrõ…", "Buscando…": "Ojeheka…", "Reintentar": "Eha'ã jey",
    "Hoy": "Ko árape", "Mañana": "Ko'ẽrõ", "— ninguna —": "— mba'eve —",
    // --- momentos del día ---
    "🌅 Amanecer": "🌅 Ko'ẽmbota", "☀️ Día": "☀️ Ára", "🌇 Atardecer": "🌇 Ka'aru", "🌙 Noche": "🌙 Pyhare",
    // --- ajustes de animación (lo demás del panel queda en español) ---
    "Día": "Ára", "Noche": "Pyhare", "Nubes": "Arai", "Estrellas y luna": "Mbyja ha jasy", "Lluvia y granizo": "Ama ha ama itá", "Aves y luciérnagas": "Guyra ha mua",
    // --- estado del cielo ---
    "Despejado": "Yvága hesakã", "Mayormente despejado": "Yvága hesakã heta", "Parcialmente nublado": "Arai sa'i", "Nublado": "Arai hetáva",
    "Niebla": "Arai yvýpe", "Niebla con escarcha": "Arai yvýpe ro'ysã reheve",
    "Llovizna leve": "Ama'i sa'i", "Llovizna": "Ama'i", "Llovizna fuerte": "Ama'i hatã", "Llovizna helada": "Ama'i ro'ysã", "Llovizna helada fuerte": "Ama'i ro'ysã hatã",
    "Lluvia leve": "Ama sa'i", "Lluvia fuerte": "Ama hatã", "Lluvia helada": "Ama ro'ysã", "Lluvia helada fuerte": "Ama ro'ysã hatã",
    "Nieve leve": "Ro'ysã ho'a sa'i", "Nieve": "Ro'ysã ho'a", "Nieve fuerte": "Ro'ysã ho'a hatã", "Granizo fino": "Ama itá sa'i",
    "Chubascos leves": "Ama pya'e sa'i", "Chubascos": "Ama pya'e", "Chubascos fuertes": "Ama pya'e hatã",
    "Chubascos de nieve": "Ro'ysã ho'a pya'e", "Chubascos de nieve fuertes": "Ro'ysã ho'a pya'e hatã",
    "Tormenta": "Aratiri", "Tormenta con granizo": "Aratiri ama itá reheve", "Tormenta fuerte con granizo": "Aratiri hatã ama itá reheve",
    // --- luna y aire ---
    "Luna nueva": "Jasy pyahu", "Creciente": "Okakuaáva", "Cuarto creciente": "Cuarto okakuaáva", "Gibosa creciente": "Gibosa okakuaáva", "Luna llena": "Jasy henyhẽ",
    "Gibosa menguante": "Gibosa okañýva", "Cuarto menguante": "Cuarto okañýva", "Menguante": "Okañýva",
    "Buena": "Iporã", "Moderada": "Mbytépe", "Dañina para sensibles": "Ivaíva umi imbarete'ỹvape", "Dañina": "Ivaíva", "Muy dañina": "Ivaiterei", "Peligrosa": "Peligro",
    // --- detalle de la ciudad ---
    "Capital del país": "Tetã táva guasu", "Asunción (capital)": "Asunción (táva guasu)", "Sensación térmica": "Ñandu hakuha", "Lluvia ahora": "Ama ko'ág̃a", "Índice UV (máx. hoy)": "Índice UV (ko árape ijyvatevéva)",
    "Amanecer": "Ko'ẽmbota", "Atardecer": "Ka'aru", "Luna": "Jasy", "Calidad del aire": "Aire reko", "Presión": "Presión",
    "Próximas horas": "Aravo oúva", "Gráfico 24 h": "Ra'ãnga 24 aravo", "Próximos días": "Ára oúva",
    "Sensación": "Ñandu", "Máx. / mín. hoy": "Ijyvatevéva / iguyvevéva ko árape", "Prob. de lluvia hoy": "Ama ikatuha ko árape",
    "Barras azules: probabilidad de lluvia": "Barra hovy: ama ikatuha", "No hay datos suficientes para el gráfico.": "Ndaipóri marandu heta ra'ãnga g̃uarã.",
    "(muy segura)": "(katuete)", "Rango del 10 % al 90 % de las simulaciones de 4 modelos": "Ñembojoja 10 % guive 90 % peve simulación 4 modelo-gua",
    "Dato medido": "Ojemedíva", "Referencia real:": "Techaukaha añete:",
    "Probabilidad básica de Open-Meteo (no se pudo consultar el ensamble de modelos).": "Ama ikatuha Open-Meteo-gua (ndaikatúi ojehecha modelo ensamble).",
    // --- avisos del clima ---
    "🥵 Sensación térmica muy alta: hidrátate y evita el sol del mediodía": "🥵 Ñandu hakuha ijyvate: eñemboy ha ekañy kuarahy mbytépe guive",
    "🔥 Calor extremo: hidrátate y evita el sol en las horas centrales del día": "🔥 Hakuha tuichaiterei: eñemboy ha ekañy kuarahy mbytépe guive",
    "🥶 Frío intenso: abrígate bien": "🥶 Ro'y hatã: eñemoĩ porã ao",
    "📤 Compartir": "📤 Compartir", "Compartir el clima de esta ciudad": "Compartir el clima de esta ciudad", "WhatsApp": "WhatsApp", "Enviar el clima por WhatsApp": "Enviar el clima por WhatsApp",
    "Enlace copiado": "Enlace copiado", "No se pudo copiar el enlace": "No se pudo copiar el enlace",
    "🥶 Sensación de frío intenso: abrígate bien": "🥶 Ñandu ro'y hatã: eñemoĩ porã ao", "💨 Viento fuerte": "💨 Yvytu hatã",
    "🌧️ Alta probabilidad de lluvia en las próximas horas": "🌧️ Ikatupyry ama aravo oúvape", "⛈️ Tormenta eléctrica en la zona ahora": "⛈️ Aratiri oĩ ko'ág̃a ko henda",
    // --- sonido ---
    "Tormenta: lluvia fuerte, viento y truenos": "Aratiri: ama hatã, yvytu ha aratiri pu", "Lluvia: gotas sobre las hojas y aves lejanas": "Ama: ama ho'a ogue ári ha guyra mombyry",
    "Noche de lluvia: gotas y ranas": "Pyhare ama: ama ho'a ha ju'i", "Niebla: sonido amortiguado y brisa suave": "Arai yvýpe: pu mbegue ha yvytu mbegue",
    "Noche tranquila: grillos y ranas": "Pyhare kirirĩ: grillo ha ju'i", "Hora dorada: coro de aves y brisa suave": "Hora dorada: guyra purahéi ha yvytu mbegue",
    "Cielo nublado: brisa suave y aves lejanas": "Yvága arai: yvytu mbegue ha guyra mombyry", "Día soleado: aves, brisa y cigarras": "Ára kuarahy: guyra, yvytu ha cigarra",
    "Día tranquilo: aves y brisa suave": "Ára kirirĩ: guyra ha yvytu mbegue", "Tu navegador no permite reproducir sonido.": "Nde navegador ndohejái ojepu.",
    // --- mensajes ---
    "Escribe al menos 3 letras del lugar.": "Ehai 3 letra michĩvévape tenda réra.", "No encontré ese lugar en Paraguay.": "Ndajuhúi pe tenda Paraguáipe.",
    "No se pudo buscar. Revisa tu conexión.": "Ndaikatúi ojeheka. Ehecha nde internet.", "No se pudo cargar el pronóstico por horas.": "Ndaikatúi oñembyaty ára marandu aravo rupi.",
    "No se pudo cargar alguna ciudad. Prueba de nuevo en un momento.": "Ndaikatúi oñembyaty peteĩ táva. Eha'ã jey sapy'ami.",
    "No se pudo cargar el radar. Comprueba la conexión e inténtalo otra vez.": "Ndaikatúi oñembyaty radar. Ehecha internet ha eha'ã jey.", "No se pudo cargar el radar.": "Ndaikatúi oñembyaty radar.",
    "Tu navegador no permite usar la ubicación.": "Nde navegador ndohejái eipuru ubicación.", "No pude obtener tu ubicación (revisa el permiso del navegador).": "Ndaikatúi ajuhu nde ubicación (ehecha navegador permiso).",
    "Ya se actualizó hace unos segundos.": "Oñemopyahúma sapy'ami ohasa.", "Algunas ciudades no se pudieron actualizar.": "Ndaikatúi oñemopyahu algunos táva.",
    "Open-Meteo recibió demasiadas consultas. Espera un minuto e inténtalo de nuevo.": "Open-Meteo ohupyty heta ñemoñe'ẽ. Eha'ãrõ peteĩ minuto ha eha'ã jey.",
    "Open-Meteo recibió demasiadas consultas. Espera un minuto.": "Open-Meteo ohupyty heta ñemoñe'ẽ. Eha'ãrõ peteĩ minuto.",
    "No se pudo actualizar el clima. Revisa tu conexión.": "Ndaikatúi oñemopyahu ára. Ehecha nde internet.", "Este navegador no permite notificaciones.": "Ko navegador ndohejái notificación.",
    "Avisos de tormenta desactivados.": "Ñemomarandu aratiri rehegua oñemboyke.", "Los avisos están bloqueados: actívalos en los permisos del navegador.": "Umi ñemomarandu oñemboyke: emoñepyrũ jey navegador permiso-pe.",
    "Te avisaré si hay tormenta en tus favoritas mientras la app esté abierta.": "Chemomarandu aratiri oĩ vove nde táva jeporavopyre-pe app ojeipe'a aja.",
    "Activados. Marca ciudades con ★ para recibir avisos de ellas.": "Oñemoñepyrũ. Emarka táva ★ reheve ehupyty hag̃ua ñemomarandu.",
    "Sin conexión a internet. Se conservarán los últimos datos guardados.": "Ndaipóri internet. Oñeñongatu hína umi marandu ipahaitéva.",
    "Conexión recuperada. Actualizando el clima…": "Internet ou jey. Oñemopyahu ára…", "Clima": "Ára", "Idioma": "Ñe'ẽ", "y": "ha", "Cerrar": "Emboty", "Buscar": "Eheka", "Ciudad": "Táva", "Departamento": "Departamento",
    "Mapa de calor": "Mapa hakuha", "Capas": "Capa", "Promedio": "Promedio", "Humedad relativa": "Humedad", "Radar": "Radar",
    "Idioma: Español": "Ñe'ẽ: Español", "Idioma: Avañe'ẽ (guaraní)": "Ñe'ẽ: Avañe'ẽ (guaraní)"
  };
  const DIAS_GN = { dom: "Arapokõindy", lun: "Arateĩ", mar: "Arakõi", mié: "Araapy", jue: "Ararundy", vie: "Arapo", sáb: "Arapokõi" };
  const diaGN = x => DIAS_GN[x.toLowerCase().replace('.', '')] || x;
  const NIVEL_UV_GN = { "extremo": "hatãeterei", "muy alto": "ijyvateterei", "alto": "ijyvate", "moderado": "mbytépe" };
  const CAPA_GN = { "temperatura": "hakuha", "humedad": "humedad", "viento": "yvytu", "lluvia": "ama" };
  const SUB = x => traducir(x);
  // Frases completas con datos variables (se aplican al texto entero)
  const GN_PATRONES = [
    [/^(● )?En vivo · actualizado (.+)$/, m => `${m[1] || ''}Ko'ág̃agua · ojemopyahu ${m[2]}`],
    [/^(● )?Datos de hace (\d+) min$/, m => `${m[1] || ''}Marandu ${m[2]} min ohasámava`],
    [/^(● )?Sin conexión · datos de las (.+)$/, m => `${m[1] || ''}Ndaipóri internet · marandu ${m[2]}-gua`],
    [/^Todo el país \((\d+)\)$/, m => `Tetã tuichakue (${m[1]})`],
    [/^(\d+) ciudades · (\d+) departamentos$/, m => `${m[1]} táva · ${m[2]} departamento`],
    [/^Promedio · (.+)$/, m => `Promedio · ${CAPA_GN[m[1]] || m[1]}`],
    [/^(\d+) ciudades$/, m => `${m[1]} táva`],
    [/^ej\.: (.+)$/, m => `techapyrã: ${m[1]}`],
    [/^Máx\. probable (.+?)( \(muy segura\))?$/, m => `Ijyvatevéva ikatúva ${m[1]}${m[2] ? ' (katuete)' : ''}`],
    [/^Máxima probable (.+?) a (.+?) · mínima probable (.+?) a (.+)$/, m => `Ijyvatevéva ikatúva ${m[1]} guive ${m[2]} peve · iguyvevéva ikatúva ${m[3]} guive ${m[4]} peve`],
    [/^☀️ UV (extremo|muy alto|alto|moderado) hoy \((\d+)\): usa protector solar(?: entre las (\d+):00 y las (\d+):00)?(, gorra y busca sombra)?$/,
      m => `☀️ UV ${NIVEL_UV_GN[m[1]]} ko árape (${m[2]}): eipuru protector solar${m[3] ? ` ${m[3]}:00 guive ${m[4]}:00 peve` : ''}${m[5] ? ', gorra ha eheka sombra' : ''}`],
    [/^🌧️ Está lloviendo ahora \(unos (.+?) mm en la próxima hora\)$/, m => `🌧️ Oky ko'ág̃a (${m[1]} mm jerére peteĩ aravo oúvape)`],
    [/^🌦️ Lluvia en unos (\d+) min \(unos (.+?) mm en la próxima hora\)$/, m => `🌦️ Ama oúta ${m[1]} min jerére (${m[2]} mm jerére peteĩ aravo oúvape)`],
    [/^💨 Viento fuerte: (\d+) km\/h$/, m => `💨 Yvytu hatã: ${m[1]} km/h`],
    [/^⛈️ Tormenta en (.+)$/, m => `⛈️ Aratiri ${m[1]}-pe`],
    [/^Radar observado · (.*?) · fotograma (\d+)\/(\d+)$/, m => `Radar ojehecháva · ${SUB(m[1])} · ra'ãnga ${m[2]}/${m[3]}`],
    [/^La ciudad más cercana es (.+), a (\d+) km\.$/, m => `Pe táva ag̃uĩvéva ha'e ${m[1]}, ${m[2]} km-pe.`],
    [/^Ciudad más cercana: (.+) \(a (\d+) km\)$/, m => `Táva ag̃uĩvéva: ${m[1]} (${m[2]} km-pe)`],
    [/^No se pudo cargar el pronóstico de (.+)\. Revisa tu conexión\.$/, m => `Ndaikatúi oñembyaty ára marandu ${m[1]} rehegua. Ehecha nde internet.`],
    [/^No se pudo actualizar el pronóstico de (.+)\. Se muestran los últimos datos\.$/, m => `Ndaikatúi oñemopyahu ára marandu ${m[1]} rehegua. Ojehechauka umi marandu ipahaitéva.`],
    [/^(Dom|Lun|Mar|Mié|Jue|Vie|Sáb)( \d+)?$/, m => `${diaGN(m[1])}${m[2] || ''}`],
    [/^(dom|lun|mar|mié|jue|vie|sáb)\.? (\d\d:\d\d) · en (\d+) h$/, m => `${diaGN(m[1])} ${m[2]} · ${m[3]} aravo rire`],
    [/^Quitar (.+) de favoritas$/, m => `Emboguete ${m[1]} jeporavopyre-gui`],
    [/^Marcar (.+) como favorita$/, m => `Emarka ${m[1]} jeporavopyre-ramo`],
    [/^Ciudad (\d)$/, m => `Táva ${m[1]}`],
    [/^(.+) · (\d+) ciudad(?:es)?$/, m => `${SUB(m[1])} · ${m[2]} táva`],
    [/^(.+) · (temperatura|humedad|viento|lluvia) (.+)$/, m => `${SUB(m[1])} · ${CAPA_GN[m[2]]} ${m[3]}`],
    [/^(.+): sin datos$/, m => `${m[1]}: ndaipóri marandu`],
    [/^(.+): (-?\d+) grados, (.+)$/, m => `${m[1]}: ${m[2]} gráu, ${SUB(m[3])}`],
    [/^(\d+) · (.+)$/, m => `${m[1]} · ${SUB(m[2])}`],
    [/^(.+) · (\d+)%$/, m => `${SUB(m[1])} · ${m[2]}%`],
    [/^(.+): (-?\d+°[CF]?), ([^,]+)$/, m => `${m[1]}: ${m[2]}, ${SUB(m[3])}`]
  ];
  // Fragmentos dentro de textos más largos
  const GN_REEMPL = [
    [/\(temperatura, humedad, viento y presión\) en el aeropuerto de (.+?), a (\d+) km, hace (.+?): /g, (m, a, b, c) => `(hakuha, humedad, yvytu ha presión) aeropuerto ${a}-pe, ${b} km-pe, ${c} ohasámava: `],
    [/el aeropuerto de (.+?), a (\d+) km, midió (.+?) hace (.+?)\./g, (m, a, b, c, d) => `aeropuerto ${a}, ${b} km-pe, omedi ${c} ${d} ohasámava.`],
    [/En ese punto el modelo calculaba/g, () => "Upe tendápe modelo oikuaa"], [/El modelo calculaba/g, () => "Modelo oikuaa"],
    [/Hoy, en (\d+) aeropuertos del país, el modelo se desvía en promedio (.+?) \(sesgo (.+?)\)\./g, (m, a, b, c) => `Ko árape, ${a} aeropuerto tetãme, modelo oñemomombyry promedio ${b} (sesgo ${c}).`],
    [/hace menos de 2 min/g, () => "2 min-gui michĩve ohasa"], [/hace (\d+) (min|h)\b/g, (m, a, b) => `${a} ${b === 'h' ? 'aravo' : 'min'} ohasámava`],
    [/Probabilidad de lluvia calculada con ensambles de 4 modelos \(ECMWF, GFS, ICON y GEM\): porcentaje de simulaciones con lluvia \(≥ 0,1 mm por hora; ≥ 1 mm en el día\)\./g,
      () => "Ama ikatuha: ojekuaa 4 modelo ensamble ndive (ECMWF, GFS, ICON ha GEM): porcentaje simulación oikývape ama (≥ 0,1 mm aravo peteĩ; ≥ 1 mm ára pukukue)."],
    [/La franja clara detrás de cada barra de temperatura es el rango probable \(del 10 % al 90 % de las simulaciones\); cuanto más ancha, menos seguros están los modelos\./g,
      () => "Pe franja hesakã barra hakuha ykére ha'e pe rango ikatúva (10 % guive 90 % peve simulación); ipukuvévo, ndojeroviapyvéi umi modelo."],
    [/ Se muestran los últimos datos\./g, () => " Ojehechauka umi marandu ipahaitéva."]
  ];
  const cacheTr = new Map();
  function traducir(s) {
    if (!s) return s;
    const t = s.trim();
    if (t.length < 1 || !/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(t)) return s;
    let r = cacheTr.get(t);
    if (r === undefined) {
      r = traducirNucleo(t);
      if (r === t) {   // sin coincidencia: separo un prefijo de emojis/símbolos ("⚠️ ", "● ", "· ") y traduzco el resto
        const m = /^([^A-Za-zÁÉÍÓÚáéíóúñÑ¿¡]*)([\s\S]*)$/.exec(t);
        if (m && m[1] && m[2]) { const r2 = traducirNucleo(m[2]); if (r2 !== m[2]) r = m[1] + r2; }
      }
      if (cacheTr.size > 4000) cacheTr.clear();
      cacheTr.set(t, r);
    }
    if (r === t) return s;
    const i = s.indexOf(t);
    return s.slice(0, i) + r + s.slice(i + t.length);
  }
  function traducirNucleo(t) {
    if (Object.prototype.hasOwnProperty.call(GN, t)) return GN[t];
    for (const [re, f] of GN_PATRONES) { const m = re.exec(t); if (m) return f(m); }
    let r = t; for (const [re, f] of GN_REEMPL) r = r.replace(re, f);
    return r;
  }
  const tr = s => idioma === 'gn' ? traducir(s) : s;

  // --- aplicar la traducción a la página (y a todo lo que la app dibuje después) ---
  const memoTxt = new WeakMap(), memoAttr = new WeakMap(), ATRS_TR = ['title', 'aria-label', 'placeholder'];
  const enMapa = el => !!el && el.id !== 'mapa' && !!el.closest('#mapa');           // el dibujo del mapa solo tiene nombres y cifras: se salta
  function traducirTexto(n) {
    const v = n.nodeValue, m = memoTxt.get(n);
    if (m && v === m.gn) return;
    const g = traducir(v);
    if (g !== v && !enMapa(n.parentElement)) { memoTxt.set(n, { es: v, gn: g }); n.nodeValue = g; } else if (m) memoTxt.delete(n);
  }
  function traducirAttr(el, a) {
    const v = el.getAttribute(a);
    if (v == null) return;
    let mm = memoAttr.get(el); const m = mm && mm.get(a);
    if (m && v === m.gn) return;
    const g = traducir(v);
    if (g !== v && !enMapa(el)) { if (!mm) { mm = new Map(); memoAttr.set(el, mm); } mm.set(a, { es: v, gn: g }); el.setAttribute(a, g); } else if (m) mm.delete(a);
  }
  function traducirArbol(raiz) {
    if (!raiz) return;
    if (raiz.nodeType === 3) { traducirTexto(raiz); return; }
    if (raiz.nodeType !== 1 || enMapa(raiz)) return;
    const filtro = { acceptNode: x => {
      if (x.nodeType !== 1) return NodeFilter.FILTER_ACCEPT;
      if (x.id === 'mapa') { ATRS_TR.forEach(a => { if (x.hasAttribute(a)) traducirAttr(x, a); }); return NodeFilter.FILTER_REJECT; }   // el mapa: solo su descripción, no su dibujo
      return x.tagName === 'SCRIPT' || x.tagName === 'STYLE' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    } };
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, filtro);
    const revisar = x => { if (x.nodeType === 3) traducirTexto(x); else ATRS_TR.forEach(a => { if (x.hasAttribute(a)) traducirAttr(x, a); }); };
    revisar(raiz);
    let n; while ((n = w.nextNode())) revisar(n);
  }
  function restaurarEspanol() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { const m = memoTxt.get(n); if (m && n.nodeValue === m.gn) n.nodeValue = m.es; memoTxt.delete(n); }
    document.querySelectorAll('[title],[aria-label],[placeholder]').forEach(el => {
      const mm = memoAttr.get(el); if (!mm) return;
      mm.forEach((m, a) => { if (el.getAttribute(a) === m.gn) el.setAttribute(a, m.es); });
      memoAttr.delete(el);
    });
  }
  let observadorIdioma = null;
  function vigilarIdioma() {
    if (observadorIdioma) return;
    observadorIdioma = new MutationObserver(ms => {
      if (idioma !== 'gn') return;
      for (const m of ms) {
        if (m.target && (m.target.id === 'mapa' || enMapa(m.target.nodeType === 1 ? m.target : m.target.parentElement))) continue;
        if (m.type === 'childList') m.addedNodes.forEach(traducirArbol);
        else if (m.type === 'characterData') traducirTexto(m.target);
        else if (m.type === 'attributes') traducirAttr(m.target, m.attributeName);
      }
    });
    observadorIdioma.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRS_TR });
  }
  const TITULO_ES = document.title, DESC_META = document.querySelector('meta[name=description]'), DESC_ES = DESC_META ? DESC_META.content : '';
  function aplicarIdioma() {
    document.documentElement.lang = idioma === 'gn' ? 'gn' : 'es';
    $('btnIdioma').textContent = '🌐 ' + (idioma === 'gn' ? 'GN' : 'ES');
    if (idioma === 'gn') {
      traducirArbol(document.body); vigilarIdioma();
      document.title = 'Clima PY: ára marandu ha mapa Paraguái táva-gua';
      if (DESC_META) DESC_META.content = 'Clima PY: ára marandu ha mapa Paraguái táva-gua rehegua';
    } else {
      if (observadorIdioma) { observadorIdioma.disconnect(); observadorIdioma = null; }
      restaurarEspanol();
      document.title = TITULO_ES; if (DESC_META) DESC_META.content = DESC_ES;
    }
  }
  $('btnIdioma').addEventListener('click', () => {
    idioma = idioma === 'gn' ? 'es' : 'gn';
    guardar('clima-py-idioma', idioma);
    aplicarIdioma();
    aviso(idioma === 'gn' ? "Idioma: Avañe'ẽ (guaraní)" : 'Idioma: Español');
  });
  aplicarIdioma();

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
})();


if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
