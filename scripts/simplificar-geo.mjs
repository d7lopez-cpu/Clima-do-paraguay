// Clima PY: simplifica los polígonos de geo.js (menos vértices = archivo más liviano).
// Uso (desde la carpeta del proyecto):
//   node scripts/simplificar-geo.mjs [--entrada geo.js] [--salida geo.js] [--eps-dep 0.004] [--eps-vec 0.02] [--radio-ciudad 0.05]
// Las tolerancias van en grados de latitud (1° ≈ 111 km): 0.004 ≈ 440 m, 0.02 ≈ 2,2 km.
//
// Cómo funciona (Douglas-Peucker que respeta la topología):
//  1. Un vértice que comparten varios anillos (por ejemplo, el borde entre dos departamentos o distritos) se
//     considera "nodo" solo donde cambia el vecino; las cadenas entre nodos se simplifican UNA vez, en una
//     orientación canónica, y todos los anillos que las comparten reciben exactamente el mismo resultado.
//     Así no quedan rendijas ni solapes entre departamentos/distritos vecinos.
//  2. Los nodos nunca se eliminan. También se conservan los vértices que están a menos de 0,05° (~5,5 km) de una ciudad.
//  3. Los departamentos y distritos usan --eps-dep; los países vecinos (solo contexto visual) usan --eps-vec.
//  4. No se toca GEO.ciudades ni la estructura de GEO (deps, dist, vecinos, ciudades).
// Es reproducible, pero parte del archivo que se le da: para repetir el resultado, usa como entrada el geo.js
// ORIGINAL (p. ej. `git show <commit-anterior>:geo.js > /tmp/geo-original.js`), no uno ya simplificado.
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const ENTRADA = arg('entrada', 'geo.js'), SALIDA = arg('salida', 'geo.js');
const EPS_DEP = parseFloat(arg('eps-dep', '0.004')), EPS_VEC = parseFloat(arg('eps-vec', '0.02'));
const COS = Math.cos(24.5 * Math.PI / 180);   // misma proyección que la app, para medir distancias parejas

const texto = readFileSync(ENTRADA, 'utf8');
const lineas = texto.split('\n');
const GEO = vm.runInNewContext(texto + '\n;GEO');

