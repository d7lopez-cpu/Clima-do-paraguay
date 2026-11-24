// Clima PY: set de íconos de los controles (dibujo propio, trazo uniforme de 1,8 sobre 24 × 24, puntas redondeadas).
// Este archivo es la fuente: genera el bloque «ICONOS» de estilos.css (cada ícono como máscara CSS, que toma el
// color del texto con currentColor). Para agregar o cambiar un ícono: editarlo aquí y correr, desde la carpeta del proyecto,
//   node scripts/iconos.mjs            (reescribe el bloque en estilos.css)
//   node scripts/iconos.mjs --galeria archivo.html   (además, una página para ver todos los íconos)
// Uso en el HTML: <span class="i i-sol" aria-hidden="true"></span>  (tamaño con --i-tam, 17 px por defecto).
import { readFileSync, writeFileSync } from 'node:fs';

const ICONOS = {
  // --- acciones ---
  buscar: "<circle cx='11' cy='11' r='7'/><path d='m20 20-3.5-3.5'/>",
  comparar: "<path d='M5 20V10M12 20V4M19 20v-7'/>",
  ubicacion: "<path d='M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z'/><circle cx='12' cy='10' r='2.5'/>",
  actualizar: "<path d='M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5'/>",
  compartir: "<path d='M12 14.5V3.5M7.5 7.5 12 3l4.5 4.5M6 11v9h12v-9'/>",
  instalar: "<path d='M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14'/>",
  cerrar: "<path d='M6 6l12 12M18 6 6 18'/>",
  // --- barra de navegación ---
  nube: "<path d='M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 9.5a4.25 4.25 0 0 1 0 8.5z'/>",
  mapa: "<path d='M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14'/>",
  lista: "<path d='M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01'/>",
  // --- preferencias ---
  globo: "<circle cx='12' cy='12' r='9'/><path d='M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z'/>",
  sol: "<circle cx='12' cy='12' r='4'/><path d='M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4'/>",
  luna: "<path d='M20 14.6A8.2 8.2 0 0 1 9.4 4 8.2 8.2 0 1 0 20 14.6z'/>",
  sonido: "<path d='M4 9.5h3.5L12 6v12l-4.5-3.5H4z'/><path d='M15.5 9.2a4 4 0 0 1 0 5.6M18.3 6.6a7.8 7.8 0 0 1 0 10.8'/>",
  silencio: "<path d='M4 9.5h3.5L12 6v12l-4.5-3.5H4z'/><path d='m16 10 4 4m0-4-4 4'/>",
  destellos: "<path d='M11 4.5l1.5 4a2 2 0 0 0 1.2 1.2l4 1.5-4 1.5a2 2 0 0 0-1.2 1.2l-1.5 4-1.5-4a2 2 0 0 0-1.2-1.2l-4-1.5 4-1.5a2 2 0 0 0 1.2-1.2z'/><path d='M18.5 3v3.5M16.75 4.75h3.5M18.5 17v3M17 18.5h3'/>",
  ajustes: "<path d='M10.07 5.69L10.4 2.94L13.6 2.94L13.93 5.69A6.6 6.6 0 0 1 15.1 6.17L17.28 4.46L19.54 6.72L17.83 8.9A6.6 6.6 0 0 1 18.31 10.07L21.06 10.4L21.06 13.6L18.31 13.93A6.6 6.6 0 0 1 17.83 15.1L19.54 17.28L17.28 19.54L15.1 17.83A6.6 6.6 0 0 1 13.93 18.31L13.6 21.06L10.4 21.06L10.07 18.31A6.6 6.6 0 0 1 8.9 17.83L6.72 19.54L4.46 17.28L6.17 15.1A6.6 6.6 0 0 1 5.69 13.93L2.94 13.6L2.94 10.4L5.69 10.07A6.6 6.6 0 0 1 6.17 8.9L4.46 6.72L6.72 4.46L8.9 6.17A6.6 6.6 0 0 1 10.07 5.69Z'/><circle cx='12' cy='12' r='2.6'/>",
  campana: "<path d='M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z'/><path d='M10 20.5a2 2 0 0 0 4 0'/>",
  // --- mapa ---
  mas: "<path d='M12 5v14M5 12h14'/>",
  menos: "<path d='M5 12h14'/>",
  encuadrar: "<path d='M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5'/>",
  reproducir: "<path d='M8 5.5v13l10.5-6.5z'/>",
  pausa: "<path d='M9 5.5v13M15 5.5v13'/>",
  radar: "<path d='M21 12a9 9 0 1 1-9-9M16.5 12A4.5 4.5 0 1 1 12 7.5M12 12l6.4-6.4'/><circle cx='12' cy='12' r='.6'/>",
  ruta: "<path d='M8.5 3 5 21M15.5 3 19 21M12 4v2.5M12 10.5v3M12 17.5V20'/>",
  // --- detalle y pronóstico ---
  estrella: "<path d='m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'/>",
  'estrella-llena': "<path fill='black' d='m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'/>",
  ojo: "<path d='M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'/><circle cx='12' cy='12' r='3'/>",
  reloj: "<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 2'/>",
  grafico: "<path d='M4 4v16h16'/><path d='m7.5 14.5 3.5-4 3 2.5 5-6'/>",
  calendario: "<rect x='4' y='5' width='16' height='15' rx='2'/><path d='M4 10h16M8.5 3v4M15.5 3v4'/>",
};

