// Clima PY: set de íconos «Cristal guaraní» (lineales, cuadro 24 × 24, puntas redondeadas, sin relleno).
// Este archivo es la fuente: escribe el sprite <svg id="iconos"> en index.html, entre <!-- ICONOS:INICIO --> y <!-- ICONOS:FIN -->.
// En el código (js/01-base.js), icono('lluvia') devuelve <svg class="ic ic-lluvia"><use href="#i-lluvia"/></svg>; en el HTML se escribe igual a mano.
// El grosor (1,6; 1,8 en la barra inferior) y el color salen de css/estilos.css: stroke = currentColor. Las partes que llevan
// un segundo color (el sol de «parcial», la lluvia) usan style="stroke:var(--ic-2, currentColor)".
// Para agregar o cambiar un ícono: editar la tabla y correr, desde la carpeta del proyecto,  node scripts/iconos.mjs
//   (con --galeria archivo.html [css/estilos.css] [oscuro|claro] además escribe una página con todos los íconos).
import { readFileSync, writeFileSync } from 'node:fs';

const nube = 'M7 18h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.6A3.3 3.3 0 0 0 7 18z';
const nubeAlta = 'M7 14h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.6A3.3 3.3 0 0 0 7 14z';
const nubeChica = 'M17 20H9.5a3.2 3.2 0 0 1-.6-6.3 4.2 4.2 0 0 1 8 .9A2.8 2.8 0 0 1 17 20z';
const sol = 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4';
const luna = 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z';
const p = d => `<path d="${d}"/>`;
const p2 = d => `<path d="${d}" style="stroke:var(--ic-2,currentColor)"/>`;      // segundo color

const ICONOS = {
  // --- clima (de referencia/Guarani-Iconos) ---
  despejado: p(sol),
  'noche-clara': p(luna),
  parcial: p2('M9 5.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7zM9 1.5v1.5M3 9H1.5M4.8 4.8l1 1M13.2 4.8l-1 1') + p(nubeChica),
  'parcial-noche': p2('M11 8.5A4.5 4.5 0 1 1 5.5 3a3.6 3.6 0 0 0 5.5 5.5z') + p(nubeChica),
  nublado: p(nube),
  niebla: p('M5 8h14M3 12h18M5 16h14M8 20h8'),
  llovizna: p(nubeAlta) + p2('M9 18v.01M13 18v.01M17 18v.01M11 21v.01M15 21v.01'),
  lluvia: p(nubeAlta) + p2('M9 17l-1 3M13 17l-1 3M17 17l-1 3'),
  tormenta: p('M7 13h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.6A3.3 3.3 0 0 0 7 13z') + p2('M13 13l-3 4.5h4l-3 4.5'),
  granizo: p(nubeAlta) + p2('M9 17.5a1 1 0 1 0 0 2a1 1 0 1 0 0-2zM15 17.5a1 1 0 1 0 0 2a1 1 0 1 0 0-2zM12 20a1 1 0 1 0 0 2a1 1 0 1 0 0-2z'),
  viento: p('M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8'),
  calor: p('M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0zM12 10v6M18 5l2-1M18 9h2'),
  frio: p('M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M10 4.5l2 2 2-2M10 19.5l2-2 2 2'),
  amanecer: p('M3 18h18M7 18a5 5 0 0 1 10 0M12 3v5M9.5 5.5L12 3l2.5 2.5M5 12l1.4 1.4M19 12l-1.4 1.4'),
  atardecer: p('M3 18h18M7 18a5 5 0 0 1 10 0M12 3v5M9.5 5.5L12 8l2.5-2.5M5 12l1.4 1.4M19 12l-1.4 1.4'),
  humedad: p('M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z'),
  // --- datos del detalle (agregados con el mismo estilo) ---
  sensacion: p('M10 13.5V5a2 2 0 0 1 4 0v8.5a4 4 0 1 1-4 0zM12 10v6'),
  presion: p('M12 20a8 8 0 1 0 0-16a8 8 0 1 0 0 16zM12 12l3.5-3.5M7.5 12h1M15.5 12h1M12 7.5v1'),
  uv: p('M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM12 3v2M12 19v2M5.6 5.6L7 7M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4-1.4'),
  hoja: p('M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7'),
  // --- interfaz (de referencia/Guarani-Iconos) ---
  buscar: p('M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-3.5-3.5'),
  ajustes: p('M4 7h10M18 7h2M4 17h4M12 17h8M16 5a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM10 15a2 2 0 1 0 0 4a2 2 0 1 0 0-4z'),
  ubicacion: p('M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 7.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z'),
  sonido: p('M4 9v6h4l5 4V5L8 9H4zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12'),
  silencio: p('M4 9v6h4l5 4V5L8 9H4zM17 9l4 6M21 9l-4 6'),
  animacion: p('M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z'),
  avisos: p('M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0'),
  tema: p('M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 3v18M12 7h4M12 11h7M12 15h6'),
  idioma: p('M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18'),
  favorito: p('M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'),
  'favorito-lleno': '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" style="fill:currentColor"/>',
  compartir: p('M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6'),
  mapa: p('M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14'),
  ciudades: p('M8 6h13M8 12h13M8 18h13M4 6h.01M4 12h.01M4 18h.01'),
  comparar: p('M6 20V10M12 20V4M18 20v-7'),
  radar: p('M12 12l7-7M21 12a9 9 0 1 1-9-9M17 12a5 5 0 1 1-5-5'),
  cerrar: p('M6 6l12 12M18 6L6 18'),
  // --- interfaz (agregados con el mismo estilo) ---
  clima: p('M9 5.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7zM9 2v1.5M3.5 9H2M5 5l1 1M13 5l-1 1') + p(nubeChica),
  actualizar: p('M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5'),
  instalar: p('M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14'),
  mas: p('M12 5v14M5 12h14'),
  menos: p('M5 12h14'),
  encuadrar: p('M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5'),
  reproducir: p('M8 5.5v13l10.5-6.5z'),
  pausa: p('M9 5.5v13M15 5.5v13'),
  ruta: p('M8.5 3 5 21M15.5 3 19 21M12 4v2.5M12 10.5v3M12 17.5V20'),
  ojo: p('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z'),
  aviso: p('M12 4 2.5 20h19zM12 10v4.5M12 17.5v.01'),
  dato: p('M3 12h4l2-6 4 12 2-6h6'),
  // --- Navidad ---
  bombilla: p('M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z'),
  musica: p('M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0a3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0a3 3 0 0 1 6 0z'),
  calendario: p('M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8.5 3v4M15.5 3v4'),
  fuegos: p('M12 9V3M14.1 9.9l4.3-4.3M15 12h6M14.1 14.1l4.3 4.3M12 15v6M9.9 14.1l-4.3 4.3M9 12H3M9.9 9.9 5.6 5.6'),
  // --- rediseño de la portada ---
  menu: p('M4 7h16M4 12h16M4 17h16'),
  paraguas: p('M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9zM12 3v1M12 12v6.5a2 2 0 0 1-4 0'),
  reloj: p('M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 7.5V12l3 2'),
};
// alias: nombres que usan el paisaje (data-icono) y la interfaz
const ALIAS = { dia: 'despejado', noche: 'noche-clara', 'despejado-noche': 'noche-clara', temperatura: 'sensacion', aire: 'hoja', luna: 'noche-clara' };

