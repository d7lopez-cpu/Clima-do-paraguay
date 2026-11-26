// Clima PY: el ñandutí de la marca, dibujado según la técnica real del encaje de Itauguá (no una mandala genérica).
//
// Cómo se teje un ñandutí (y cómo lo sigue este dibujo):
//  1. Urdimbre: sobre la tela tensa en el bastidor se tienden muchísimos hilos rectos que pasan por el centro: los «rayos».
//  2. Apyte: con dos vueltas de zurcido alrededor del centro se sujetan los rayos; queda un centro chico y apretado.
//  3. Dechados: sobre los rayos, en el tercio exterior del disco y en anillos concéntricos, se tejen los motivos con aguja:
//     nudos que juntan rayos vecinos de a pares y forman una red en zigzag (la «telaraña»), dientes y rombos zurcidos
//     (la flor) — siempre geométricos, con bordes rectos que siguen los rayos.
//  4. Borde: uno o dos círculos de refuerzo y, al final, puntas formadas al agrupar los rayos.
//  5. Color: el tradicional es blanco; el moderno usa al menos cinco colores vivos, cada anillo de un color.
// Fuentes: Wikipedia («Ñandutí»: urdimbre radial, apyte, dechados en el tercio exterior, círculos de refuerzo),
// Asociación de Ñandutí en Japón y artículos de La Nación y Última Hora (bastidor, dechados, colores).
//
// Escribe en img/: icono.svg, logo-nanduti.svg, logo-nanduti-hilos.svg (sin fondo: marca de agua, carga y guirnalda),
//          icono-navidad.svg, logo-navidad.svg y, en index.html entre <!-- NANDUTI:INICIO --> y <!-- NANDUTI:FIN -->,
//          el <symbol id="nanduti-portada"> de la portada (sus colores son variables CSS: --nd-hilo, --nd-centro, --nd-trama,
//          --nd-anillo, --nd-petalo; los define css/estilos.css y cambian con el clima, el tema y la Navidad).
// Con --png además dibuja los PNG de la app instalada (icono-192/512, maskable 192/512, apple-touch-icon) con Playwright.
// Uso (desde la carpeta del proyecto): node scripts/nanduti.mjs [--png]
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const f = n => (Math.round(n * 100) / 100).toString();
const P = (r, a) => [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
const pt = (r, a) => P(r, a).map(f).join(' ');
const TAU = Math.PI * 2, ARR = -Math.PI / 2;               // el primer rayo apunta hacia arriba

// Colores fijos (archivos sueltos) y de la portada (variables CSS)
const COLORES = {
  // tricolor de la bandera (rojo, blanco y azul, algo más luminosos para que se lean sobre el fondo azul noche);
  // medio: el blanco del degradé de los lóbulos (rojo adentro, blanco al medio, azul afuera)
  normal: { hilo: '#f8fafc', centro: '#ffffff', trama: '#4f7bff', anillo: '#ef4b41', petalo: '#9db2ff', medio: '#ffffff' },
  navidad: { hilo: '#f7efdd', centro: '#fde68a', trama: '#4ade80', anillo: '#f87171', petalo: '#86efac' },
  css: { hilo: 'var(--nd-hilo)', centro: 'var(--nd-centro)', trama: 'var(--nd-trama)', anillo: 'var(--nd-anillo)', petalo: 'var(--nd-petalo)', medio: 'var(--nd-medio)' }
};

// ---- Piezas del encaje ----
// Rayos de la urdimbre: rectos, del apyte al borde
const rayos = (n, r0, r1) => Array.from({ length: n }, (_, i) => { const a = ARR + i * TAU / n; return `M${pt(r0, a)}L${pt(r1, a)}`; }).join('');
// Red de nudos: cada nudo junta dos rayos vecinos; dos hileras alternadas forman la malla de rombos de la telaraña
function red(n, ra, rb, desfase = 0) {
  let d = '';
  for (let k = 0; k <= n; k++) { const a = ARR + k * TAU / n; d += (k ? 'L' : 'M') + pt((k + desfase) % 2 ? rb : ra, a); }
  return d;
}
// Zurcido: líneas paralelas (arcos cortos entre rayos) que rellenan un motivo, como la aguja que va y viene
function zurcido(r0, r1, a0, a1, pasos, ancho) {
  let d = '';
  for (let s = 0; s <= pasos; s++) {
    const r = r0 + (r1 - r0) * s / pasos, k = ancho(s / pasos), am = (a0 + a1) / 2, h = (a1 - a0) / 2 * k;
    if (h <= 0.0005) continue;
    d += `M${pt(r, am - h)}A${f(r)} ${f(r)} 0 0 1 ${pt(r, am + h)}`;
  }
  return d;
}
// Dientes: triángulos zurcidos entre grupos de rayos, con la punta hacia afuera
function dientes(n, r0, r1, pasos) {
  let borde = '', relleno = '', lleno = '';
  for (let i = 0; i < n; i++) {
    const a0 = ARR + (i - 0.5) * TAU / n, a1 = ARR + (i + 0.5) * TAU / n, am = (a0 + a1) / 2;
    lleno += `M${pt(r0, a0)}L${pt(r1, am)}L${pt(r0, a1)}A${f(r0)} ${f(r0)} 0 0 0 ${pt(r0, a0)}Z`;
    relleno += zurcido(r0, r1, a0, a1, pasos, t => 1 - t);
  }
  return { lleno, relleno, borde };
}
// Rombos de la flor (mburukuja / estrella): zurcidos sobre los rayos, con bordes rectos
function rombos(n, r0, r1, ancho, pasos) {
  let lleno = '', relleno = '';
  for (let i = 0; i < n; i++) {
    const am = ARR + (i + 0.5) * TAU / n, h = ancho * TAU / n / 2, rm = (r0 + r1) / 2;
    lleno += `M${pt(r0, am)}L${pt(rm, am - h)}L${pt(r1, am)}L${pt(rm, am + h)}Z`;
    relleno += zurcido(r0, r1, am - h, am + h, pasos, t => 1 - Math.abs(t * 2 - 1));
  }
  return { lleno, relleno };
}
// Puntas del borde: los rayos se agrupan de a varios y terminan en una punta
function puntas(n, r0, r1) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = ARR + (i - 0.5) * TAU / n, a1 = ARR + (i + 0.5) * TAU / n;
    d += `M${pt(r0, a0)}L${pt(r1, (a0 + a1) / 2)}L${pt(r0, a1)}`;
  }
  return d;
}
const circulo = r => `M${pt(r, ARR)}A${f(r)} ${f(r)} 0 1 1 ${pt(r, ARR + Math.PI)}A${f(r)} ${f(r)} 0 1 1 ${pt(r, ARR)}`;
// Apyte: dos vueltas de zurcido apretado alrededor del centro
const apyte = (r) => ({ lleno: circulo(r * 0.45), vueltas: circulo(r * 0.75) + circulo(r) });

