// Clima PY: revisión automática. La ejecuta GitHub Actions en cada cambio (ver .github/workflows/revisar.yml).
// También se puede correr a mano desde la carpeta del proyecto:  node scripts/revisar.mjs
// Comprueba que el código no tenga errores de sintaxis y que los datos y archivos que usa la app existan y tengan sentido.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const errores = [];
const error = msg => errores.push(msg);
const leer = f => readFileSync(f, 'utf8');
// El código de la app está dividido por temas en js/01-…js a js/12-…js (se cargan en ese orden desde index.html)
const PARTES = readdirSync('js').filter(f => /^\d\d-.*\.js$/.test(f)).sort().map(f => 'js/' + f);
if (!PARTES.length) error('js/: no se encontraron los archivos del código (js/01-….js …)');

// 1) Sintaxis de JavaScript
for (const f of [...PARTES, 'js/geo.js', 'sw.js', ...readdirSync('pruebas').filter(f => f.endsWith('.js')).map(f => 'pruebas/' + f)]) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { error(`${f}: error de sintaxis\n${String(e.stderr).trim()}`); }
}

// 1b) El código: sin restos de depuración y sin claves repetidas en el diccionario guaraní (GN)
for (const f of PARTES) leer(f).split('\n').forEach((linea, i) => {
  if (/^\s*(console\.(log|debug)\(|debugger\b)/.test(linea)) error(`${f}:${i + 1}: resto de depuración (${linea.trim().slice(0, 40)})`);
});
{
  const archivoGN = PARTES.find(f => leer(f).includes('const GN = {')) || PARTES[0], codigoApp = leer(archivoGN);
  const ini = codigoApp.indexOf('const GN = {'), fin = codigoApp.indexOf('\n  };', ini);
  if (ini < 0 || fin < 0) error('js/: no se encontró el diccionario GN');
  else {
    const bloque = codigoApp.slice(ini, fin), vistas = new Set();
    for (const m of bloque.matchAll(/"((?:[^"\\\n]|\\.)*)"(\s*:)?/g)) {   // cada cadena entre comillas; es clave si le sigue ":"
      if (!m[2]) continue;
      if (vistas.has(m[1])) error(`${archivoGN}: clave repetida en el diccionario guaraní: "${m[1]}"`);
      vistas.add(m[1]);
    }
    console.log(`${archivoGN}: ${vistas.size} claves en el diccionario guaraní`);
  }
}

// 2) Datos geográficos (js/geo.js)
let GEO = null;
try {
  GEO = vm.runInNewContext(leer('js/geo.js') + '\n;GEO');
} catch (e) { error(`js/geo.js: no se pudo cargar GEO (${e.message})`); }
if (GEO) {
  const deps = new Set((GEO.deps || []).map(d => d.n));
  if (deps.size !== 18) error(`js/geo.js: se esperaban 18 departamentos y hay ${deps.size}`);
  if (!Array.isArray(GEO.ciudades) || !GEO.ciudades.length) error('js/geo.js: la lista de ciudades está vacía');
  const vistos = new Set();
  for (const c of GEO.ciudades || []) {
    const quien = `js/geo.js: ciudad "${c && c.n}"`;
    if (!c || typeof c.n !== 'string' || !c.n.trim()) { error('js/geo.js: hay una ciudad sin nombre'); continue; }
    if (vistos.has(c.n)) error(`${quien} está repetida`);
    vistos.add(c.n);
    // Caja que contiene a Paraguay (con un pequeño margen)
    if (!(c.lat > -28 && c.lat < -19 && c.lon > -63 && c.lon < -54)) error(`${quien}: coordenadas fuera de Paraguay (${c.lat}, ${c.lon})`);
    if (!deps.has(c.dep)) error(`${quien}: departamento desconocido "${c.dep}"`);
    if (![1, 2, 3, 4].includes(c.g)) error(`${quien}: tamaño "g" debe ser 1, 2, 3 o 4 (es ${c.g})`);
  }
  console.log(`js/geo.js: ${deps.size} departamentos, ${vistos.size} ciudades`);
}

// 3) Archivos que la página, el manifest y el service worker esperan encontrar
const html = leer('index.html');
for (const [, ruta] of html.matchAll(/(?:src|href)="([^"#:?]+)"/g)) {
  if (!existsSync(ruta)) error(`index.html usa "${ruta}", pero ese archivo no existe`);
}
try {
  const man = JSON.parse(leer('manifest.webmanifest'));
  for (const i of man.icons || []) if (!existsSync(i.src)) error(`manifest.webmanifest: falta el ícono "${i.src}"`);
} catch (e) { error(`manifest.webmanifest: no es un JSON válido (${e.message})`); }
const app = leer('sw.js').match(/const APP = \[(.*?)\];/s);
if (!app) error('sw.js: no se encontró la lista APP');
else for (const [, ruta] of app[1].matchAll(/'([^']+)'/g)) {
  if (ruta !== './' && !existsSync(ruta)) error(`sw.js guarda "${ruta}", pero ese archivo no existe`);
}

// 4) Cada parte del código se carga desde index.html, en orden, y el service worker la guarda para usarla sin internet;
//    y lo que pide la hoja de estilos (fuentes, imágenes) existe (sus rutas son relativas a css/)
const cargadas = [...html.matchAll(/<script src="(js\/\d\d-[^"]+)"><\/script>/g)].map(m => m[1]);
if (cargadas.join() !== PARTES.join()) error(`index.html debe cargar, en este orden: ${PARTES.join(', ')} (carga: ${cargadas.join(', ') || 'ninguno'})`);
if (app) for (const f of PARTES) if (!app[1].includes(`'${f}'`)) error(`sw.js: falta "${f}" en la lista APP (sin él la app no abre sin internet)`);
for (const [, ruta] of leer('css/estilos.css').matchAll(/url\("?([^")]+)"?\)/g)) {
  if (!ruta.startsWith('data:') && !existsSync(path.join('css', ruta))) error(`css/estilos.css usa "${ruta}", pero ese archivo no existe`);
}
console.log(`código: ${PARTES.length} archivos en js/, cargados en orden y guardados por el service worker`);

// Resultado
if (errores.length) {
  console.error(`\n❌ ${errores.length} problema(s):\n- ` + errores.join('\n- '));
  process.exit(1);
}
console.log('✅ Todo en orden');
