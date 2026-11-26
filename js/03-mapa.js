/* Clima PY — Mapa de departamentos y ciudades, deslizador de horas, comparar ciudades, radar, rutas, búsqueda de lugares, tema y unidad.
 * Parte del código de la app, dividido por temas en js/01…12 (se cargan en orden desde index.html y comparten
 * las mismas variables). Usa GEO, definido en js/geo.js. */
'use strict';

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
      pts += `<circle class="zona" data-ciudad="${escObs(c.n)}" cx="${X(sx)}" cy="${Y(sy)}" r="${u(Math.max(rpx + 3, 11))}"/>`;
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
      const w = d ? clima(d.weather_code, d.is_day).svg + ' ' : '';
      html = `<b>${escObs(c.n)}</b> · ${nombreDep(c.dep)}<br>${w}${d ? grados(d.temperature_2m) + UT() : 'sin datos'}`;
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
    $('chipSel').innerHTML = d ? `${clima(d.weather_code, d.is_day).svg}<span>${escObs(c.n)} · ${grados(d.temperature_2m)}</span>` : `<span>${escObs(c.n)}</span>`;
  }

  // Capas del mapa (botones) y leyenda de colores
  function pintarCapas() {
    $('capas').innerHTML = Object.entries(CAPAS).map(([id, c]) =>
      `<button class="capa${id === capaId ? ' on' : ''}" role="tab" aria-selected="${id === capaId}" data-capa="${id}">${icono(c.icono)}<span>${c.nombre}</span></button>`).join('');
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
      anotarConsultas(lote.length);
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
  function botonReloj(on) { const b = $('hPlay'); b.innerHTML = icono(on ? 'pausa' : 'reproducir'); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Pausar' : 'Reproducir'); }
  function pararReloj() { clearInterval(relojMapa); relojMapa = null; botonReloj(false); }
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
    botonReloj(true);
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
      CIUDADES.map(c => c.n).sort((x, y) => x.localeCompare(y, 'es')).map(n => `<option${n === compSel[i] ? ' selected' : ''}>${escObs(n)}</option>`).join('') + `</select>`).join('');
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
        <thead><tr><th></th>${items.map(x => `<th scope="col"><span class="comp-punto" style="background:${x.col}"></span>${escObs(x.c.n)}</th>`).join('')}</tr></thead>
        <tbody>
          ${fila('Ahora', d => { const w = clima(d.current.weather_code, d.current.is_day); return `<span class="con-ic">${w.svg}<span>${w.texto}</span></span>`; })}
          ${fila('Temperatura', d => `<b>${grados(d.current.temperature_2m) + UT()}</b>`)}
          ${fila('Sensación', d => grados(d.current.apparent_temperature) + UT())}
          ${fila('Máx. / mín. hoy', d => `${grados(d.daily.temperature_2m_max[0])} / ${grados(d.daily.temperature_2m_min[0])}`)}
          ${fila('Humedad', d => num(d.current.relative_humidity_2m, '%'))}
          ${fila('Viento', d => `${num(d.current.wind_speed_10m, ' km/h')} ${dirViento(d.current.wind_direction_10m)}`)}
          ${fila('Prob. de lluvia hoy', d => num(d.daily.precipitation_probability_max[0], '%'))}
          ${fila('Índice UV (máx. hoy)', d => num(d.daily.uv_index_max[0], ''))}
          ${fila('Presión', d => num(d.current.pressure_msl, ' hPa'))}
          ${fila('Mañana', d => { const w = clima(d.daily.weather_code[1], 1); return `<span class="con-ic">${w.svg}<span>${grados(d.daily.temperature_2m_max[1])} / ${grados(d.daily.temperature_2m_min[1])}</span></span>`; })}
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
    $('btnRadarPlay').innerHTML = icono(radarPausado ? 'reproducir' : 'pausa') + `<span>${radarPausado ? 'Reanudar' : 'Pausar'}</span>`;
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
      cerrar.dataset.lugar = 'x'; cerrar.innerHTML = icono('cerrar'); cerrar.setAttribute('aria-label', 'Cerrar');
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
      cerrar.dataset.lugar = 'x'; cerrar.innerHTML = icono('cerrar'); cerrar.setAttribute('aria-label', 'Cerrar');
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