// ---- El ñandutí completo ----
// Composición tomada de piezas reales (referencias: lámina de dechados tradicionales de Itauguá —Arapaho, Arasape ysypo,
// Arasa poty, Botella— y un ñandutí grande de color de una artesana de Itauguá):
//  · borde de lóbulos grandes: cada uno es un abanico de hilos que convergen hacia adentro, tejido macizo con degradé
//    (celeste afuera, durazno adentro) y terminado en piquitos;
//  · una banda de red anudada (la telaraña) entre el borde y el interior;
//  · adentro, varias ruedas chicas (rayos + apyte + flor de pétalos «botella») alrededor de una estrella central de red,
//    con hojitas entre rueda y rueda.
// detalle 'simple' (ícono de 32 a 192 px): lóbulos, un aro y una sola rueda con su flor botella.
let ids = 0;
function nanduti(c, detalle = 'completo') {
  const S = detalle === 'simple', id = 'nd' + (++ids);
  const out = [], g = (d, color, ancho, extra = '') => out.push(`<path d="${d}" style="stroke:${color}" fill="none" stroke-width="${ancho}"${extra}/>`);
  const relleno = (d, fill, op = 1, extra = '') => out.push(`<path d="${d}" style="fill:${fill};fill-opacity:${op}" stroke="none"${extra}/>`);
  const circ = (cx, cy, r) => `M${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 1 ${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 1 ${f(cx + r)} ${f(cy)}`;
  const defs = `<radialGradient id="${id}L" gradientUnits="userSpaceOnUse" cx="100" cy="100" r="${S ? 98 : 99}">` +
    `<stop offset="${S ? 0.62 : 0.72}" style="stop-color:${c.anillo}"/>` + (c.medio ? `<stop offset="${S ? 0.76 : 0.81}" style="stop-color:${c.medio}"/>` : '') +
    `<stop offset="${c.medio ? (S ? 0.9 : 0.91) : (S ? 0.8 : 0.84)}" style="stop-color:${c.trama}"/><stop offset="1" style="stop-color:${c.trama}"/></radialGradient>`;

  // 1) Lóbulos del borde: abanicos de hilos que convergen hacia adentro, con degradé y piquitos
  const NL = S ? 12 : 18, rc = S ? 79 : 84.5, lr = S ? 19 : 13.6, rf = S ? 64 : 73;
  let lob = '', abanico = '', piquitos = '';
  for (let i = 0; i < NL; i++) {
    const a = ARR + i * TAU / NL, [cx, cy] = P(rc, a), [fx, fy] = P(rf, a);
    lob += circ(cx, cy, lr);
    const n = S ? 7 : 13;
    for (let k = 0; k < n; k++) { const t = a - 1.75 + 3.5 * k / (n - 1); abanico += `M${f(fx)} ${f(fy)}L${f(cx + lr * Math.cos(t))} ${f(cy + lr * Math.sin(t))}`; }
    piquitos += `M${f(cx + (lr + 1.6) * Math.cos(a - 1.9))} ${f(cy + (lr + 1.6) * Math.sin(a - 1.9))}A${f(lr + 1.6)} ${f(lr + 1.6)} 0 0 1 ${f(cx + (lr + 1.6) * Math.cos(a + 1.9))} ${f(cy + (lr + 1.6) * Math.sin(a + 1.9))}`;
  }
  relleno(lob, `url(#${id}L)`, S ? 0.95 : 0.88);
  g(abanico, c.hilo, S ? 0.9 : 0.4, ' stroke-opacity=".7"');
  g(lob, c.hilo, S ? 1.2 : 0.6);
  g(piquitos, c.hilo, S ? 1.6 : 1, ` stroke-dasharray="0 ${S ? 3.4 : 2.2}" stroke-linecap="round"`);

  // 2) Banda de red anudada (telaraña) entre el borde y el interior
  const r1 = S ? 52 : 57, r2 = S ? 62 : 73;
  relleno(circ(100, 100, r2), 'url(#' + id + 'F)', 0);       // (sin fondo: se ve lo de atrás entre los hilos)
  if (!S) {
    const NR = 72;
    g(rayos(NR, r1, r2), c.hilo, 0.4, ' stroke-opacity=".7"');
    g(red(NR, r1 + 2, (r1 + r2) / 2) + red(NR, r1 + 2, (r1 + r2) / 2, 1) + red(NR, (r1 + r2) / 2, r2 - 2) + red(NR, (r1 + r2) / 2, r2 - 2, 1), c.hilo, 0.5);
    let nudos = ''; for (let k = 0; k < 36; k++) { const [x, y] = P((r1 + r2) / 2, ARR + (k + 0.5) * TAU / 36); nudos += circ(x, y, 0.9); }
    relleno(nudos, c.centro, 0.9);
  }
  g(circ(100, 100, r2) + circ(100, 100, r2 - (S ? 0 : 1.6)) + circ(100, 100, r1), c.centro, S ? 1.6 : 0.8);

  // 3) Ruedas chicas con su flor botella (en el ícono simple, una sola rueda grande)
  const rueda = (cx, cy, R, petalos, rotar) => {
    let ray = '';
    const nr = S ? 24 : 32;
    for (let k = 0; k < nr; k++) { const t = k * TAU / nr; ray += `M${f(cx + R * 0.18 * Math.cos(t))} ${f(cy + R * 0.18 * Math.sin(t))}L${f(cx + R * Math.cos(t))} ${f(cy + R * Math.sin(t))}`; }
    g(ray, c.hilo, S ? 0.9 : 0.35, ' stroke-opacity=".75"');
    // pétalos «botella»: angostos junto al centro, anchos y redondeados afuera, zurcidos a lo largo
    let pet = '', zur = '';
    for (let k = 0; k < petalos; k++) {
      const t = rotar + k * TAU / petalos, ux = Math.cos(t), uy = Math.sin(t), vx = -uy, vy = ux;
      const q = (l, w) => `${f(cx + ux * R * l + vx * R * w)} ${f(cy + uy * R * l + vy * R * w)}`;
      pet += `M${q(0.2, 0)}C${q(0.38, 0.1)} ${q(0.5, 0.26)} ${q(0.72, 0.24)}C${q(0.95, 0.22)} ${q(0.95, -0.22)} ${q(0.72, -0.24)}C${q(0.5, -0.26)} ${q(0.38, -0.1)} ${q(0.2, 0)}Z`;
      for (let j = -2; j <= 2; j++) zur += `M${q(0.24, 0)}Q${q(0.6, j * 0.07)} ${q(0.88, j * 0.06)}`;
    }
    relleno(pet, c.anillo, S ? 0.85 : 0.75);
    g(zur, c.hilo, S ? 0.7 : 0.3, ' stroke-opacity=".8"');
    g(pet, c.anillo, S ? 1 : 0.5);
    g(circ(cx, cy, R), c.centro, S ? 1.6 : 0.7);
    g(circ(cx, cy, R * 0.16), c.centro, S ? 1.4 : 0.6);
    relleno(circ(cx, cy, R * 0.09), c.centro, 1);
  };
  if (S) rueda(100, 100, 47, 6, ARR);
  else {
    const NW = 6, rw = 33.5, R = 16.2;
    // estrella central de red (celeste) con su apyte
    let estrella = '';
    for (let k = 0; k < 12; k++) { const [x, y] = P(k % 2 ? 7.5 : 16.5, ARR + Math.PI / 6 + k * Math.PI / 6); estrella += (k ? 'L' : 'M') + f(x) + ' ' + f(y); }
    estrella += 'Z';
    relleno(estrella, c.trama, 0.55);
    g(rayos(24, 2.5, 16.5) , c.hilo, 0.35, ` clip-path="url(#${id}E)" stroke-opacity=".8"`);
    g(red(24, 5, 10) + red(24, 5, 10, 1) + red(24, 10, 15) + red(24, 10, 15, 1), c.hilo, 0.35, ` clip-path="url(#${id}E)"`);
    g(estrella, c.trama, 0.6);
    for (let k = 0; k < NW; k++) { const a = ARR + k * TAU / NW, [x, y] = P(rw, a); rueda(x, y, R, 6, a); }
    // hojitas entre rueda y rueda (de a pares, como plumas)
    let hojas = '';
    for (let k = 0; k < NW; k++) {
      const a = ARR + (k + 0.5) * TAU / NW;
      for (const s of [-1, 1]) {
        const [bx, by] = P(41, a), [tx, ty] = P(53, a + s * 0.17), [c1x, c1y] = P(48, a + s * 0.02), [c2x, c2y] = P(46, a + s * 0.24);
        hojas += `M${f(bx)} ${f(by)}Q${f(c1x)} ${f(c1y)} ${f(tx)} ${f(ty)}Q${f(c2x)} ${f(c2y)} ${f(bx)} ${f(by)}Z`;
      }
    }
    relleno(hojas, c.petalo, 0.7); g(hojas, c.petalo, 0.5);
    out.unshift(`<clipPath id="${id}E"><path d="${estrella}"/></clipPath>`);
  }
  return { defs, cuerpo: `<g stroke-linecap="round" stroke-linejoin="round">${out.join('')}</g>` };
}