const svg = cuerpo => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'>${cuerpo}</svg>`;
const dataUri = cuerpo => 'url("data:image/svg+xml,' + svg(cuerpo).replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'") + '")';

const bloque = [
  '/* ICONOS:INICIO — generado por scripts/iconos.mjs a partir de su tabla; no editar a mano */',
  ':root {',
  ...Object.entries(ICONOS).map(([n, c]) => `  --ic-${n}: ${dataUri(c)};`),
  '}',
  Object.keys(ICONOS).map(n => `.i-${n} { --i: var(--ic-${n}); }`).join('\n'),
  '/* ICONOS:FIN */'
].join('\n');

const ruta = 'estilos.css', css = readFileSync(ruta, 'utf8');
const ini = css.indexOf('/* ICONOS:INICIO'), fin = css.indexOf('/* ICONOS:FIN */');
if (ini < 0 || fin < 0) { console.error('estilos.css: no se encontró el bloque ICONOS:INICIO … ICONOS:FIN'); process.exit(1); }
const nuevo = css.slice(0, ini) + bloque + css.slice(fin + '/* ICONOS:FIN */'.length);
if (nuevo !== css) { writeFileSync(ruta, nuevo); console.log(`estilos.css: bloque de íconos actualizado (${Object.keys(ICONOS).length} íconos)`); }
else console.log(`estilos.css: los ${Object.keys(ICONOS).length} íconos ya estaban al día`);

const g = process.argv.indexOf('--galeria');
if (g > 0 && process.argv[g + 1]) {
  const html = `<!doctype html><meta charset="utf-8"><title>Íconos de Clima PY</title><link rel="stylesheet" href="${process.argv[g + 2] || 'estilos.css'}">
<style>body{padding:24px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}.c{display:grid;place-items:center;gap:8px;padding:14px;border:1px solid var(--borde);border-radius:12px;font-size:.8rem}.c .i{--i-tam:28px}.c .chico{--i-tam:17px}</style>
<h1>Íconos (${Object.keys(ICONOS).length})</h1><p>28 px y 17 px, con el color del texto</p><div class="g">${Object.keys(ICONOS).map(n => `<div class="c"><span class="i i-${n}"></span><span class="i chico i-${n}"></span>${n}</div>`).join('')}</div>`;
  writeFileSync(process.argv[g + 1], html); console.log('galería:', process.argv[g + 1]);
}
