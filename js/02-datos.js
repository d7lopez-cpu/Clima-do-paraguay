/* Clima PY — Pedir datos: Open-Meteo (clima por lotes, detalle, ensambles, horas), archivo compartido de GitHub con frescura por ciudad, cupo de consultas y observaciones de aeropuertos (METAR).
 * Parte del código de la app, dividido por temas en js/01…12 (se cargan en orden desde index.html y comparten
 * las mismas variables). Usa GEO, definido en js/geo.js. */
'use strict';

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
  // ---- Frescura de cada dato ----
  // Cada clima trae `time`: el cuarto de hora de Open-Meteo al que corresponde, en hora de Asunción ("2026-11-24T20:45").
  // Con eso se sabe la edad REAL de cada ciudad, venga del archivo compartido, de Open-Meteo o de la memoria del celular.
  const FRESCO_MS = 25 * 60000;           // un dato con menos de 25 min está al día (Open-Meteo lo renueva cada 15)
  const fmtPY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Asuncion', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  function msDato(d) {
    const m = d && typeof d.time === 'string' && /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(d.time);
    if (!m) return 0;
    const supuesto = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]), p = {};
    fmtPY.formatToParts(new Date(supuesto)).forEach(x => { p[x.type] = x.value; });
    return supuesto - (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute) - supuesto);   // hora de Asunción → instante real
  }
  const viejo = c => !datos[c.n] || Date.now() - msDato(datos[c.n]) > FRESCO_MS;
  // Cupo de consultas a Open-Meteo desde este dispositivo (su límite gratuito: 5000 por hora y 10 000 por día por red; cada ciudad
  // de un pedido cuenta como una). Se lleva la cuenta en el dispositivo y se queda por debajo, con margen para las otras pestañas.
  const CUPO_HORA = 2500, CUPO_DIA = 8000;
  function registroConsultas() { const r = leerJSON('clima-py-consultas', []); return Array.isArray(r) ? r.filter(x => Array.isArray(x) && Date.now() - x[0] < 86400000) : []; }
  function cupoConsultas() {
    const r = registroConsultas(), hora = r.filter(x => Date.now() - x[0] < 3600000).reduce((a, x) => a + x[1], 0), dia = r.reduce((a, x) => a + x[1], 0);
    return Math.max(0, Math.min(CUPO_HORA - hora, CUPO_DIA - dia));
  }
  function anotarConsultas(n) { if (n > 0) { const r = registroConsultas(); r.push([Date.now(), n]); guardar('clima-py-consultas', JSON.stringify(r.slice(-400))); } }
  async function cargarCompartidos() {
    const base = baseCompartida();
    if (!base) return null;
    try {
      const j = await pedir(`${base}/datos.json?v=${Math.floor(Date.now() / 300000)}`, 8000, 0);
      if (!j || !j.datos || !esNumero(j.t)) return null;
      let nuevos = 0;
      Object.keys(j.lugares || {}).forEach(n => { const v = j.lugares[n]; if (v && v.dep && esNumero(v.lat) && esNumero(v.lon) && sumarLugar(n, v.dep, v.lat, v.lon)) nuevos++; });
      if (nuevos) pintarConteos();
      // Se usa cada ciudad del archivo solo si es MÁS NUEVA que la que ya hay (antes un archivo atrasado pisaba datos más recientes)
      let usadas = 0;
      CIUDADES.forEach(c => { const d = j.datos[c.n]; if (d && esNumero(d.temperature_2m) && (!datos[c.n] || msDato(d) >= msDato(datos[c.n]))) { datos[c.n] = d; usadas++; } });
      if (!usadas) return null;
      usoCompartido = true;
      return { t: j.t };
    } catch (e) { return null; }
  }
  async function cargarTodas(forzar) {
    // 1) Todo lo guardado en el dispositivo sigue al día: no se pide nada (abrir la app varias veces seguidas no gasta consultas)
    if (!forzar && hayDatos && CIUDADES.every(c => c.g === 4 || !viejo(c))) return { ok: 1, total: 1, omitido: true };
    // 2) Archivo compartido (lo publica GitHub; puede llegar atrasado: de cada ciudad se toma solo si es más nuevo)
    const comp = await cargarCompartidos();
    // 3) Directo a Open-Meteo, SOLO las ciudades cuyo dato tiene más de 25 min, de la más importante a la menos: la elegida, las
    //    favoritas y luego por tamaño. Las localidades chicas (g 4) cada ~55 min. Así, aunque GitHub se atrase horas, el mapa
    //    queda al día; y cuando el archivo llega fresco, no se pide nada.
    const caducan = Date.now() - ultimaExtras > EXTRAS_MS;
    const primero = c => c.n === seleccionada ? 0 : favoritas.has(c.n) ? 1 : c.g + 1;
    let lista = CIUDADES.filter(c => viejo(c) && (c.g < 4 || caducan || !datos[c.n] || favoritas.has(c.n) || c.n === seleccionada))
      .sort((a, b) => primero(a) - primero(b));
    const cupo = cupoConsultas();
    if (lista.length > cupo) lista = lista.filter((c, i) => i < cupo || primero(c) <= 1);   // sin cupo, igual la elegida y las favoritas
    const lotes = [];
    for (let i = 0; i < lista.length; i += TAM_LOTE) lotes.push(lista.slice(i, i + TAM_LOTE));
    let ok = 0;
    if (lotes.length) {
      const res = await Promise.allSettled(lotes.map(async lote => {
        const url = `${OM.clima}?latitude=${lote.map(c => c.lat).join(',')}` +
          `&longitude=${lote.map(c => c.lon).join(',')}` +
          `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code,is_day&timezone=America%2FAsuncion`;
        anotarConsultas(lote.length);
        const json = await pedirClima(url);
        (Array.isArray(json) ? json : [json]).forEach((d, i) => { if (d && d.current && lote[i]) datos[lote[i].n] = d.current; });
      }));
      ok = res.filter(r => r.status === 'fulfilled').length;
      if (!ok && !comp) throw res[0].reason;
    }
    if (caducan) ultimaExtras = Date.now();
    return { ok: lotes.length ? ok : 1, total: lotes.length || 1 };
  }

  // ---- Probabilidad de lluvia: se calcula con ensambles (muchas simulaciones) de 4 modelos, no con el valor básico ----
  const OM_ENS = 'https://ensemble-api.open-meteo.com/v1/ensemble';
  const MODELOS_ENS = ['ecmwf_ifs025', 'gfs025', 'icon_seamless', 'gem_global'];
  const aMultiplo5 = p => Math.round(p * 20) * 5;
  const promedio = a => a.reduce((x, y) => x + y, 0) / a.length;
  function pedirEnsamble(c) {
    const url = `${OM_ENS}?latitude=${c.lat}&longitude=${c.lon}&models=${MODELOS_ENS.join(',')}&hourly=precipitation,temperature_2m&timezone=America%2FAsuncion&forecast_days=7`;
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
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,visibility` +
      `&hourly=temperature_2m,precipitation_probability,weather_code,is_day,uv_index&minutely_15=precipitation` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset` +
      `&timezone=America%2FAsuncion&forecast_days=7`;
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
      ? `${icono('dato')}<b>Dato medido</b> (temperatura, humedad, viento y presión) en el ${lugar}, a ${km} km, hace ${haceTxt(s.t)}: ${grados(s.temp)}${UT()}.`
      : `${icono('dato')}<b>Referencia real:</b> el ${lugar}, a ${km} km, midió ${grados(s.temp)}${UT()} hace ${haceTxt(s.t)}.`;
    if (esNumero(s.dif)) txt += usada ? ` El modelo calculaba ${grados(s.modelo)}${UT()} (${difTxt(s.dif)}).` : ` En ese punto el modelo calculaba ${grados(s.modelo)}${UT()} (${difTxt(s.dif)}).`;
    const v = estaciones.filter(x => esNumero(x.dif));
    if (v.length >= 3) {
      const err = promedio(v.map(x => Math.abs(x.dif))), sesgo = promedio(v.map(x => x.dif));
      txt += `<br>Hoy, en ${v.length} aeropuertos del país, el modelo se desvía en promedio ${(usaF ? err * 1.8 : err).toFixed(1).replace('.', ',')}°${UT()} (sesgo ${difTxt(sesgo)}).`;
    }
    return `<div class="verif">${txt}</div>`;
  }
