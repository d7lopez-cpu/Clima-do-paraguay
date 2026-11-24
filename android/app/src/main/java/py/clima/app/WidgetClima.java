package py.clima.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;

/**
 * El widget: muestra al instante el último clima guardado y, en segundo plano, pide el de ahora.
 * Android lo actualiza solo cada 30 min; tocar la hora lo actualiza en el momento.
 */
public class WidgetClima extends AppWidgetProvider {

    static final String ACCION_ACTUALIZAR = "py.clima.app.ACTUALIZAR";
    private static final long VIEJO = 3 * 3600_000L;            // con más de 3 h, el dato se marca como «sin conexión»

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) pintar(ctx, mgr, id);
        actualizar(ctx, ids, goAsync());
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (ACCION_ACTUALIZAR.equals(intent.getAction())) {
            int[] ids = intent.getIntArrayExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS);
            if (ids == null) ids = todos(ctx);
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            for (int id : ids) pintarCargando(ctx, mgr, id);
            actualizar(ctx, ids, goAsync());
            return;
        }
        super.onReceive(ctx, intent);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle opciones) {
        pintar(ctx, mgr, id);                                   // cambió de tamaño: normal o compacto
    }

    @Override
    public void onDeleted(Context ctx, int[] ids) {
        for (int id : ids) Datos.olvidar(ctx, id);
    }

    static int[] todos(Context ctx) {
        return AppWidgetManager.getInstance(ctx).getAppWidgetIds(new ComponentName(ctx, WidgetClima.class));
    }

    /** Pide a este mismo receptor que actualice (lo usa la pantalla de elegir ciudad). */
    static void pedirActualizacion(Context ctx, int[] ids) {
        Intent i = new Intent(ctx, WidgetClima.class).setAction(ACCION_ACTUALIZAR).putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        ctx.sendBroadcast(i);
    }

    /** Baja el clima de cada ciudad distinta (una sola vez aunque haya varios widgets de la misma) y vuelve a pintar. */
    private static void actualizar(Context ctx, int[] ids, PendingResult fin) {
        final Context app = ctx.getApplicationContext();
        new Thread(() -> {
            try {
                AppWidgetManager mgr = AppWidgetManager.getInstance(app);
                Set<String> hechas = new HashSet<>();
                for (int id : ids) {
                    String nombre = ciudad(app, id);
                    if (hechas.add(nombre)) {
                        Datos.Ciudad c = Datos.buscar(app, nombre);
                        Datos.Clima k = c == null ? null : Datos.pedir(c);
                        Datos.Clima previo = Datos.memoria(app, nombre);
                        if (k != null && (previo == null || k.t >= previo.t)) Datos.recordar(app, nombre, k);
                    }
                    pintar(app, mgr, id);
                }
            } finally {
                if (fin != null) fin.finish();
            }
        }, "clima-widget").start();
    }

    private static String ciudad(Context ctx, int id) {
        String c = Datos.ciudadDe(ctx, id);
        return c != null ? c : "Asunción";
    }

    static void pintar(Context ctx, AppWidgetManager mgr, int id) {
        String nombre = ciudad(ctx, id);
        Datos.Clima k = Datos.memoria(ctx, nombre);
        RemoteViews normal = vistas(ctx, R.layout.widget_clima, true, id, nombre, k, false);
        RemoteViews chico = vistas(ctx, R.layout.widget_compacto, false, id, nombre, k, false);
        mgr.updateAppWidget(id, elegir(mgr, id, normal, chico));
    }

    private static void pintarCargando(Context ctx, AppWidgetManager mgr, int id) {
        String nombre = ciudad(ctx, id);
        RemoteViews normal = vistas(ctx, R.layout.widget_clima, true, id, nombre, Datos.memoria(ctx, nombre), true);
        RemoteViews chico = vistas(ctx, R.layout.widget_compacto, false, id, nombre, Datos.memoria(ctx, nombre), true);
        mgr.updateAppWidget(id, elegir(mgr, id, normal, chico));
    }

    /** Android 12 o más: el sistema elige el diseño según el tamaño. Antes: se decide con el tamaño que informa el lanzador. */
    private static RemoteViews elegir(AppWidgetManager mgr, int id, RemoteViews normal, RemoteViews chico) {
        if (Build.VERSION.SDK_INT >= 31) {
            Map<SizeF, RemoteViews> m = new HashMap<>();
            m.put(new SizeF(100f, 40f), chico);
            m.put(new SizeF(180f, 100f), normal);
            return new RemoteViews(m);
        }
        Bundle o = mgr.getAppWidgetOptions(id);
        int ancho = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
        int alto = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 110);
        return ancho >= 180 && alto >= 100 ? normal : chico;
    }

    private static RemoteViews vistas(Context ctx, int layout, boolean completo, int id, String nombre, Datos.Clima k, boolean cargando) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), layout);
        boolean hay = k != null && !Double.isNaN(k.temp);
        String estado = hay ? Datos.texto(k.codigo) : "Sin datos todavía";

        v.setTextViewText(R.id.ciudad, nombre);
        v.setTextViewText(R.id.temp, hay ? Datos.grados(k.temp) : "--°");
        v.setImageViewResource(R.id.icono, Datos.icono(hay ? k.codigo : -1, !hay || k.dia));
        v.setContentDescription(android.R.id.background,
                nombre + ": " + (hay ? Math.round(k.temp) + " grados, " + estado : estado) + ". Toca para abrir Clima PY.");

        // Tocar el widget abre la app en esta ciudad
        Intent abrir = new Intent(ctx, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .setData(Uri.parse("climapy://widget/" + id))
                .putExtra(MainActivity.EXTRA_CIUDAD, nombre)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(android.R.id.background,
                PendingIntent.getActivity(ctx, id * 4, abrir, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        if (!completo) return v;

        v.setTextViewText(R.id.estado, estado);
        if (hay && !Double.isNaN(k.max) && !Double.isNaN(k.min)) {
            v.setViewVisibility(R.id.maxima, View.VISIBLE);
            v.setViewVisibility(R.id.minima, View.VISIBLE);
            v.setTextViewText(R.id.maxima, "Máx " + Datos.grados(k.max));
            v.setTextViewText(R.id.minima, "Mín " + Datos.grados(k.min));
        } else {
            v.setViewVisibility(R.id.maxima, View.GONE);
            v.setViewVisibility(R.id.minima, View.GONE);
        }
        v.setTextViewText(R.id.hora, cargando ? "Actualizando…" : hora(k));

        // Tocar el nombre de la ciudad: elegir otra. Tocar la hora: actualizar ahora.
        Intent cambiar = new Intent(ctx, ConfigWidget.class)
                .setData(Uri.parse("climapy://ciudad/" + id))
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        v.setOnClickPendingIntent(R.id.ciudad,
                PendingIntent.getActivity(ctx, id * 4 + 1, cambiar, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        Intent act = new Intent(ctx, WidgetClima.class)
                .setAction(ACCION_ACTUALIZAR)
                .setData(Uri.parse("climapy://actualizar/" + id))
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, new int[]{id});
        v.setOnClickPendingIntent(R.id.hora,
                PendingIntent.getBroadcast(ctx, id * 4 + 2, act, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }

    private static String hora(Datos.Clima k) {
        if (k == null || k.t <= 0) return "Toca para actualizar";
        SimpleDateFormat f = new SimpleDateFormat("HH:mm", new Locale("es", "PY"));
        f.setTimeZone(TimeZone.getTimeZone("America/Asuncion"));
        String h = f.format(new Date(k.t));
        return System.currentTimeMillis() - k.t > VIEJO ? "Sin conexión · " + h : h;
    }
}
