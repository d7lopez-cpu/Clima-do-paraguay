# Clima PY 🇵🇾

El clima de **263 ciudades y localidades de Paraguay** en un mapa: temperatura, humedad, viento y lluvia, con pronóstico por horas y por días.

👉 **Usar la app:** https://d7lopez-cpu.github.io/Clima-do-paraguay/

Se puede instalar en el celular como una app (desde el menú del navegador: *Agregar a la pantalla de inicio*) y abre aunque no haya internet, mostrando los últimos datos guardados.

## Qué ofrece

- **Mapa de los 18 departamentos** con capas de temperatura, humedad, viento y lluvia, y un deslizador para ver las próximas 24 horas.
- **Pronóstico de cada ciudad** por horas (con «Ahora» destacado) o en gráfico, y los **próximos 7 días** en filas con probabilidad de lluvia y rango de temperatura; tarjetas de sensación, humedad, viento, presión, lluvia, UV, probabilidad de lluvia, visibilidad, luna, calidad del aire y una de salida y puesta del sol con el arco del día.
- **Datos medidos, no solo calculados:** cerca de un aeropuerto (≤ 25 km) se usan las observaciones reales (METAR); en el resto del país se muestra cuánto difiere el modelo de lo medido.
- **Probabilidad de lluvia con ensambles** de 4 modelos (ECMWF, GFS, ICON y GEM) y rango probable de temperatura.
- **Compartir** el clima de una ciudad (menú del celular, copiar enlace o WhatsApp), con enlace directo a esa ciudad.
- **Avisos** en el detalle: calor extremo (sensación ≥ 38 °C), frío intenso (≤ 5 °C) y viento fuerte (≥ 50 km/h), además de UV, lluvia y tormenta.
- **Paisaje y cielo animados** que cambian con el clima y la hora de la ciudad elegida, con transiciones suaves: nubes en capas con profundidad, reflejos del sol y la luna en el río, luces de la ciudad de noche, Vía Láctea, lluvia con charcos, granizo, viento con hojas y palmeras que se mecen, niebla, relámpagos, luna con su fase real, estrellas fugaces, arcoíris, ondas de calor y lapachos en flor (julio a septiembre).
- **Sonido ambiente opcional** con una mezcla limpia (un fondo y como mucho dos detalles, volumen parejo entre climas, limitador): chicharras en verano, grillos, aves, ranas, viento, lluvia, granizo y truenos.
- **Ajustes (botón de ajustes):** pestañas Animación, Sonido y Navidad: qué efectos ver, intensidad, calidad (automática, alta o ahorro de batería), fondo y paisaje por separado, volumen y una **vista previa** para ver cualquier clima y momento del día. Se guardan en el navegador de cada persona.
- **Navidad** automática del 1 de diciembre al 6 de enero (o siempre/nunca): logo ñandutí festivo, guirnalda de luces que parpadean (se puede dejar fija), saludo con cuenta regresiva, pino decorado y palmeras con luces en el paisaje, **música navideña opcional** (caja de música sintetizada con melodías de dominio público) y fuegos artificiales en Año Nuevo. Sin nieve: en Paraguay la Navidad es en verano.
- **Portada premium:** la ciudad y la temperatura sobre la franja de paisaje animado, con un **ñandutí fiel a la técnica de Itauguá** (urdimbre de rayos, apyte, redes de nudos, dientes y flor de rombos; cinco colores) que rodea la temperatura y cambia su brillo con el clima; barra superior compacta con un **menú** (en el celular) para idioma, tema, sonido, ajustes y accesos rápidos.
- **Diseño «Cristal guaraní»:** modo oscuro por defecto, el **ñandutí** como logo y como detalle, tipografía Fraunces + Inter (incluidas, con las letras del guaraní) y un set de íconos propio: la interfaz no usa emojis.
- Radar de lluvia, comparación de ciudades, favoritas, "cerca de mí", tema claro/oscuro y °C/°F.

## Cómo funciona

```
GitHub Actions (cada 30 min)                       Navegador
┌──────────────────────────────┐                   ┌──────────────────────────────┐
│ scripts/actualizar_clima.py  │──► rama "datos" ──►│ index.html + app.js          │
│ baja el clima de Open-Meteo  │   datos.json       │ lee datos.json y solo pide   │
│ para todas las ciudades      │   horas.json       │ directo lo que falte         │
└──────────────────────────────┘                   └──────────────────────────────┘
```

