# Dashboard administrativo y financiero · NayarSound

Consulta y análisis del negocio con **Google Sheets como única fuente**. El
dashboard solo **lee** la hoja «🐯NAYARSOUND - PERSONAL»: no duplica la
captura, no escribe y no cambia fórmulas.

Es una **aplicación web privada de Google Apps Script**, vinculada a esa hoja.
Google pide iniciar sesión y solo responde a la cuenta propietaria. El mapa
sigue siendo público en GitHub Pages; el dashboard no usa sus endpoints.

```
dashboard/
├── apps-script/        ← lo que se copia al proyecto de Apps Script
│   ├── appsscript.json   manifiesto (zona horaria, acceso «Solo yo»)
│   ├── Code.gs           servidor: lee la hoja y detecta columnas por encabezado
│   ├── Core.html         reglas e indicadores (las mismas fórmulas del archivo)
│   ├── Charts.html       gráficas SVG sin librerías externas
│   ├── App.html          interfaz: filtros, pestañas, tablas y desgloses
│   ├── Styles.html       estilos (mismo lenguaje visual que el mapa)
│   └── Index.html        página
├── test/               pruebas con datos sintéticos (nunca datos reales)
└── tools/              vista previa local y verificación contra una copia de la hoja
```

---

## 1. Privacidad: revisa esto antes de usarlo

Lo que encontré al revisar el proyecto (28 oct 2026):

| Hallazgo | Riesgo |
|---|---|
| El repositorio es **público** y GitHub Pages publica todo su contenido. | Cualquier archivo con datos en el repo quedaría público. |
| «AMAL AGENDA» (fuente del mapa) está compartida como **«Cualquier persona con el enlace»** y su ID está en `index.html`. | Con ese ID cualquiera puede leer **todas** sus hojas por la URL `gviz`, no solo las coordenadas: clientes, teléfonos (algunos aparecen en CLIENTE), domicilios, totales y anticipos. |
| «🐯NAYARSOUND - PERSONAL» (fuente financiera) también está compartida como **«Cualquier persona con el enlace»**. Su ID **no** está en el repo. | Quien tenga el enlace ve todas las finanzas y las CLABE y la tarjeta escritas en la fórmula de `AGENDA Y VENTAS!K3`. |

**El dashboard no necesita que ninguna hoja sea pública.** Apps Script la lee
con tu cuenta. No cambié permisos de tus archivos; te recomiendo, en este orden:

1. **Hoja financiera:** en «🐯NAYARSOUND - PERSONAL» → Compartir → Acceso
   general → **Restringido**. El dashboard y los `IMPORTRANGE` siguen
   funcionando porque los autorizó tu cuenta.
2. **Mapa:** crea una hoja nueva solo para el mapa, por ejemplo «NAYARSOUND
   MAPA PÚBLICO». Que tenga únicamente ciudad, fecha y coordenadas, en las mismas
   columnas que lee el mapa (C = ciudad, E = fecha, Q = coordenadas, desde la
   fila 13), con `IMPORTRANGE` desde «AMAL AGENDA». Compártela con el enlace,
   cambia `SHEET_ID` en `index.html` por el de la hoja nueva y comprueba que el
   mapa carga.
3. Después, deja «AMAL AGENDA» **restringida** (quienes ya la editan conservan su acceso).

## 2. Cómo está protegido el dashboard

- **Implementación:** «Ejecutar como: Yo» y «Quién tiene acceso: **Solo yo**».
  Google exige iniciar sesión con tu cuenta. Un enlace oculto o una contraseña
  en JavaScript no protegerían nada; esto sí.
- **Doble control:** el código vuelve a comprobar que quien abre la página es la
  cuenta propietaria. Si alguien cambia el acceso por error, sigue cerrado.
- **Sin endpoint público:** los datos viajan por `google.script.run` dentro de la
  sesión autenticada, no por una URL que se pueda consultar sin iniciar sesión.
- **Permiso mínimo:** `@OnlyCurrentDoc` limita el script a la hoja donde está instalado.
- **El repositorio solo tiene código:** no contiene datos, IDs de hojas,
  contraseñas ni claves. Las pruebas usan datos inventados.

## 3. Instalación (unos 10 minutos)

1. Abre la hoja «🐯NAYARSOUND - PERSONAL» → **Extensiones → Apps Script**.
2. En **Configuración del proyecto** (engrane), marca «Mostrar el archivo de
   manifiesto "appsscript.json" en el editor».
3. En el **Editor**, crea los archivos con estos nombres exactos y pega el
   contenido de `dashboard/apps-script/`:
   - `Code.gs` (reemplaza el `Código.gs` inicial)
   - Archivos HTML (botón **+ → HTML**, sin escribir «.html»): `Index`, `Styles`, `Core`, `Charts`, `App`
   - `appsscript.json` (reemplaza su contenido)
4. Guarda. Elige la función `getDashboardData` y pulsa **Ejecutar** una vez para
   autorizar el acceso de solo esa hoja.
