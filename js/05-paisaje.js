/* Clima PY — Paisaje animado de la portada (río, colinas, palmeras, clima, Navidad), cielo de fondo de toda la pantalla, fuegos artificiales y calidad automática.
 * Parte del código de la app, dividido por temas en js/01…12 (se cargan en orden desde index.html y comparten
 * las mismas variables). Usa GEO, definido en js/geo.js. */
'use strict';

  // ============ PAISAJE ANIMADO (el cuadro de arriba) ============
  // Un paisaje del río con colinas y palmeras que cambia con el clima de la ciudad elegida y con la hora. Todo se dibuja aquí mismo.
  const ec = $('escenaCv'), ex = ec.getContext('2d');
  let eW = 0, eH = 0, eD = 1, eClave = '', eFirma = '', eNubes = [], eAves = [], eLuci = [], eEstr = [], eGotas = [], eGranizo = [], eHojas = [], ePetalos = [], eOndas = [], eNiebla = [], eRayo = null, eFugaz = null;
  let eTexNiebla = null, eSprLuci = null, eSombra = null, ultRayoT = -1, reGolpe = 0;
  let eSprGuir = null, eNuevo = { t: -1e9, si: false }, eLuces = [], eViaL = null, eCharcos = [], eMoj = -1, eFoto = null, eFundido = 0, eEtq = [], eEtqSucio = true;        // fundido entre escenas · zonas ocupadas por las etiquetas
  const vAst = { ok: false, sx: 0, sy: 0, so: 0, mx: 0, my: 0, mf: 0 };   // sol y luna suavizados (no saltan al cambiar de momento del día)
  // Paralaje: el puntero sobre el cuadro (o la inclinación del celular, donde el navegador la da sin pedir permiso) corre un poco
  // cada capa según su distancia: lo lejano casi nada, las palmeras y la orilla lo que más. Nunca con movimiento reducido.
  const par = { x: 0, y: 0, tx: 0, ty: 0, b0: null, g0: null };
  if (!REDUCIDO) {
    const sec = $('escena');
    if (sec) {
      sec.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const r = sec.getBoundingClientRect(); if (!r.width) return; par.tx = limitar((e.clientX - r.left) / r.width * 2 - 1, -1, 1); par.ty = limitar((e.clientY - r.top) / r.height * 2 - 1, -1, 1); }, { passive: true });
      sec.addEventListener('pointerleave', () => { par.tx = par.ty = 0; }, { passive: true });
    }
    // deviceorientation: Android lo da sin pedir nada; iOS exige pedir permiso y entonces simplemente no llega (no se pide).
    // Se mide respecto de cómo se sostiene el celular (la referencia se acomoda despacio), así no queda torcido.
    addEventListener('deviceorientation', e => {
      if (e.beta == null || e.gamma == null) return;
      const ang = (screen.orientation && screen.orientation.angle) || 0, de = ang % 180 ? [e.beta, e.gamma] : [e.gamma, e.beta];
      const gx = ang === 90 || ang === 180 ? -de[0] : de[0], by = ang === 180 || ang === 270 ? -de[1] : de[1];
      if (par.g0 === null) { par.g0 = gx; par.b0 = by; }
      par.g0 += (gx - par.g0) * 0.01; par.b0 += (by - par.b0) * 0.01;
      par.tx = limitar((gx - par.g0) / 18, -1, 1); par.ty = limitar((by - par.b0) / 18, -1, 1);
    }, { passive: true });
  }
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
  const vientoVis = () => (amb.viento || 0) + (amb.tipo === 'tormenta' ? 25 : 0);   // la tormenta siempre trae ráfagas (inclinan la lluvia y mecen las palmeras)
  // las hojas, en cambio, siguen al viento real: con tormenta solo un poco más (antes una tormenta sin viento se llenaba de hojas)
  const vientoHojas = () => (amb.viento || 0) + (amb.tipo === 'tormenta' ? 6 : 0);
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
  // En vez de saltar de un color a otro, cada cuadro se acerca un poco al color objetivo (unos 2 s en total).
  // Lo que se vuelve a sortear (nubes, gotas, hojas…) no salta: se funde con el último cuadro de la escena anterior (fotoFundido).
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
    const o = objetivosVisuales(), c = vEsc.crudo, k = quieto || !c ? 1 : 1 - Math.exp(-dt / 650);   // ~2 s hasta el color nuevo
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

  // Fundido entre escenas: se guarda el último cuadro y se lo dibuja encima, cada vez más transparente, durante ~1,4 s
  function fotoFundido() {
    if (!eFoto) eFoto = document.createElement('canvas');
    if (eFoto.width !== ec.width || eFoto.height !== ec.height) { eFoto.width = ec.width; eFoto.height = ec.height; }
    const g = eFoto.getContext('2d'); g.clearRect(0, 0, eFoto.width, eFoto.height); g.drawImage(ec, 0, 0); eFundido = 1;
  }
  // Rectángulos (en px del cuadro) que tapan las etiquetas: el sol, la luna y la estrella se corren hacia abajo para no quedar debajo.
  // Se miden solo cuando cambian (texto nuevo, tamaño o fuente), nunca en cada cuadro.
  const vigiaEtq = 'ResizeObserver' in window ? new ResizeObserver(() => { eEtqSucio = true; }) : null;
  function zonasEtq() {
    if (!eEtqSucio) return eEtq;
    eEtqSucio = false; eEtq = [];
    const r0 = ec.getBoundingClientRect(), caja = $('escenaEtq');
    if (caja && r0.width) for (const e of caja.children) { const r = e.getBoundingClientRect(); if (r.width) eEtq.push([r.left - r0.left - 4, r.top - r0.top - 4, r.right - r0.left + 4, r.bottom - r0.top + 4]); }
    return eEtq;
  }
  function libreDeEtq(x, y, r) {                                  // la altura más alta, desde y hacia abajo, en la que un disco de radio r no toca ninguna etiqueta
    for (const [a, b, c, d] of zonasEtq()) if (x + r > a && x - r < c && y + r > b && y - r < d) y = d + r;
    return y;
  }
  // Vía Láctea: un arco de luz lechosa con una franja de polvo oscuro, dibujado una vez por tamaño (a baja resolución y luego
  // ampliado: así queda difuso) con estrellitas finas encima. Al pintar solo se copia.
  function texturaViaLactea(w, h) {
    const lw = Math.ceil(w / 4), lh = Math.ceil(h / 4), lo = document.createElement('canvas'); lo.width = lw; lo.height = lh;
    const g = lo.getContext('2d'), pto = u => { const v = 1 - u; return [lw * (-0.05 * v * v + 2 * 0.5 * u * v + 1.05 * u * u), lh * (0.95 * v * v + 2 * 0.02 * u * v + 0.6 * u * u)]; };
    for (let i = 0; i < 160; i++) {
      const u = Math.random(), [x, y] = pto(u), d = (Math.random() + Math.random() - 1) * lh * 0.16, r = lh * (0.06 + Math.random() * 0.12);
      const gr = g.createRadialGradient(x, y + d, 0, x, y + d, r); gr.addColorStop(0, `rgba(205,212,255,${0.05 + Math.random() * 0.06})`); gr.addColorStop(1, 'rgba(205,212,255,0)');
      g.fillStyle = gr; g.fillRect(x - r, y + d - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'destination-out';                 // la franja de polvo que parte la Vía Láctea
    for (let i = 0; i < 50; i++) {
      const u = 0.15 + Math.random() * 0.7, [x, y] = pto(u), r = lh * (0.03 + Math.random() * 0.05);
      const gr = g.createRadialGradient(x, y + lh * 0.02, 0, x, y + lh * 0.02, r); gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y + lh * 0.02 - r, r * 2, r * 2);
    }
    const c = document.createElement('canvas'); c.width = Math.ceil(w * eD); c.height = Math.ceil(h * eD);
    const f = c.getContext('2d'); f.drawImage(lo, 0, 0, c.width, c.height);
    f.fillStyle = 'rgba(235,240,255,0.55)';
    for (let i = 0; i < 260; i++) { const [x, y] = pto(Math.random()), d = (Math.random() + Math.random() - 1) * lh * 0.13; f.fillRect(x * 4 * eD, (y + d) * 4 * eD, eD * 0.7, eD * 0.7); }
    return c;
  }
  // ¿Llovió hace poco? 1 si llovió la hora anterior, 0,67 hace dos, 0,33 hace tres; 0 si no (con el pronóstico por horas del detalle)
  function charcosRecientes(d) {
    const h = d && d.hourly; if (!h || !Array.isArray(h.time) || !Array.isArray(h.weather_code)) return 0;
    const ahora = horaAsuncion(), i = h.time.findIndex(x => String(x).startsWith(ahora)); if (i < 1) return 0;
    for (let j = 1; j <= 3 && i - j >= 0; j++) { const c = h.weather_code[i - j]; if ((c >= 51 && c <= 82) || c >= 95) return 1 - (j - 1) / 3; }
    return 0;
  }
  function armarEscena() {
    const A = amb, simple = !prefsAnim.paisaje || !fx, part = g => !simple && efectoActivo(g), yAgua = eH * 0.74;
    const grandes = A.tipo === 'nublado' || A.tipo === 'lluvia' || A.tipo === 'tormenta', abierto = A.tipo === 'despejado' || A.tipo === 'parcial';
    const nN = { despejado: 2, parcial: 4, nublado: 6, niebla: 0, lluvia: 7, tormenta: 7 }[A.tipo];
    // las nubes dicen qué clima hace: su cantidad varía menos que la de las demás partículas
    // en 3 capas (z): lejanas (chicas, bajas, lentas y desvaídas), medias y cercanas (grandes, altas y más rápidas)
    for (const k of [...ePre.keys()]) if (k.startsWith('nube')) ePre.delete(k);   // las nubes nuevas traen otros tamaños
    eNubes = efectoActivo('nubes') ? Array.from({ length: Math.round(nN * limitar(multFx(), 0.7, 1.3)) }, (_, i) => {
      const z = (i + 1) % 3, y = grandes ? [0.2, 0.08, 0.02][z] + Math.random() * [0.12, 0.18, 0.16][z] : [0.27, 0.1, 0.05][z] + Math.random() * [0.12, 0.25, 0.2][z];
      return { x: Math.random() * eW, y: eH * y, r: eH * (0.06 + Math.random() * 0.06) * (grandes ? 1.6 : 1) * [0.6, 0.95, 1.2][z], v: (0.008 + Math.random() * 0.014) * [0.45, 1, 1.6][z], z };
    }).sort((a, b) => a.z - b.z) : [];
    eAves = part('fauna') && A.tipo !== 'lluvia' && A.tipo !== 'tormenta' && A.tipo !== 'niebla' ? Array.from({ length: Math.max(1, cant(4)) }, () => ({ x: Math.random() * eW, y: eH * (0.12 + Math.random() * 0.25), v: 0.03 + Math.random() * 0.03, f: Math.random() * 6.28, s: eH * (0.025 + Math.random() * 0.02) })) : [];
    eLuci = part('fauna') && A.lluvia === 0 && A.tipo !== 'niebla' ? Array.from({ length: cant(16) }, () => ({ x: Math.random() * eW, y: eH * (0.55 + Math.random() * 0.4), f: Math.random() * 6.28, v: 0.0004 + Math.random() * 0.0006 })) : [];
    eViaL = part('estrellas') && abierto ? texturaViaLactea(eW, eH * 0.62) : null;
    // luces de una ciudad lejana sobre la colina, junto al agua (en 3 grupos), solo se ven al anochecer y de noche
    eLuces = [];
    for (let i = 0, n = Math.max(10, cant(28)); i < n; i++) {
      const cx0 = [0.36, 0.5, 0.63][i % 3], x = eW * (cx0 + (Math.random() + Math.random() - 1) * 0.07), techo = altColina(x) + 2;
      if (techo > yAgua - 3) continue;
      eLuces.push({ x, y: Math.max(techo, yAgua - 2 - Math.random() * eH * 0.04), r: 0.6 + Math.random() * 0.7, c: Math.random() < 0.8 ? 0 : 1, k: i % 3 });
    }
    eEstr = part('estrellas') && abierto ? Array.from({ length: cant(45) }, () => ({ x: Math.random() * eW, y: Math.random() * eH * 0.5, r: 0.4 + Math.random() * 1.1 })) : [];
    // gotas en dos planos: lejanas (cortas, lentas, tenues) y cercanas (largas y más claras)
    eGotas = part('lluvia') ? Array.from({ length: cant(A.lluvia * 70 * (A.granizo ? 0.6 : 1)) }, () => { const z = Math.random() < 0.55 ? 0 : 1; return { x: Math.random() * eW, y: Math.random() * eH, l: eH * (0.05 + Math.random() * 0.05) * (z ? 1.15 : 0.6), v: (0.6 + Math.random() * 0.5) * (z ? 1.1 : 0.75), z }; }) : [];
    // charcos en las orillas (durante la lluvia y un rato después): posiciones fijas dentro de la tierra
    eCharcos = efectoActivo('lluvia') ? [[0.04, 0.9, 1], [0.12, 0.95, 0.8], [0.09, 0.84, 0.6], [0.95, 0.88, 0.9], [0.87, 0.95, 0.75]].map(([x, y, k]) => ({ x: eW * x, y: eH * y, rx: Math.min(eW * 0.035, eH * 0.28) * k, ry: eH * 0.017 * (0.7 + k * 0.4) })) : [];
    const nuevoGranizo = g => Object.assign(g, { x: Math.random() * eW, y: -Math.random() * eH * 0.4, vy: 0.3 + Math.random() * 0.2, vx: vientoVis() / 900, r: 1 + Math.random() * 1.3, suelo: yAgua + 3 + Math.random() * (eH - yAgua - 6), reb: 0 });
    eGranizo = part('lluvia') && A.granizo ? Array.from({ length: cant(34) }, () => { const g = nuevoGranizo({ nuevo: nuevoGranizo }); g.y = Math.random() * eH * 0.7; return g; }) : [];
    eHojas = part('viento') ? Array.from({ length: cant(limitar((vientoHojas() - 12) / 25, 0, 1) * 18) }, () => ({ x: Math.random() * eW, y: eH * (0.35 + Math.random() * 0.6), v: 0.6 + Math.random() * 0.7, f: Math.random() * 6.28, a: Math.random() * 6.28, g: (Math.random() - 0.5) * 0.02, l: 1.6 + Math.random() * 1.8 })) : [];
    // flores que caen del lapacho de la orilla: siempre unas pocas, más de julio a septiembre (plena floración)
    ePetalos = part('especiales') ? Array.from({ length: cant(mesLapacho() ? 16 : 6) }, () => ({ x: 0, y: -1, v: 0.5 + Math.random() * 0.5, f: Math.random() * 6.28 })) : [];
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
  const BOLITAS = [[0, 0, 1], [-0.9, 0.2, 0.7], [0.9, 0.15, 0.75], [-0.4, -0.45, 0.65], [0.45, -0.4, 0.6], [1.5, 0.3, 0.5], [-1.5, 0.3, 0.5]];
  // Una nube suave: bolitas fundidas con el borde apenas difuso; arriba la luz del cielo, abajo la panza en sombra, y cada bolita
  // con su brillo. Se dibuja una vez por nube y por color (los colores cambian despacio con la hora y el clima).
  function nubeSuave(r, z, cc, panza, forzar) {
    const R0 = Math.max(4, Math.round(r)), w = R0 * 4.6, h = R0 * 2.7;
    return pre('nube' + z + '_' + R0, [cc, panza].join(), w, h, forzar, g => {
      const cx = R0 * 2.3, cy = R0 * 1.35, luz = mezA(aRgb(cc), [255, 255, 255], z ? 0.3 : 0.1).map(Math.round).join(','), sombra = z ? mezA(aRgb(cc), aRgb(panza), 0.8).map(Math.round).join(',') : cc;
      g.filter = `blur(${Math.max(0.6, R0 * 0.05)}px)`;
      const gr = g.createLinearGradient(0, cy - R0 * 1.1, 0, cy + R0 * 0.9); gr.addColorStop(0, `rgb(${luz})`); gr.addColorStop(0.55, `rgb(${cc})`); gr.addColorStop(1, `rgb(${sombra})`);
      g.fillStyle = gr; g.beginPath();
      for (const [dx, dy, k] of BOLITAS) { g.moveTo(cx + dx * R0 + R0 * k, cy + dy * R0); g.arc(cx + dx * R0, cy + dy * R0, R0 * k, 0, 6.283); }
      g.fill(); g.filter = 'none';
      if (z) {                                                      // brillo de cada bolita, arriba a la izquierda
        g.globalCompositeOperation = 'source-atop';
        for (const [dx, dy, k] of BOLITAS) {
          const x = cx + (dx - 0.25 * k) * R0, y = cy + (dy - 0.35 * k) * R0, rb = R0 * k * 0.9, gb = g.createRadialGradient(x, y, 0, x, y, rb);
          gb.addColorStop(0, 'rgba(255,255,255,0.28)'); gb.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gb; g.fillRect(x - rb, y - rb, rb * 2, rb * 2);
        }
        g.globalCompositeOperation = 'source-over';
      }
    });
  }
  function nubeRuta(x, y, r) {                                     // una nube: varias bolitas que se funden en una sola forma (se suma al trazo abierto)
    for (const [dx, dy, k] of BOLITAS) { ex.moveTo(x + dx * r + r * k, y + dy * r); ex.arc(x + dx * r, y + dy * r, r * k, 0, 6.283); }
  }
  // ---- Piezas del paisaje dibujadas de antemano (con detalle) y reutilizadas en cada cuadro ----
  // Colinas con monte, orillas con pasto y camino, copa de las palmeras y el lapacho: cada una se dibuja UNA vez en un lienzo aparte
  // y en cada cuadro solo se copia (barato aunque tenga miles de trazos). Se rehace si cambian sus colores o el tamaño; mientras los
  // colores se funden (cambio de hora o de clima, unos segundos) se rehace como mucho 4 veces por segundo.
  const ePre = new Map();
  function pre(nombre, clave, w, h, forzar, dibujar) {
    const e = ePre.get(nombre), ahora = performance.now(), W = Math.ceil(w * eD), H = Math.ceil(h * eD);
    if (e && e.clave === clave && e.W === W && e.H === H) return e.c;
    if (e && !forzar && e.W === W && e.H === H && ahora - e.t < 250) return e.c;
    const c = e && e.W === W && e.H === H ? e.c : document.createElement('canvas');
    if (c.width !== W) c.width = W; if (c.height !== H) c.height = H;
    const g = c.getContext('2d'); g.setTransform(eD, 0, 0, eD, 0, 0); g.clearRect(0, 0, w, h); dibujar(g);
    ePre.set(nombre, { clave, c, t: ahora, W, H });
    return c;
  }
  // números «al azar» pero siempre los mismos (así el monte, el pasto y las ramas no cambian de forma al redibujarse)
  const semilla = n => () => (n = (n * 16807) % 2147483647) / 2147483647;
  const oscuro = (c, k) => mezcla(c, '#000000', k), claro = (c, k) => mezcla(c, '#ffffff', k);

  // Colina: ladera con degradé (la luz viene de arriba) cubierta de monte: copas de árboles apretadas en la cresta y en manchones
  // sobre la ladera, con pastizales entre medio. La lejana, con copas chicas y poco contraste (la bruma se las come).
  function colinaEsc(y0, amp, f1, f2, ph, color, cerca, forzar) {
    const W = eW + 32, top = Math.max(0, Math.floor(y0 - amp - eH * 0.05)), H = eH - top;
    const cresta = xc => y0 - amp * (Math.sin((xc - 16) / eW * 6.283 * f1 + ph) * 0.6 + Math.sin((xc - 16) / eW * 6.283 * f2 + ph * 2.3) * 0.4) - top;
    const c = pre('colina' + f1, [color, eW, eH].join(), W, H, forzar, g => {
      const R = semilla(f1 * 977 + 13), gr = g.createLinearGradient(0, y0 - amp - top, 0, H);
      gr.addColorStop(0, claro(color, cerca ? 0.1 : 0.05)); gr.addColorStop(0.4, color); gr.addColorStop(1, oscuro(color, cerca ? 0.22 : 0.1));
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 6) g.lineTo(x, cresta(x));
      g.lineTo(W, H); g.closePath(); g.fill();
      // pastizal: motas finas
      g.fillStyle = oscuro(color, 0.12); g.globalAlpha = 0.35; g.beginPath();
      for (let i = 0; i < W * 0.6; i++) { const x = R() * W, y = cresta(x) + R() * (H - cresta(x)); g.moveTo(x + 0.8, y); g.arc(x, y, 0.4 + R() * 0.6, 0, 6.283); }
      g.fill(); g.globalAlpha = 1;
      // monte: muchas copas chicas y apretadas (textura de bosque visto de lejos), en la cresta y en manchones sobre la ladera, con
      // pastizales entre medio. Cuatro tonos: hueco oscuro, copa, copa más clara y la luz arriba a la izquierda.
      const rr = eH * (cerca ? 0.0085 : 0.0055), copas = [];
      const bosque = x => Math.sin(x * 0.017 + ph) + Math.sin(x * 0.043 + ph * 2) * 0.7 + Math.sin(x * 0.11 + ph * 5) * 0.3;
      for (let x = 0; x < W; x += rr * (0.5 + R() * 0.6)) {
        if (bosque(x) < -0.9) continue;                                                   // claros en la cresta
        for (let j = 0; j < 2; j++) { const r = rr * (0.7 + R() * 0.7); copas.push([x + R() * rr, cresta(x) + r * (0.3 + R() * 0.9) + j * rr * 1.2, r]); }
      }
      for (let i = 0; i < W * H / (rr * rr) * 0.22; i++) {           // manchones en la ladera, más grandes abajo (más cerca)
        const x = R() * W, base = cresta(x), y = base + rr + R() * (H - base) * 0.75;
        if (bosque(x) + (y - base) / H * 1.5 > 0.9 + Math.sin(y * 0.09 + x * 0.01) * 0.4) continue;
        copas.push([x, y, rr * (0.7 + R() * 0.7) * (1 + (y - base) / H * 0.8)]);
      }
      copas.sort((a, b) => a[1] - b[1]);
      const tonos = [[oscuro(color, cerca ? 0.22 : 0.1), 0.18, 0.28, 1.05], [oscuro(color, cerca ? 0.1 : 0.05), 0, 0, 0.92], [mezcla(color, '#6f8a3a', cerca ? 0.07 : 0.03), -0.15, -0.2, 0.55], [claro(color, cerca ? 0.05 : 0.025), -0.3, -0.4, 0.28]];
      for (const [col, dx, dy, k] of tonos) {
        g.fillStyle = col; g.beginPath();
        for (const [x, y, r] of copas) { const X = x + dx * r, Y = y + dy * r; g.moveTo(X + r * k, Y); g.arc(X, Y, r * k, 0, 6.283); }
        g.fill();
      }
      if (cerca) for (const [fx0, col] of LAPACHOS) {                 // lapachos lejanos en flor (rosados y uno amarillo) asomando sobre el monte
        const x = eW * fx0 + 16, y = cresta(x) + rr * 1.5, sz = eH * 0.05, flor = mezcla(col, color, 0.3);
        g.strokeStyle = oscuro(color, 0.35); g.lineWidth = Math.max(1, sz * 0.07); g.lineCap = 'round'; g.beginPath();
        g.moveTo(x, y); g.lineTo(x, y - sz * 0.55); g.moveTo(x, y - sz * 0.45); g.lineTo(x - sz * 0.3, y - sz * 0.85); g.moveTo(x, y - sz * 0.5); g.lineTo(x + sz * 0.32, y - sz * 0.82); g.stroke();
        for (const [cf, dy, n, k] of [[oscuro(flor, 0.3), 0.08, 34, 1], [flor, 0, 40, 1], [claro(flor, 0.3), -0.1, 16, 0.8]]) {
          g.fillStyle = cf; g.beginPath();
          for (let i = 0; i < n; i++) { const a = Math.PI * (1.05 + R() * 0.9), d = Math.sqrt(R()), px = x + Math.cos(a) * d * sz * 0.55, py = y - sz * 0.62 + Math.sin(a) * d * sz * 0.42 + dy * sz, r = Math.max(0.6, sz * 0.05) * (0.7 + R() * 0.8) * k; g.moveTo(px + r, py); g.arc(px, py, r, 0, 6.283); }
          g.fill();
        }
      }
    });
    ex.drawImage(c, -16, top, W, H);
    return { c, top };
  }

  // Orillas: pasto con matas de hojas finas (más grandes cuanto más cerca), borde mojado junto al agua y un camino de tierra colorada
  // con huellas y piedritas que baja hasta el río.
  function orillasEsc(col, kLuz, kNb, forzar) {
    const yA = eH * 0.74, top = Math.floor(yA - eH * 0.06), W = eW + 24, H = eH - top, os = 1 - kLuz;
    const c = pre('orillas', [col, Math.round(kLuz * 20), Math.round(kNb * 20), eW, eH].join(), W, H, forzar, g => {
      const R = semilla(4711);
      g.translate(12, -top);
      const izq = new Path2D(), der = new Path2D();
      izq.moveTo(-12, eH); izq.lineTo(-12, yA - eH * 0.05); izq.lineTo(0, yA - eH * 0.05); izq.quadraticCurveTo(eW * 0.2, yA - eH * 0.02, eW * 0.3, eH); izq.closePath();
      der.moveTo(eW + 12, eH); der.lineTo(eW + 12, yA - eH * 0.04); der.lineTo(eW, yA - eH * 0.04); der.quadraticCurveTo(eW * 0.84, yA - eH * 0.01, eW * 0.72, eH); der.closePath();
      const gr = g.createLinearGradient(0, yA - eH * 0.05, 0, eH); gr.addColorStop(0, claro(col, 0.08)); gr.addColorStop(0.5, col); gr.addColorStop(1, oscuro(col, 0.25));
      g.fillStyle = gr; g.fill(izq); g.fill(der);
      // borde mojado: una línea clara donde la tierra toca el agua
      g.strokeStyle = `rgba(255,255,255,${0.05 + 0.1 * kLuz})`; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(0, yA - eH * 0.05); g.quadraticCurveTo(eW * 0.2, yA - eH * 0.02, eW * 0.3, eH); g.moveTo(eW, yA - eH * 0.04); g.quadraticCurveTo(eW * 0.84, yA - eH * 0.01, eW * 0.72, eH); g.stroke();
      // camino de tierra colorada
      const tierra = mezcla(mezcla('#a9482a', col, 0.15 + os * 0.5), '#cfd6da', kNb * 0.4), cam = new Path2D();
      cam.moveTo(eW * 0.04, eH); cam.quadraticCurveTo(eW * 0.12, eH * 0.9, eW * 0.172, eH * 0.79); cam.lineTo(eW * 0.2, eH * 0.805); cam.quadraticCurveTo(eW * 0.17, eH * 0.9, eW * 0.16, eH); cam.closePath();
      const gt = g.createLinearGradient(0, eH * 0.79, 0, eH); gt.addColorStop(0, oscuro(tierra, 0.15)); gt.addColorStop(1, claro(tierra, 0.06));
      g.fillStyle = gt; g.fill(cam);
      g.save(); g.clip(cam);
      g.strokeStyle = oscuro(tierra, 0.22); g.lineWidth = 1.4; g.globalAlpha = 0.6; g.beginPath();      // huellas de las ruedas
      for (const k of [0.3, 0.7]) { g.moveTo(eW * (0.04 + 0.12 * k), eH); g.quadraticCurveTo(eW * (0.12 + 0.04 * k), eH * 0.9, eW * (0.174 + 0.024 * k), eH * 0.8); }
      g.stroke(); g.globalAlpha = 1;
      g.fillStyle = claro(tierra, 0.25); g.beginPath();                                                  // piedritas
      for (let i = 0; i < 60; i++) { const y = eH * (0.8 + R() * 0.2), x = eW * (0.04 + R() * 0.17); g.moveTo(x + 0.7, y); g.arc(x, y, 0.4 + R() * 0.6 * (y / eH), 0, 6.283); }
      g.fill(); g.restore();
      // pasto: matas de 3 a 5 hojas, en tres tonos
      const tonos = [oscuro(col, 0.3), claro(col, 0.1), mezcla(col, '#a9b85a', 0.25 * kLuz)], lineas = [new Path2D(), new Path2D(), new Path2D()];
      for (let i = 0; i < eW * 1.5; i++) {
        const lado = R() < 0.5, x = lado ? R() * eW * 0.3 : eW * (0.72 + R() * 0.28), y = yA - eH * 0.05 + R() * (eH - yA + eH * 0.05);
        if (!g.isPointInPath(lado ? izq : der, (x + 12) * eD, (y - top) * eD) || g.isPointInPath(cam, (x + 12) * eD, (y - top) * eD)) continue;
        const h = eH * (0.009 + 0.02 * (y - yA) / (eH - yA)) * (0.6 + R() * 0.6), n = 3 + Math.floor(R() * 3), L = lineas[Math.floor(R() * 3)];
        for (let k = 0; k < n; k++) { const a = (k / (n - 1) - 0.5) * 1.1 + (R() - 0.5) * 0.3; L.moveTo(x, y); L.quadraticCurveTo(x + Math.sin(a) * h * 0.4, y - h * 0.6, x + Math.sin(a) * h * 0.8, y - h * Math.cos(a)); }
      }
      g.lineWidth = Math.max(0.6, eH * 0.0024); g.lineCap = 'round';
      lineas.forEach((L, i) => { g.strokeStyle = tonos[i]; g.stroke(L); });
    });
    ex.drawImage(c, -12, top, W, H);
  }

  // Karanda'y (la palmera del Chaco y de los esteros): tronco fino, liso y gris con anillos, y una copa redonda de hojas en abanico,
  // rígidas y de un verde grisáceo: las de arriba apuntan al cielo, las del costado salen derechas y las de abajo se doblan. Cada hoja
  // es un abanico relleno con sus nervios. La copa se dibuja aparte y se mece entera con el viento.
  function copaKaranday(g, s, base, luz, R) {
    const w = s * 0.5, h = s * 0.46, cx = w / 2, cy = h * 0.48, hojas = [];
    for (let k = 0; k < 22; k++) {
      const a = -Math.PI / 2 + (k / 22) * 6.283 + (R() - 0.5) * 0.25, abajo = Math.sin(a);   // abajo: 1 si apunta al suelo
      if (abajo > 0.75 && R() < 0.6) continue;
      hojas.push({ a, L: s * (0.085 + R() * 0.03) * (abajo > 0.3 ? 0.85 : 1), pet: s * (0.035 + R() * 0.02), cae: Math.max(0, abajo) * 0.5 + 0.12, z: Math.cos(a * 1.3 + 0.8) + R() * 0.6 });
    }
    hojas.sort((p, q) => p.z - q.z);                                 // de atrás (oscuras) a adelante (con luz)
    g.lineCap = 'round'; g.lineJoin = 'round';
    hojas.forEach((o, i) => {
      const k = i / hojas.length, col = mezcla(base, luz, 0.15 + k * 0.55), px = cx + Math.cos(o.a) * o.pet, py = cy + Math.sin(o.a) * o.pet * 0.9 + o.cae * o.pet * 0.5;
      g.strokeStyle = oscuro(col, 0.15); g.lineWidth = Math.max(0.8, s * 0.005); g.beginPath(); g.moveTo(cx, cy); g.lineTo(px, py); g.stroke();
      const n = 13, abre = 1.9, puntas = [];
      for (let j = 0; j < n; j++) {
        const b = o.a + (j / (n - 1) - 0.5) * abre, L = o.L * (0.82 + 0.18 * Math.cos((j / (n - 1) - 0.5) * 3));
        puntas.push([px + Math.cos(b) * L, py + Math.sin(b) * L + L * o.cae * (0.4 + 0.6 * Math.abs(Math.cos(b)))]);
      }
      g.fillStyle = col; g.beginPath(); g.moveTo(px, py);              // la lámina, con el borde dentado de las puntas
      puntas.forEach(([x, y], j) => { const [qx, qy] = puntas[Math.min(n - 1, j + 1)]; g.lineTo(x, y); if (j < n - 1) g.lineTo((x + qx) / 2 * 0.93 + px * 0.07, (y + qy) / 2 * 0.93 + py * 0.07); });
      g.closePath(); g.fill();
      g.strokeStyle = oscuro(col, 0.22); g.lineWidth = Math.max(0.5, s * 0.0028); g.beginPath();   // nervios
      puntas.forEach(([x, y]) => { g.moveTo(px, py); g.lineTo(px + (x - px) * 0.92, py + (y - py) * 0.92); });
      g.stroke();
    });
  }
  function palmaEsc(x, y, s, t, color, v, forzar, luz) {          // karanda'y: tronco curvo y copa que se mece (y se inclina) con el viento
    luz = luz || color;
    const raf = 0.6 + 0.4 * Math.sin(t / 2300 + x * 0.01), lean = Math.min(0.09, v / 700) * raf;
    const bal = Math.sin(t / 1700 + x) * (0.012 + v / 600) * s, tx = x + s * 0.05 + bal + lean * s, ty = y - s;
    const P = u => { const w = 1 - u; return [w * w * x + 2 * u * w * (x + s * 0.01) + u * u * tx, w * w * y + 2 * u * w * (y - s * 0.55) + u * u * ty]; };
    const tronco = mezcla(color, mezcla(luz, '#8d8878', 0.5), 0.4), izq = [], der = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14, [px, py] = P(u), [qx, qy] = P(Math.min(1, u + 0.02)), d = Math.hypot(qx - px, qy - py) || 1, nx = -(qy - py) / d, ny = (qx - px) / d;
      const r = s * (0.016 * (1 - u) + 0.01 * u + (u < 0.06 ? (0.06 - u) * 0.15 : 0)); izq.push([px + nx * r, py + ny * r]); der.push([px - nx * r, py - ny * r]);
    }
    const gT = ex.createLinearGradient(izq[0][0], 0, der[0][0], 0); gT.addColorStop(0, claro(tronco, 0.12)); gT.addColorStop(1, oscuro(tronco, 0.25));
    ex.fillStyle = gT; ex.beginPath(); ex.moveTo(...izq[0]); izq.forEach(p => ex.lineTo(...p)); for (let i = der.length - 1; i >= 0; i--) ex.lineTo(...der[i]); ex.closePath(); ex.fill();
    ex.strokeStyle = oscuro(tronco, 0.18); ex.lineWidth = Math.max(0.5, s * 0.0025); ex.globalAlpha = 0.7; ex.beginPath();   // anillos del tronco
    for (let i = 1; i < 14; i++) { ex.moveTo(...izq[i]); ex.lineTo(...der[i]); }
    ex.stroke(); ex.globalAlpha = 1;
    const nombre = 'karanday' + Math.round(s), R = semilla(Math.round(s * 7) + 3), w = s * 0.5, h = s * 0.46;
    const cv = pre(nombre, [color, luz, Math.round(s)].join(), w, h, forzar, g => { copaKaranday(g, s, color, luz, R); });
    const giro = Math.min(0.45, v / 110) * raf;
    ex.save(); ex.translate(tx, ty); ex.rotate(lean * 1.5 + bal / s * 1.2 + giro * 0.35 + Math.sin(t / 900 + x) * 0.012 * (1 + v / 15));
    ex.drawImage(cv, -w / 2, -h * 0.48, w, h); ex.restore();
    return u => P(u);                                              // punto del tronco (u: 0 pie … 1 copa)
  }

  // Lapacho rosado: tronco y ramas que se abren en abanico (cada rama se divide en 2 o 3), y en la punta de cada ramita un racimo
  // de flores rosadas en tres tonos (sombra, flor y la luz del sol desde arriba a la izquierda). En flor no tiene hojas.
  function lapachoEsc(x, y, s, t, v, cTronco, cFlor, forzar) {
    const w = s * 1.25, h = s * 1.35;
    const cv = pre('lapacho', [cTronco, cFlor, Math.round(s)].join(), w, h, forzar, g => {
      const R = semilla(4242), puntas = [], tronco = mezcla(cTronco, '#4a3a30', 0.35);
      g.strokeStyle = tronco; g.lineCap = 'round';
      const rama = (x0, y0, ang, L, ancho, n) => {
        const x1 = x0 + Math.cos(ang) * L, y1 = y0 + Math.sin(ang) * L, mx = (x0 + x1) / 2 + (R() - 0.5) * L * 0.25, my = (y0 + y1) / 2 + (R() - 0.5) * L * 0.15;
        g.lineWidth = ancho; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke();
        if (n <= 1) puntas.push([x1, y1, n]);                                 // flores en las ramitas de arriba y en las puntas
        if (!n) return;
        const hijos = n >= 4 ? 2 : 2 + (R() < 0.5 ? 1 : 0), abre = n === 5 ? 0.85 : n === 4 ? 0.75 : 0.9;
        for (let i = 0; i < hijos; i++) {
          let a = ang + (i / (hijos - 1) - 0.5) * abre + (R() - 0.5) * 0.3;
          a = Math.max(-Math.PI + 0.45, Math.min(-0.45, a));                 // las ramas suben y se abren: copa en cúpula ancha
          rama(x1, y1, a, L * (0.7 + R() * 0.14), ancho * 0.66, n - 1);
        }
      };
      rama(w / 2, h, -Math.PI / 2 + (R() - 0.5) * 0.08, s * 0.3, s * 0.06, 5);
      const r0 = Math.max(0.7, s * 0.009), rc = s * 0.085;
      for (const [col, dx, dy, n, k] of [[mezcla(cFlor, '#4a1030', 0.42), 0.12, 0.3, 22, 1], [cFlor, 0, 0, 26, 1], [mezcla(cFlor, '#ffd6ea', 0.45), -0.25, -0.35, 12, 0.8]]) {
        g.fillStyle = col; g.beginPath();
        for (const [px, py, nv] of puntas) for (let i = 0, m = nv ? Math.round(n * 0.7) : n; i < m; i++) {
          const a = R() * 6.283, d = Math.sqrt(R()) * rc, fx = px + Math.cos(a) * d + dx * rc, fy = py + Math.sin(a) * d * 0.75 + dy * rc, r = r0 * (0.7 + R() * 0.9) * k;
          g.moveTo(fx + r, fy); g.arc(fx, fy, r, 0, 6.283);
        }
        g.fill();
      }
    });
    const bal = Math.sin(t / 2100 + x) * (0.004 + v / 1800);
    ex.save(); ex.translate(x, y); ex.rotate(bal); ex.drawImage(cv, -w / 2, -h, w, h); ex.restore();
    return { cx: x, cy: y - h * 0.72, ancho: w * 0.42, suelo: y };
  }
  // ---- Temporada (grupo «especiales») ----
  const COL_GUIR = ['239,68,68', '251,191,36', '34,197,94', '96,165,250'];   // rojo, dorado, verde y azul (#ef4444 #fbbf24 #22c55e #60a5fa)
  // Parpadeo encadenado de las luces de Navidad: tres grupos que se atenúan por turno (~0,9 s cada uno, con transición suave);
  // ninguna se apaga del todo ni destella. `fija` (navidad-quieta, movimiento reducido o escena quieta): todas encendidas.
  function brilloFoco(j, t, fija) {
    if (fija) return 1;
    const ph = (t / 900) % 3, d = Math.abs(((ph - (j % 3) - 0.5) % 3 + 4.5) % 3 - 1.5), off = limitar(1 - d / 0.75, 0, 1);
    return 1 - 0.68 * off * off * (3 - 2 * off);
  }
  function foco(x, y, rx, ry, j, br, noche) {                      // una luz: halo de su color y bombilla
    const c = j % 4;
    if (nivelR() >= 0.75) { const h = (rx + 3.5) * 2.2; ex.globalAlpha = br * (0.35 + 0.65 * noche) * Math.min(1.3, prefsAnim.intensidad); ex.drawImage(eSprGuir[c], x - h / 2, y - h / 2, h, h); }
    ex.globalAlpha = 0.4 + 0.6 * br; ex.fillStyle = `rgb(${COL_GUIR[c]})`; ex.beginPath(); ex.ellipse(x, y, rx, ry, 0, 0, 6.283); ex.fill();
  }
  function spritesGuirnalda() { return COL_GUIR.map(c => { const k = document.createElement('canvas'); k.width = k.height = 24; const g = k.getContext('2d'), gr = g.createRadialGradient(12, 12, 0, 12, 12, 12); gr.addColorStop(0, `rgba(${c},0.9)`); gr.addColorStop(0.3, `rgba(${c},0.35)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(0, 0, 24, 24); return k; }); }
  // Guirnalda colgada entre dos puntos (a y b: funciones de palmaEsc o del pino), con luces de parpadeo encadenado (brilloFoco).
  // Con `rosetas`, de ella cuelgan dos rosetas de ñandutí doradas que se mecen apenas (quietas si `fija`).
  function guirnalda(a, b, ua, ub, t, noche, cable, i0, fija, kLuz, rosetas) {
    const [x1, y1] = a(ua), [x2, y2] = b(ub), cx1 = (x1 + x2) / 2, cy1 = Math.max(y1, y2) + Math.abs(x2 - x1) * 0.28, n = 9;
    const punto = u => { const v = 1 - u; return [v * v * x1 + 2 * u * v * cx1 + u * u * x2, v * v * y1 + 2 * u * v * cy1 + u * u * y2]; };
    ex.strokeStyle = cable; ex.lineWidth = 0.8; ex.beginPath(); ex.moveTo(x1, y1); ex.quadraticCurveTo(cx1, cy1, x2, y2); ex.stroke();
    // rosetas de ñandutí: un hilo, un aro con rayos y un centro
    const rr = Math.max(2.6, eH * 0.02), oro = `rgba(232,196,110,${0.6 + 0.4 * kLuz})`;
    ex.strokeStyle = oro; ex.lineWidth = 0.6;
    if (rosetas) for (const [u, j] of [[0.3, 0], [0.7, 1]]) {
      const [hx, hy] = punto(u), sw = fija ? 0 : Math.sin(t / 1700 + j * 2 + i0) * 0.12, hl = eH * 0.03, rx = hx + Math.sin(sw) * (hl + rr), ry = hy + Math.cos(sw) * (hl + rr);
      ex.beginPath(); ex.moveTo(hx, hy); ex.lineTo(hx + Math.sin(sw) * hl, hy + Math.cos(sw) * hl);
      ex.moveTo(rx + rr, ry); ex.arc(rx, ry, rr, 0, 6.283); ex.moveTo(rx + rr * 0.45, ry); ex.arc(rx, ry, rr * 0.45, 0, 6.283);
      for (let k = 0; k < 10; k++) { const an = k * 0.6283 + sw; ex.moveTo(rx + Math.cos(an) * rr * 0.45, ry + Math.sin(an) * rr * 0.45); ex.lineTo(rx + Math.cos(an) * rr, ry + Math.sin(an) * rr); }
      ex.stroke(); ex.fillStyle = oro; ex.fillRect(rx - 0.7, ry - 0.7, 1.4, 1.4);
    }
    if (!eSprGuir) eSprGuir = spritesGuirnalda();
    for (let i = 1; i < n; i++) {
      const [x, y0] = punto(i / n), y = y0 + 2.2;
      ex.globalAlpha = 1; ex.fillStyle = cable; ex.fillRect(x - 0.7, y0, 1.4, 1.4);                    // portalámpara
      foco(x, y + 0.4, Math.max(1.25, eH * 0.009), Math.max(1.75, eH * 0.012), i + i0, brilloFoco(i + i0, t, fija), noche);
    }
    ex.globalAlpha = 1;
  }
  // Pino de Navidad decorado (geometría de la referencia de diseño, escena de 350×150, con el pie del tronco en (80, 132)):
  // tres pisos de follaje con degradado y luz lateral, tronco, guirnalda dorada de cuentas, 14 esferas de luz, estrella con brillo
  // y dos regalos. De noche el follaje se oscurece un poco para no desentonar con el paisaje. Devuelve P(x, y): de la referencia a px.
  const PINO_PISOS = [[34, 124, 80, 136, 126, 124, 95, 86, 80, 90, 65, 86], [44, 94, 80, 104, 116, 94, 91, 62, 80, 65, 69, 62], [55, 68, 80, 76, 105, 68, 80, 30, 80, 30, 80, 30]];
  const PINO_FOCOS = [[80, 44], [73, 56], [88, 54], [64, 80], [80, 84], [97, 78], [56, 102], [72, 108], [90, 106], [106, 98], [48, 120], [64, 126], [96, 126], [112, 118]];
  function pinoNavidad(X, Y, k, t, fija, kLuz, noche) {
    const P = (x, y) => [X + (x - 80) * k, Y + (y - 132) * k], os = noche * 0.45;
    const ruta = () => { ex.beginPath(); for (const p of PINO_PISOS) { const [a, b, c, d, e, f, g, h, i, j, l, m] = p; ex.moveTo(...P(a, b)); ex.quadraticCurveTo(...P(c, d), ...P(e, f)); ex.lineTo(...P(g, h)); ex.quadraticCurveTo(...P(i, j), ...P(l, m)); ex.closePath(); } };
    ex.fillStyle = mezcla('#4a2f1c', '#1a120c', os); ex.fillRect(...P(76, 122), 8 * k, 10 * k);   // tronco
    const [x0, y0] = P(34, 30), [x1, y1] = P(126, 136);
    const gv = ex.createLinearGradient(x0, y0, x1, y1); gv.addColorStop(0, mezcla('#23854a', '#0c2a22', os)); gv.addColorStop(1, mezcla('#0b3a20', '#051510', os));
    ruta(); ex.fillStyle = gv; ex.fill();
    const gl = ex.createLinearGradient(x0, 0, x1, 0); gl.addColorStop(0, `rgba(63,174,102,${0.55 * (1 - os)})`); gl.addColorStop(0.5, 'rgba(63,174,102,0)');
    ex.fillStyle = gl; ex.fill();                                                                    // luz lateral
    ex.strokeStyle = '#fbbf24'; ex.lineWidth = 1.6 * k; ex.lineCap = 'round'; ex.setLineDash([0.1, 3.2 * k]); ex.beginPath();   // guirnalda dorada de cuentas
    for (const [a, b, c, d, e, f] of [[60, 64, 80, 78, 100, 62], [52, 90, 80, 106, 110, 88], [42, 118, 80, 134, 120, 116]]) { ex.moveTo(...P(a, b)); ex.quadraticCurveTo(...P(c, d), ...P(e, f)); }
    ex.stroke(); ex.setLineDash([]);
    if (!eSprGuir) eSprGuir = spritesGuirnalda();
    PINO_FOCOS.forEach(([x, y], j) => { const [px, py] = P(x, y); foco(px, py, 2.5 * k, 2.5 * k, j, brilloFoco(j, t, fija), noche); });
    ex.globalAlpha = 1;
    // regalos al pie
    const regalo = (x, y, w, h, col, lazo) => { const [a, b] = P(x, y); ex.fillStyle = mezcla(col, '#000000', os * 0.6); ex.fillRect(a, b, w * k, h * k); ex.strokeStyle = '#fde68a'; ex.lineWidth = 1.2 * k; ex.beginPath(); ex.moveTo(a + w * k / 2, b); ex.lineTo(a + w * k / 2, b + h * k); ex.moveTo(a, b + h * k / 2); ex.lineTo(a + w * k, b + h * k / 2); if (lazo) { ex.moveTo(a + w * k / 2, b); ex.quadraticCurveTo(a + w * k / 2 - 5 * k, b - 4 * k, a + w * k / 2 - 6 * k, b - 1 * k); ex.moveTo(a + w * k / 2, b); ex.quadraticCurveTo(a + w * k / 2 + 5 * k, b - 4 * k, a + w * k / 2 + 6 * k, b - 1 * k); } ex.stroke(); };
    regalo(90, 122, 15, 11, '#b91c1c', true); regalo(56, 125, 12, 8, '#1d4ed8', false);
    // estrella dorada en la punta: brillo suave (más de noche) que late despacio salvo si `fija`
    const [sx, sy] = P(80, 27.5), lat = fija ? 1 : 1 + 0.08 * Math.sin(t / 2200), rb = 15 * k * lat * (0.8 + 0.4 * noche);
    const gs = ex.createRadialGradient(sx, sy, 0, sx, sy, rb); gs.addColorStop(0, `rgba(253,230,138,${0.5 + 0.35 * noche})`); gs.addColorStop(1, 'rgba(253,230,138,0)');
    ex.fillStyle = gs; ex.fillRect(sx - rb, sy - rb, rb * 2, rb * 2);
    ex.fillStyle = '#fbbf24'; ex.strokeStyle = '#fff3c4'; ex.lineWidth = 0.8 * k; ex.lineJoin = 'round'; ex.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 3.3 : 8) * k; ex[i ? 'lineTo' : 'moveTo'](sx + Math.cos(a) * r, sy + 1.5 * k + Math.sin(a) * r); }
    ex.closePath(); ex.fill(); ex.stroke();
    return P;
  }
  // Luces en espiral alrededor de un tronco (tr: función de palmaEsc); las que quedan "detrás" del tronco se ven más tenues
  function lucesEspiral(tr, t, fija, noche, ancho) {
    for (let k = 0; k < 13; k++) {
      const u = 0.06 + k * 0.054, [x, y] = tr(u), fase = u * Math.PI * 9, atras = Math.cos(fase) < 0;
      if (libreDeEtq(x, y, ancho) !== y) continue;                  // no se dibujan debajo de las etiquetas
      foco(x + Math.sin(fase) * ancho, y, Math.max(1.4, ancho * 0.42), Math.max(1.4, ancho * 0.42), k + 2, brilloFoco(k + 2, t, fija) * (atras ? 0.5 : 1), noche * (atras ? 0.5 : 1));
    }
    ex.globalAlpha = 1;
  }
  // ¿Hay fuegos artificiales? En Paraguay se tiran en Nochebuena y en Año Nuevo: el 24 y el 31 de diciembre desde las 23:30
  // hasta la 1:00 del día siguiente (hora de Asunción). Devuelve 0 (no), 1 (sí) o 2 (gran final: de las 0:00 a las 0:03).
  // Se consulta cada 15 s.
  function hayFuegos() {
    const ahora = Date.now(); if (Math.abs(ahora - eNuevo.t) < 15000) return eNuevo.si;
    const p = {}; eNuevo.t = ahora;
    try { new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(ahora)).forEach(x => { p[x.type] = +x.value; }); } catch (e) { return eNuevo.si = 0; }
    const vispera = p.month === 12 && (p.day === 24 || p.day === 31) && p.hour * 60 + p.minute >= 23 * 60 + 30;
    const despues = ((p.month === 12 && p.day === 25) || (p.month === 1 && p.day === 1)) && p.hour < 1;
    return eNuevo.si = !(vispera || despues) ? 0 : despues && p.minute < 3 ? 2 : 1;
  }

  function pintarEscena(t, dt, quieto) {
    const w = ec.clientWidth, h = ec.clientHeight;
    if (!w || !h) return;
    if (!quieto) latidoRayo(t, dt || 0);
    const simple = !prefsAnim.paisaje || !fx, d = Math.min(window.devicePixelRatio || 1, nivelR() < 0.75 ? 1 : 2);   // con calidad baja, menos píxeles
    if (w !== eW || h !== eH || d !== eD) { eW = w; eH = h; eD = d; ec.width = Math.round(w * d); ec.height = Math.round(h * d); ex.setTransform(d, 0, 0, d, 0, 0); eClave = ''; eEtqSucio = true; vAst.ok = false; eFundido = 0; }
    const clave = [ambClave, eW, eH, claveFx(), simple ? 1 : 0, amb.granizo ? 1 : 0, Math.round(vientoVis() / 8), Math.round(vientoHojas() / 8), mesLapacho() ? 1 : 0].join('|');
    if (eClave !== clave) {
      if (eClave && !quieto && !simple && vEsc.Ph) fotoFundido();      // cambió el clima, la ciudad o las preferencias (no el tamaño): fundido
      eClave = clave; eFirma = ''; armarEscena();
    }
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
    if (anim) { const k = 1 - Math.exp(-dt / 380); par.x += (par.tx - par.x) * k; par.y += (par.ty - par.y) * k; } else par.x = par.y = 0;
    const pA = Math.min(10, eW * 0.008), pX = z => par.x * pA * z, pY = z => par.y * pA * 0.4 * z;   // desplazamiento de una capa a la distancia z (0 lejos … 1 cerca)
    // cielo
    const g = ex.createLinearGradient(0, 0, 0, yAgua); g.addColorStop(0, P[0]); g.addColorStop(0.55, P[1]); g.addColorStop(1, P[2]);
    ex.fillStyle = g; ex.fillRect(0, 0, eW, eH);
    if (eEstr.length && kEstr > 0.01) {                            // estrellas: en 4 grupos que titilan a destiempo (4 trazos en vez de uno por estrella)
      ex.fillStyle = '#fff';
      for (let k = 0; k < 4; k++) { ex.globalAlpha = kEstr * (0.3 + 0.55 * Math.sin(t / 900 + k * 1.7) ** 2); ex.beginPath(); for (let i = k; i < eEstr.length; i += 4) { const s = eEstr[i]; ex.moveTo(s.x + s.r, s.y); ex.arc(s.x, s.y, s.r, 0, 6.283); } ex.fill(); }
      ex.globalAlpha = 1;
    }
    if (eViaL && kEstr > 0.4) {                                     // Vía Láctea: noche despejada y sin luna (la luna llena la borra)
      const il = (1 - Math.cos(2 * Math.PI * edadLuna())) / 2, luna = A.tipo === 'nublado' ? 0 : vAst.mf * kLuna * (0.15 + 0.85 * il);
      const a = ((kEstr - 0.4) / 0.6) ** 2 * (A.tipo === 'despejado' ? 0.75 : 0.4) * limitar(1 - luna * 1.6, 0, 1);
      if (a > 0.02) { ex.globalAlpha = a; ex.drawImage(eViaL, 0, 0, eW, eH * 0.62); ex.globalAlpha = 1; }
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
    {                                                               // posición objetivo de sol y luna; se acercan a ella en ~1,5 s (al cambiar de hora en la vista previa no saltan)
      const k = anim && vAst.ok ? 1 - Math.exp(-dt / 500) : 1, ir = (c, v) => { vAst[c] += (v - vAst[c]) * k; };
      ir('sx', S ? S.x : 0.72); ir('sy', S ? (yHor - S.alt * aMax) / eH : 0.22); ir('so', S ? S.f : A.fase === 'noche' ? 0 : 1);
      ir('mx', L ? L.x : 0.5); ir('my', L ? (yHor - L.alt * aMax) / eH : yHor / eH); ir('mf', L ? L.f : 0);
      vAst.ok = true;
    }
    const sx = eW * vAst.sx, sy = libreDeEtq(sx, eH * vAst.sy, R), altSol = limitar((yHor - eH * vAst.sy) / aMax, 0, 1), sobre = vAst.so;
    let refSol = null, refLuna = null, kDor = 0;                   // reflejos en el río y brillo de la hora dorada (se dibujan más abajo)
    if (sobre > 0.01 && (vis || A.tipo === 'nublado' || A.tipo === 'niebla')) {
      const k = limitar(altSol / 0.45, 0, 1);                     // sol bajo = naranja; sol alto = amarillo claro
      const al = (vis ? 1 : A.tipo === 'nublado' ? 0.45 : 0.3) * sobre, col = `255,${Math.round(150 + 86 * k)},${Math.round(80 + 90 * k)}`;
      refSol = { x: sx, col, a: 0.5 * al, w: R * (1.3 + 1.4 * (1 - k)) };
      // rayos de sol entre las nubes con el sol bajo (se dibujan antes que las nubes, que los tapan): abanico que gira muy despacio
      const kr = esp && vis ? sobre * limitar((0.55 - altSol) / 0.3, 0, 1) * (A.tipo === 'parcial' ? 1 : 0.45) * Math.min(1.2, prefsAnim.intensidad) : 0;
      kDor = esp && vis && A.dorado ? sobre * (1 - k * 0.6) : 0;
      if (kr > 0.02) {
        const Lr = Math.hypot(eW, eH) * 0.75, gr = ex.createRadialGradient(sx, sy, R, sx, sy, Lr);
        gr.addColorStop(0, `rgba(255,${Math.round(190 + 40 * k)},140,${0.06 * kr})`); gr.addColorStop(0.5, `rgba(255,200,140,${0.02 * kr})`); gr.addColorStop(1, 'rgba(255,200,140,0)');
        ex.save(); ex.globalCompositeOperation = 'lighter'; ex.fillStyle = gr;
        for (const m of nivelR() < 1 ? [0.75] : [1, 0.45]) {        // dos pasadas (ancha y angosta): el borde de cada rayo queda difuso; con calidad baja, una
          ex.beginPath();
          for (let i = 0; i < 10; i++) {
            const a = i / 10 * 6.283 + 0.18 * Math.sin(t / 9000 + i * 1.3), w = (0.05 + 0.03 * Math.sin(t / 3700 + i * 2.3)) * m;
            ex.moveTo(sx, sy); ex.lineTo(sx + Math.cos(a - w) * Lr, sy + Math.sin(a - w) * Lr); ex.lineTo(sx + Math.cos(a + w) * Lr, sy + Math.sin(a + w) * Lr); ex.closePath();
          }
          ex.fill();
        }
        ex.restore();
      }
      const gl = ex.createRadialGradient(sx, sy, 0, sx, sy, R * 5); gl.addColorStop(0, `rgba(${col},${0.55 * al})`); gl.addColorStop(1, `rgba(${col},0)`);
      ex.fillStyle = gl; ex.fillRect(sx - R * 5, sy - R * 5, R * 10, R * 10);
      if (vis && k > 0.7) { ex.save(); ex.globalAlpha = (k - 0.7) / 0.3 * sobre; ex.translate(sx, sy); ex.rotate(t / 9000); ex.fillStyle = 'rgba(255,240,190,0.07)'; for (let i = 0; i < 12; i++) { ex.rotate(0.5236); ex.beginPath(); ex.moveTo(0, 0); ex.lineTo(-R * 0.5, -R * 6.5); ex.lineTo(R * 0.5, -R * 6.5); ex.fill(); } ex.restore(); }
      ex.fillStyle = mezcla('#ffb982', '#fff6cf', k); ex.globalAlpha = al; ex.beginPath(); ex.arc(sx, sy, R, 0, 6.283); ex.fill(); ex.globalAlpha = 1;
    }
    if (efectoActivo('estrellas') && L && vAst.mf > 0.01 && kLuna > 0.01 && A.tipo !== 'lluvia' && A.tipo !== 'tormenta') {
      const mx = eW * vAst.mx, my = Math.min(yHor, libreDeEtq(mx, eH * vAst.my, R));
      const il = (1 - Math.cos(2 * Math.PI * edadLuna())) / 2, al = (A.tipo === 'niebla' ? 0.4 : A.tipo === 'nublado' ? 0.6 : 1) * kLuna * vAst.mf;
      const gl = ex.createRadialGradient(mx, my, 0, mx, my, R * 4.5); gl.addColorStop(0, `rgba(190,208,255,${0.34 * al * il})`); gl.addColorStop(1, 'rgba(190,208,255,0)');
      ex.fillStyle = gl; ex.fillRect(mx - R * 4.5, my - R * 4.5, R * 9, R * 9);
      dibujarLuna(ex, mx, my, R * 0.85, al);
      refLuna = { x: mx, col: '222,230,255', a: 0.42 * al * (0.3 + 0.7 * il), w: R * 1.1 };
    }
    // nubes y aves
    if (eNubes.length) {                                          // por capas: las lejanas se tiñen del cielo; medias y cercanas llevan la panza en sombra
      const cc = aRgb(vEsc.cc), cielo = hexA(P[2]), lejos = mezA(cc, cielo, 0.4).map(Math.round).join(','), panza = mezA(cc, [20, 28, 45], A.tipo === 'tormenta' ? 0.35 : 0.2).map(Math.round).join(',');
      for (let z = 0; z < 3; z++) {
        const dx = pX([0.2, 0.45, 0.8][z]), dy = pY([0.2, 0.45, 0.8][z]);
        let hay = false;
        for (const n of eNubes) if (n.z === z) { hay = true; n.x += n.v * dt * (1 + A.viento / 20); if (n.x - n.r * 3 > eW) n.x = -n.r * 3; }
        if (!hay) continue;
        ex.globalAlpha = z ? kCca : kCca * 0.8;
        for (const n of eNubes) if (n.z === z) { const r = n.r, c = nubeSuave(r, z, z ? vEsc.cc : lejos, panza, !anim); ex.drawImage(c, n.x + dx - r * 2.3, n.y + dy - r * 1.35, r * 4.6, r * 2.7); }
        ex.globalAlpha = 1;
      }
    }
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
    // los fuegos artificiales del 24 y del 31 se dibujan en el cielo de toda la pantalla (fuegosCielo): en la franja del paisaje
    // quedaban chicos y tapados por la portada   // la clase sin-fuegos los apaga (panel)
    // colinas lejanas y cercanas
    ex.translate(pX(0.25), 0); colinaEsc(eH * 0.56, eH * 0.07, 2, 5, 0.6, T[0], false, !anim); ex.translate(-pX(0.25), 0);
    // bruma atmosférica: lo lejano se funde con el color del horizonte (más de día, menos de noche)
    const hz = hexA(P[2]).join(','), aBr = 0.22 + 0.16 * kLuz;
    const gb = ex.createLinearGradient(0, eH * 0.46, 0, eH * 0.64); gb.addColorStop(0, `rgba(${hz},0)`); gb.addColorStop(1, `rgba(${hz},${aBr})`);
    ex.fillStyle = gb; ex.fillRect(0, eH * 0.46, eW, eH * 0.18);
    ex.translate(pX(0.45), 0); const colCerca = colinaEsc(eH * 0.65, eH * 0.07, 3, 7, 2.1, T[1], true, !anim); ex.translate(-pX(0.45), 0);
    const gb2 = ex.createLinearGradient(0, eH * 0.6, 0, yAgua); gb2.addColorStop(0, `rgba(${hz},0)`); gb2.addColorStop(1, `rgba(${hz},${aBr * 0.45})`);
    ex.fillStyle = gb2; ex.fillRect(0, eH * 0.6, eW, yAgua - eH * 0.6);
    const kCiu = eLuces.length ? (1 - kLuz) ** 1.5 * (A.tipo === 'niebla' ? 0.35 : A.lluvia ? 0.6 : 1) : 0;
    if (kCiu > 0.02) {                                              // luces de la ciudad lejana: titilan muy despacio y tiñen apenas el cielo encima
      const dxC = pX(0.45);
      ex.save(); ex.translate(eW * 0.5 + dxC, yAgua); ex.scale(1, 0.22);
      const gc = ex.createRadialGradient(0, 0, 0, 0, 0, eW * 0.22); gc.addColorStop(0, `rgba(255,190,120,${0.1 * kCiu})`); gc.addColorStop(1, 'rgba(255,190,120,0)');
      ex.fillStyle = gc; ex.fillRect(-eW * 0.22, -eW * 0.22, eW * 0.44, eW * 0.22); ex.restore();
      for (let c = 0; c < 2; c++) for (let k = 0; k < 3; k++) {
        ex.fillStyle = c ? '#eaf0ff' : '#ffd08c'; ex.globalAlpha = kCiu * (0.7 + 0.3 * Math.sin(t / 1400 + k * 2.1)); ex.beginPath();
        for (const l of eLuces) if (l.c === c && l.k === k) { ex.moveTo(l.x + dxC + l.r, l.y); ex.arc(l.x + dxC, l.y, l.r, 0, 6.283); }
        ex.fill();
      }
      ex.globalAlpha = 1;
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
    {                                                               // la colina con su monte se refleja en el río (la lluvia y la niebla lo borran)
      const a = 0.28 * (1 - (A.lluvia || 0) * 0.7) * (A.tipo === 'niebla' ? 0.4 : 1);
      if (a > 0.02) {
        ex.save(); ex.beginPath(); ex.rect(0, yAgua, eW, eH - yAgua); ex.clip(); ex.globalAlpha = a;
        ex.translate(pX(0.45), yAgua); ex.scale(1, -0.6); ex.translate(0, -yAgua); ex.drawImage(colCerca.c, -16, colCerca.top, eW + 32, eH - colCerca.top);
        ex.restore();
        const gv = ex.createLinearGradient(0, yAgua, 0, yAgua + eH * 0.12); gv.addColorStop(0, `rgba(${hexA(P[2]).join(',')},0)`); gv.addColorStop(1, `rgba(${hexA(P[2]).join(',')},0.25)`);
        ex.fillStyle = gv; ex.fillRect(0, yAgua, eW, eH * 0.12);
      }
    }
    const brillo = vEsc.br, hAg = eH - yAgua;
    for (let i = 0; i < 26; i++) {
      const x = (i * 97 + t * 0.012 * (i % 3 + 1)) % eW, y = yAgua + ((i * 37) % 100) / 100 * hAg;
      ex.fillStyle = `rgba(${brillo},${0.06 + 0.06 * Math.sin(t / 700 + i)})`; ex.fillRect(x, y, 10 + (i * 13) % 26, 1.6);
    }
    // reflejo del sol y de la luna: una columna de destellos que ondula y se ensancha hacia la orilla (la lluvia lo rompe)
    const reflejo = o => {
      const a0 = o.a * (1 - A.lluvia * 0.75); if (a0 < 0.01) return;
      ex.fillStyle = `rgb(${o.col})`;
      for (let y = yAgua + 1.5, i = 0; y < eH; y += 2.6, i++) {
        const u = (y - yAgua) / hAg, w = o.w * (0.5 + u * 1.3) * (0.55 + 0.45 * Math.sin(i * 1.9 + t / 520)), dx = Math.sin(i * 0.8 + t / 700) * (1.5 + u * 4);
        ex.globalAlpha = a0 * (1 - u * 0.55) * (0.5 + 0.5 * Math.sin(i * 2.7 - t / 380)); ex.fillRect(o.x + dx - w / 2, y, w, 1.5);
      }
      ex.globalAlpha = 1;
    };
    if (kCiu > 0.02) {                                              // las luces de la ciudad se estiran en el agua
      ex.fillStyle = '#ffcf8a'; ex.globalAlpha = kCiu * 0.32 * (1 - A.lluvia * 0.6); const dxC = pX(0.45);
      for (const l of eLuces) { const L = 3 + l.r * 4 + Math.sin(t / 600 + l.x) * 1.5; ex.fillRect(l.x + dxC - 0.5 + Math.sin(t / 500 + l.y) * 0.6, yAgua + 1.5, 1, L); }
      ex.globalAlpha = 1;
    }
    for (const f of cFuegos) if (f.chispas && f.vida < f.dur * 0.6) {   // los estallidos del cielo se reflejan apenas en el río
      const k = 1 - f.vida / (f.dur * 0.6), r = eH * 0.2;
      ex.save(); ex.translate(f.cx * eW / (cvW || 1), yAgua + hAg * 0.35); ex.scale(1, 0.3);
      const gw = ex.createRadialGradient(0, 0, 0, 0, 0, r); gw.addColorStop(0, `rgba(${f.c},${0.16 * k * k})`); gw.addColorStop(1, `rgba(${f.c},0)`);
      ex.fillStyle = gw; ex.fillRect(-r, -r, r * 2, r * 2); ex.restore();
    }
    if (refSol) reflejo(refSol);
    if (refLuna) reflejo(refLuna);
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
    const dxO = pX(1); ex.translate(dxO, 0);
    orillasEsc(T[2], kLuz, kNb, !anim);                              // pasto, borde mojado y camino de tierra colorada
    {                                                               // charcos: reflejan el cielo; con lluvia, anillos que se abren; después se secan
      const obj = efectoActivo('lluvia') ? Math.max(A.lluvia ? 0.6 + 0.4 * A.lluvia : 0, A.mojado || 0) : 0;
      eMoj = eMoj < 0 || !anim ? obj : eMoj + (obj - eMoj) * (1 - Math.exp(-dt / 2500));
      if (eMoj > 0.02 && eCharcos.length) {
        ex.fillStyle = 'rgba(10,20,15,0.22)'; ex.globalAlpha = eMoj; ex.beginPath();   // tierra mojada alrededor
        for (const c of eCharcos) { ex.moveTo(c.x + c.rx * 1.35, c.y + c.ry * 0.2); ex.ellipse(c.x, c.y + c.ry * 0.2, c.rx * 1.35, c.ry * 1.6, 0, 0, 6.283); }
        ex.fill();
        ex.fillStyle = mezcla(P[2], '#ffffff', 0.12 * kLuz); ex.globalAlpha = 0.55 * eMoj; ex.beginPath();
        for (const c of eCharcos) { ex.moveTo(c.x + c.rx, c.y); ex.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, 6.283); }
        ex.fill();
        ex.strokeStyle = `rgba(${vEsc.br},0.5)`; ex.lineWidth = 1; ex.beginPath();   // brillo en el borde de cada charco
        for (const c of eCharcos) { ex.moveTo(c.x - c.rx * 0.7, c.y - c.ry * 0.55); ex.ellipse(c.x, c.y, c.rx, c.ry, 0, 3.6, 5.8); }
        ex.stroke();
        if (anim && A.lluvia) {
          ex.strokeStyle = 'rgba(220,235,255,0.6)'; ex.beginPath();
          eCharcos.forEach((c, j) => { for (let m = 0; m < 2; m++) { const ph = t / 650 + j * 0.37 + m * 0.5, u = ph % 1, n = Math.floor(ph), ox = ((n * 37 + j * 11) % 10 / 10 - 0.5) * c.rx * 1.1, rr = u * c.rx * 0.45; ex.moveTo(c.x + ox + rr, c.y); ex.ellipse(c.x + ox, c.y, rr, rr * 0.35, 0, 0, 6.283); } });
          ex.globalAlpha = 0.5 * eMoj * A.lluvia; ex.stroke();
        }
        ex.globalAlpha = 1;
      }
    }
    const vp = efectoActivo('viento') && !simple ? vientoVis() : 0;
    {                                                               // el lapacho rosado de la orilla derecha, con sus flores caídas
      const os = 1 - kLuz, sL = Math.min(eH * 0.5, eW * 0.34), xL = eW * 0.79, yL = eH * 0.965;
      const flor = mezcla(mezcla('#e8559f', T[2], 0.1 + os * 0.68), '#dfe6ea', kNb * 0.5);
      ex.fillStyle = mezcla(flor, "#ffffff", 0.15); ex.globalAlpha = 0.7; ex.beginPath();   // flores caídas sobre el pasto, alrededor del tronco
      for (let k = 0; k < 9; k++) { const px = xL + (k - 4) * sL * 0.06 + Math.sin(k * 2.3) * sL * 0.03, py = yL + eH * (0.005 + ((k * 7) % 5) * 0.006); ex.moveTo(px + sL * 0.03, py); ex.ellipse(px, py, sL * 0.03, eH * 0.006, 0, 0, 6.283); }
      ex.fill(); ex.globalAlpha = 1;
      const L = lapachoEsc(xL, yL, sL, t, vp, T[3], flor, !anim);
      if (ePetalos.length) {
        const vv = vientoVis(); ex.fillStyle = mezcla(flor, '#ffffff', 0.18); ex.beginPath();
        ePetalos.forEach(p => {
          if (dt) { p.x += (0.004 + vv / 3000) * p.v * dt; p.y += 0.008 * p.v * dt; p.f += dt / 500; }
          if (p.y < 0 || p.y > L.suelo || p.x > eW + 5) { p.x = L.cx + (Math.random() * 2 - 1) * L.ancho * 0.9; p.y = L.cy + Math.random() * sL * 0.12; }
          const px = p.x + Math.sin(p.f) * 3; ex.moveTo(px + 1.6, p.y); ex.ellipse(px, p.y, 1.6, 1.1, p.f, 0, 6.283);
        });
        ex.fill();
      }
    }
    const pa = palmaEsc(eW * 0.08, yAgua - eH * 0.04, eH * 0.7, t, T[3], vp, !anim, T[1]), pb = palmaEsc(eW * 0.17, yAgua - eH * 0.01, eH * 0.44, t + 900, T[3], vp, !anim, T[1]);
    const pc = palmaEsc(eW * 0.92, yAgua - eH * 0.035, eH * 0.62, t + 400, T[3], vp, !anim, T[1]), pd = palmaEsc(eW * 0.84, yAgua - eH * 0.005, eH * 0.4, t + 1600, T[3], vp, !anim, T[1]);
    const navidad = esp && document.documentElement.classList.contains('navidad');
    if (navidad) {                                                // Navidad: pino decorado, luces en espiral, guirnaldas (todo bajo «especiales»)
      const cab = mezcla(T[3], '#000000', 0.3), fija = !anim || document.documentElement.classList.contains('navidad-quieta');
      const noche = 1 - kLuz, kP = eH / 200;
      if (!eSprGuir) eSprGuir = spritesGuirnalda();
      guirnalda(pd, pc, 0.66, 0.52, t + 700, noche, cab, 2, fija, kLuz, true);                       // orilla derecha: guirnalda con ñandutí
      lucesEspiral(pa, t, fija, noche, eH * 0.024);                                                  // palmera alta de la izquierda: luces en espiral
      // en pantallas angostas el pino se achica y se corre a la derecha de la palmera chica, para no tapar su tronco ni asomar sobre el río
      const angosta = eW < eH * 3.2, kPino = angosta ? eH / 240 : kP;
      if (angosta) {                                              // un montículo de la misma tierra de la orilla bajo el pino (no queda sobre el agua)
        const xP = eW * 0.285, yP = eH * 0.93;
        ex.fillStyle = T[2]; ex.beginPath(); ex.moveTo(xP - 80 * kPino, eH + 2); ex.quadraticCurveTo(xP - 6 * kPino, yP - 74 * kPino, xP + 84 * kPino, eH + 2); ex.fill();
      }
      const P = pinoNavidad(angosta ? eW * 0.285 : eW * 0.205, angosta ? eH * 0.93 : eH * 0.885, kPino, t, fija, kLuz, noche), ap = P(57, 70);   // pino decorado en la orilla izquierda
      guirnalda(() => ap, pa, 0, 0.5, t + 300, noche, cab, 5, fija, kLuz, false);                    // guirnalda del pino a la palmera
    }
    ex.translate(-dxO, 0);
    // luciérnagas
    if (kLuci > 0.02 && eLuci.length) {                            // luciérnagas: con viento derivan hacia un lado y, si es fuerte, casi no se ven
      const vl = efectoActivo('viento') ? limitar((A.viento || 0) / 30, 0, 1) : 0, ocultas = 1 - limitar(((A.viento || 0) - 25) / 20, 0, 0.8);
      eLuci.forEach(l => {
        l.x += (Math.sin(t * l.v + l.f) * 0.35 + vl * (0.5 + (l.f % 1)) * 0.9) * (dt / 16); l.y += Math.cos(t * l.v * 1.3 + l.f) * 0.25 * (dt / 16);
        if (l.x > eW + 10) l.x = -10;
        ex.globalAlpha = kLuci * ocultas * (0.25 + 0.75 * Math.max(0, Math.sin(t / 700 + l.f * 3))); ex.drawImage(eSprLuci, l.x - 9, l.y - 9, 18, 18);
      });
    }
    ex.globalAlpha = 1;
    // hojas y polvo que arrastra el viento
    if (eHojas.length) {
      const vv = vientoHojas(), vel = 0.03 + vv / 450;
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
    // lluvia: la inclinación sigue al viento y va y viene en rachas; con lluvia fuerte pasan cortinas de agua más densas
    if (eGotas.length) {
      const rach = 0.5 + 0.5 * Math.sin(t / 2600) * Math.sin(t / 1700 + 1.3), r = limitar(vientoVis() / 60, 0, 0.5) * (0.7 + 0.6 * rach);
      if (A.lluvia > 0.45) {
        const ac = 0.07 * (A.lluvia - 0.3) * Math.min(1.3, prefsAnim.intensidad);
        ex.save(); ex.transform(1, 0, -r, 1, 0, 0);
        for (let i = 0; i < 2; i++) {
          const w = eW * (0.16 + i * 0.08), x = ((t * (0.018 + i * 0.01) * (0.5 + r * 2) + i * eW * 0.7) % (eW * 1.5)) - eW * 0.25 + r * eH * 0.5;
          const gc = ex.createLinearGradient(x, 0, x + w, 0); gc.addColorStop(0, 'rgba(200,214,235,0)'); gc.addColorStop(0.5, `rgba(200,214,235,${ac})`); gc.addColorStop(1, 'rgba(200,214,235,0)');
          ex.fillStyle = gc; ex.fillRect(x, 0, w, eH);
        }
        ex.restore();
      }
      ex.lineWidth = 1;
      for (let z = 0; z < 2; z++) {
        ex.strokeStyle = z ? 'rgba(210,228,255,0.45)' : 'rgba(195,212,240,0.24)'; ex.beginPath();
        for (const d of eGotas) if (d.z === z) { d.y += d.v * dt * 0.7; d.x += d.v * dt * 0.7 * r; if (d.y > eH) { d.y = -d.l; d.x = Math.random() * eW; } if (d.x > eW) d.x -= eW; ex.moveTo(d.x, d.y); ex.lineTo(d.x - d.l * r, d.y - d.l); }
        ex.stroke();
      }
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
    if (kDor > 0.02 && nivelR() >= 0.75) {                                            // hora dorada: un resplandor cálido y suave que baña el cuadro desde el sol
      const rg = Math.max(eW, eH) * 0.55, gd = ex.createRadialGradient(sx, sy, 0, sx, sy, rg);
      gd.addColorStop(0, `rgba(255,178,105,${0.2 * kDor})`); gd.addColorStop(0.4, `rgba(255,150,90,${0.07 * kDor})`); gd.addColorStop(1, 'rgba(255,150,90,0)');
      ex.save(); ex.globalCompositeOperation = 'lighter'; ex.fillStyle = gd; ex.fillRect(Math.max(0, sx - rg), 0, Math.min(eW, sx + rg) - Math.max(0, sx - rg), eH); ex.restore();
    }
    ex.fillStyle = eSombra; ex.fillRect(0, 0, eW, eH * 0.4);   // sombra arriba para que se lean las etiquetas
    if (eFundido > 0) {                                           // la escena anterior se desvanece encima de la nueva
      eFundido = anim ? eFundido - dt / 1400 : 0;
      if (eFundido > 0) { ex.save(); ex.setTransform(1, 0, 0, 1, 0, 0); ex.globalAlpha = eFundido * eFundido * (3 - 2 * eFundido); ex.drawImage(eFoto, 0, 0); ex.restore(); }
    }
  }
  function etiquetaEscena(a) {                                     // las etiquetas sobre el cuadro: ciudad, clima y momento del día
    // en una vista previa se muestra el clima elegido (con el mismo texto que la app usa para un código típico de ese clima), no el real
    // Sin emojis: cada etiqueta lleva data-icono (minúsculas, sin tildes) para que la interfaz dibuje su propio ícono.
    const tipoDe = c => [95, 96, 99].includes(c) ? 'tormenta' : c >= 51 && c <= 86 ? 'lluvia' : c === 45 || c === 48 ? 'niebla' : c === 3 ? 'nublado' : c === 2 ? 'parcial' : 'despejado';
    const c0 = a.weather_code, real = tipoDe(c0);
    const cod = amb.previa && real !== amb.tipo ? { despejado: 0, parcial: 2, nublado: 3, lluvia: 63, tormenta: 95, niebla: 45 }[amb.tipo] : c0;   // si coincide con el real, se deja el texto real (p. ej. «Tormenta con granizo»)
    const deNoche = amb.previa ? amb.fase === 'noche' : a.is_day === 0, w = clima(cod, deNoche ? 0 : 1), tc = tipoDe(cod), caja = $('escenaEtq');
    const fase = { amanecer: 'Amanecer', dia: 'Día', atardecer: 'Atardecer', noche: 'Noche' }[amb.fase] ? amb.fase : 'dia';
    const tx = [['ubicacion', seleccionada], [(tc === 'despejado' || tc === 'parcial') && deNoche ? tc + '-noche' : tc, w.texto], [fase, { amanecer: 'Amanecer', dia: 'Día', atardecer: 'Atardecer', noche: 'Noche' }[fase]]];
    if (vigiaEtq) vigiaEtq.disconnect();
    caja.textContent = ''; tx.forEach(([ic, s]) => { const e = document.createElement('span'); e.dataset.icono = ic; e.innerHTML = icono(ic); e.append(s); caja.appendChild(e); if (vigiaEtq) vigiaEtq.observe(e); });
    eEtqSucio = true;
  }
  // Barra de navegación del celular
  document.querySelectorAll('.barra-nav [data-ir]').forEach(b => b.addEventListener('click', () => { const s = $(b.dataset.ir); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  // «Comparar»: si ya está abierto, solo lleva hasta ahí (antes el mismo toque lo cerraba)
  $('navComparar').addEventListener('click', () => { if ($('comparar').hidden) $('btnComparar').click(); else $('comparar').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  if ('IntersectionObserver' in window) {
    // la sección que cruza la franja del medio de la pantalla marca su botón; «Comparar» también (antes, mirando la comparación, quedaba marcado «Mapa»)
    const destino = b => b.dataset.ir || (b.id === 'navComparar' ? 'comparar' : '');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) document.querySelectorAll('.barra-nav button').forEach(b => b.classList.toggle('on', destino(b) === e.target.id)); }), { rootMargin: '-40% 0px -50% 0px' });
    ['detalle', 'comparar', 'seccionMapa', 'seccionLista'].forEach(id => { if ($(id)) io.observe($(id)); });
  }

  function ajustarCielo() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cvW = innerWidth; cvH = innerHeight;
    cv.width = Math.round(cvW * dpr); cv.height = Math.round(cvH * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cieloLimpio = false;
    armarParticulas();
  }
  let cClave = '', cieloLimpio = false, cAcum = 0, cDestello = 0, cViejo = null;   // cViejo: nubes y estrellas del clima anterior, que se desvanecen
  const claveCielo = () => [amb.tipo, cvW, cvH, claveFx()].join('|');
  function armarParticulas() {
    const ant = cClave.split('|');                                 // si cambió el clima (no el tamaño), lo anterior se desvanece en ~1,5 s
    cViejo = fx && cClave && ant[0] !== amb.tipo && +ant[1] === cvW && +ant[2] === cvH && (nubes.length || estrellas.length) ? { nubes, estrellas, k: 1, kE: vEsc.esc[1] } : null;
    cClave = claveCielo();
    const area = cvW * cvH, abierto = amb.tipo === 'despejado' || amb.tipo === 'parcial';
    gotas = [];                                                    // la lluvia se dibuja solo en el paisaje de arriba (no sobre los datos)
    estrellas = abierto && efectoActivo('estrellas')
      ? Array.from({ length: cant(area / 9000) }, () => ({ x: Math.random() * cvW, y: Math.random() * cvH * 0.7, r: 0.3 + Math.random() * 1.1 })) : [];
    const n = { despejado: 0, parcial: 3, nublado: 5, niebla: 5, lluvia: 5, tormenta: 5 }[amb.tipo];
    nubes = efectoActivo('nubes') ? Array.from({ length: Math.round(n * limitar(multFx(), 0.7, 1.3)) }, () => ({ x: Math.random() * cvW, y: cvH * (0.05 + Math.random() * 0.45), r: cvW * (0.18 + Math.random() * 0.18), v: 0.01 + Math.random() * 0.02 })) : [];
  }
  // ---- Fuegos artificiales del 24 y del 31, en el cielo de toda la pantalla ----
  // Cohetes que suben desde abajo y estallan alrededor de la portada (se ven también a través de las tarjetas de vidrio).
  // Cuatro estallidos: esfera, anillo, doble color y «sauce» dorado que cae lento; colores de la bandera y de fiesta.
  // Gran final en los primeros 3 minutos después de la medianoche. Nunca con movimiento reducido, con los efectos apagados,
  // sin «Efectos especiales» o con el interruptor «Fuegos artificiales» apagado (<html class="sin-fuegos">).
  const COL_FUEGOS = ['255,82,70', '255,255,255', '90,140,255', '255,214,102', '120,230,140', '255,140,200', '150,220,255'];
  let cFuegos = [], cProxCohete = 0;
  const fuegosPermitidos = () => fx && !REDUCIDO && efectoActivo('especiales') && !document.documentElement.classList.contains('sin-fuegos') && hayFuegos() > 0;
  function fuegosCielo(t, dt) {
    const modo = fuegosPermitidos() ? hayFuegos() : 0;
    document.documentElement.classList.toggle('fuegos-vivos', modo > 0 || cFuegos.length > 0);
    if (!modo && !cFuegos.length) return;
    const escala = Math.min(cvW, cvH * 0.8), subiendo = cFuegos.filter(f => !f.chispas).length;
    if (modo && t >= cProxCohete && subiendo < (modo === 2 ? 6 : 3)) {
      cProxCohete = t + (modo === 2 ? 250 + Math.random() * 350 : 700 + Math.random() * 900) / Math.max(0.4, prefsAnim.intensidad || 1);
      const meta = cvH * (0.08 + Math.random() * 0.34);
      cFuegos.push({ x: cvW * (0.12 + Math.random() * 0.76), y: cvH + 10, meta, v: (cvH + 10 - meta) / (900 + Math.random() * 400),
        tipo: ['esfera', 'esfera', 'anillo', 'doble', 'sauce'][Math.floor(Math.random() * 5)],
        c: COL_FUEGOS[Math.floor(Math.random() * COL_FUEGOS.length)], c2: COL_FUEGOS[Math.floor(Math.random() * COL_FUEGOS.length)], estela: [] });
      const ult = cFuegos[cFuegos.length - 1];                       // uno de cada tres cohetes silba al subir (sube en ~1–1,3 s)
      if (Math.random() < 0.35 && window.climaSonido && climaSonido.cohete) climaSonido.cohete((ult.y - ult.meta) / ult.v / 1000 * 0.9);
    }
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.lineCap = 'round';
    cFuegos = cFuegos.filter(f => {
      if (!f.chispas) {                                             // subiendo: una chispa con su estela
        f.y -= f.v * dt; f.v = Math.max(f.v * Math.exp(-dt / 1800), 0.05);
        f.estela.push([f.x + Math.sin(f.y * 0.05) * 0.6, f.y]); if (f.estela.length > 10) f.estela.shift();
        cx.strokeStyle = 'rgba(255,220,170,0.5)'; cx.lineWidth = 1.6; cx.beginPath(); f.estela.forEach(([x, y], i) => i ? cx.lineTo(x, y) : cx.moveTo(x, y)); cx.stroke();
        cx.fillStyle = 'rgba(255,240,210,0.95)'; cx.beginPath(); cx.arc(f.x, f.y, 1.8, 0, 6.283); cx.fill();
        if (f.y <= f.meta) estallar(f, escala);
        return true;
      }
      f.vida += dt; const u = f.vida / f.dur; if (u >= 1) return false;
      if (u < 0.25) {                                               // el resplandor del estallido
        const r = escala * 0.34, gl = cx.createRadialGradient(f.cx, f.cy, 0, f.cx, f.cy, r);
        gl.addColorStop(0, `rgba(${f.c},${0.3 * (1 - u * 4)})`); gl.addColorStop(1, `rgba(${f.c},0)`); cx.fillStyle = gl; cx.fillRect(f.cx - r, f.cy - r, 2 * r, 2 * r);
      }
      const sauce = f.tipo === 'sauce', ar = Math.exp(-dt / (sauce ? 1400 : 700)), g = (sauce ? 9e-5 : 5e-5) * dt, largo = sauce ? 130 : 70;
      for (const c of f.chispas) {
        c.vx *= ar; c.vy = c.vy * ar + g; c.x += c.vx * dt; c.y += c.vy * dt;
        const a = (1 - u) ** 1.4 * (c.titila ? 0.55 + 0.45 * Math.sin(t / 60 + c.titila) : 1);
        cx.strokeStyle = `rgba(${c.col},${0.9 * a})`; cx.lineWidth = c.ancho;
        cx.beginPath(); cx.moveTo(c.x, c.y); cx.lineTo(c.x - c.vx * largo, c.y - c.vy * largo); cx.stroke();
      }
      return true;
    });
    cx.restore();
  }
  function estallar(f, escala) {
    const sauce = f.tipo === 'sauce', n = Math.round((f.tipo === 'anillo' ? 56 : sauce ? 70 : 84) * Math.max(0.5, nivelR())), vel = escala * (0.0005 + Math.random() * 0.00016);
    f.chispas = []; f.cx = f.x; f.cy = f.y; f.vida = 0; f.dur = sauce ? 2600 : 1700 + Math.random() * 500;
    if (sauce) f.c = '255,200,110';
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283 + Math.random() * 0.08, s = vel * (f.tipo === 'anillo' ? 1 : sauce ? 0.55 + Math.random() * 0.5 : 0.35 + Math.random() * 0.75);
      f.chispas.push({ x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col: f.tipo === 'doble' && i % 2 ? f.c2 : f.c, ancho: sauce ? 1.5 : 2.1, titila: Math.random() < 0.3 ? Math.random() * 6 : 0 });
    }
    if (window.climaSonido && climaSonido.estallido) climaSonido.estallido(0.55 + Math.random() * 0.45, f.tipo);   // suena solo si el sonido del clima está encendido
  }
  function pintarCielo(t, dt, quieto) {
    if (!quieto) latidoRayo(t, dt || 0);
    if (!prefsAnim.fondo) { if (!cieloLimpio) { cx.clearRect(0, 0, cvW, cvH); cieloLimpio = true; } return; }   // fondo apagado: el lienzo queda limpio
    // El fondo cambia muy despacio (nubes de menos de 1 px por cuadro) y repintarlo obliga al navegador a recomponer toda la página
    // (los paneles translúcidos se apoyan en él): basta con repintarlo ~15 veces por segundo, salvo durante un relámpago.
    if (!quieto) {
      cAcum += dt || 0;
      if (cAcum < 62 && !cieloLimpio && cClave === claveCielo() && destello <= 0.02 && cDestello <= 0.02 && !cFuegos.length && !fuegosPermitidos()) return;   // con fuegos: a ritmo completo
      dt = cAcum; cAcum = 0;
    }
    cDestello = destello;
    cieloLimpio = false;
    if (cClave !== claveCielo()) armarParticulas();
    if (!vEsc.Ph) avanzarVisual(0, true);
    const A = amb, kEstr = vEsc.esc[1], kLuna = vEsc.esc[4], luz = vEsc.esc[6], ast = arcoAstros();
    cx.clearRect(0, 0, cvW, cvH);
    if (!quieto) fuegosCielo(t, dt || 0);
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
    const V = cViejo;
    if (V) { V.k = quieto ? 0 : V.k - dt / 1500; if (V.k <= 0) cViejo = null; }
    const fv = cViejo ? V.k * V.k * (3 - 2 * V.k) : 0;             // cuánto queda de lo anterior (suavizado)
    const pintarEstrellas = (lista, a) => {                         // estrellas en 4 grupos que titilan a destiempo
      cx.fillStyle = '#fff';
      for (let k = 0; k < 4; k++) { cx.globalAlpha = a * (0.35 + 0.45 * Math.sin(t / 900 + k * 1.7) ** 2); cx.beginPath(); for (let i = k; i < lista.length; i += 4) { const s = lista[i]; cx.moveTo(s.x + s.r, s.y); cx.arc(s.x, s.y, s.r, 0, 6.283); } cx.fill(); }
      cx.globalAlpha = 1;
    };
    if (estrellas.length && kEstr > 0.01) pintarEstrellas(estrellas, kEstr);
    if (fv && V.estrellas.length && V.kE > 0.01) pintarEstrellas(V.estrellas, V.kE * fv);
    const oscuras = A.tipo === 'lluvia' || A.tipo === 'tormenta';
    const ca = A.tipo === 'tormenta' ? 0.34 : A.tipo === 'niebla' ? 0.24 : 0.12 + 0.05 * luz;
    const cc = oscuras ? '40,50,70' : `${Math.round(150 + 105 * luz)},${Math.round(165 + 90 * luz)},${Math.round(200 + 55 * luz)}`;
    const pintarNube = (n, a) => {
      if (!quieto) { n.x += n.v * dt * (1 + A.viento / 25); if (n.x - n.r * 1.8 > cvW) n.x = -n.r * 1.8; }
      const g = cx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, `rgba(${cc},${a})`); g.addColorStop(1, `rgba(${cc},0)`);
      cx.save(); cx.translate(n.x, n.y); cx.scale(1.8, 0.55); cx.translate(-n.x, -n.y);
      cx.fillStyle = g; cx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2); cx.restore();   // el recuadro de la nube, no un círculo trazado
    };
    if (fv) V.nubes.forEach(n => pintarNube(n, ca * fv));
    nubes.forEach(n => pintarNube(n, ca * (1 - fv)));
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
    Object.assign(amb, { tipo, fase, dia, dorado, lluvia, sol: m ? m.sol : null, viento: a.wind_speed_10m || 0, temp: a.temperature_2m, previa: !!vp, granizo: tipo === 'tormenta' && (cod === 96 || cod === 99), mojado: vp ? 0 : d ? charcosRecientes(d) : (amb.mojado || 0) });
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
