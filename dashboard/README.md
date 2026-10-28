# Dashboard administrativo y financiero · NayarSound

Consulta y análisis del negocio con **Google Sheets como única fuente**, publicado
en GitHub Pages junto al mapa:

- Mapa: `https://osvaldoh096-a11y.github.io/nayarsound---mapa-/`
- Dashboard: `https://osvaldoh096-a11y.github.io/nayarsound---mapa-/dashboard/`

El dashboard solo **lee** la hoja «🐯NAYARSOUND - PERSONAL»: no duplica la
captura, no escribe y no cambia fórmulas. Se actualiza desde la hoja cada vez que
se abre o se pulsa «Actualizar».

```
dashboard/
├── index.html        página
├── css/styles.css    estilos (mismo lenguaje visual que el mapa)
├── js/config.js      configuración pública (sin datos)
├── js/source.js      lectura de Google Sheets (gviz, como el mapa)
├── js/sheet.js       detecta columnas por encabezado y normaliza filas
├── js/core.js        reglas e indicadores (las mismas fórmulas del archivo)
├── js/charts.js      gráficas SVG sin librerías externas
├── js/app.js         interfaz: filtros, pestañas, tablas y desgloses
├── test/             pruebas (datos sintéticos, nunca datos reales)
└── tools/            verificación contra una copia de la hoja y simulador de gviz
```

## 1. Cómo se conecta con la hoja

Igual que el mapa: con la consulta `gviz` de Google Sheets. Funciona mientras la
hoja esté compartida como «Cualquier persona con el enlace».

El ID de la hoja está en `js/config.js`. Es el mismo que ya usa el mapa
publicado (`VENTAS_SHEET_ID`). Para ver otra hoja en un navegador: «Fuentes y
verificación» → «Cambiar hoja», o abre `…/dashboard/#hoja=ID`. Esa elección se
guarda solo en ese navegador.

La navegación MAPA · DJS · DEMANDA · DASHBOARD es la misma del mapa.

## 2. Privacidad: estado actual y siguiente paso

**Hoy los datos no están protegidos.** Quien abra el dashboard, el mapa o el
enlace de la hoja puede ver la información financiera, porque la hoja está
compartida con «cualquier persona con el enlace» y su ID está en el código
público. El dueño decidió verlo así por ahora y protegerlo después.

Para protegerlo:

1. Crear un «ID de cliente de OAuth» gratuito en Google Cloud, con la API de
   Google Sheets habilitada y el origen `https://osvaldoh096-a11y.github.io`.
2. Cambiar `js/source.js` por una lectura con inicio de sesión de Google y
   permiso de solo lectura, y **quitar el ID** de `js/config.js` y del mapa.
3. Dejar la hoja financiera y «AMAL AGENDA» como **Restringidas**. Para el mapa,
   usar una hoja pública aparte con solo ciudad, fecha y coordenadas.

Contraseñas en JavaScript o enlaces ocultos **no** sirven como protección.

## 3. Qué muestra

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

## 4. De dónde sale cada indicador

Columnas detectadas por **encabezado** (si mueves columnas, el dashboard las sigue encontrando).

| Indicador | Cálculo (igual al del archivo) | Origen | Fecha |
|---|---|---|---|
| Ingresos generados | TOTAL EVENTO de eventos con REALIZADO = SI. En Guadalajara, desde feb 2026, + GAS A COBRAR | AGENDA Y VENTAS = `ANALISIS!E`, `DASHBOARD!C10` | Evento |
| Pago a DJs | Columna «DJ» de pago (la segunda «DJ»), eventos realizados | AGENDA Y VENTAS = `ANALISIS!F` | Evento |
| Publicidad / Operación / Atención al cliente | TOTAL con categoría PUBLICIDAD, OPERACION o AT. CLIENTE, solo en ciudades y meses con agenda | STOCK OPERACION = `ANALISIS!G:I` | Compra |
| Ganancia operativa | Ingresos − DJs − publicidad − operación − atención al cliente | `ANALISIS!J`, `DASHBOARD!C18` | Ambas |
| Ganancia personal | Reparto por ciudad y mes de `ANALISIS!M` (ver la pestaña Análisis) | `ANALISIS!M`, `DASHBOARD!C19` | Ambas |
| Eventos realizados / próximos | REALIZADO = SI / NO | AGENDA Y VENTAS | Evento |
| Saldo por cobrar | TOTAL EVENTO − ANTICIPO + GAS A COBRAR de eventos con REALIZADO = NO | fórmula de `AGENDA Y VENTAS!I2` | Evento |
| Por entregar de DJs | ENTREGAR A OSVALDO de eventos realizados con PAGADO = DEUDOR y pago al DJ registrado | `AGENDA Y VENTAS!I2`, `S` | Evento |
| Ventas por cada $1 en publicidad | Ingresos generados ÷ publicidad | `DATA!AT` «$1 EN ADS, VENDE» | Ambas |
| Ganancia operativa por cada $1 en publicidad | Ganancia operativa ÷ publicidad (ya descuenta la publicidad) | `DATA!AU` «$1 EN ADS NETO» | Ambas |
| Inversión en equipo | TOTAL con categoría STOCK. Inversión de Osvaldo = propia − ventas + 50% de socios | `STOCK OPERACION!V6` | Compra |
| Dinero cobrado por fecha de cobro | **No disponible:** el archivo no registra cuándo se cobra cada pago | — | — |

