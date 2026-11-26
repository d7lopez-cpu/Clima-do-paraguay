/* Clima PY — Ambiente: el estado del cielo que comparten el fondo animado, el paisaje y el sonido, y las preferencias de la animación.
 * Parte del código de la app, dividido por temas en js/01…12 (se cargan en orden desde index.html y comparten
 * las mismas variables). Usa GEO, definido en js/geo.js. */
'use strict';

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