5. **Implementar → Nueva implementación → Tipo: Aplicación web.**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Solo yo**
6. Copia la URL que termina en `/exec` y ábrela: es tu dashboard.
7. Para que el botón «DASHBOARD» del mapa lleve ahí, pega esa URL en
   `DASHBOARD_URL` dentro de `index.html`. La URL no da acceso por sí sola:
   Google pide iniciar sesión con tu cuenta.

**Actualizar después de un cambio de código:** Implementar → Gestionar
implementaciones → editar (lápiz) → Versión: **Nueva versión**. Así la URL no cambia.

Opcional: la propiedad de script `MAP_URL` (Configuración del proyecto →
Propiedades del script) cambia el enlace de la pestaña «Mapa». Por defecto
apunta a `https://osvaldoh096-a11y.github.io/nayarsound---mapa-/`.

## 4. Qué muestra

- **Filtros globales** (afectan tarjetas, gráficas, tablas y desgloses):
  ciudad (detectada de los datos) y periodo. Las opciones de periodo son mes
  actual, año actual, histórico y rango personalizado. «Hoy» se calcula en
  hora de Ciudad de México.
- **Resumen:** 6 tarjetas del periodo (ingresos, ganancia personal, saldo por
  cobrar, eventos realizados, eventos próximos y publicidad), una franja aparte
  con los **resultados históricos** y 4 gráficas:
  - evolución de ingresos y ganancia personal
  - ganancia por ciudad
  - eventos por mes y ciudad
  - publicidad y rendimiento
- **Análisis:** estado de resultados por ciudad; rendimiento de la publicidad;
  pendientes y saldo por cobrar por mes; inversión en equipo; y detalle por mes.
- **Operación:** recordatorios con las condiciones del archivo, próximos eventos
  y cobros a clientes, entregas pendientes de DJs y pagos operativos pendientes.
- **Fuentes y verificación:** comparación en vivo contra la hoja ANALISIS,
  gastos que el archivo no suma, posibles duplicados, problemas de lectura y de
  qué columna sale cada indicador.
- **Desglose:** cada tarjeta, barra, columna o fila abre un panel con los
  eventos y gastos que explican el número.
- **Actualizar:** el botón vuelve a leer la hoja y muestra la hora de la última
  lectura exitosa.
  - Si falla la carga inicial, no se muestra ningún número.
  - Si falla una actualización, aparece un aviso de que los datos no son actuales.
- **Formato:** pesos mexicanos y fechas en español. Funciona en computadora y
  celular, con tema oscuro (como el mapa) y claro.

## 5. De dónde sale cada indicador

Columnas detectadas por **encabezado** (si mueves columnas, el dashboard las sigue encontrando).

| Indicador | Cálculo (igual al del archivo) | Origen | Fecha |
|---|---|---|---|
| Ingresos generados | TOTAL EVENTO de eventos con REALIZADO = SI. En Guadalajara, desde feb 2026, + GAS A COBRAR | AGENDA Y VENTAS: TOTAL EVENTO, GAS A COBRAR, REALIZADO = `ANALISIS!E`, `DASHBOARD!C10` | Evento |
| Pago a DJs | Columna «DJ» de pago (la segunda «DJ»), eventos realizados | AGENDA Y VENTAS = `ANALISIS!F` | Evento |
| Publicidad / Operación / Atención al cliente | TOTAL con categoría PUBLICIDAD, OPERACION o AT. CLIENTE, solo en ciudades y meses con agenda | STOCK OPERACION = `ANALISIS!G:I` | Compra |
| Ganancia operativa | Ingresos − DJs − publicidad − operación − atención al cliente | `ANALISIS!J`, `DASHBOARD!C18` | Ambas |
| Ganancia personal | Guadalajara: 50% antes de nov 2025 y 100% después. Tepic: 100% antes de nov 2025; después 50% + ½ de GANANCIA 2 de eventos con sonido de Osvaldo. Otras ciudades: 100% | `ANALISIS!M`, `DASHBOARD!C19` | Ambas |
| Eventos realizados / próximos | REALIZADO = SI / NO | AGENDA Y VENTAS (importado de AMAL AGENDA) | Evento |
| Saldo por cobrar | TOTAL EVENTO − ANTICIPO + GAS A COBRAR de eventos con REALIZADO = NO | fórmula de `AGENDA Y VENTAS!I2` | Evento |
| Por entregar de DJs | ENTREGAR A OSVALDO de eventos realizados con PAGADO = DEUDOR y pago al DJ registrado | `AGENDA Y VENTAS!I2`, `S` | Evento |
| Ventas por cada $1 en publicidad | Ingresos generados ÷ publicidad | `DATA!AT` «$1 EN ADS, VENDE» | Ambas |
| Ganancia operativa por cada $1 en publicidad | Ganancia operativa ÷ publicidad (ya descuenta la publicidad) | `DATA!AU` «$1 EN ADS NETO» | Ambas |
| Inversión en equipo | TOTAL con categoría STOCK. Inversión de Osvaldo = propia − ventas + 50% de socios | `STOCK OPERACION!V6` | Compra |
| Dinero cobrado por fecha de cobro | **No disponible:** el archivo no registra cuándo se cobra cada pago | — | — |

