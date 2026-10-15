#!/usr/bin/env python3
"""Clima PY: baja el clima actual y el pronóstico por horas de todas las ciudades de la app
y los guarda en datos.json y horas.json. Lo ejecuta GitHub Actions cada 30 minutos, así cada
persona que abre la app lee estos archivos en vez de consultar a Open-Meteo por su cuenta.

Las ciudades se leen de index.html (la lista GEO), así que no hay que mantener otra copia.
Solo usa la biblioteca estándar de Python (no hay que instalar nada).
"""
import json, math, re, sys, time, unicodedata, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone

BASE = "https://api.open-meteo.com/v1/forecast"
LOTE = 40                      # ciudades por consulta (como en la app)
PAUSA = 2.0                    # segundos entre consultas, para no saturar
CAMPOS_ACTUAL = "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code,is_day"
CAMPOS_HORAS = "temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation"


def leer_geo(ruta="index.html"):
    html = open(ruta, encoding="utf-8").read()
    i = html.index("const GEO = ") + len("const GEO = ")
    j = html.index("\n", i)
    geo = json.loads(html[i:j].rstrip().rstrip(";"))
    m = re.search(r"const PENDIENTES = \{(.*?)\n  \};", html, re.S)      # localidades cuyas coordenadas se buscan con el geocodificador
    pendientes = json.loads("{" + m.group(1).replace("'", '"') + "}") if m else {}
    return geo, pendientes


def normalizar(t):
    t = unicodedata.normalize("NFD", t.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in t if unicodedata.category(c) != "Mn"))


def en_anillo(lon, lat, anillo):
    dentro = False
    for i in range(len(anillo)):
        x1, y1 = anillo[i]
        x2, y2 = anillo[i - 1]
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            dentro = not dentro
    return dentro


def en_departamento(lat, lon, dep, geo):
    d = next((x for x in geo["deps"] if x["n"] == dep), None)
    return bool(d) and any(en_anillo(lon, lat, r) for r in d["r"])


def km(a, b, c, d):
    p = math.pi / 180
    h = math.sin((c - a) * p / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def resolver_lugares(geo, pendientes, ciudades, previos):
    """Busca las coordenadas de los distritos que faltan. Un resultado solo se acepta si cae dentro del departamento
    correcto y no repite una ciudad que ya existe. Lo ya resuelto (en la corrida anterior) no se vuelve a pedir."""
    res = dict(previos)
    conocidas = {c[0] for c in ciudades}
    for dep, nombres in pendientes.items():
        for n in nombres:
            if n in res or n in conocidas:
                continue
            j = pedir("https://geocoding-api.open-meteo.com/v1/search?name=" + urllib.parse.quote(n) + "&count=10&language=es&countryCode=PY", intentos=2)
            time.sleep(0.6)
            if j is None:
                continue                                   # sin respuesta: se reintenta en la próxima corrida
            buenos = []
            for x in j.get("results") or []:
                a, b = normalizar(x.get("name", "")), normalizar(n)
                if not (a == b or (len(b) >= 5 and (b in a or a in b))):
                    continue
                if not en_departamento(x["latitude"], x["longitude"], dep, geo):
                    continue
                if any(km(c[1], c[2], x["latitude"], x["longitude"]) < 5 for c in ciudades):
                    continue
                buenos.append(x)
            buenos.sort(key=lambda x: x.get("population") or 0, reverse=True)
            res[n] = ({"dep": dep, "lat": round(buenos[0]["latitude"], 4), "lon": round(buenos[0]["longitude"], 4)} if buenos else 0)
    return res


def pedir(url, intentos=4):
    """GET con reintentos. Si Open-Meteo responde 429 o hay un error de red, espera y vuelve a probar."""
    for k in range(intentos):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "clima-py-actualizador (GitHub Actions)"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            espera = 30 * (k + 1) if e.code == 429 or e.code >= 500 else None
            print(f"  HTTP {e.code} (intento {k + 1}/{intentos})", flush=True)
            if espera is None:
                return None
        except Exception as e:  # red caída, tiempo agotado, JSON roto…
            espera = 15 * (k + 1)
            print(f"  error: {e} (intento {k + 1}/{intentos})", flush=True)
        if k < intentos - 1:
            time.sleep(espera)
    return None


def por_lotes(ciudades, campo, extra):
    """Pide cada lote y devuelve {nombre_de_ciudad: datos}. Lo que falle se omite (la app lo pide directo)."""
    salida = {}
    for i in range(0, len(ciudades), LOTE):
        lote = ciudades[i:i + LOTE]
        url = (f"{BASE}?latitude={','.join(str(c[1]) for c in lote)}&longitude={','.join(str(c[2]) for c in lote)}"
               f"&{extra}&timezone=America%2FAsuncion")
        j = pedir(url)
        if j is None:
            print(f"  lote {i // LOTE + 1}: sin datos", flush=True)
        else:
            for c, d in zip(lote, j if isinstance(j, list) else [j]):
                if d and d.get(campo):
                    salida[c[0]] = d[campo]
        time.sleep(PAUSA)
    return salida


def main():
    geo, pendientes = leer_geo()
    ciudades = [(c["n"], c["lat"], c["lon"]) for c in geo["ciudades"]]
    try:
        previos = json.load(open("lugares_previos.json", encoding="utf-8"))
    except Exception:
        previos = {}
    print("Localidades extra…", flush=True)
    lugares = resolver_lugares(geo, pendientes, ciudades, previos)
    validos = {n: v for n, v in lugares.items() if v}
    ciudades += [(n, v["lat"], v["lon"]) for n, v in validos.items()]
    print(f"{len(ciudades)} ciudades ({len(validos)} localidades extra)", flush=True)
    ahora = int(datetime.now(timezone.utc).timestamp() * 1000)

    print("Clima actual…", flush=True)
    datos = por_lotes(ciudades, "current", f"current={CAMPOS_ACTUAL}")
    print("Pronóstico por horas…", flush=True)
    horas = por_lotes(ciudades, "hourly", f"hourly={CAMPOS_HORAS}&forecast_days=2")

    # Si casi no llegó nada, no se publica: se conservan los datos anteriores
    if len(datos) < len(ciudades) * 0.6:
        print(f"Solo llegaron {len(datos)} de {len(ciudades)} ciudades: no se publica.", file=sys.stderr)
        sys.exit(1)

    cod = dict(ensure_ascii=False, separators=(",", ":"))
    with open("datos.json", "w", encoding="utf-8") as f:
        json.dump({"t": ahora, "datos": datos, "lugares": validos}, f, **cod)
    with open("lugares.json", "w", encoding="utf-8") as f:
        json.dump(lugares, f, **cod)
    with open("horas.json", "w", encoding="utf-8") as f:
        json.dump({"t": ahora, "horas": horas}, f, **cod)
    print(f"Listo: datos de {len(datos)} ciudades y horas de {len(horas)}.", flush=True)


if __name__ == "__main__":
    main()