const sprite = '<svg id="iconos" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">\n' +
  Object.entries(ICONOS).map(([n, c]) => `  <symbol id="i-${n}" viewBox="0 0 24 24">${c}</symbol>`).join('\n') + '\n' +
  Object.entries(ALIAS).map(([a, n]) => `  <symbol id="i-${a}" viewBox="0 0 24 24">${ICONOS[n]}</symbol>`).join('\n') + '\n</svg>';

const ruta = 'index.html', html = readFileSync(ruta, 'utf8');
const A = '<!-- ICONOS:INICIO', B = '<!-- ICONOS:FIN -->';
const ini = html.indexOf(A), fin = html.indexOf(B);
if (ini < 0 || fin < 0) { console.error('index.html: falta el bloque <!-- ICONOS:INICIO --> … <!-- ICONOS:FIN -->'); process.exit(1); }
const bloque = '<!-- ICONOS:INICIO (generado por scripts/iconos.mjs; no editar a mano) -->\n' + sprite + '\n';
const nuevo = html.slice(0, ini) + bloque + html.slice(fin);
if (nuevo !== html) writeFileSync(ruta, nuevo);
const nombres = [...Object.keys(ICONOS), ...Object.keys(ALIAS)];
console.log(`index.html: sprite con ${nombres.length} íconos${nuevo !== html ? ' (actualizado)' : ' (sin cambios)'}`);

const g = process.argv.indexOf('--galeria');
if (g > 0 && process.argv[g + 1]) {
  const css = process.argv[g + 2] || 'css/estilos.css';
  writeFileSync(process.argv[g + 1], `<!doctype html><html lang="es" data-tema="${process.argv[g + 3] || 'oscuro'}"><meta charset="utf-8"><title>Íconos</title><link rel="stylesheet" href="${css}">
<style>body{padding:24px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px}.c{display:grid;place-items:center;gap:6px;padding:12px;border-radius:14px;background:var(--vidrio);border:1px solid var(--borde);font-size:.75rem}.c .ic{width:28px;height:28px}</style>
<body>${sprite}<h1>Íconos (${nombres.length})</h1><div class="g">${Object.keys(ICONOS).map(n => `<div class="c"><svg class="ic ic-${n}"><use href="#i-${n}"/></svg>${n}</div>`).join('')}</div></body></html>`);
  console.log('galería:', process.argv[g + 1]);
}
