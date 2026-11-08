# Panel personal

Panel privado de pendientes y finanzas. Se publica en GitHub Pages como el mapa y la tienda:

`https://osvaldoh096-a11y.github.io/nayarsound---mapa-/panel/`

- **Fuente de datos:** tus Google Sheets. El panel no tiene base de datos propia.
- **Acceso:** iniciar sesión con tu cuenta de Google.
- **Hojas privadas:** Google solo entrega los datos a cuentas con acceso a tus archivos. Las hojas pueden estar como **Restringido**. Permiso pedido: `spreadsheets` (lectura y edición). El panel solo escribe cuando marcas un pago: «SI» en la columna PAGO de AGENDA Y VENTAS, después de comprobar que la fila sigue siendo ese evento deudor y que la celda no tiene fórmula.
- **Qué se publica:** solo código. Los IDs de las hojas están en `js/fuentes.js`, pero no dan acceso porque las hojas están restringidas.
- **Datos de ejemplo:** `…/panel/?demo` muestra datos inventados, siempre con la banda «DATOS DE EJEMPLO».

## 1. De dónde sale cada indicador

El panel toma los **textos de recordatorio que ya generan tus DASHBOARD** y la **tabla mensual** de gastos, sin rehacer sus reglas. Las tablas de registros solo añaden la hora del evento y el enlace a la fila; nunca cambian una cifra.

| Indicador o alerta | Archivo | Pestaña | Rango | Regla |
|---|---|---|---|---|
| Eventos de hoy, mañana y días siguientes (por ciudad y DJ) | 🐯NAYARSOUND - PERSONAL | DASHBOARD | Celda bajo «RECORDATORIOS» (B47) | El texto de la hoja, que viene de AMAL AGENDA |
| Hora del evento y enlace a su fila | AMAL AGENDA | AGENDA | Fila 12 en adelante: CIUDAD, DJ, FECHA, INICIO DEL EVENTO | Se cruza fecha, ciudad y DJ |
| Evento que requiere acción (resaltado) | AMAL AGENDA | AGENDA | Mismas columnas | Las reglas de D9, D10, G11, L11 y N11: DJ «buscar» o vacío en evento por realizar, sin hora de inicio, sin total, o Guadalajara sin gas a cobrar |
| Avisos de captura | AMAL AGENDA / 🐯NAYARSOUND | AGENDA D9:N11 / AGENDA Y VENTAS L11 | Celdas con ❌ o ✅ | Se muestran tal cual |
| Recordatorio de deuda (persona, eventos, fechas, importe, total) | 🐯NAYARSOUND - PERSONAL | DASHBOARD | Celda bajo «RECORDATORIO DE DEUDA» (B79) | El texto de la hoja: filas con PAGADO = DEUDOR. Días desde el evento más antiguo. |
| Enlace a cada evento adeudado | 🐯NAYARSOUND - PERSONAL | AGENDA Y VENTAS | DJ, FECHA, ENTREGAR A OSVALDO, PAGADO | Se cruza DJ y fecha. Se compara con «FALTAN N DE PAGAR» (S11). |
| COBRAR / PAGAR en los próximos 5 días | 💵REGISTRO DE PRESTAMOS | DASHBOARD | Celda bajo «RESUMEN GENERAL» (B18) | El texto de la hoja. COBRAR: préstamos ACTIVO por FECHA COMPROMISO. PAGAR: inversores ACTIVO por FECHA DINAMICA. USDT × 18. |
| Capital por liquidar a inversores | 💵REGISTRO DE PRESTAMOS | DASHBOARD | Misma celda | Compromisos de los próximos 30 días |
| Enlace a la operación | 💵REGISTRO DE PRESTAMOS | REGISTRO PRESTAMOS / REGISTRO DE INVERSORES | NOMBRE, DIVISA, FECHA, ESTADO, PAGO MES | Se cruza nombre, fecha e importe |
| Ganancia mensual | 🚹GASTOS PERSONALES - OSVALDO | DASHBOARD BALANCE GENERAL | Columna GANANCIA MENSUAL, fila del mes | Suma de los negocios (columnas entre MES y GANANCIA MENSUAL) |
| Ganancia por negocio | 🚹GASTOS PERSONALES - OSVALDO | DASHBOARD BALANCE GENERAL | NAYARSOUND, ST, PRESTAMOS, SALDOS, OTROS | Tal cual, fila del mes |
| Gastos personales | 🚹GASTOS PERSONALES - OSVALDO | DASHBOARD BALANCE GENERAL | Columna GASTOS PERSONALES | Tal cual |
| Gastos por categoría | 🚹GASTOS PERSONALES - OSVALDO | ANALISIS GASTOS PERSONALES | CANTIDAD, MOTIVO, AUX | Igual que la hoja: suma de CANTIDAD donde AUX = mes. Se compara con GASTOS PERSONALES. |
| Sobrante mensual | 🚹GASTOS PERSONALES - OSVALDO | DASHBOARD BALANCE GENERAL | Columna SOBRANTE MENSUAL | Ganancia − gastos. Resultado calculado, no saldo bancario. |

