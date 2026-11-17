// Clima PY: revisión automática. La ejecuta GitHub Actions en cada cambio (ver .github/workflows/revisar.yml).
// También se puede correr a mano desde la carpeta del proyecto:  node scripts/revisar.mjs
// Comprueba que el código no tenga errores de sintaxis y que los datos y archivos que usa la app existan y tengan sentido.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const errores = [];
const error = msg => errores.push(msg);
const leer = f => readFileSync(f, 'utf8');

// 1) Sintaxis de JavaScript
for (const f of ['app.js', 'geo.js', 'sw.js']) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { error(`${f}: error de sintaxis\n${String(e.stderr).trim()}`); }
}

// 2) Datos geográficos (geo.js)
let GEO = null;
try {
  GEO = vm.runInNewContext(leer('geo.js') + '\n;GEO');
} catch (e) { error(`geo.js: no se pudo cargar GEO (${e.message})`); }
if (GEO) {
  const deps = new Set((GEO.deps || []).map(d => d.n));
  if (deps.size !== 18) error(`geo.js: se esperaban 18 departamentos y hay ${deps.size}`);
  if (!Array.isArray(GEO.ciudades) || !GEO.ciudades.length) error('geo.js: la lista de ciudades está vacía');
  const vistos = new Set();
  for (const c of GEO.ciudades || []) {
    const quien = `geo.js: ciudad "${c && c.n}"`;
    if (!c || typeof c.n !== 'string' || !c.n.trim()) { error('geo.js: hay una ciudad sin nombre'); continue; }
    if (vistos.has(c.n)) error(`${quien} está repetida`);
    vistos.add(c.n);
    // Caja que contiene a Paraguay (con un pequeño margen)
    if (!(c.lat > -28 && c.lat < -19 && c.lon > -63 && c.lon < -54)) error(`${quien}: coordenadas fuera de Paraguay (${c.lat}, ${c.lon})`);
    if (!deps.has(c.dep)) error(`${quien}: departamento desconocido "${c.dep}"`);
    if (![1, 2, 3, 4].includes(c.g)) error(`${quien}: tamaño "g" debe ser 1, 2, 3 o 4 (es ${c.g})`);
  }
  console.log(`geo.js: ${deps.size} departamentos, ${vistos.size} ciudades`);
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

// Resultado
if (errores.length) {
  console.error(`\n❌ ${errores.length} problema(s):\n- ` + errores.join('\n- '));
  process.exit(1);
}
console.log('✅ Todo en orden');
