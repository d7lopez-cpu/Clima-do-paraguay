/* Clima PY — Sonido del clima (paisaje sonoro sintetizado con Web Audio), música navideña opcional y sonidos de los fuegos artificiales.
 * Parte del código de la app, dividido por temas en js/01…12 (se cargan en orden desde index.html y comparten
 * las mismas variables). Usa GEO, definido en js/geo.js. */
'use strict';

  // ============ SONIDO DEL CLIMA ============
  // Un paisaje sonoro que cambia con el clima de la ciudad elegida (o con la vista previa). Todo se fabrica aquí mismo con el navegador
  // (Web Audio: ruido y osciladores, no se descarga nada) y solo suena si la persona toca 🔈.
  // MEZCLA LIMPIA: en cada estado suena UNA cama (el fondo: brisa, lluvia o grillos de noche) y como mucho DOS acentos
  // (aves, chicharras, ranas, ráfagas, granizo, truenos), elegidos por prioridad en escena(); el resto calla del todo.
  //  ☀️ día: brisa y aves del monte (benteveo, chopí, zorzal, hornero, chingolo, palomas, cotorras, pájaro campana); con calor de verano (≥ 28 °C, de noviembre a marzo) chicharras · 🌇 hora dorada: coro de aves
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
  function estallido(fuerza, tipo) {
    if (!au || !sonando || au.ctx.state !== 'running' || !hayLugar(12)) return false;
    const ahora = performance.now(); if (ahora - (au.ultEstallido || 0) < 250) return false; au.ultEstallido = ahora;
    const { ctx, buf } = au, T = ctx.currentTime + MARGEN, k = limitar(Number(fuerza) || 0.6, 0.1, 1), sal = salida(au.duckAcentos);
    const ruido = (t, tipoF, f0, f1, vol, ataque, dur) => {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = buf; fl.type = tipoF; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(sal); vigilar(s).start(t, Math.random() * 4, dur + 0.05);
    };
    // 1) el golpe grave que se siente en el pecho: un seno que cae de ~95 a ~38 Hz
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.frequency.setValueAtTime(azar(85, 105), T); o.frequency.exponentialRampToValueAtTime(38, T + 0.45);
    og.gain.setValueAtTime(0.0001, T); og.gain.exponentialRampToValueAtTime(0.75 * k, T + 0.006); og.gain.exponentialRampToValueAtTime(0.0001, T + 0.6);
    o.connect(og); og.connect(sal); vigilar(o).start(T); o.stop(T + 0.65);
    // 2) el estampido (ruido que se apaga de agudo a grave) y su retumbo, que llega un poco después
    ruido(T, 'lowpass', 2600, 160, 0.95 * k, 0.004, 0.9);
    ruido(T + azar(0.18, 0.32), 'lowpass', 520, 70, 0.32 * k, 0.08, 1.3);
    // 3) chisporroteo: golpecitos agudos que caen mientras se apagan las chispas (más largo en el «sauce»)
    const sauce = tipo === 'sauce', n = sauce ? 26 : tipo === 'anillo' ? 10 : 16, largo = sauce ? 2.2 : 1.3;
    for (let i = 0; i < n; i++) {
      const t = T + 0.25 + Math.pow(Math.random(), 0.8) * largo, c = ctx.createBufferSource(), h = ctx.createBiquadFilter(), cg = ctx.createGain(), d = azar(0.012, 0.03);
      c.buffer = buf; h.type = 'highpass'; h.frequency.value = azar(2800, 7500);
      cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(azar(0.08, 0.2) * k, t + 0.002); cg.gain.exponentialRampToValueAtTime(0.0001, t + d);
      c.connect(h); h.connect(cg); cg.connect(sal); vigilar(c).start(t, Math.random() * 4, d + 0.02);
    }
    return true;
  }
  // Silbido de un cohete que sube (los «silbadores»): ruido en una banda angosta que sube de tono durante el ascenso
  function silbidoCohete(dur) {
    if (!au || !sonando || au.ctx.state !== 'running' || !hayLugar(1)) return false;
    const { ctx, buf } = au, T = ctx.currentTime + MARGEN, D = limitar(Number(dur) || 1.1, 0.4, 2.5), sal = salida(au.duckAcentos);
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; s.loop = true; fl.type = 'bandpass'; fl.Q.value = 18;
    fl.frequency.setValueAtTime(azar(700, 900), T); fl.frequency.exponentialRampToValueAtTime(azar(2400, 3200), T + D);
    g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(0.5, T + 0.15); g.gain.setValueAtTime(0.5, T + D * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, T + D);
    s.connect(fl); fl.connect(g); g.connect(sal); vigilar(s).start(T, Math.random() * 4); s.stop(T + D + 0.05);
    return true;
  }

  // ctxDado: un OfflineAudioContext para medir (climaSonido.renderizar); sin él se crea el contexto real que suena
  function crearAudio(ctxDado) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!ctxDado && !AC) return null;
    // latencyHint 'playback': el navegador usa un búfer de salida más grande. Unos ms más de retraso (no importa en un paisaje
    // sonoro) a cambio de que el audio no se corte cuando el celular está ocupado dibujando la animación.
    let ctxNuevo = ctxDado;
    if (!ctxNuevo) { try { ctxNuevo = new AC({ latencyHint: 'playback' }); } catch (_) { ctxNuevo = new AC(); } }
    const ctx = ctxNuevo, master = ctx.createGain(), suave = ctx.createBiquadFilter(), lim = ctx.createDynamicsCompressor();
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

    // Capas que hoy no suenan se DESCONECTAN (después de su fundido de salida): así el navegador deja de calcularlas. Antes las ~15 capas
    // fijas se procesaban siempre, aunque estuvieran en silencio, y en celulares eso cortaba el audio. revisarDormidos() las conecta y desconecta.
    const dormidos = [];
    const dormir = (nodo, destino, params, ambiente) => { dormidos.push({ nodo, destino, params, ambiente, conectado: false, hasta: 0 }); };
    // Eco barato: 6 filtros peine (retardo con realimentación amortiguada), repartidos entre izquierda y derecha. Reemplaza a los dos
    // ConvolverNode (respuestas de 1,8 y 1,2 s en estéreo), que eran lo más pesado del sonido en un celular. Mismo nivel de eco (medido).
    const eco = (t60, corte, nivel) => {
      const ent = ctx.createGain(), mez = ctx.createChannelMerger(2), sal = ctx.createGain(), pre = ctx.createBiquadFilter();
      pre.type = 'lowpass'; pre.frequency.value = corte; ent.connect(pre); sal.gain.value = nivel; mez.connect(sal);
      [0.0297, 0.0371, 0.0411, 0.0437, 0.0533, 0.0617].forEach((d, i) => {
        const dl = ctx.createDelay(0.1), fb = ctx.createGain(), am = ctx.createBiquadFilter();
        dl.delayTime.value = d; fb.gain.value = Math.pow(10, -3 * d / t60); am.type = 'lowpass'; am.frequency.value = corte;
        pre.connect(dl); dl.connect(am); am.connect(fb); fb.connect(dl); am.connect(mez, 0, i % 2);
      });
      return { ent, sal };
    };
    // Un poco de eco de espacio abierto para las aves y las ranas (vuelve por el grupo de acentos: el trueno también lo agacha)
    const rev = eco(1.1, 6000, 0.6 * 0.081);
    const bus = (destino, eco) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(destino); if (eco) { const e = ctx.createGain(); e.gain.value = eco; g.connect(e); e.connect(rev.ent); } return g; };
    const aves = bus(duckAcentos, 0.5), ranas = bus(duckAcentos, 1), gotas = bus(duckCama), busGranizo = bus(duckCama);
    dormir(rev.sal, duckAcentos, [aves.gain, ranas.gain], true);

    // Una capa de ruido filtrado: fuente → filtros → env (envolvente propia: brisa que respira, ráfagas) → g (nivel de la escena)
    // Como el nivel va DESPUÉS de la envolvente, con nivel 0 la capa queda en silencio real.
    const capa = (tipo, f, q, alto) => {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), env = ctx.createGain(), g = ctx.createGain();
      s.buffer = buf; s.loop = true; fl.type = tipo; fl.frequency.value = f; fl.Q.value = q; hp.type = 'highpass'; hp.frequency.value = alto || 20; g.gain.value = 0;
      s.connect(fl); fl.connect(hp); hp.connect(env); env.connect(g); dormir(g, duckCama, [g.gain], true); s.start(0, Math.random() * 3);
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
      nivel.gain.value = 0; s.connect(bp); bp.connect(am); am.connect(sw); sw.connect(nivel); dormir(nivel, duckAcentos, [nivel.gain], true); s.start(0, Math.random() * 3); l.start();
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
      o.connect(am); am.connect(gate); gate.connect(nivel); dormir(nivel, duckAcentos, [nivel.gain], true); o.start();
      return { nivel, ritmo: gr.p.frequency, grupo };
    };
    const gri = [grillo(4300, 29, 1.9), grillo(4650, 33, 2.3), grillo(5050, 27, 1.6)];

    // Un solo reloj cada 200 ms programa por adelantado, con el reloj del AUDIO (no el del temporizador), todo lo que cae en los
    // próximos ADELANTO s. Antes había dos setInterval (100 y 250 ms) que creaban los sonidos «para ya»: si la página se trababa un
    // momento (la animación, el celular ocupado), las gotas llegaban a tirones, en ráfagas y con huecos. Ahora cada gota tiene su hora
    // exacta y un atraso del temporizador de hasta ~0,3 s no se nota. Lo atrasado (tras una pausa larga) se salta, nunca se amontona.
    // Nada se crea si el contexto no está corriendo (suspendido o interrumpido): sus sonidos no terminarían nunca y se acumularían.
    const ADELANTO = 0.5;
    const listo = () => sonando && !document.hidden && ctx.state === 'running' && au && au.ctx === ctx;
    // Llegadas con `tasa` por segundo, cada una a su hora en el reloj del audio. Separación al azar entre 0,25 y 1,75 veces la media:
    // suena irregular pero pareja (un reparto de Poisson puro dejaba huecos de casi 1 s con llovizna, que se oían como cortes)
    const llegadas = (clave, tasa, sonar, ahora, hasta) => {
      if (!(tasa > 0)) { au[clave] = 0; return; }
      let t = Math.max(au[clave] || 0, ahora + 0.05);
      while (t < hasta) { sonar(t); t += azar(0.25, 1.75) / tasa; }
      au[clave] = t;
    };
    const pulso = () => {
      const ahora = ctx.currentTime, hasta = ahora + ADELANTO, dt = limitar(ahora - (au.ultPulso || ahora), 0, 0.5);
      au.ultPulso = ahora;
      llegadas('proxGota', au.tasaGotas * 25, gota, ahora, hasta);            // ~25 gotas por segundo con lluvia plena
      llegadas('proxPiedra', au.hayPiedras ? 25 : 0, piedra, ahora, hasta);
      if (Math.random() < 1 - Math.exp(-au.tasaAves * 0.28 * dt)) llamadaAve();
      if (Math.random() < 1 - Math.exp(-au.tasaRanas * 0.48 * dt)) rana();
      if (ahora >= au.proxRafaga) programarRafaga();
      // si el cielo no está dibujando relámpagos (fondo apagado, movimiento reducido…), los truenos llegan solos de vez en cuando
      if (amb.tipo === 'tormenta' && performance.now() - au.ultTrueno > au.esperaTrueno) trueno();
    };
    const reloj = ctxDado ? 0 : setInterval(() => {
      if (!au || au.ctx !== ctx) return;
      if (listo()) pulso(); else au.ultPulso = 0;
      revisarDormidos();
    }, 200);
    // Un poco de sala para la música (un eco corto propio: el de las aves pasa por el ambiente, que la música baja)
    const salaM = eco(0.8, 5000, 0.18 * 0.063);
    musG.connect(salaM.ent); dormir(salaM.sal, master, [musG.gain], false);
    // iOS «interrumpe» el audio (una llamada, otra app que suena) y no lo reanuda solo: se reintenta al volver y con el próximo toque
    if (!ctxDado) {
      ctx.onstatechange = () => { if (ctx.state === 'interrupted' && au && au.ctx === ctx && (sonando || mus.activa) && !document.hidden) ctx.resume().catch(() => {}); };
      const despertar = () => { if (au && au.ctx === ctx && (sonando || mus.activa) && !document.hidden && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {}); };
      document.addEventListener('pointerdown', despertar, { capture: true, passive: true });
      document.addEventListener('keydown', despertar, { capture: true });
    }
    return { ctx, offline: !!ctxDado, pulso, dormidos, master, suave, lim, ambG, musG, duckCama, duckAcentos, busTruenos, viento, rafaga, silbido, lluvia, lluviaBajo, cig, gri, aves, ranas, gotas, busGranizo, rev, buf,
      reloj, panes: new Map(), proxGota: 0, proxPiedra: 0, ultPulso: 0, tasaAves: 0, tasaRanas: 0, tasaGotas: 0, hayPiedras: false, proxRafaga: 0, ultTrueno: performance.now(), esperaTrueno: 15000,
      truenoLibre: 0, truenos: [], truenosTotal: 0, truenosDescartados: 0, fuentes: 0, objetivo: new WeakMap(), escena: null, niveles: {}, solo: null };
  }

  // Cuenta los sonidos sueltos vivos (para el tope) y los descuenta cuando terminan
  function vigilar(src) { au.fuentes++; const a = au; src.onended = () => { a.fuentes--; }; return src; }
  const hayLugar = (n) => au && au.fuentes + (n || 1) <= TOPE_FUENTES;
  // Un punto al azar del estéreo. Cada grupo tiene 5 posiciones fijas que se reparten al azar (antes cada gota creaba su propio
  // StereoPanner: ~25 nodos más por segundo con lluvia, que el navegador tenía que crear, calcular y recoger).
  function salida(destino) {
    const { ctx } = au; if (!ctx.createStereoPanner) return destino;
    let l = au.panes.get(destino);
    if (!l) { l = [-0.8, -0.4, 0, 0.4, 0.8].map(x => { const p = ctx.createStereoPanner(); p.pan.value = x + azar(-0.1, 0.1); p.connect(destino); return p; }); au.panes.set(destino, l); }
    return l[Math.floor(Math.random() * l.length)];
  }
  // Los sonidos sueltos se programan al menos 50 ms en el futuro: algo programado «para ya» llega tarde al hilo del audio y su
  // envolvente arranca a la mitad (un clic, un corte)
  const MARGEN = 0.05;
  // Una nota de ave: un tono que se desliza de f0 a f1 (opcionalmente con vibrato)
  function tono(dest, f0, f1, t0, dur, vol, vib) {
    const { ctx } = au, T = ctx.currentTime + MARGEN + t0, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, T); o.frequency.exponentialRampToValueAtTime(f1, T + dur);
    if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vib.hz; lg.gain.value = vib.prof; l.connect(lg); lg.connect(o.frequency); l.start(T); l.stop(T + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(vol, T + Math.min(0.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, T + dur);
    o.connect(g); g.connect(dest); vigilar(o).start(T); o.stop(T + dur + 0.05);
  }
  // Un canto con curva de tono (puntos [s, Hz]); arm: nivel del 2.º armónico (voz más llena y áspera, como la del benteveo)
  function canto(dest, curva, t0, vol, arm) {
    const { ctx } = au, T = ctx.currentTime + MARGEN + t0, dur = curva[curva.length - 1][0], g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(vol, T + Math.min(0.015, dur / 4));
    g.gain.setValueAtTime(vol, T + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, T + dur);
    g.connect(dest);
    for (const [k, a] of arm ? [[1, 1], [2, arm]] : [[1, 1]]) {
      const o = ctx.createOscillator(); let d = g;
      curva.forEach(([s, f], i) => i ? o.frequency.exponentialRampToValueAtTime(f * k, T + s) : o.frequency.setValueAtTime(f * k, T + s));
      if (a !== 1) { d = ctx.createGain(); d.gain.value = a; d.connect(g); }
      o.connect(d); vigilar(o).start(T); o.stop(T + dur + 0.05);
    }
  }
  // Aves del monte paraguayo, cada una con su canto (sintetizado a partir de cómo suenan de verdad):
  //  benteveo o pitogüé («bien-te-veo»), chopí («cho-pí», el que le da el nombre), zorzal colorado o havía (frases aflautadas),
  //  hornero u ogaraity (el trino que se acelera), chingolo (silbidos y un trino), palomas (el arrullo), cotorras (charla áspera, más
  //  en la hora dorada) y, de vez en cuando, el pájaro campana (el ave nacional: un «tán» metálico que suena lejos, en el monte).
  const AVES_DIA = [['benteveo', 0.2], ['chopi', 0.12], ['zorzal', 0.14], ['hornero', 0.1], ['chingolo', 0.1], ['paloma', 0.16], ['cotorras', 0.1], ['campana', 0.08]];
  function llamadaAve() {
    if (!hayLugar(24)) return;
    const sal = salida(au.aves), v = azar(0.45, 1), pesos = AVES_DIA.map(([n, p]) => [n, n === 'cotorras' && amb.dorado ? 0.3 : p]);
    let r = Math.random() * pesos.reduce((a, x) => a + x[1], 0), cual = pesos[0][0];
    for (const [n, p] of pesos) { if (r < p) { cual = n; break; } r -= p; }
    if (cual === 'benteveo') {                                     // bien - te - veo: dos notas cortas y una larga que cae
      const k = azar(0.92, 1.08);
      canto(sal, [[0, 2900 * k], [0.06, 3300 * k]], 0, 0.08 * v, 0.3);
      canto(sal, [[0, 2500 * k], [0.07, 2750 * k]], 0.11, 0.07 * v, 0.3);
      canto(sal, [[0, 3300 * k], [0.08, 3550 * k], [0.3, 2300 * k]], 0.22, 0.09 * v, 0.35);
    } else if (cual === 'chopi') {                                 // cho-pí, a veces dos veces
      const k = azar(0.9, 1.1), n = Math.random() < 0.4 ? 2 : 1;
      for (let i = 0; i < n; i++) { canto(sal, [[0, 1750 * k], [0.15, 1350 * k]], i * 0.75, 0.09 * v); canto(sal, [[0, 1900 * k], [0.22, 3100 * k]], i * 0.75 + 0.21, 0.1 * v); }
    } else if (cual === 'zorzal') {                                // frase aflautada de 4 a 7 notas, con saltos
      const NOTAS = [1900, 2150, 2400, 2550, 2850, 3200], n = Math.round(azar(4, 7)); let t = 0;
      for (let i = 0; i < n; i++) { const f = NOTAS[Math.floor(Math.random() * NOTAS.length)], d = azar(0.1, 0.22); canto(sal, [[0, f], [d * 0.4, f * azar(1.02, 1.12)], [d, f * azar(0.9, 1)]], t, 0.07 * v); t += d + azar(0.04, 0.12); }
    } else if (cual === 'hornero') {                               // trino que se acelera y baja, y se frena al final
      const n = Math.round(azar(9, 13)); let t = 0, f = azar(3000, 3400);
      for (let i = 0; i < n; i++) { canto(sal, [[0, f * 1.06], [0.035, f * 0.9]], t, 0.06 * v); const u = i / n; t += 0.15 - 0.09 * Math.sin(Math.PI * Math.min(1, u * 1.3)); f *= 0.985; }
    } else if (cual === 'chingolo') {                              // dos o tres silbidos claros y un trino
      const k = azar(0.92, 1.08); let t = 0;
      for (const [f0, d] of [[3300, 0.24], [3900, 0.18], [3500, 0.16]].slice(0, Math.random() < 0.5 ? 2 : 3)) { canto(sal, [[0, f0 * k], [d, f0 * k * 0.98]], t, 0.06 * v); t += d + 0.06; }
      for (let i = 0; i < 5; i++) canto(sal, [[0, 4600 * k], [0.03, 4200 * k]], t + i * 0.055, 0.04 * v);
    } else if (cual === 'paloma') {                                // arrullo: cu-CU-cu-cuuu
      const f = azar(380, 470); let t = 0;
      [[0.35, 1], [0.16, 1.08], [0.16, 1.08], [0.42, 0.98]].forEach(([d, k]) => { tono(sal, f * k, f * k * 0.93, t, d, 0.15 * v, { hz: 5.5, prof: 6 }); t += d + 0.07; });
    } else if (cual === 'cotorras') {                              // varias cotorras charlando: chillidos cortos y ásperos
      const n = Math.round(azar(3, 6)); let t = 0;
      for (let i = 0; i < n; i++) { const f = azar(1900, 2700), d = azar(0.06, 0.12); canto(sal, [[0, f], [d * 0.5, f * azar(1.1, 1.3)], [d, f * 0.85]], t, 0.035 * v, 0.6); t += d + azar(0.03, 0.14); }
    } else campana(sal, v);
  }
  // Pájaro campana: golpes metálicos (parciales inarmónicos que se apagan rápido), espaciados; se oye lejos, con el eco del monte
  function campana(sal, v) {
    const { ctx } = au, n = Math.round(azar(2, 4)), f = azar(1100, 1350); let t = 0;
    for (let i = 0; i < n; i++) {
      const T = ctx.currentTime + MARGEN + t;
      [[1, 1, 0.45], [2.02, 0.35, 0.25], [3.1, 0.15, 0.15]].forEach(([k, a, d]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(f * k * 1.01, T); o.frequency.exponentialRampToValueAtTime(f * k, T + 0.05);
        g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(0.11 * v * a, T + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, T + d);
        o.connect(g); g.connect(sal); vigilar(o).start(T); o.stop(T + d + 0.05);
      });
      t += azar(0.9, 1.6);
    }
  }
  // De noche: ranas (croares pulsados), el kururú (sapo: un trino grave y largo) y, sin lluvia, a veces el urutau (silbidos tristes que bajan)
  function rana() {
    if (!hayLugar(10)) return;
    const r = Math.random();
    if (r < 0.2) return kururu();
    if (r < 0.32 && !amb.lluvia) return urutau();
    const { ctx } = au, sal = salida(au.ranas), n = Math.round(azar(2, 5)), f = azar(150, 240); let t = 0;
    for (let i = 0; i < n; i++) {
      const T = ctx.currentTime + MARGEN + t, d = azar(0.1, 0.2), o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), mod = ctx.createGain(), am = ctx.createOscillator(), ag = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.1, T); o.frequency.exponentialRampToValueAtTime(f * 0.8, T + d);
      bp.type = 'bandpass'; bp.frequency.value = f * 3.2; bp.Q.value = 2.5;
      mod.gain.value = 0.5; am.frequency.value = azar(28, 40); ag.gain.value = 0.5; am.connect(ag); ag.connect(mod.gain);
      g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(0.1, T + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, T + d);
      o.connect(bp); bp.connect(mod); mod.connect(g); g.connect(sal);
      vigilar(o).start(T); am.start(T); o.stop(T + d + 0.05); am.stop(T + d + 0.05);
      t += azar(0.17, 0.25);
    }
  }
  function kururu() {                                              // un trino grave de 1,5 a 3 s: pulsos rápidos de un tono áspero
    const { ctx } = au, sal = salida(au.ranas), T = ctx.currentTime + MARGEN, d = azar(1.5, 3), f = azar(620, 780);
    const o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), am = ctx.createGain(), p = ctx.createOscillator(), pf = ctx.createBiquadFilter(), pg = ctx.createGain(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 3;
    p.type = 'square'; p.frequency.value = azar(13, 17); pf.type = 'lowpass'; pf.frequency.value = 60; pg.gain.value = 0.5; am.gain.value = 0.5;
    p.connect(pf); pf.connect(pg); pg.connect(am.gain);
    g.gain.setValueAtTime(0.0001, T); g.gain.exponentialRampToValueAtTime(0.07, T + 0.15); g.gain.setValueAtTime(0.07, T + d - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, T + d);
    o.connect(bp); bp.connect(am); am.connect(g); g.connect(sal);
    vigilar(o).start(T); p.start(T); o.stop(T + d + 0.05); p.stop(T + d + 0.05);
  }
  function urutau() {                                              // 4 a 6 silbidos aflautados que van bajando, el primero más largo
    const sal = salida(au.ranas), f0 = azar(820, 980), n = Math.round(azar(4, 6)); let t = 0, f = f0;
    for (let i = 0; i < n; i++) { const d = i ? azar(0.4, 0.5) : 0.75; tono(sal, f * 1.02, f * 0.96, t, d, (i ? 0.09 : 0.11), { hz: 4.5, prof: f * 0.006 }); t += d + azar(0.3, 0.45); f *= [0.89, 0.94, 0.94, 0.95, 0.95][i] || 0.95; }
  }
  function gota(T) {                                               // una gota (a la hora T del reloj del audio): un toque corto y apagado
    if (!au || !hayLugar()) return;
    const { ctx, buf } = au, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 3200; f.Q.value = 6;
    g.gain.setValueAtTime(0, T); g.gain.linearRampToValueAtTime(0.15 + Math.random() * 0.25, T + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, T + 0.05 + Math.random() * 0.05);
    s.connect(f); f.connect(g); g.connect(salida(au.gotas)); vigilar(s).start(T, Math.random() * 4, 0.12);
  }
  // Granizo: un golpe seco y agudo (piedra sobre chapa o tejas), a veces con un "toc" más grave
  function piedra(T) {
    if (!au || !hayLugar()) return;
    const { ctx, buf } = au, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), d = azar(0.012, 0.03);
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
      aves: dorado ? 'coro de aves' : e.tasaAves < 0.5 ? 'aves lejanas' : 'aves del monte',
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
  // Conecta las capas que deben sonar (antes de que empiece su fundido de entrada) y desconecta las que callan, 3,2 s después de que
  // su objetivo pasó a 0 (los fundidos de salida duran 2,5 s como mucho). Una capa desconectada no le cuesta nada al procesador.
  function revisarDormidos() {
    if (!au) return;
    const ahora = au.ctx.currentTime, obj = p => au.objetivo.get(p) || 0, ambienteOn = obj(au.ambG.gain) > 0;
    for (const d of au.dormidos) {
      if (d.params.some(p => obj(p) > 1e-6) && (!d.ambiente || ambienteOn)) {
        d.hasta = 0;
        if (!d.conectado) { d.nodo.connect(d.destino); d.conectado = true; }
      } else if (d.conectado) {
        if (au.offline || (d.hasta && ahora >= d.hasta)) { try { d.nodo.disconnect(d.destino); } catch (_) { d.nodo.disconnect(); } d.conectado = false; d.hasta = 0; }
        else if (!d.hasta) d.hasta = ahora + 3.2;
      }
    }
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
    revisarDormidos();
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
    estallido: (fuerza, tipo) => estallido(fuerza, tipo),
    // Para el cielo: el silbido de un cohete que sube (duración en s)
    cohete: dur => silbidoCohete(dur)
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
      conA(() => { A.pulso(); if (k === 40 || k === 45) trueno(); });
      off.resume();
    });
    const buf = await off.startRendering();
    buf.info = { truenos: A.truenosTotal, descartados: A.truenosDescartados };
    return buf;
  }
  function visibilidadSonido() { if (au && (sonando || mus.activa)) { if (document.hidden) au.ctx.suspend(); else au.ctx.resume().catch(() => {}); } }
  function pintarBotonSonido() {
    const b = $('btnSonido');
    b.innerHTML = icono(sonando ? 'sonido' : 'silencio'); b.classList.toggle('on', sonando); b.setAttribute('aria-pressed', sonando);
    b.setAttribute('aria-label', sonando ? 'Silenciar el sonido del clima' : 'Activar el sonido del clima');
  }
  // Al salir de la página se libera el audio. Si la página vuelve desde la caché del navegador (atrás/adelante), el botón
  // queda apagado y coherente (antes seguía en 🔊 sin sonar, y una segunda salida ya no liberaba nada).
  window.addEventListener('pagehide', () => {
    sonando = false; mus.activa = false; clearInterval(mus.temporizador); mus.temporizador = 0;
    if (au) { clearInterval(au.reloj); try { au.ctx.close(); } catch (_) {} au = null; }
    pintarBotonSonido();
  });
  $('btnSonido').addEventListener('click', async () => {
    if (!au) { au = crearAudio(); if (!au) { aviso('Tu navegador no permite reproducir sonido.'); return; } }
    sonando = !sonando;
    pintarBotonSonido();
    if (sonando) { try { await au.ctx.resume(); } catch (_) {} }
    if (!sonando) setTimeout(() => { if (!sonando && !mus.activa && au) au.ctx.suspend(); }, 3500);
    mezclar();
    if (sonando) aviso(describirSonido());
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