Si la publicidad es 0, los indicadores «por cada $1» muestran **«No disponible»**, no un número.

## 6. Verificación realizada

Se verificó contra una copia de la hoja (descargada el 28 oct 2026 y guardada
fuera del repositorio). Este documento es público, así que **no incluye cifras
del negocio**; el resultado se puede repetir con `tools/verificar-snapshot.js`
y se ve en vivo en la pestaña «Fuentes y verificación».

- **Celda por celda contra ANALISIS:** todas las combinaciones ciudad/mes × 8
  indicadores (eventos realizados, ingresos, DJs, publicidad, operación,
  atención al cliente, ganancia operativa y ganancia personal): **0 diferencias**.
- **Global histórico:** coincide con DASHBOARD (selector GLOBAL/GLOBAL), con el
  conteo de eventos realizados y con `DATA!AP9:AU9`, incluidos los dos indicadores «por cada $1».
- **Por ciudad:** coincide con `DATA!AP5:AU8` en las cuatro ciudades.
- **Pruebas automáticas:**
  - 26 pruebas de reglas y lectura (`npm test`).
  - 46 comprobaciones de la interfaz en Chromium (`node test/ui.check.js`): filtros coherentes, errores de conexión, estados sin datos y celular sin desplazamiento horizontal.
- **Mapa:** mismo conteo, filtros y cuadrantes antes y después de agregar la
  navegación, sin errores, en escritorio y celular.

## 7. Hallazgos en los datos (el dashboard los muestra, no los corrige)

Los montos y filas exactos aparecen en «Fuentes y verificación», dentro del
dashboard privado.

1. **Publicidad con espacio extra:** hay registros con categoría `"PUBLICIDAD "`
   (espacio al final). Las fórmulas del archivo (SUMIFS) no los suman, así que
   la ganancia de esa ciudad y mes aparece más alta.
2. **Publicidad de meses sin agenda:** ANALISIS solo suma gastos de ciudades y
   meses con eventos. La publicidad pagada antes de abrir una ciudad queda fuera.
3. **«POR CADA $1 MXN INVERTIDO EN ADS»** en `DASHBOARD!B24:C24` siempre muestra
   `$0.00x`: divide entre `C14`, que es texto. Los valores correctos están en `DATA!AT:AU`.
4. **Dos reglas distintas para la gasolina.**
   - `ANALISIS!E` (lo que muestra DASHBOARD) solo la suma en Guadalajara desde
     feb 2026.
   - `AGENDA Y VENTAS!M` (GANANCIA) la suma en cualquier evento con sonido de
     Osvaldo desde esa fecha. Esa fórmula también alimenta GANANCIA 2 y ENTREGAR
     A OSVALDO.
   - Hay gasolina de otras ciudades que ANALISIS no cuenta como ingreso.
5. **Fórmulas con rangos que se desplazan** en ANALISIS: algunas gráficas de la
   hoja pueden omitir filas. Son «EVENTOS POR CIUDAD», «GANANCIA OPERATIVA POR
   CIUDAD» y la columna Monterrey de «POR COBRAR PROPIO», que cuenta eventos en
   vez de sumar dinero. El dashboard no las usa: calcula desde las filas.
6. **Posibles duplicados** (misma fecha, ciudad, DJ, sonido, cliente, total y
   anticipo): se listan y **no se eliminan**, porque pueden ser eventos distintos.

## 8. Pendiente de confirmar

- **Gasolina:** ¿cuál regla es la correcta, la de ANALISIS (solo Guadalajara) o
  la de AGENDA Y VENTAS (sonido de Osvaldo en cualquier ciudad)? Hoy uso la de ANALISIS.
- **Cancelaciones:** el archivo no tiene un estado de cancelación. ¿Un evento
  cancelado se borra de la agenda? ¿El anticipo se conserva como ingreso?
- **«POR COBRAR PROPIO»:** no está incluido porque resta un costo de DJ fijo por
  ciudad, escrito en la fórmula. ¿Lo quieres con esos supuestos?
- **Flujo de caja por fecha de cobro:** requiere registrar la fecha de cada
  anticipo y saldo. Hoy no existe en el archivo.
- **Pagos operativos pendientes:** STOCK OPERACION no tiene columna de estado de
  pago, así que solo se muestran los eventos realizados sin pago al DJ registrado.

## 9. Desarrollo local

```bash
cd dashboard
npm test                                   # reglas y lectura (Node 18+, sin dependencias)
node test/ui.check.js                      # interfaz en Chromium (requiere Playwright)
node tools/preview.js --salida /tmp/dashboard.html   # vista previa con datos sintéticos
```

Para verificar contra una copia real de la hoja (guárdala **fuera** del repositorio):

```bash
node tools/verificar-snapshot.js /ruta/fuera-del-repo/snapshot.json
```

El snapshot es la respuesta de `spreadsheets.get` con `includeGridData` para las
hojas AGENDA Y VENTAS, STOCK OPERACION, ANALISIS, DATA y DASHBOARD.
