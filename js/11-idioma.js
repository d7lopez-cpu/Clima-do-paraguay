/* Clima PY — Idioma: español y guaraní (Avañe'ẽ). Diccionario GN, frases con datos variables y traducción de la página.
 * Parte del código de la app, dividido por temas en js/01…12 (se cargan en orden desde index.html y comparten
 * las mismas variables). Usa GEO, definido en js/geo.js. */
'use strict';

  // ============ IDIOMA: español / guaraní (Avañe'ẽ) ============
  // Todas las traducciones están juntas en GN, GN_PATRONES y GN_REEMPL para poder corregirlas fácilmente.
  // Lo que no tiene traducción se queda en español. Los nombres de ciudades no se traducen.
  let idioma = leer('clima-py-idioma', 'es') === 'gn' ? 'gn' : 'es';
  const GN = {
    // --- pantalla principal ---
     "Sin conexión · usando datos guardados": "Ndaipóri internet · oñemoĩ marandu oñeñongatúva",
     "Instalar": "Emoĩ", "Radar de lluvia": "Radar ama rehegua", "Rutas": "Tape", "Buscar lugar": "Eheka tenda", "Comparar": "Ñembojoja", "Cerca de mí": "Che ag̃ui", "Actualizar": "Mbopyahu",
    "Cargando el clima…": "Oñembyaty ára marandu…", 
    "Usa Ctrl + rueda para hacer zoom": "Eipuru Ctrl + rueda embotuicha térã emomichĩ hag̃ua",
    "Ahora": "Ko'ág̃a",   "Pausar": "Mbopyta", "Reanudar": "Eñepyrũ jey",
    "Reproducir": "Emboguata",  "Radar desactivado": "Radar oñemboyke", "Radar sin datos": "Radar ndaipóri marandu",
    "Conectando con el radar…": "Ojejoaju radar ndive…",
    "Ctrl + rueda o pellizca para zoom · arrastra para mover · toca un departamento para filtrar · con zoom se ven los distritos":
      "Ctrl + rueda térã pellizca embotuicha hag̃ua · egueru emongu'e hag̃ua · epoko peteĩ departamento emoĩporã hag̃ua · embotuicha vove ojehecha umi distrito",
    "Ciudades": "Táva", "Orden: nombre": "Ñemohenda: téra", "Mayor valor primero": "Tuichavéva peteĩha", "Menor valor primero": "Michĩvéva peteĩha",
    "Datos del clima:": "Ára marandu:", "(modelos ECMWF, GFS, ICON y GEM) · observaciones:": "(modelo ECMWF, GFS, ICON ha GEM) · ojehecháva:",
    "(METAR de aeropuertos) · radar:": "(METAR aeropuerto-gua) · radar:", "Límites:": "Rembe'y:", "(dominio público)": "(opavavepegua)",
    "Se actualiza solo cada 30 minutos mientras la página está visible": "Ijehegui oñemopyahu opa 30 minuto ko página ojehecha aja",
    "Mapa": "Yvy ra'ãnga", "Opacidad": "Opacidad",
    // --- textos de ayuda (atributos title / aria-label / placeholder) ---
    "Acercar": "Embotuicha", "Alejar": "Emomichĩ", "Activar el sonido del clima": "Emoñepyrũ ára pu", "Silenciar el sonido del clima": "Emokirirĩ ára pu",
    "Avisar de tormentas en tus ciudades favoritas (con la app abierta)": "Emomarandu aratiri rehe nde táva jeporavopyre-pe (app ojeipe'a aja)",
    "Avisos de tormenta": "Ñemomarandu aratiri rehegua", "Busca cualquier pueblo o barrio de Paraguay": "Eheka oimeraẽ távaha térã barrio Paraguáipe",
    "Buscar ciudad": "Eheka táva", "Buscar ciudad o lugar…": "Eheka táva térã tenda…", "Capa del mapa": "Mapa capa", "Cerrar comparación": "Emboty ñembojoja",
    "Ciudades favoritas": "Táva jeporavopyre", "Comparar ciudades": "Ñembojoja táva", "Comparar dos o tres ciudades": "Embojoja mokõi térã mbohapy táva",
    "Efectos del cielo": "Yvága efecto", "Filtrar por departamento": "Emoĩporã departamento rupi", "Hora del pronóstico en el mapa": "Aravo ára marandu rehegua mapa-pe",
    "Instalar Clima PY como app": "Emoĩ Clima PY app-ramo", "Ir a una sección": "Eho peteĩ pehẽme", "Mostrar u ocultar el radar de lluvia": "Ehechauka térã eñomi radar ama rehegua",
    "Ordenar ciudades": "Emohenda táva", "Paisaje del clima actual": "Ára ko'ág̃a ra'ãnga", "Pausar la animación del radar": "Emopyta radar animación",
    "Resumen nacional": "Tetã rehegua mbykymi", "Rutas principales (aproximadas)": "Tape guasu (jerére)", "Selecciona la ciudad más cercana a ti": "Eporavo pe táva ag̃uĩvéva ndéve",
    "Sonido ambiente según el clima": "Ára pu ára rehe oĩva", "Ver todo el país": "Ehecha tetã tuichakue", "Favorita": "Jeporavopyre",
    "Mapa de Paraguay por departamentos. Usa + y - para el zoom y las flechas para moverte.": "Paraguay mapa departamento rupi. Eipuru + ha - embotuicha térã emomichĩ hag̃ua, ha flecha eguata hag̃ua.",
    "Cambiar a modo claro": "Emoambue modo hesakãme", "Cambiar a modo oscuro": "Emoambue modo pytũme", "Temperatura de las próximas 24 horas": "Hakuha 24 aravo oúva",
    // --- capas, resumen y lista ---
    "Temperatura": "Hakuha", "Humedad": "Humedad", "Viento": "Yvytu", "Lluvia": "Ama",
    "Más calurosa": "Hakuvéva", "Más fría": "Ro'yvéva", "Más húmeda": "Humedad ijyvatevéva", "Más seca": "Ipiruvéva",
    "Más ventosa": "Yvytu hatãvéva", "Más calma": "Kirirĩvéva", "Más lluvia": "Ama hetavéva", 
    "Con lluvia ahora": "Oky ko'ág̃a", "Sin lluvia ahora": "Ndaipóri ama ko'ág̃a", "ciudades secas": "táva ndaipóri ama", "ninguna ciudad": "ni peteĩ táva",
    "Favoritas": "Jeporavopyre", "Todas": "Opavave", "Ciudades principales": "Táva tuichavéva", "Ver todas las ciudades": "Ehecha opaite táva", "No hay ciudades con ese filtro.": "Ndaipóri táva ko filtro ndive.", "Quitar filtros": "Emboguete filtro",
    "Sin datos": "Ndaipóri marandu", "sin datos": "ndaipóri marandu", "Sin datos por ahora": "Ndaipóri marandu ko'ág̃a", "Cargando…": "Eha'ãrõ…", "Buscando…": "Ojeheka…", "Reintentar": "Eha'ã jey",
    "Hoy": "Ko árape", "Mañana": "Ko'ẽrõ", "— ninguna —": "— mba'eve —",
    // --- momentos del día ---
       
    // --- ajustes de animación (lo demás del panel queda en español) ---
    "Día": "Ára", "Noche": "Pyhare", "Nubes": "Arai", "Estrellas y luna": "Mbyja ha jasy", "Lluvia y granizo": "Ama ha ama itá", "Aves y luciérnagas": "Guyra ha mua",
    // --- estado del cielo ---
    "Despejado": "Yvága hesakã", "Mayormente despejado": "Yvága hesakã heta", "Parcialmente nublado": "Arai sa'i", "Nublado": "Arai hetáva",
    "Niebla": "Arai yvýpe", "Niebla con escarcha": "Arai yvýpe ro'ysã reheve",
    "Llovizna leve": "Ama'i sa'i", "Llovizna": "Ama'i", "Llovizna fuerte": "Ama'i hatã", "Llovizna helada": "Ama'i ro'ysã", "Llovizna helada fuerte": "Ama'i ro'ysã hatã",
    "Lluvia leve": "Ama sa'i", "Lluvia fuerte": "Ama hatã", "Lluvia helada": "Ama ro'ysã", "Lluvia helada fuerte": "Ama ro'ysã hatã",
    "Nieve leve": "Ro'ysã ho'a sa'i", "Nieve": "Ro'ysã ho'a", "Nieve fuerte": "Ro'ysã ho'a hatã", "Granizo fino": "Ama itá sa'i",
    "Chubascos leves": "Ama pya'e sa'i", "Chubascos": "Ama pya'e", "Chubascos fuertes": "Ama pya'e hatã",
    "Chubascos de nieve": "Ro'ysã ho'a pya'e", "Chubascos de nieve fuertes": "Ro'ysã ho'a pya'e hatã",
    "Tormenta": "Aratiri", "Tormenta con granizo": "Aratiri ama itá reheve", "Tormenta fuerte con granizo": "Aratiri hatã ama itá reheve",
    // --- luna y aire ---
    "Luna nueva": "Jasy pyahu", "Creciente": "Okakuaáva", "Cuarto creciente": "Cuarto okakuaáva", "Gibosa creciente": "Gibosa okakuaáva", "Luna llena": "Jasy henyhẽ",
    "Gibosa menguante": "Gibosa okañýva", "Cuarto menguante": "Cuarto okañýva", "Menguante": "Okañýva",
    "Buena": "Iporã", "Moderada": "Mbytépe", "Dañina para sensibles": "Ivaíva umi imbarete'ỹvape", "Dañina": "Ivaíva", "Muy dañina": "Ivaiterei", "Peligrosa": "Peligro",
    // --- detalle de la ciudad ---
    "Índice tereré": "Tereré ra'ãha", "Día ideal para un tereré": "Ára iporãitéva tereré haguã", "Buen día para un tereré": "Ára porã tereré haguã",
    "Tereré o mate, como prefieras": "Tereré térã kay'u, eipotaháicha", "Más para un mate": "Kay'u haguãve", "Día de mate caliente (y sopa paraguaya)": "Kay'u aku ára (ha sopa paraguaya)",
    "Capital del país": "Tetã táva guasu", "Asunción (capital)": "Asunción (táva guasu)", "Sensación térmica": "Ñandu hakuha", "Lluvia ahora": "Ama ko'ág̃a", "Índice UV (máx. hoy)": "Índice UV (ko árape ijyvatevéva)",
    "Amanecer": "Ko'ẽmbota", "Atardecer": "Ka'aru", "Luna": "Jasy", "Calidad del aire": "Aire reko", "Presión": "Presión",
    "Próximas horas": "Aravo oúva", "Gráfico 24 h": "Ra'ãnga 24 aravo", "Próximos días": "Ára oúva",
    "Sensación": "Ñandu", "Máx. / mín. hoy": "Ijyvatevéva / iguyvevéva ko árape", "Prob. de lluvia hoy": "Ama ikatuha ko árape",
    "Barras azules: probabilidad de lluvia": "Barra hovy: ama ikatuha", "No hay datos suficientes para el gráfico.": "Ndaipóri marandu heta ra'ãnga g̃uarã.",
    "(muy segura)": "(katuete)", "Rango del 10 % al 90 % de las simulaciones de 4 modelos": "Ñembojoja 10 % guive 90 % peve simulación 4 modelo-gua",
    "Dato medido": "Ojemedíva", "Referencia real:": "Techaukaha añete:",
    "Probabilidad básica de Open-Meteo (no se pudo consultar el ensamble de modelos).": "Ama ikatuha Open-Meteo-gua (ndaikatúi ojehecha modelo ensamble).",
    // --- avisos del clima ---
    "Sensación térmica muy alta: hidrátate y evita el sol del mediodía": "Ñandu hakuha ijyvate: eñemboy ha ekañy kuarahy mbytépe guive",
    "Calor extremo: hidrátate y evita el sol en las horas centrales del día": "Hakuha tuichaiterei: eñemboy ha ekañy kuarahy mbytépe guive",
    "Frío intenso: abrígate bien": "Ro'y hatã: eñemoĩ porã ao",
    "Compartir": "Compartir", "Compartir el clima de esta ciudad": "Compartir el clima de esta ciudad", "WhatsApp": "WhatsApp", "Enviar el clima por WhatsApp": "Enviar el clima por WhatsApp",
    "Enlace copiado": "Enlace copiado", "No se pudo copiar el enlace": "No se pudo copiar el enlace",
    "Sensación de frío intenso: abrígate bien": "Ñandu ro'y hatã: eñemoĩ porã ao", "Viento fuerte": "Yvytu hatã",
    "Alta probabilidad de lluvia en las próximas horas": "Ikatupyry ama aravo oúvape", "Tormenta eléctrica en la zona ahora": "Aratiri oĩ ko'ág̃a ko henda",
    // --- sonido ---
    "Tormenta: lluvia fuerte, viento y truenos": "Aratiri: ama hatã, yvytu ha aratiri pu", "Lluvia: gotas sobre las hojas y aves lejanas": "Ama: ama ho'a ogue ári ha guyra mombyry",
    "Noche de lluvia: gotas y ranas": "Pyhare ama: ama ho'a ha ju'i", "Niebla: sonido amortiguado y brisa suave": "Arai yvýpe: pu mbegue ha yvytu mbegue",
    "Noche tranquila: grillos y ranas": "Pyhare kirirĩ: grillo ha ju'i", "Hora dorada: coro de aves y brisa suave": "Hora dorada: guyra purahéi ha yvytu mbegue",
    "Cielo nublado: brisa suave y aves lejanas": "Yvága arai: yvytu mbegue ha guyra mombyry", "Día soleado: aves, brisa y cigarras": "Ára kuarahy: guyra, yvytu ha cigarra",
    "Día tranquilo: aves y brisa suave": "Ára kirirĩ: guyra ha yvytu mbegue", "Tu navegador no permite reproducir sonido.": "Nde navegador ndohejái ojepu.",
    // --- mensajes ---
    "Escribe al menos 3 letras del lugar.": "Ehai 3 letra michĩvévape tenda réra.", "No encontré ese lugar en Paraguay.": "Ndajuhúi pe tenda Paraguáipe.",
    "No se pudo buscar. Revisa tu conexión.": "Ndaikatúi ojeheka. Ehecha nde internet.", "No se pudo cargar el pronóstico por horas.": "Ndaikatúi oñembyaty ára marandu aravo rupi.",
    "No se pudo cargar alguna ciudad. Prueba de nuevo en un momento.": "Ndaikatúi oñembyaty peteĩ táva. Eha'ã jey sapy'ami.",
    "No se pudo cargar el radar. Comprueba la conexión e inténtalo otra vez.": "Ndaikatúi oñembyaty radar. Ehecha internet ha eha'ã jey.", "No se pudo cargar el radar.": "Ndaikatúi oñembyaty radar.",
    "Tu navegador no permite usar la ubicación.": "Nde navegador ndohejái eipuru ubicación.", "No pude obtener tu ubicación (revisa el permiso del navegador).": "Ndaikatúi ajuhu nde ubicación (ehecha navegador permiso).",
    "Ya se actualizó hace unos segundos.": "Oñemopyahúma sapy'ami ohasa.", "Algunas ciudades no se pudieron actualizar.": "Ndaikatúi oñemopyahu algunos táva.",
    "Open-Meteo recibió demasiadas consultas. Espera un minuto e inténtalo de nuevo.": "Open-Meteo ohupyty heta ñemoñe'ẽ. Eha'ãrõ peteĩ minuto ha eha'ã jey.",
    "Open-Meteo recibió demasiadas consultas. Espera un minuto.": "Open-Meteo ohupyty heta ñemoñe'ẽ. Eha'ãrõ peteĩ minuto.",
    "No se pudo actualizar el clima. Revisa tu conexión.": "Ndaikatúi oñemopyahu ára. Ehecha nde internet.", "Este navegador no permite notificaciones.": "Ko navegador ndohejái notificación.",
    "Avisos de tormenta desactivados.": "Ñemomarandu aratiri rehegua oñemboyke.", "Los avisos están bloqueados: actívalos en los permisos del navegador.": "Umi ñemomarandu oñemboyke: emoñepyrũ jey navegador permiso-pe.",
    "Te avisaré si hay tormenta en tus favoritas mientras la app esté abierta.": "Chemomarandu aratiri oĩ vove nde táva jeporavopyre-pe app ojeipe'a aja.",
    
    "Sin conexión a internet. Se conservarán los últimos datos guardados.": "Ndaipóri internet. Oñeñongatu hína umi marandu ipahaitéva.",
    "Conexión recuperada. Actualizando el clima…": "Internet ou jey. Oñemopyahu ára…", "Clima": "Ára", "Idioma": "Ñe'ẽ", "y": "ha", "Cerrar": "Emboty", "Buscar": "Eheka", "Ciudad": "Táva", "Departamento": "Departamento",
    "Mapa de calor": "Mapa hakuha", "Capas": "Capa", "Promedio": "Promedio", "Humedad relativa": "Humedad", "Radar": "Radar",
    "Idioma: Español": "Ñe'ẽ: Español", "Idioma: Avañe'ẽ (guaraní)": "Ñe'ẽ: Avañe'ẽ (guaraní)",
    "Menú": "Menu", "Menú: idioma, tema, sonido y más": "Menu: ñe'ẽ, sa'y, ryapu ha hetave", "Pronóstico": "Ára oúva",
    "Visibilidad": "Hecha", "Salida del sol": "Kuarahy osẽ", "Puesta del sol": "Kuarahy oike",
    "Creado por": "Ojapo", "Para el campo": "Kokuépe guarã", "Lunes": "Arateĩ", "Martes": "Arakõi", "Miércoles": "Araapy", "Jueves": "Ararundy", "Viernes": "Arapo", "Sábado": "Arapokõi", "Domingo": "Arapokõindy"
  };
  const DIAS_GN = { dom: "Arapokõindy", lun: "Arateĩ", mar: "Arakõi", mié: "Araapy", jue: "Ararundy", vie: "Arapo", sáb: "Arapokõi" };
  const diaGN = x => DIAS_GN[x.toLowerCase().replace('.', '')] || x;
  const NIVEL_UV_GN = { "extremo": "hatãeterei", "muy alto": "ijyvateterei", "alto": "ijyvate", "moderado": "mbytépe" };
  const CAPA_GN = { "temperatura": "hakuha", "humedad": "humedad", "viento": "yvytu", "lluvia": "ama" };
  const SUB = x => traducir(x);
  // Frases completas con datos variables (se aplican al texto entero)
  const UV_CORTO_GN = { "Bajo": "michĩ", "Moderado": "mbytépe", "Alto": "ijyvate", "Muy alto": "ijyvateterei", "Extremo": "hatãeterei" };
  const GN_PATRONES = [
    [/^Próximos (\d+) días$/, m => `Ára oúva (${m[1]})`],
    [/^Sensación (.+)$/, m => `Ñandu ${m[1]}`],
    [/^(\d+) · (Bajo|Moderado|Alto|Muy alto|Extremo)$/, m => `${m[1]} · ${UV_CORTO_GN[m[2]]}`],
    [/^En vivo · datos de las (.+)$/, m => `Ko'ág̃agua · ojemopyahu ${m[1]}`],
    [/^Datos de hace (\d+) min$/, m => `Marandu ${m[1]} min ohasámava`],
    [/^Datos de hace (\d+) h$/, m => `Marandu ${m[1]} aravo ohasámava`],
    [/^Sin conexión · datos de las (.+)$/, m => `Ndaipóri internet · marandu ${m[1]}-gua`],
    [/^Todo el país \((\d+)\)$/, m => `Tetã tuichakue (${m[1]})`],
    [/^(\d+) ciudades · (\d+) departamentos$/, m => `${m[1]} táva · ${m[2]} departamento`],
    [/^Promedio · (.+)$/, m => `Promedio · ${CAPA_GN[m[1]] || m[1]}`],
    [/^(\d+) ciudades$/, m => `${m[1]} táva`],
    [/^ej\.: (.+)$/, m => `techapyrã: ${m[1]}`],
    [/^Máx\. probable (.+?)( \(muy segura\))?$/, m => `Ijyvatevéva ikatúva ${m[1]}${m[2] ? ' (katuete)' : ''}`],
    [/^Máxima probable (.+?) a (.+?) · mínima probable (.+?) a (.+)$/, m => `Ijyvatevéva ikatúva ${m[1]} guive ${m[2]} peve · iguyvevéva ikatúva ${m[3]} guive ${m[4]} peve`],
    [/^UV (extremo|muy alto|alto|moderado) hoy \((\d+)\): usa protector solar(?: entre las (\d+):00 y las (\d+):00)?(, gorra y busca sombra)?$/,
      m => `UV ${NIVEL_UV_GN[m[1]]} ko árape (${m[2]}): eipuru protector solar${m[3] ? ` ${m[3]}:00 guive ${m[4]}:00 peve` : ''}${m[5] ? ', gorra ha eheka sombra' : ''}`],
    [/^Está lloviendo ahora \(unos (.+?) mm en la próxima hora\)$/, m => `Oky ko'ág̃a (${m[1]} mm jerére peteĩ aravo oúvape)`],
    [/^Lluvia en unos (\d+) min \(unos (.+?) mm en la próxima hora\)$/, m => `Ama oúta ${m[1]} min jerére (${m[2]} mm jerére peteĩ aravo oúvape)`],
    [/^Viento fuerte: (\d+) km\/h$/, m => `Yvytu hatã: ${m[1]} km/h`],
    [/^Tormenta en (.+)$/, m => `Aratiri ${m[1]}-pe`],
    [/^Radar observado · (.*?) · fotograma (\d+)\/(\d+)$/, m => `Radar ojehecháva · ${SUB(m[1])} · ra'ãnga ${m[2]}/${m[3]}`],
    [/^La ciudad más cercana es (.+), a (\d+) km\.$/, m => `Pe táva ag̃uĩvéva ha'e ${m[1]}, ${m[2]} km-pe.`],
    [/^Ciudad más cercana: (.+) \(a (\d+) km\)$/, m => `Táva ag̃uĩvéva: ${m[1]} (${m[2]} km-pe)`],
    [/^No se pudo cargar el pronóstico de (.+)\. Revisa tu conexión\.$/, m => `Ndaikatúi oñembyaty ára marandu ${m[1]} rehegua. Ehecha nde internet.`],
    [/^No se pudo actualizar el pronóstico de (.+)\. Se muestran los últimos datos\.$/, m => `Ndaikatúi oñemopyahu ára marandu ${m[1]} rehegua. Ojehechauka umi marandu ipahaitéva.`],
    [/^(Dom|Lun|Mar|Mié|Jue|Vie|Sáb)( \d+)?$/, m => `${diaGN(m[1])}${m[2] || ''}`],
    [/^(dom|lun|mar|mié|jue|vie|sáb)\.? (\d\d:\d\d) · en (\d+) h$/, m => `${diaGN(m[1])} ${m[2]} · ${m[3]} aravo rire`],
    [/^Quitar (.+) de favoritas$/, m => `Emboguete ${m[1]} jeporavopyre-gui`],
    [/^Marcar (.+) como favorita$/, m => `Emarka ${m[1]} jeporavopyre-ramo`],
    [/^Ciudad (\d)$/, m => `Táva ${m[1]}`],
    [/^(.+) · (\d+) ciudad(?:es)?$/, m => `${SUB(m[1])} · ${m[2]} táva`],
    [/^(.+) · (temperatura|humedad|viento|lluvia) (.+)$/, m => `${SUB(m[1])} · ${CAPA_GN[m[2]]} ${m[3]}`],
    [/^(.+): sin datos$/, m => `${m[1]}: ndaipóri marandu`],
    [/^(.+): (-?\d+) grados, (.+)$/, m => `${m[1]}: ${m[2]} gráu, ${SUB(m[3])}`],
    [/^(\d+) · (.+)$/, m => `${m[1]} · ${SUB(m[2])}`],
    [/^(.+) · (\d+)%$/, m => `${SUB(m[1])} · ${m[2]}%`],
    [/^(.+): (-?\d+°[CF]?), ([^,]+)$/, m => `${m[1]}: ${m[2]}, ${SUB(m[3])}`]
  ];
  // Fragmentos dentro de textos más largos
  const GN_REEMPL = [
    [/\(temperatura, humedad, viento y presión\) en el aeropuerto de (.+?), a (\d+) km, hace (.+?): /g, (m, a, b, c) => `(hakuha, humedad, yvytu ha presión) aeropuerto ${a}-pe, ${b} km-pe, ${c} ohasámava: `],
    [/el aeropuerto de (.+?), a (\d+) km, midió (.+?) hace (.+?)\./g, (m, a, b, c, d) => `aeropuerto ${a}, ${b} km-pe, omedi ${c} ${d} ohasámava.`],
    [/En ese punto el modelo calculaba/g, () => "Upe tendápe modelo oikuaa"], [/El modelo calculaba/g, () => "Modelo oikuaa"],
    [/Hoy, en (\d+) aeropuertos del país, el modelo se desvía en promedio (.+?) \(sesgo (.+?)\)\./g, (m, a, b, c) => `Ko árape, ${a} aeropuerto tetãme, modelo oñemomombyry promedio ${b} (sesgo ${c}).`],
    [/hace menos de 2 min/g, () => "2 min-gui michĩve ohasa"], [/hace (\d+) (min|h)\b/g, (m, a, b) => `${a} ${b === 'h' ? 'aravo' : 'min'} ohasámava`],
    [/Probabilidad de lluvia calculada con ensambles de 4 modelos \(ECMWF, GFS, ICON y GEM\): porcentaje de simulaciones con lluvia \(≥ 0,1 mm por hora; ≥ 1 mm en el día\)\./g,
      () => "Ama ikatuha: ojekuaa 4 modelo ensamble ndive (ECMWF, GFS, ICON ha GEM): porcentaje simulación oikývape ama (≥ 0,1 mm aravo peteĩ; ≥ 1 mm ára pukukue)."],
    [/La franja clara detrás de cada barra de temperatura es el rango probable \(del 10 % al 90 % de las simulaciones\); cuanto más ancha, menos seguros están los modelos\./g,
      () => "Pe franja hesakã barra hakuha ykére ha'e pe rango ikatúva (10 % guive 90 % peve simulación); ipukuvévo, ndojeroviapyvéi umi modelo."],
    [/ Se muestran los últimos datos\./g, () => " Ojehechauka umi marandu ipahaitéva."]
  ];
  const cacheTr = new Map();
  function traducir(s) {
    if (!s) return s;
    const t = s.trim();
    if (t.length < 1 || !/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(t)) return s;
    let r = cacheTr.get(t);
    if (r === undefined) {
      r = traducirNucleo(t);
      if (r === t) {   // sin coincidencia: separo un prefijo de emojis/símbolos ("⚠️ ", "● ", "· ") y traduzco el resto
        const m = /^([^A-Za-zÁÉÍÓÚáéíóúñÑ¿¡]*)([\s\S]*)$/.exec(t);
        if (m && m[1] && m[2]) { const r2 = traducirNucleo(m[2]); if (r2 !== m[2]) r = m[1] + r2; }
      }
      if (cacheTr.size > 4000) cacheTr.clear();
      cacheTr.set(t, r);
    }
    if (r === t) return s;
    const i = s.indexOf(t);
    return s.slice(0, i) + r + s.slice(i + t.length);
  }
  function traducirNucleo(t) {
    if (Object.prototype.hasOwnProperty.call(GN, t)) return GN[t];
    for (const [re, f] of GN_PATRONES) { const m = re.exec(t); if (m) return f(m); }
    let r = t; for (const [re, f] of GN_REEMPL) r = r.replace(re, f);
    return r;
  }
  const tr = s => idioma === 'gn' ? traducir(s) : s;

  // --- aplicar la traducción a la página (y a todo lo que la app dibuje después) ---
  const memoTxt = new WeakMap(), memoAttr = new WeakMap(), ATRS_TR = ['title', 'aria-label', 'placeholder'];
  const enMapa = el => !!el && el.id !== 'mapa' && !!el.closest('#mapa');           // el dibujo del mapa solo tiene nombres y cifras: se salta
  function traducirTexto(n) {
    const v = n.nodeValue, m = memoTxt.get(n);
    if (m && v === m.gn) return;
    const g = traducir(v);
    if (g !== v && !enMapa(n.parentElement)) { memoTxt.set(n, { es: v, gn: g }); n.nodeValue = g; } else if (m) memoTxt.delete(n);
  }
  function traducirAttr(el, a) {
    const v = el.getAttribute(a);
    if (v == null) return;
    let mm = memoAttr.get(el); const m = mm && mm.get(a);
    if (m && v === m.gn) return;
    const g = traducir(v);
    if (g !== v && !enMapa(el)) { if (!mm) { mm = new Map(); memoAttr.set(el, mm); } mm.set(a, { es: v, gn: g }); el.setAttribute(a, g); } else if (m) mm.delete(a);
  }
  function traducirArbol(raiz) {
    if (!raiz) return;
    if (raiz.nodeType === 3) { traducirTexto(raiz); return; }
    if (raiz.nodeType !== 1 || enMapa(raiz)) return;
    const filtro = { acceptNode: x => {
      if (x.nodeType !== 1) return NodeFilter.FILTER_ACCEPT;
      if (x.id === 'mapa') { ATRS_TR.forEach(a => { if (x.hasAttribute(a)) traducirAttr(x, a); }); return NodeFilter.FILTER_REJECT; }   // el mapa: solo su descripción, no su dibujo
      return x.tagName === 'SCRIPT' || x.tagName === 'STYLE' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    } };
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, filtro);
    const revisar = x => { if (x.nodeType === 3) traducirTexto(x); else ATRS_TR.forEach(a => { if (x.hasAttribute(a)) traducirAttr(x, a); }); };
    revisar(raiz);
    let n; while ((n = w.nextNode())) revisar(n);
  }
  function restaurarEspanol() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { const m = memoTxt.get(n); if (m && n.nodeValue === m.gn) n.nodeValue = m.es; memoTxt.delete(n); }
    document.querySelectorAll('[title],[aria-label],[placeholder]').forEach(el => {
      const mm = memoAttr.get(el); if (!mm) return;
      mm.forEach((m, a) => { if (el.getAttribute(a) === m.gn) el.setAttribute(a, m.es); });
      memoAttr.delete(el);
    });
  }
  let observadorIdioma = null;
  function vigilarIdioma() {
    if (observadorIdioma) return;
    observadorIdioma = new MutationObserver(ms => {
      if (idioma !== 'gn') return;
      for (const m of ms) {
        if (m.target && (m.target.id === 'mapa' || enMapa(m.target.nodeType === 1 ? m.target : m.target.parentElement))) continue;
        if (m.type === 'childList') m.addedNodes.forEach(traducirArbol);
        else if (m.type === 'characterData') traducirTexto(m.target);
        else if (m.type === 'attributes') traducirAttr(m.target, m.attributeName);
      }
    });
    observadorIdioma.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRS_TR });
  }
  const TITULO_ES = document.title, DESC_META = document.querySelector('meta[name=description]'), DESC_ES = DESC_META ? DESC_META.content : '';
  function aplicarIdioma() {
    document.documentElement.lang = idioma === 'gn' ? 'gn' : 'es';
    $('btnIdioma').innerHTML = icono('idioma') + `<span>${idioma === 'gn' ? 'GN' : 'ES'}</span>`;
    if (idioma === 'gn') {
      traducirArbol(document.body); vigilarIdioma();
      document.title = 'Clima PY: ára marandu ha mapa Paraguái táva-gua';
      if (DESC_META) DESC_META.content = 'Clima PY: ára marandu ha mapa Paraguái táva-gua rehegua';
    } else {
      if (observadorIdioma) { observadorIdioma.disconnect(); observadorIdioma = null; }
      restaurarEspanol();
      document.title = TITULO_ES; if (DESC_META) DESC_META.content = DESC_ES;
    }
  }
  $('btnIdioma').addEventListener('click', () => {
    idioma = idioma === 'gn' ? 'es' : 'gn';
    guardar('clima-py-idioma', idioma);
    aplicarIdioma();
    aviso(idioma === 'gn' ? "Idioma: Avañe'ẽ (guaraní)" : 'Idioma: Español');
  });
  aplicarIdioma();