Si la publicidad es 0, los indicadores «por cada $1» muestran **«No disponible»**, no un número.

## 5. Verificación realizada

Hice la verificación con una copia de la hoja descargada el 28 oct 2026. La
guardé fuera del repositorio. Este documento es público, así que **no incluye
cifras del negocio**.

- **Celda por celda contra ANALISIS:** todas las combinaciones ciudad/mes × 8
  indicadores: **0 diferencias**.
- **Global histórico y por ciudad:** coincide con DASHBOARD (GLOBAL/GLOBAL), con
  el conteo de eventos realizados y con `DATA!AP:AU` en las cuatro ciudades.
- **De punta a punta:** la página real leyó la copia a través de un simulador de
  gviz que reproduce cómo Google entrega los datos. Los números en pantalla
  coinciden en histórico, año actual, mes actual y cada ciudad.
- **Pruebas automáticas:**
  - `npm test`: 26 pruebas de reglas y lectura.
  - `node test/ui.check.js`: interfaz en Chromium. Cubre filtros coherentes,
    enlace de la hoja, errores de conexión, estados sin datos y celular sin
    desplazamiento horizontal.
- **Mapa:** mismo conteo, filtros y cuadrantes antes y después de agregar la
  navegación.

## 6. Hallazgos en los datos (el dashboard los muestra, no los corrige)

Los montos y las filas exactas aparecen en «Fuentes y verificación».

1. **Publicidad con espacio extra:** hay registros con categoría `"PUBLICIDAD "`
   (espacio al final). Las fórmulas del archivo (SUMIFS) no los suman.
2. **Publicidad de meses sin agenda:** ANALISIS solo suma gastos de ciudades y
   meses con eventos.
3. **«POR CADA $1 MXN INVERTIDO EN ADS»** en `DASHBOARD!B24:C24` siempre muestra
   `$0.00x`: divide entre `C14`, que es texto. Los valores correctos están en `DATA!AT:AU`.
4. **Dos reglas distintas para la gasolina:** `ANALISIS!E` solo la suma en
   Guadalajara, y `AGENDA Y VENTAS!M` en cualquier evento con sonido de Osvaldo.
5. **Fórmulas con rangos que se desplazan** en algunas gráficas de ANALISIS. El
   dashboard no las usa: calcula desde las filas.
6. **Posibles duplicados:** se listan y **no se eliminan**.

## 7. Pendiente de confirmar

- **Gasolina:** ¿cuál regla es la correcta, la de ANALISIS (solo Guadalajara) o
  la de AGENDA Y VENTAS (sonido de Osvaldo en cualquier ciudad)? Hoy uso la de ANALISIS.
- **Cancelaciones:** el archivo no tiene un estado de cancelación. ¿Un evento
  cancelado se borra de la agenda? ¿El anticipo se conserva como ingreso?
- **«POR COBRAR PROPIO»:** no está incluido porque usa un costo de DJ fijo por ciudad.
- **Flujo de caja por fecha de cobro:** requiere registrar la fecha de cada
  anticipo y saldo.

## 8. Desarrollo local

```bash
cd dashboard
npm test                      # reglas y lectura (Node 18+, sin dependencias)
node test/ui.check.js         # interfaz en Chromium con gviz simulado (requiere Playwright)
```

Para verificar contra una copia real de la hoja (guárdala **fuera** del repositorio):

```bash
node tools/verificar-snapshot.js /ruta/fuera-del-repo/snapshot.json
node test/ui.check.js --snapshot /ruta/fuera-del-repo/snapshot.json --hoy AAAA-MM-DD
```

El snapshot es la respuesta de `spreadsheets.get` con `includeGridData` para las
hojas AGENDA Y VENTAS, STOCK OPERACION, ANALISIS, DATA y DASHBOARD.
