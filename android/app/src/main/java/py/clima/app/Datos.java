package py.clima.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Ciudades, clima (Open-Meteo, con los datos publicados del repositorio de reserva) y la memoria del último clima de cada ciudad. */
final class Datos {
    private Datos() {}

    static final String SITIO = "https://d7lopez-cpu.github.io/Clima-do-paraguay/";
    private static final String DATOS_REPO = "https://raw.githubusercontent.com/d7lopez-cpu/Clima-do-paraguay/datos/datos.json";
    private static final String PREFS = "clima_widget";

    // ---------- Ciudades ----------
    static final class Ciudad {
        final String nombre, dep, clave;
        final double lat, lon;
        Ciudad(String nombre, String dep, double lat, double lon) {
            this.nombre = nombre; this.dep = dep; this.lat = lat; this.lon = lon;
            this.clave = normalizar(nombre + " " + dep);
        }
    }

    private static List<Ciudad> ciudades;

    static synchronized List<Ciudad> ciudades(Context ctx) {
        if (ciudades != null) return ciudades;
        List<Ciudad> l = new ArrayList<>();
        try (InputStream in = ctx.getAssets().open("ciudades.json")) {
            JSONArray a = new JSONArray(leerTodo(in));
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.getJSONObject(i);
                l.add(new Ciudad(o.getString("n"), o.optString("dep", ""), o.getDouble("lat"), o.getDouble("lon")));
            }
        } catch (Exception e) {
            l.add(new Ciudad("Asunción", "Asunción", -25.2637, -57.5759));
        }
        ciudades = l;
        return l;
    }

    static Ciudad buscar(Context ctx, String nombre) {
        for (Ciudad c : ciudades(ctx)) if (c.nombre.equals(nombre)) return c;
        return null;
    }

    /** Sin tildes ni mayúsculas: «Ñemby» y «nemby» se encuentran igual. */
    static String normalizar(String s) {
        String n = Normalizer.normalize(s.toLowerCase(Locale.ROOT), Normalizer.Form.NFD);
        return n.replaceAll("\\p{M}", "");
    }

    // ---------- Clima ----------
    static final class Clima {
        double temp = Double.NaN, max = Double.NaN, min = Double.NaN;
        int codigo = -1;
        boolean dia = true;
        long t;                                         // cuándo se obtuvo (ms)

        JSONObject json() throws Exception {
            JSONObject o = new JSONObject();
            o.put("temp", temp); o.put("codigo", codigo); o.put("dia", dia); o.put("t", t);
            if (!Double.isNaN(max)) o.put("max", max);
            if (!Double.isNaN(min)) o.put("min", min);
            return o;
        }

        static Clima de(JSONObject o) {
            Clima k = new Clima();
            k.temp = o.optDouble("temp", Double.NaN); k.codigo = o.optInt("codigo", -1); k.dia = o.optBoolean("dia", true);
            k.t = o.optLong("t", 0); k.max = o.optDouble("max", Double.NaN); k.min = o.optDouble("min", Double.NaN);
            return k;
        }
    }

    /** Pide el clima de ahora. Primero Open-Meteo (al día, con máxima y mínima); si falla, los datos que publica el repositorio. */
    static Clima pedir(Ciudad c) {
        try {
            String url = String.format(Locale.US,
                    "https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f" +
                            "&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min" +
                            "&timezone=America%%2FAsuncion&forecast_days=1", c.lat, c.lon);
            JSONObject j = new JSONObject(bajar(url, 5000));
            JSONObject cur = j.getJSONObject("current");
            Clima k = new Clima();
            k.temp = cur.getDouble("temperature_2m");
            k.codigo = cur.getInt("weather_code");
            k.dia = cur.optInt("is_day", 1) == 1;
            JSONObject d = j.optJSONObject("daily");
            if (d != null) {
                k.max = d.getJSONArray("temperature_2m_max").optDouble(0, Double.NaN);
                k.min = d.getJSONArray("temperature_2m_min").optDouble(0, Double.NaN);
            }
            k.t = System.currentTimeMillis();
            return k;
        } catch (Exception e) {
            try {
                JSONObject j = new JSONObject(bajar(DATOS_REPO + "?v=" + (System.currentTimeMillis() / 300000), 5000));
                JSONObject d = j.getJSONObject("datos").getJSONObject(c.nombre);
                Clima k = new Clima();
                k.temp = d.getDouble("temperature_2m");
                k.codigo = d.getInt("weather_code");
                k.dia = d.optInt("is_day", 1) == 1;
                k.t = j.optLong("t", System.currentTimeMillis());
                return k;
            } catch (Exception e2) {
                return null;
            }
        }
    }

    private static String bajar(String url, int ms) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(ms);
        con.setReadTimeout(ms);
        con.setRequestProperty("User-Agent", "ClimaPY-Android");
        try {
            if (con.getResponseCode() != 200) throw new Exception("HTTP " + con.getResponseCode());
            try (InputStream in = con.getInputStream()) { return leerTodo(in); }
        } finally {
            con.disconnect();
        }
    }

    private static String leerTodo(InputStream in) throws Exception {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        for (int n; (n = in.read(buf)) > 0; ) b.write(buf, 0, n);
        return b.toString("UTF-8");
    }

    // ---------- Memoria (preferencias) ----------
    static SharedPreferences prefs(Context ctx) { return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static String ciudadDe(Context ctx, int widgetId) { return prefs(ctx).getString("ciudad_" + widgetId, null); }

    static void fijarCiudad(Context ctx, int widgetId, String ciudad) { prefs(ctx).edit().putString("ciudad_" + widgetId, ciudad).apply(); }

    static void olvidar(Context ctx, int widgetId) { prefs(ctx).edit().remove("ciudad_" + widgetId).apply(); }

    static Clima memoria(Context ctx, String ciudad) {
        String s = prefs(ctx).getString("clima_" + ciudad, null);
        if (s == null) return null;
        try { return Clima.de(new JSONObject(s)); } catch (Exception e) { return null; }
    }

    static void recordar(Context ctx, String ciudad, Clima k) {
        try { prefs(ctx).edit().putString("clima_" + ciudad, k.json().toString()).apply(); } catch (Exception ignorado) { }
    }

    static String enlace(String ciudad) {
        try { return SITIO + "#c=" + URLEncoder.encode(ciudad, "UTF-8").replace("+", "%20"); }
        catch (Exception e) { return SITIO; }
    }

    // ---------- Textos e íconos (los mismos que la app web) ----------
    static String texto(int c) {
        switch (c) {
            case 0: return "Despejado";
            case 1: return "Mayormente despejado";
            case 2: return "Parcialmente nublado";
            case 3: return "Nublado";
            case 45: return "Niebla";
            case 48: return "Niebla con escarcha";
            case 51: return "Llovizna leve";
            case 53: return "Llovizna";
            case 55: return "Llovizna fuerte";
            case 56: return "Llovizna helada";
            case 57: return "Llovizna helada fuerte";
            case 61: return "Lluvia leve";
            case 63: return "Lluvia";
            case 65: return "Lluvia fuerte";
            case 66: return "Lluvia helada";
            case 67: return "Lluvia helada fuerte";
            case 71: return "Nieve leve";
            case 73: return "Nieve";
            case 75: return "Nieve fuerte";
            case 77: return "Granizo fino";
            case 80: return "Chubascos leves";
            case 81: return "Chubascos";
            case 82: return "Chubascos fuertes";
            case 85: return "Chubascos de nieve";
            case 86: return "Chubascos de nieve fuertes";
            case 95: return "Tormenta";
            case 96: return "Tormenta con granizo";
            case 99: return "Tormenta fuerte con granizo";
            default: return "Sin datos";
        }
    }

    static int icono(int c, boolean dia) {
        if (c < 0) return R.drawable.ic_sensacion;
        if (c <= 1) return dia ? R.drawable.ic_despejado : R.drawable.ic_noche_clara;
        if (c == 2) return dia ? R.drawable.ic_parcial : R.drawable.ic_parcial_noche;
        if (c == 3) return R.drawable.ic_nublado;
        if (c == 45 || c == 48) return R.drawable.ic_niebla;
        if (c >= 51 && c <= 57) return R.drawable.ic_llovizna;
        if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return R.drawable.ic_lluvia;
        if ((c >= 71 && c <= 77) || c == 85 || c == 86) return R.drawable.ic_frio;
        if (c == 95) return R.drawable.ic_tormenta;
        if (c >= 96 && c <= 99) return R.drawable.ic_granizo;
        return R.drawable.ic_sensacion;
    }

    static String grados(double t) {
        return Double.isNaN(t) ? "--°" : Math.round(t) + "°";
    }
}