const FONDO = `<linearGradient id="ndFondo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1433"/><stop offset=".6" stop-color="#172a63"/><stop offset="1" stop-color="#2b2463"/></linearGradient>`;
const FONDO_NV = `<linearGradient id="nvFondo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1a3a"/><stop offset=".6" stop-color="#1c2a5e"/><stop offset="1" stop-color="#3a1d3f"/></linearGradient>`;
const BRILLO = c => `<radialGradient id="ndBrillo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
// Estrella dorada de Navidad, sobre las puntas de arriba
const ESTRELLA = (() => { let d = ''; for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 14, a = ARR + i * Math.PI / 5; d += (i ? 'L' : 'M') + f(100 + r * Math.cos(a)) + ' ' + f(17 + r * Math.sin(a)); } return `<path d="${d}Z" fill="#fde68a" stroke="#f59e0b" stroke-width="1" stroke-linejoin="round"/>`; })();

// fondo: 'redondeado' | 'pleno' (cuadrado: maskable e iOS) | null ; escala: tamaño del encaje dentro del cuadro
function svg({ detalle = 'completo', fondo = 'redondeado', escala, navidad = false, estrella = navidad } = {}) {
  escala = escala ?? (fondo ? 0.86 : 1);
  const c = navidad ? COLORES.navidad : COLORES.normal;
  const tr = escala === 1 ? '' : ` transform="translate(${f(100 - 100 * escala)} ${f(100 - 100 * escala)}) scale(${escala})"`;
  const nd = nanduti(c, detalle);
  const fondoSvg = !fondo ? '' : `<rect width="200" height="200"${fondo === 'redondeado' ? ' rx="44"' : ''} fill="url(#${navidad ? 'nvFondo' : 'ndFondo'})"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">\n<!-- Generado por scripts/nanduti.mjs (ñandutí según la técnica de Itauguá): no editar a mano -->\n` +
    `<defs>${navidad ? FONDO_NV : FONDO}${BRILLO(c.centro)}${nd.defs}</defs>\n${fondoSvg}<g${tr}><circle cx="100" cy="100" r="40" fill="url(#ndBrillo)"/>${nd.cuerpo}</g>` +
    `${estrella ? ESTRELLA : ''}</svg>\n`;
}

