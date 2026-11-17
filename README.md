# Clima PY 🇵🇾

El clima de **263 ciudades y localidades de Paraguay** en un mapa: temperatura, humedad, viento y lluvia, con pronóstico por horas y por días.

👉 **Usar la app:** https://d7lopez-cpu.github.io/Clima-do-paraguay/

Se puede instalar en el celular como una app (desde el menú del navegador: *Agregar a la pantalla de inicio*) y abre aunque no haya internet, mostrando los últimos datos guardados.

## Qué ofrece

- **Mapa de los 18 departamentos** con capas de temperatura, humedad, viento y lluvia, y un deslizador para ver las próximas 24 horas.
- **Pronóstico de cada ciudad** por horas y para 6 días, con índice UV, amanecer, atardecer y luna.
- **Datos medidos, no solo calculados:** cerca de un aeropuerto (≤ 25 km) se usan las observaciones reales (METAR); en el resto del país se muestra cuánto difiere el modelo de lo medido.
- **Probabilidad de lluvia con ensambles** de 4 modelos (ECMWF, GFS, ICON y GEM) y rango probable de temperatura.
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
| `sw.js` | Service worker: permite abrir la app sin internet |
| `manifest.webmanifest` | Nombre e íconos para instalar la app |
| `scripts/actualizar_clima.py` | Descarga el clima de todas las ciudades (solo usa Python estándar) |
| `.github/workflows/clima.yml` | Ejecuta el script cada 30 minutos y publica en la rama `datos` |
| `scripts/revisar.mjs` y `.github/workflows/revisar.yml` | Revisión automática: en cada cambio comprueba que el código no tenga errores y que las ciudades y archivos estén bien |

## Tareas comunes

- **Agregar o mover una ciudad:** edita la lista `ciudades` dentro de `geo.js` (`n` nombre, `lat`, `lon`, `dep` departamento, `g` tamaño de 1 a 4). El script lee la misma lista, no hay que cambiarla en otro lugar.
- **Publicar una versión nueva:** después de cambiar `index.html`, `app.js`, `estilos.css` o `geo.js`, sube el número de `VERSION` en `sw.js` para que los celulares renueven su copia guardada.
- **Actualizar el clima a mano:** pestaña *Actions* → *Actualizar clima* → *Run workflow*.
- **Revisar que nada esté roto:** GitHub lo hace solo en cada cambio (✅ o ❌ junto al commit). A mano: `node scripts/revisar.mjs`.
- **Probar en tu computadora:** desde la carpeta del proyecto, ejecuta `python3 -m http.server` y abre http://localhost:8000.

## Fuentes de datos

- Clima y pronóstico: [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0)
- Observaciones de aeropuertos: [aviationweather.gov](https://aviationweather.gov/)
- Radar: [RainViewer](https://www.rainviewer.com/)
- Límites: [geoBoundaries](https://www.geoboundaries.org/), [Natural Earth](https://www.naturalearthdata.com/) e INE Paraguay (distritos 2022)