**Pendientes en Inicio.** Cada línea de un recordatorio es una acción concreta:

- un DJ en un día (aunque tenga varios eventos);
- un evento sin DJ asignado;
- una persona con deuda;
- un COBRAR o un PAGAR;
- un capital por liquidar.

Los eventos se cuentan aparte. Colores:

- **Hoy:** acciones de hoy.
- **Próximo:** acciones de días siguientes.
- **Cobros de eventos pendientes:** deudas de DJs; cada una muestra los días desde el evento más antiguo que se debe.

**Mes actual.** Hoy, mañana y el mes actual se calculan con la hora de Ciudad de México. El selector de mes ofrece los meses que tiene la tabla de tu hoja.

## 2. Acceso y seguridad

- **Google:** el proyecto de Google Cloud «dashboard personal» tiene un ID de cliente en `js/fuentes.js` (no es secreto) y solo acepta el origen `https://osvaldoh096-a11y.github.io`.
  - El token de Google dura cerca de una hora y se guarda en ese navegador hasta que expira, para no pedir la cuenta en cada recarga. «Cerrar sesión» lo borra.
  - Si expira, el panel lo avisa y basta con tocar «Actualizar».
- **Otro proyecto en otro dominio:** agrega su origen en https://console.cloud.google.com/auth/clients (cliente «dashboard personal» → Orígenes de JavaScript autorizados). Los proyectos en `osvaldoh096-a11y.github.io` ya funcionan.
- **Usuarios:** la app está en modo de prueba. Solo entran las cuentas agregadas en https://console.cloud.google.com/auth/audience.

## 3. Uso diario

- **En el celular:** abre la dirección del panel, toca «Entrar con Google». Para tenerlo como app:
  - **iPhone:** Safari → Compartir → «Agregar a pantalla de inicio».
  - **Android:** Chrome → ⋮ → «Agregar a la pantalla principal».
- **Actualizar:** el botón ↻ vuelve a leer tus hojas.
  - En **⚙ Fuentes** eliges la actualización automática: desactivada, 5, 15, 30 o 60 minutos.
  - Arriba se ve la fecha y hora de la última lectura correcta.
- **Si algo falla:** cada archivo se lee por separado.
  - Si uno falla, sus datos anteriores se marcan con la hora en que se leyeron.
  - Si nunca se pudo leer, no se muestra ninguna cifra suya.
  - Una celda vacía o con error se muestra como tal, nunca como $0.

## 4. Conectar otro negocio

1. Agrega el archivo en `js/fuentes.js`: nombre, rangos y una clave nueva en `ORDEN_ARCHIVOS`.
2. Escribe su lector:
   - Si el DASHBOARD del negocio tiene un texto de recordatorio con el mismo formato (📅 día, líneas con COBRAR/PAGAR o 🎧 persona | 📌 eventos | 💰 monto), reutiliza `leerPrestamos` o `leerDeuda` de `js/parsers.js`.
   - Si no, escribe un lector parecido.
3. En `js/modelo.js`, convierte lo leído en pendientes, con `negocio`, `urgencia` y `origen`.

Para las finanzas no hace falta código: si agregas una columna del negocio en DASHBOARD BALANCE GENERAL, entre MES y GANANCIA MENSUAL, el panel la muestra sola.

## 5. Desarrollo

Antes de publicar un cambio, ejecuta `node panel/herramientas/version.mjs`: pone un número de versión en las rutas de CSS y JS para que los navegadores no usen archivos viejos del caché.

```bash
cd panel
npm test                       # reglas y lectura, con datos sintéticos (Node 20+)
node test/ui.check.mjs         # interfaz en Chromium con un simulador de Google (requiere Playwright)
```

Para comparar con una copia real, guárdala **fuera** del repositorio:

```bash
node test/ui.check.mjs --snapshot /ruta/snapshot.json --esperado /ruta/esperado.json --hoy AAAA-MM-DD
```

```
panel/
├── index.html, css/panel.css, manifest, iconos
├── js/fuentes.js    archivos, IDs, pestañas y rangos que se leen
├── js/config.js     preferencias en el navegador
├── js/auth.js       inicio de sesión con Google (solo lectura)
├── js/api.js        lectura con la API de Google Sheets
├── js/sheets.js     utilidades de rangos, celdas y encabezados
├── js/carga.js      lectura en paralelo y estado por archivo
├── js/parsers.js    lectura de los textos de recordatorio
├── js/modelo.js     pendientes, agenda, deuda, préstamos y finanzas
├── js/graficas.js   barras y líneas sin librerías
├── js/app.js        interfaz
├── js/demo.js       DATOS DE EJEMPLO (inventados)
└── test/            pruebas y simulador
```
