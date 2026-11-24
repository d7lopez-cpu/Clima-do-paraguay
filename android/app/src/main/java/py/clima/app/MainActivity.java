package py.clima.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

/** La app completa: Clima PY (la misma web, con su modo sin conexión) dentro de la app, sin barra del navegador. */
public class MainActivity extends Activity {

    static final String EXTRA_CIUDAD = "ciudad";
    private static final int PEDIDO_UBICACION = 7;
    private static final String HOST = Uri.parse(Datos.SITIO).getHost();

    private WebView web;
    private GeolocationPermissions.Callback geoAvisar;
    private String geoOrigen;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0A1433);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                           // favoritas, preferencias y datos guardados de la app
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST != null && HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignorado) { }
                return true;                                    // los enlaces de afuera se abren en el navegador
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) v.loadDataWithBaseURL(null, PAGINA_SIN_CONEXION, "text/html", "UTF-8", null);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origen, GeolocationPermissions.Callback avisar) {
                if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    avisar.invoke(origen, true, false);
                } else {
                    geoAvisar = avisar; geoOrigen = origen;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION}, PEDIDO_UBICACION);
                }
            }
        });

        if (guardado != null) web.restoreState(guardado);
        else web.loadUrl(direccion(getIntent()));
    }

    private static String direccion(Intent i) {
        String c = i == null ? null : i.getStringExtra(EXTRA_CIUDAD);
        return c == null ? Datos.SITIO : Datos.enlace(c);
    }

    /** Desde el widget con la app ya abierta: cambia a esa ciudad (la app lee la ciudad del #c=… al cargar). */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String c = intent.getStringExtra(EXTRA_CIUDAD);
        if (c == null || web == null) return;
        String url = web.getUrl();
        if (url != null && url.startsWith(Datos.SITIO)) {
            web.evaluateJavascript("location.replace(" + JSONObject.quote(Datos.enlace(c)) + ");location.reload();", null);
        } else {
            web.loadUrl(Datos.enlace(c));
        }
    }

    @Override
    public void onRequestPermissionsResult(int pedido, String[] permisos, int[] resultados) {
        if (pedido == PEDIDO_UBICACION && geoAvisar != null) {
            boolean ok = resultados.length > 0 && resultados[0] == PackageManager.PERMISSION_GRANTED;
            geoAvisar.invoke(geoOrigen, ok, false);
            geoAvisar = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        if (web != null) web.saveState(estado);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();                         // la app web pausa la animación y el sonido al ocultarse
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

    private static final String PAGINA_SIN_CONEXION =
            "<!doctype html><html lang=es><meta name=viewport content='width=device-width,initial-scale=1'>" +
            "<body style='margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;" +
            "background:linear-gradient(180deg,#0a1433,#172a63 48%,#2b2463);color:#eef2ff;font-family:sans-serif;text-align:center'>" +
            "<div style='padding:24px'><h1 style='font-family:serif;font-weight:600'>Sin conexión</h1>" +
            "<p style='color:#c3cdf0'>La primera vez Clima PY necesita internet. Después funciona también sin conexión.</p>" +
            "<button onclick=\"location.href='" + Datos.SITIO + "'\" style='margin-top:12px;min-height:44px;padding:0 20px;border:0;" +
            "border-radius:12px;background:#f4a3c6;color:#2a0f1f;font-weight:600;font-size:16px'>Reintentar</button></div></body></html>";
}
