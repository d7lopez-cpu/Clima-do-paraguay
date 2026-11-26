/* Clima PY — Panel de ajustes de animación (pestañas Animación, Sonido y Navidad) y vista previa de climas.
 * Parte del código de la app, dividido por temas en js/01…12 (se cargan en orden desde index.html y comparten
 * las mismas variables). Usa GEO, definido en js/geo.js. */
'use strict';

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
    $('daVolMusica').value = v; $('daVolMusicaVal').textContent = v + '%'; $('daVolMusica').setAttribute('aria-valuetext', v + '%');
    dlgAnim.classList.toggle('apagada', !fx);
    sincronizarPrevia();
  }
  function cambiarAnim(cambios) { fijarPrefAnim(cambios); sincronizarPanel(); }
  function salirPrevia() { if (prefsAnim.vistaPrevia) { cambiarAnim({ vistaPrevia: null }); anunciar('Volviste al clima real.'); } }

  $('daReducido').hidden = !REDUCIDO;
  const daTabs = [...$$a('.da-pestanas [role=tab]')];
  function elegirDaTab(id, enfocar) {
    daTabs.forEach(b => {
      const on = b.dataset.da === id;
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; $('daPanel' + b.dataset.da).hidden = !on;
      if (on && enfocar) b.focus();
    });
  }
  daTabs.forEach(b => b.addEventListener('click', () => elegirDaTab(b.dataset.da)));
  $$a('.da-pestanas')[0].addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = daTabs.findIndex(b => b.getAttribute('aria-selected') === 'true'), n = daTabs.length;
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + n) % n;
    elegirDaTab(daTabs[j].dataset.da, true);
  });
  // abrir el panel directamente en una pestaña (lo usan las pruebas y la consola)
  window.climaPanel = Object.freeze({ abrir: id => { $('btnAjustesAnim').click(); elegirDaTab(id || 'Anim'); } });
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
  // Volumen general (sonido del clima y música navideña): dos deslizadores, uno en «Sonido» y otro en «Navidad», siempre iguales
  ['daVolumen', 'daVolMusica'].forEach(id => $(id).addEventListener('input', e => {
    const v = Math.round(Number(e.target.value)) || 0;
    ['daVolumen', 'daVolMusica'].forEach(x => { $(x).value = v; $(x).setAttribute('aria-valuetext', v + '%'); $(x + 'Val').textContent = v + '%'; });
    fijarPrefAnim({ volumen: limitar(v / 100, 0, 1) });
  }));
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