const archivos = {
  'icono.svg': svg({ detalle: 'simple' }),
  'logo-nanduti.svg': svg({ detalle: 'completo' }),
  'logo-nanduti-hilos.svg': svg({ detalle: 'completo', fondo: null }),
  'icono-navidad.svg': svg({ detalle: 'simple', navidad: true }),
  'logo-navidad.svg': svg({ detalle: 'completo', navidad: true }),
  'nanduti-navidad-hilos.svg': svg({ detalle: 'completo', fondo: null, navidad: true, estrella: false })   // adornos de la guirnalda
};
for (const [n, s] of Object.entries(archivos)) writeFileSync('img/' + n, s);

// ---- El símbolo de la portada (en index.html, con colores CSS) ----
const ndP = nanduti(COLORES.css, 'completo');
const simbolo = `<svg id="nanduti-sprite" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>` +
  `<radialGradient id="ndPortadaBrillo" cx=".5" cy=".5" r=".5"><stop offset="0" style="stop-color:var(--nd-centro);stop-opacity:.4"/><stop offset="1" style="stop-color:var(--nd-centro);stop-opacity:0"/></radialGradient>` +
  `${ndP.defs}<symbol id="nanduti-portada" viewBox="0 0 200 200"><circle cx="100" cy="100" r="44" fill="url(#ndPortadaBrillo)"/>${ndP.cuerpo}</symbol></defs></svg>`;
