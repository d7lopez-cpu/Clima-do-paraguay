package py.clima.app;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/** Pantalla para elegir la ciudad del widget (con buscador sin tildes). */
public class ConfigWidget extends Activity {

    private int widgetId = AppWidgetManager.INVALID_APPWIDGET_ID;
    private final List<Datos.Ciudad> visibles = new ArrayList<>();
    private Adaptador adaptador;

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        setResult(RESULT_CANCELED);                             // si se sale sin elegir, Android no agrega el widget
        Bundle extras = getIntent().getExtras();
        if (extras != null) widgetId = extras.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return; }

        setContentView(R.layout.activity_config);
        ListView lista = findViewById(R.id.lista);
        EditText buscar = findViewById(R.id.buscar);
        adaptador = new Adaptador();
        lista.setAdapter(adaptador);
        filtrar("");

        // La ciudad actual del widget, primero (si ya tenía una)
        String actual = Datos.ciudadDe(this, widgetId);
        if (actual != null) buscar.setHint("Ahora: " + actual + " · buscar otra");

        buscar.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) { }
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) { filtrar(s.toString()); }
            @Override public void afterTextChanged(Editable s) { }
        });
        lista.setOnItemClickListener((padre, vista, pos, idFila) -> elegir(visibles.get(pos)));
    }

    private void filtrar(String q) {
        String n = Datos.normalizar(q.trim());
        visibles.clear();
        List<Datos.Ciudad> empiezan = new ArrayList<>(), contienen = new ArrayList<>();
        for (Datos.Ciudad c : Datos.ciudades(this)) {
            if (n.isEmpty() || c.clave.startsWith(n)) empiezan.add(c);
            else if (c.clave.contains(n)) contienen.add(c);
        }
        visibles.addAll(empiezan);
        visibles.addAll(contienen);
        adaptador.notifyDataSetChanged();
    }

    private void elegir(Datos.Ciudad c) {
        Datos.fijarCiudad(this, widgetId, c.nombre);
        WidgetClima.pintar(this, AppWidgetManager.getInstance(this), widgetId);
        WidgetClima.pedirActualizacion(this, new int[]{widgetId});
        setResult(RESULT_OK, new Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId));
        finish();
    }

    private final class Adaptador extends BaseAdapter {
        @Override public int getCount() { return visibles.size(); }
        @Override public Object getItem(int i) { return visibles.get(i); }
        @Override public long getItemId(int i) { return i; }

        @Override
        public View getView(int i, View v, ViewGroup padre) {
            if (v == null) v = getLayoutInflater().inflate(R.layout.fila_ciudad, padre, false);
            Datos.Ciudad c = visibles.get(i);
            ((TextView) v.findViewById(R.id.nombre)).setText(c.nombre);
            ((TextView) v.findViewById(R.id.dep)).setText(c.dep.equals(c.nombre) ? "Capital" : c.dep);
            return v;
        }
    }
}
