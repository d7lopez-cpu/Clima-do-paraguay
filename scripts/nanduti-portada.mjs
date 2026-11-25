// Clima PY: el ñandutí grande de la portada (detrás de la temperatura), a color.
// Toma los hilos de logo-nanduti-hilos.svg (el ñandutí complejo, ya aprobado) y escribe en index.html, entre
// <!-- NANDUTI:INICIO --> y <!-- NANDUTI:FIN -->, un <symbol id="nanduti-portada"> donde cada capa de hilos usa una variable de color:
//   --nd-petalo (relleno de los pétalos), --nd-hilo (abanicos de hilos y anillos: dorado), --nd-anillo (contorno de los pétalos: rosa),
//   --nd-trama (trama en espiral y puntadas: violeta), --nd-centro (el sol del centro).
// estilos.css define los colores (dorado, rosa y violeta) y los ajusta según el clima y el tema. En app.js se usa con
//   <svg class="hero-nanduti"><use href="#nanduti-portada"/></svg>
// Uso (desde la carpeta del proyecto): node scripts/nanduti-portada.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('logo-nanduti-hilos.svg', 'utf8');
const grupo = /<g fill="none" stroke="#f3e3b0"[^>]*>([\s\S]*?)<\/g>/.exec(svg);
if (!grupo) throw new Error('No se encontraron los hilos en logo-nanduti-hilos.svg');
const capas = [...grupo[1].matchAll(/<path d="([^"]+)"([^>]*)\/>/g)];
if (capas.length !== 8) throw new Error(`Se esperaban 8 capas de hilos y hay ${capas.length}`);

// Color de cada capa, en el orden del archivo (de afuera hacia adentro: pétalos, hilos, anillos, tramas…)
// 0 relleno de pétalos · 1 abanicos de hilos · 2 contorno de pétalos · 3 contorno punteado · 4 trama en espiral · 5 círculo punteado · 6 anillos · 7 sol del centro
const COLOR = ['--nd-petalo', '--nd-hilo', '--nd-anillo', '--nd-trama', '--nd-trama', '--nd-hilo', '--nd-hilo', '--nd-centro'];
const caminos = capas.map(([, d, attr], i) => {
  const ancho = (/stroke-width="([\d.]+)"/.exec(attr) || [])[1];
  const guiones = (/stroke-dasharray="([^"]+)"/.exec(attr) || [])[1];
  if (/fill="#f3e3b0"/.test(attr)) return `<path d="${d}" style="fill:var(${COLOR[i]});fill-opacity:var(--nd-relleno-op,.22)" stroke="none"/>`;
  return `<path d="${d}" style="stroke:var(${COLOR[i]})"${ancho ? ` stroke-width="${ancho}"` : ''}${guiones ? ` stroke-dasharray="${guiones}"` : ''}/>`;
});

const simbolo = `<svg id="nanduti-sprite" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>` +
  `<radialGradient id="ndPortadaBrillo" cx=".5" cy=".5" r=".5"><stop offset="0" style="stop-color:var(--nd-centro);stop-opacity:.5"/><stop offset="1" style="stop-color:var(--nd-centro);stop-opacity:0"/></radialGradient>` +
  `<symbol id="nanduti-portada" viewBox="0 0 200 200"><circle cx="100" cy="100" r="52" fill="url(#ndPortadaBrillo)"/>` +
  `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${caminos.join('')}</g>` +
  `<circle cx="100" cy="100" r="4.5" style="fill:var(--nd-centro)"/></symbol></defs></svg>`;

const html = readFileSync('index.html', 'utf8');
const A = '<!-- NANDUTI:INICIO -->', B = '<!-- NANDUTI:FIN -->';
let nuevo;
if (html.includes(A)) nuevo = html.slice(0, html.indexOf(A) + A.length) + '\n' + simbolo + '\n' + html.slice(html.indexOf(B));
else { const i = html.indexOf('<!-- ICONOS:INICIO'); if (i < 0) throw new Error('index.html sin el sprite de íconos'); nuevo = html.slice(0, i) + `${A}\n${simbolo}\n${B}\n` + html.slice(i); }
writeFileSync('index.html', nuevo);
console.log(`index.html: ñandutí de portada con ${capas.length} capas de hilos (actualizado)`);
