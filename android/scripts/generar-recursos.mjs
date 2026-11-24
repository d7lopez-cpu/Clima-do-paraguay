// Genera los recursos de la app Android a partir de la app web, para que no haya copias que mantener a mano:
//  · res/drawable/ic_*.xml   íconos del clima (vectores) desde el sprite de index.html, con los colores de «Cristal guaraní»
//  · res/drawable/nanduti.xml marca de agua del ñandutí desde icono.svg
//  · assets/ciudades.json     las 263 ciudades (nombre, departamento, coordenadas) desde geo.js
//  · res/mipmap-*/ic_launcher.png el ícono de la app
// Uso (desde la raíz del repositorio): node android/scripts/generar-recursos.mjs
import fs from 'fs';
import path from 'path';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const APP = path.join(RAIZ, 'android', 'app', 'src', 'main');
const escribir = (rel, txt) => { const f = path.join(APP, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt); };

// ---- Íconos del clima ----
// [color del trazo principal, color del detalle (style="stroke:var(--ic-2)")]
const COLORES = {
  despejado: ['#fde68a', '#fde68a'], 'noche-clara': ['#c7d2fe', '#c7d2fe'],
  parcial: ['#eef2ff', '#fde68a'], 'parcial-noche': ['#eef2ff', '#c7d2fe'],
  nublado: ['#dbe3ff', '#dbe3ff'], niebla: ['#c3cdf0', '#c3cdf0'],
  llovizna: ['#eef2ff', '#93c5fd'], lluvia: ['#eef2ff', '#93c5fd'],
  tormenta: ['#c4b5fd', '#fde68a'], granizo: ['#eef2ff', '#bae6fd'],
  frio: ['#93c5fd', '#93c5fd'], sensacion: ['#eef2ff', '#eef2ff'], ubicacion: ['#c3cdf0', '#c3cdf0']
};
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
for (const [nombre, [c1, c2]] of Object.entries(COLORES)) {
  const m = new RegExp(`<symbol id="i-${nombre}" viewBox="0 0 24 24">(.*?)</symbol>`).exec(html);
  if (!m) throw new Error('Falta el ícono ' + nombre);
  const trazos = [...m[1].matchAll(/<path d="([^"]+)"( style="[^"]*")?\s*\/>/g)].map(p =>
    `    <path android:pathData="${p[1]}" android:strokeColor="${p[2] ? c2 : c1}" android:strokeWidth="1.6"\n` +
    `        android:strokeLineCap="round" android:strokeLineJoin="round" android:fillColor="#00000000"/>`);
  if (!trazos.length) throw new Error('Ícono sin trazos: ' + nombre);
  escribir(`res/drawable/ic_${nombre.replace(/-/g, '_')}.xml`,
    `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generado por android/scripts/generar-recursos.mjs desde index.html: no editar a mano -->\n` +
    `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp"\n` +
    `    android:viewportWidth="24" android:viewportHeight="24">\n${trazos.join('\n')}\n</vector>\n`);
}

// ---- Ñandutí (marca de agua: solo los hilos, sin el fondo) ----
const svg = fs.readFileSync(path.join(RAIZ, 'icono.svg'), 'utf8');
const g = /<g fill="none" stroke="#f3e3b0"[^>]*>([\s\S]*?)<\/g>/.exec(svg)[1];
const hilos = [...g.matchAll(/<path d="([^"]+)"([^>]*)\/>/g)].map(([, d, attr]) => {
  const relleno = /fill="#f3e3b0"/.test(attr), ancho = (/stroke-width="([\d.]+)"/.exec(attr) || [])[1] || '3';
  return relleno
    ? `    <path android:pathData="${d}" android:fillColor="#c7d2fe" android:fillAlpha="0.3"/>`
    : `    <path android:pathData="${d}" android:strokeColor="#c7d2fe" android:strokeWidth="${ancho}"\n        android:strokeLineCap="round" android:strokeLineJoin="round" android:fillColor="#00000000"/>`;
});
escribir('res/drawable/nanduti.xml',
  `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generado por android/scripts/generar-recursos.mjs desde icono.svg: no editar a mano -->\n` +
  `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="200dp" android:height="200dp"\n` +
  `    android:viewportWidth="200" android:viewportHeight="200">\n  <group android:translateX="10" android:translateY="10" android:scaleX="0.9" android:scaleY="0.9">\n` +
  hilos.map(h => h.replace(/^ {4}/gm, '      ')).join('\n') +
  `\n      <path android:pathData="M93,100a7,7 0 1,0 14,0a7,7 0 1,0 -14,0" android:fillColor="#fde68a"/>\n  </group>\n</vector>\n`);

// ---- Ciudades ----
const geo = fs.readFileSync(path.join(RAIZ, 'geo.js'), 'utf8');
const i = geo.indexOf('const GEO = ') + 'const GEO = '.length;
const GEO = JSON.parse(geo.slice(i, geo.indexOf('\n', i)).trim().replace(/;$/, ''));
const ciudades = GEO.ciudades.filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lon))
  .map(c => ({ n: c.n, dep: c.dep, lat: c.lat, lon: c.lon }))
  .sort((a, b) => a.n.localeCompare(b.n, 'es'));
escribir('assets/ciudades.json', JSON.stringify(ciudades));

// ---- Ícono de la app ----
for (const [carpeta, archivo] of [['mipmap-xxxhdpi', 'icono-192.png']]) {
  const dest = path.join(APP, 'res', carpeta, 'ic_launcher.png');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(RAIZ, archivo), dest);
}
console.log(`Recursos generados: ${Object.keys(COLORES).length} íconos, ñandutí, ${ciudades.length} ciudades, ícono de la app.`);
