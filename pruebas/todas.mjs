// Clima PY: corre todas las pruebas automáticas de la app y muestra un resumen.
// Uso (desde la carpeta del proyecto):  node pruebas/todas.mjs [--rapida]
// Necesita Playwright con Chromium:  npm install --no-save playwright && npx playwright install chromium
// Sirve la app con un servidor propio (sin internet: Open-Meteo y demás se simulan con pruebas/datos.json y horas.json).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url)), RAIZ = path.join(AQUI, '..');
const RAPIDA = process.argv.includes('--rapida');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

// Servidor estático mínimo (solo para las pruebas)
const servidor = http.createServer(async (req, res) => {
  try {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ruta.endsWith('/')) ruta += 'index.html';
    const archivo = path.join(RAIZ, path.normalize(ruta));
    if (!archivo.startsWith(RAIZ)) throw new Error('fuera');
    const cuerpo = await readFile(archivo);
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' }); res.end(cuerpo);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(ok => servidor.listen(0, '127.0.0.1', ok));
const PUERTO = String(servidor.address().port);

// [nombre, archivo, argumentos]
const PRUEBAS = [
  ['Recorrido de la interfaz', 'recorrido.js', [PUERTO]],
  ['Sonido', 'sonido.js', [PUERTO, ...(RAPIDA ? ['--rapida'] : [])]],
  ['Datos al día', 'frescura.js', [RAIZ]],
  ['Caza de errores', 'caza-errores.js', [PUERTO]],
  ['Cero emojis', 'cero-emojis.js', [PUERTO]],
  ['Contraste (informativo)', 'contraste.js', [PUERTO]],
];
const resumen = [];
for (const [nombre, archivo, args] of PRUEBAS) {
  process.stdout.write(`\n=== ${nombre} ===\n`);
  const salida = await new Promise(ok => {
    let texto = '';
    const p = spawn(process.execPath, [path.join(AQUI, archivo), ...args], { cwd: RAIZ });
    p.stdout.on('data', d => { texto += d; process.stdout.write(d); });
    p.stderr.on('data', d => { texto += d; process.stderr.write(d); });
    p.on('close', codigo => ok({ codigo, texto }));
  });
  // contraste es informativo: siempre termina bien, pero cuenta lo que quedó debajo del mínimo
  const ok = archivo === 'contraste.js' ? true : salida.codigo === 0 && !/✘|❌|falló/.test(salida.texto);
  resumen.push([ok, nombre]);
}
servidor.close();
console.log('\n===== Resumen =====\n' + resumen.map(([ok, n]) => `${ok ? '✅' : '❌'} ${n}`).join('\n'));
process.exit(resumen.every(([ok]) => ok) ? 0 : 1);
