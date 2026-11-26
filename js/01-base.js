/* Clima PY — Datos geográficos, capas del mapa, estado de la app y funciones auxiliares (íconos, textos del clima, memoria del navegador).
 * Parte del código de la app, dividido por temas en js/01…12 (se cargan en orden desde index.html y comparten
 * las mismas variables). Usa GEO, definido en js/geo.js. */
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
  const INTERVALO = 15 * 60 * 1000;   // cada cuánto se actualiza solo (Open-Meteo renueva el clima de ahora cada 15 min)
  const nombreDep = n => n === 'Asunción' ? 'Asunción (capital)' : n;

  // ============ 2) CAPAS DEL MAPA ============
  // Cada capa dice qué dato mostrar, en qué rango y con qué colores.
  const CAPAS = {
    temp: { icono: 'sensacion', nombre: 'Temperatura', campo: 'temperature_2m', min: 5, max: 40, dec: 0, corto: '°', largo: '°C',
      color: v => escalaTemp(v), alto: ['calor', 'Más calurosa'], bajo: ['frio', 'Más fría'] },
    humedad: { icono: 'humedad', nombre: 'Humedad', campo: 'relative_humidity_2m', min: 20, max: 100, dec: 0, corto: '%', largo: '%',
      color: v => `hsl(${Math.round(45 + norm(v, 20, 100) * 170)}, 75%, 55%)`, alto: ['humedad', 'Más húmeda'], bajo: ['despejado', 'Más seca'] },
    viento: { icono: 'viento', nombre: 'Viento', campo: 'wind_speed_10m', min: 0, max: 40, dec: 0, corto: ' km/h', largo: ' km/h',
      color: v => `hsl(${Math.round(165 + norm(v, 0, 40) * 135)}, 75%, 55%)`, alto: ['viento', 'Más ventosa'], bajo: ['hoja', 'Más calma'] },
    lluvia: { icono: 'lluvia', nombre: 'Lluvia', campo: 'precipitation', min: 0, max: 4, dec: 1, corto: ' mm', largo: ' mm',
      color: v => { const x = norm(v, 0, 4); return `hsl(210, ${Math.round(18 + x * 67)}%, ${Math.round(68 - x * 30)}%)`; },
      alto: ['lluvia', 'Más lluvia'], bajo: ['despejado', 'Más seca'] }
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
  const paraTexto = c => esClaro() ? `oklch(from ${c} 0.5 calc(c * 1.35) h)` : `oklch(from ${c} 0.92 calc(c * 0.75) h)`;   // mismo tono: más oscuro en claro, más luminoso en oscuro (AA sobre el vidrio)
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
  // Íconos: sprite <svg id="iconos"> de index.html (lo genera scripts/iconos.mjs). Sin emojis en ninguna parte de la interfaz.
  const icono = (n, cl) => `<svg class="ic ic-${n}${cl ? ' ' + cl : ''}" aria-hidden="true" focusable="false"><use href="#i-${n}"/></svg>`;
  const CODIGOS = {
    0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Niebla', 48: 'Niebla con escarcha',
    51: 'Llovizna leve', 53: 'Llovizna', 55: 'Llovizna fuerte', 56: 'Llovizna helada', 57: 'Llovizna helada fuerte',
    61: 'Lluvia leve', 63: 'Lluvia', 65: 'Lluvia fuerte', 66: 'Lluvia helada', 67: 'Lluvia helada fuerte',
    71: 'Nieve leve', 73: 'Nieve', 75: 'Nieve fuerte', 77: 'Granizo fino',
    80: 'Chubascos leves', 81: 'Chubascos', 82: 'Chubascos fuertes', 85: 'Chubascos de nieve', 86: 'Chubascos de nieve fuertes',
    95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta fuerte con granizo'
  };
  // Código WMO → nombre del ícono (0–1 despejado, 2 parcial, 3 nublado, 45–48 niebla, 51–57 llovizna, 61–67 y 80–82 lluvia,
  // 71–77 y 85–86 frío (nieve, rarísima en Paraguay), 95 tormenta, 96–99 granizo); de noche, luna en vez de sol
  function nombreIcono(c, esDia) {
    const noche = esDia === 0;
    if (c <= 1) return noche ? 'noche-clara' : 'despejado';
    if (c === 2) return noche ? 'parcial-noche' : 'parcial';
    if (c === 3) return 'nublado';
    if (c === 45 || c === 48) return 'niebla';
    if (c >= 51 && c <= 57) return 'llovizna';
    if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return 'lluvia';
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'frio';
    if (c === 95) return 'tormenta';
    if (c >= 96 && c <= 99) return 'granizo';
    return 'sensacion';
  }
  function clima(codigo, esDia) {
    const t = CODIGOS[codigo], n = t ? nombreIcono(codigo, esDia) : 'sensacion';
    return { icono: n, svg: icono(n, 'ic-clima'), texto: t || 'Sin datos' };
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
