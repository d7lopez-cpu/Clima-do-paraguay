/* Clima PY — Acciones de la persona: elegir ciudad, favoritas, compartir, buscador, cerca de mí, actualizar, avisos de tormenta, instalar, menú.
 * Parte del código de la app, dividido por temas en js/01…12 (se cargan en orden desde index.html y comparten
 * las mismas variables). Usa GEO, definido en js/geo.js. */
'use strict';

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
        `${d ? clima(d.weather_code, d.is_day).svg : '<span class="ic ic-espera" aria-hidden="true"></span>'}<b>${escObs(c.n)}</b><small>${d ? grados(d.temperature_2m) : '--'}</small></button>`;
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
      // la edad que se muestra es la del dato de la ciudad elegida (su cuarto de hora de Open-Meteo), no la del último pedido
      const t = Math.min(msDato(datos[seleccionada]) || ultimaOk, Date.now()), min = Math.round((Date.now() - t) / 60000), hora = fmtHora(new Date(t));
      if (ultimoError) { clase = 'error'; texto = `Sin conexión · datos de las ${hora}`; }
      else if (min >= 45) { clase = 'viejo'; texto = min >= 90 ? `Datos de hace ${Math.round(min / 60)} h` : `Datos de hace ${min} min`; }
      else { clase = 'ok'; texto = `En vivo · datos de las ${hora}`; }
    }
    el.className = 'pill ' + clase;
    el.textContent = texto;
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
      ultimaOk = r.omitido ? ultimaOk : Date.now(); ultimoError = false; ok = true; hayDatos = true;
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
    aviso(favoritas.size ? 'Te avisaré si hay tormenta en tus favoritas mientras la app esté abierta.' : 'Activados. Marca tus ciudades favoritas para recibir avisos de ellas.');
  });
  async function avisarTormentas() {
    if (!avisosOn || !('Notification' in window) || Notification.permission !== 'granted') return;
    let hechos = {};
    try { hechos = JSON.parse(leer('clima-py-avisados', '{}')) || {}; } catch (e) { hechos = {}; }
    for (const n of favoritas) {
      const a = datos[n];
      if (!a || ![95, 96, 99].includes(a.weather_code) || Date.now() - (hechos[n] || 0) < 3 * 3600 * 1000) continue;   // un aviso por ciudad cada 3 h
      hechos[n] = Date.now();
      const opc = { body: `${tr(clima(a.weather_code, a.is_day).texto)} · ${grados(a.temperature_2m)}`, icon: 'img/icono-192.png', badge: 'img/icono-192.png', tag: 'tormenta-' + n };
      try {
        const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
        if (reg) await reg.showNotification(tr('Tormenta en ' + n), opc); else new Notification(tr('Tormenta en ' + n), opc);
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
      estado.textContent = 'Sin conexión · usando datos guardados';
    }
  });
  window.addEventListener('online', () => {
    aviso('Conexión recuperada. Actualizando el clima…');
    if (!document.hidden) actualizarTodo();
  });

  // ---- Menú del celular: idioma, tema, °C/°F, sonido, efectos, ajustes, avisos y accesos rápidos ----
  // En pantallas grandes todo está a la vista (el botón no se muestra); en el celular se despliega bajo la barra superior.
  const cabecera = document.querySelector('.cabecera');
  function abrirMenu(si) {
    cabecera.classList.toggle('menu-abierto', si);
    $('btnMenu').setAttribute('aria-expanded', String(si));
  }
  $('btnMenu').addEventListener('click', () => abrirMenu(!cabecera.classList.contains('menu-abierto')));
  // los accesos que llevan a otra parte cierran el menú; los interruptores (tema, sonido…) lo dejan abierto para seguir ajustando
  $('menuPanel').addEventListener('click', e => { if (e.target.closest('.acciones button, #btnAjustesAnim, #btnAcerca')) abrirMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && cabecera.classList.contains('menu-abierto')) { abrirMenu(false); $('btnMenu').focus(); } });

  // ---- «Acerca de Clima PY»: quién la hizo, versión, cómo instalarla, privacidad y fuentes de datos ----
  const dlgAcerca = $('dlgAcerca');
  $('btnAcerca').addEventListener('click', async () => {
    $('acercaInstalar').hidden = !promptInstalar;                  // el botón de instalar, solo si el navegador lo ofrece
    if (typeof dlgAcerca.showModal === 'function') dlgAcerca.showModal(); else dlgAcerca.setAttribute('open', '');
    try {                                                          // la versión es la del service worker (VERSION en sw.js)
      const v = (await (await fetch('sw.js', { cache: 'no-cache' })).text()).match(/const VERSION = '([^']+)'/);
      if (v) $('acercaVersion').textContent = 'Versión ' + v[1].replace(/^v/, '');
    } catch (e) { /* sin internet: queda sin número */ }
  });
  $('acercaInstalar').addEventListener('click', () => { dlgAcerca.close(); $('btnInstalar').click(); });
  dlgAcerca.addEventListener('close', () => { $('btnAcerca').focus(); });
  dlgAcerca.addEventListener('click', e => { if (e.target === dlgAcerca) dlgAcerca.close(); });   // tocar fuera de la hoja la cierra