// --- Douglas-Peucker iterativo sobre una cadena (extremos fijos); devuelve los índices que se conservan
function dp(pts, eps) {
  const n = pts.length, keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const pila = [[0, n - 1]];
  while (pila.length) {
    const [a, b] = pila.pop();
    if (b <= a + 1) continue;
    const ax = pts[a][0] * COS, ay = pts[a][1], bx = pts[b][0] * COS, by = pts[b][1];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let max = -1, im = -1;
    for (let i = a + 1; i < b; i++) {
      const px = pts[i][0] * COS - ax, py = pts[i][1] - ay;
      let t = l2 ? (px * dx + py * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - t * dx, py - t * dy);
      if (d > max) { max = d; im = i; }
    }
    if (max > eps) { keep[im] = 1; pila.push([a, im], [im, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// --- Recolecta todos los anillos y cuántos vecinos distintos tiene cada vértice
const clave = p => p[0] + ',' + p[1];
const anillos = [];   // { pts (sin el cierre repetido), eps, set(fn para escribir) }
function agregar(ring, eps, escribir) {
  // Los países vecinos son líneas ABIERTAS (la app las cierra al dibujar): se simplifican sin cerrarlas
  const cerrado = clave(ring[0]) === clave(ring[ring.length - 1]);
  const pts = cerrado ? ring.slice(0, -1) : ring;
  anillos.push({ ring, pts, eps, cerrado, escribir });
}
GEO.deps.forEach(d => { d.r = d.r.slice(); d.r.forEach((r, i) => agregar(r, EPS_DEP, nuevo => { d.r[i] = nuevo; })); });
GEO.dist.forEach(rs => rs.forEach((r, i) => agregar(r, EPS_DEP, nuevo => { rs[i] = nuevo; })));
for (const k of Object.keys(GEO.vecinos)) GEO.vecinos[k].forEach((r, i, arr) => agregar(r, EPS_VEC, nuevo => { arr[i] = nuevo; }));

const pares = new Map();   // vértice -> Set de pares de vecinos (no ordenados)
for (const a of anillos) {
  const n = a.pts.length;
  a.pts.forEach((p, i) => {
    const x = clave(a.pts[(i + n - 1) % n]), y = clave(a.pts[(i + 1) % n]);
    const par = x < y ? x + '|' + y : y + '|' + x;
    const k = clave(p);
    if (!pares.has(k)) pares.set(k, new Set());
    pares.get(k).add(par);
  });
}
// 1b. Protección de las ciudades: los vértices a menos de RADIO_CIUDAD grados de una ciudad no se eliminan,
//     para que ninguna ciudad cambie de departamento/distrito por culpa de la simplificación.
const RADIO_CIUDAD = parseFloat(arg('radio-ciudad', '0.05'));
const protegidos = new Set();
for (const a of anillos) for (const p of a.pts) {
  for (const c of GEO.ciudades) if (Math.hypot((p[0] - c.lon) * COS, p[1] - c.lat) < RADIO_CIUDAD) { protegidos.add(clave(p)); break; }
}
const esNodo = p => pares.get(clave(p)).size > 1 || protegidos.has(clave(p));

// --- Simplifica cada anillo cortándolo en cadenas entre nodos; las cadenas compartidas se resuelven una sola vez
const memo = new Map();
function cadena(c, eps) {
  // orientación canónica: la cadena se simplifica siempre desde su extremo "menor"
  const k0 = clave(c[0]), k1 = clave(c[c.length - 1]);
  let invertir = k0 > k1;
  if (k0 === k1) {   // cadena cerrada sobre sí misma: compara el segundo vértice
    invertir = c.length > 2 && clave(c[1]) > clave(c[c.length - 2]);
  }
  const base = invertir ? c.slice().reverse() : c;
  const id = eps + '#' + base.map(clave).join(';');
  let r = memo.get(id);
  if (!r) { r = dp(base, eps); memo.set(id, r); }
  return invertir ? r.slice().reverse() : r;
}

let antes = 0, despues = 0, conservados = 0;
for (const a of anillos) {
  const pts = a.pts, n = pts.length;
  antes += a.ring.length;
  if (!a.cerrado) {   // línea abierta: una sola cadena con los extremos fijos
    const s = n > 2 ? cadena(pts, a.eps) : pts;
    despues += s.length; a.escribir(s); continue;
  }
  let nodos = [];
  pts.forEach((p, i) => { if (esNodo(p)) nodos.push(i); });
  if (!nodos.length) {   // anillo sin nodos: ancla en el vértice menor (igual para todos los anillos idénticos)
    let m = 0; pts.forEach((p, i) => { if (clave(p) < clave(pts[m])) m = i; });
    nodos = [m];
  }
  let salida = [];
  for (let j = 0; j < nodos.length; j++) {
    const ini = nodos[j], fin = nodos[(j + 1) % nodos.length];
    const c = [];
    for (let i = ini; ; i = (i + 1) % n) { c.push(pts[i]); if (i === fin && c.length > 1) break; if (nodos.length === 1 && c.length === n + 1) break; }
    if (nodos.length === 1 && c[c.length - 1] !== pts[ini]) c.push(pts[ini]);
    const s = cadena(c, a.eps);
    salida.push(...(j ? s.slice(1) : s));
  }
  // `salida` termina en el vértice inicial (cierre); un anillo válido necesita al menos 4 puntos
  if (salida.length < 4) { salida = a.ring; conservados++; }
  else if (clave(salida[0]) !== clave(salida[salida.length - 1])) salida.push(salida[0]);
  despues += salida.length;
  a.escribir(salida);
}

const cuerpo = 'const GEO = ' + JSON.stringify(GEO) + ';';
const nuevo = [lineas[0], cuerpo, ...lineas.slice(2).filter((l, i, arr) => i < arr.length - 1 || l !== '')].join('\n') + '\n';
writeFileSync(SALIDA, nuevo);
console.log(`vértices: ${antes} -> ${despues} (${(100 * despues / antes).toFixed(1)} %), anillos conservados sin cambio: ${conservados}`);
console.log(`geo.js: ${texto.length} -> ${nuevo.length} bytes`);