const html = readFileSync('index.html', 'utf8'), A = '<!-- NANDUTI:INICIO -->', B = '<!-- NANDUTI:FIN -->';
if (!html.includes(A) || !html.includes(B)) throw new Error('index.html no tiene los marcadores NANDUTI');
writeFileSync('index.html', html.slice(0, html.indexOf(A) + A.length) + '\n' + simbolo + '\n' + html.slice(html.indexOf(B)));
console.log(`Ñandutí: ${Object.keys(archivos).join(', ')} y el símbolo de la portada en index.html`);

// ---- PNG de la app instalada ----
if (process.argv.includes('--png')) {
  const { chromium } = createRequire(import.meta.url)('playwright');
  const png = [
    ['icono-512.png', 512, svg({ detalle: 'completo' })],
    ['icono-192.png', 192, svg({ detalle: 'simple' })],
    ['icono-maskable-512.png', 512, svg({ detalle: 'completo', fondo: 'pleno', escala: 0.74 })],   // dentro de la zona segura
    ['icono-maskable-192.png', 192, svg({ detalle: 'simple', fondo: 'pleno', escala: 0.74 })],
    ['apple-touch-icon.png', 180, svg({ detalle: 'simple', fondo: 'pleno', escala: 0.86 })]
  ];
  const b = await chromium.launch(), p = await b.newPage();
  for (const [n, tam, s] of png) {
    await p.setViewportSize({ width: tam, height: tam });
    await p.setContent(`<html><body style="margin:0;background:transparent">${s.replace('<svg ', `<svg width="${tam}" height="${tam}" `)}</body></html>`);
    await p.screenshot({ path: 'img/' + n, omitBackground: true, clip: { x: 0, y: 0, width: tam, height: tam } });
  }
  await b.close();
  console.log('PNG: ' + png.map(x => x[0]).join(', '));
}