En vez de que cada visitante consulte cientos de ciudades a Open-Meteo, un proceso automático las consulta una vez cada 30 minutos y deja el resultado en la rama `datos`. Así la app es rápida, no agota el límite gratuito de la API y no necesita servidor propio.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página (estructura) |
| `estilos.css` | El diseño |
| `app.js` | El código de la app |
| `geo.js` | Datos geográficos: departamentos, distritos, países vecinos y ciudades (`GEO`) |
| `sw.js` | Service worker: permite abrir la app sin internet (`geo.js` sale primero del caché y se renueva en segundo plano) |
| `fonts/` | Fuentes propias Fraunces e Inter (licencia OFL): subconjunto latino y las letras del guaraní ĩ ũ ẽ ỹ |
| `icono.svg`, `logo-nanduti*.svg`, `logo-navidad.svg`, `icono-*.png` | Logo ñandutí y sus variantes (normal y navideña, para la app instalada y el navegador) |
| `scripts/nanduti.mjs` | Dibuja el ñandutí de la marca según la técnica de Itauguá (urdimbre de rayos, apyte, redes de nudos, dientes y flor de rombos zurcidos, círculos de refuerzo y puntas): `icono.svg`, los logos (normal, sin fondo y navideño) y el ñandutí de la portada en `index.html` (entre `<!-- NANDUTI:INICIO -->` y `<!-- NANDUTI:FIN -->`, con colores `--nd-…` de `estilos.css`). Con `--png` también los íconos PNG de la app instalada |
| `scripts/iconos.mjs` | Genera el set de íconos SVG de la interfaz dentro de `index.html`, entre `<!-- ICONOS:INICIO -->` y `<!-- ICONOS:FIN -->` (para cambiar un ícono, edita este script y córrelo: `node scripts/iconos.mjs`) |
| `scripts/simplificar-geo.mjs` | Aligera los mapas de `geo.js` sin deformar los bordes compartidos (ver abajo) |
| `manifest.webmanifest` | Nombre e íconos para instalar la app |
| `scripts/actualizar_clima.py` | Descarga el clima de todas las ciudades (solo usa Python estándar) |
| `.github/workflows/clima.yml` | Ejecuta el script cada 30 minutos y publica en la rama `datos` |
| `scripts/revisar.mjs` y `.github/workflows/revisar.yml` | Revisión automática: en cada cambio comprueba que el código no tenga errores y que las ciudades y archivos estén bien |

## Tareas comunes

- **Agregar o mover una ciudad:** edita la lista `ciudades` dentro de `geo.js` (`n` nombre, `lat`, `lon`, `dep` departamento, `g` tamaño de 1 a 4). El script lee la misma lista, no hay que cambiarla en otro lugar.
- **Publicar una versión nueva:** después de cambiar `index.html`, `app.js`, `estilos.css` o `geo.js`, sube el número de `VERSION` en `sw.js` para que los celulares renueven su copia guardada. **Con `geo.js` es imprescindible:** se sirve primero desde el caché, así que sin subir `VERSION` cada persona vería el cambio recién en su segunda visita.
- **Aligerar los mapas:** `geo.js` ya está simplificado (−40 % de peso). Si se vuelve a generar, hay que partir del archivo original (no de uno ya simplificado): `git show 17b6f36:geo.js > /tmp/original.js` y luego `node scripts/simplificar-geo.mjs --entrada /tmp/original.js --eps-dep 0.007 --eps-vec 0.01`. Con `--eps-dep 0.005` se conserva más detalle (−34 %).
- **Actualizar el clima a mano:** pestaña *Actions* → *Actualizar clima* → *Run workflow*.
- **Probar la animación en todas sus variantes:** en la consola del navegador, `climaAnim.fijar({ vistaPrevia: { tipo: 'tormenta', fase: 'noche' } })` (tipos: despejado, parcial, nublado, lluvia, tormenta, niebla; fases: amanecer, dia, atardecer, noche) y `climaAnim.fijar({ vistaPrevia: null })` para volver al clima real.
- **Revisar que nada esté roto:** GitHub lo hace solo en cada cambio (✅ o ❌ junto al commit). A mano: `node scripts/revisar.mjs`.
- **Probar en tu computadora:** desde la carpeta del proyecto, ejecuta `python3 -m http.server` y abre http://localhost:8000.

## Fuentes de datos

- Clima y pronóstico: [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0)
- Observaciones de aeropuertos: [aviationweather.gov](https://aviationweather.gov/)
- Radar: [RainViewer](https://www.rainviewer.com/)
- Límites: [geoBoundaries](https://www.geoboundaries.org/), [Natural Earth](https://www.naturalearthdata.com/) e INE Paraguay (distritos 2022)
