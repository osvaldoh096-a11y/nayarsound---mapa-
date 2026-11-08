# Panel personal

Panel privado de pendientes y finanzas. Se publica en GitHub Pages como el mapa y la tienda:

`https://osvaldoh096-a11y.github.io/nayarsound---mapa-/panel/`

- **Fuente de datos:** tus Google Sheets. El panel no tiene base de datos propia.
- **Solo lectura:** pide el permiso `spreadsheets.readonly` de Google. No escribe ni cambia fórmulas.
- **Qué se publica:** este repositorio solo tiene código, sin datos, sin IDs de archivos y sin contraseñas.
- **Datos de ejemplo:** `…/panel/?demo` muestra datos inventados, siempre con la banda «DATOS DE EJEMPLO».

## 1. De dónde sale cada indicador

El panel toma los **textos de recordatorio que ya generan tus DASHBOARD** y la **tabla mensual** de gastos, sin rehacer sus reglas. Las tablas de registros solo añaden la hora del evento y el enlace a la fila; nunca cambian una cifra.

| Indicador o alerta | Archivo | Pestaña | Rango | Regla |
|---|---|---|---|---|
| Eventos de hoy, mañana y días siguientes (por ciudad y DJ) | 🐯NAYARSOUND - PERSONAL | DASHBOARD | Celda bajo «RECORDATORIOS» (B47) | El texto de la hoja, que viene de AMAL AGENDA |
| Hora del evento y enlace a su fila | AMAL AGENDA | AGENDA | Fila 12 en adelante: CIUDAD, DJ, FECHA, INICIO DEL EVENTO | Se cruza fecha, ciudad y DJ |
| Evento que requiere acción (resaltado) | AMAL AGENDA | AGENDA | Mismas columnas | Las reglas de D9, D10, G11, L11 y N11: DJ «buscar» o vacío en evento por realizar, sin hora de inicio, sin total, o Guadalajara sin gas a cobrar |
| Avisos de captura | AMAL AGENDA / 🐯NAYARSOUND | AGENDA D9:N11 / AGENDA Y VENTAS L11 | Celdas con ❌ o ✅ | Se muestran tal cual |
| Recordatorio de deuda (persona, eventos, fechas, importe, total) | 🐯NAYARSOUND - PERSONAL | DASHBOARD | Celda bajo «RECORDATORIO DE DEUDA» (B79) | El texto de la hoja: filas con PAGADO = DEUDOR. Sin fecha límite. |
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
- **Sin fecha límite:** deudas de DJs.
- **Vencido:** ninguna de tus hojas marca vencidos, así que queda en 0.

**Mes actual.** Hoy, mañana y el mes actual se calculan con la hora de Ciudad de México. El selector de mes ofrece los meses que tiene la tabla de tu hoja.

## 2. Seguridad

- **Inicio de sesión:** con tu cuenta de Google. **Google solo entrega los datos a cuentas con acceso a tus archivos.** Quien abra la página sin esa cuenta no ve nada; el código público no contiene datos.
- **Token de Google:** dura cerca de una hora y vive solo en la memoria de la pestaña. No se guarda ni se envía a otro servidor.
- **En el navegador se guarda:** el ID de cliente de Google y los IDs de tus archivos, solo en ese dispositivo. No son contraseñas; entran con el enlace de configuración.
- **Para que esto proteja de verdad:** tus hojas deben estar como **Restringido** en «Compartir». Si una hoja está como «Cualquier persona con el enlace», cualquiera que tenga ese enlace la puede abrir sin pasar por el panel.

## 3. Configuración inicial (una sola vez)

1. Entra a <https://console.cloud.google.com/> con tu cuenta y crea un proyecto, por ejemplo «Panel personal».
2. **APIs y servicios → Biblioteca:** habilita **Google Sheets API**.
3. **Pantalla de consentimiento de OAuth:**
   - tipo **Externo**, estado **Prueba**;
   - agrega tu correo como **usuario de prueba**;
   - el permiso que usa el panel es `…/auth/spreadsheets.readonly`.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth:**
   - tipo **Aplicación web**;
   - en **Orígenes de JavaScript autorizados** escribe `https://osvaldoh096-a11y.github.io`;
   - no hace falta URI de redirección ni secreto.
5. Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`).
6. Abre el panel y pega el ID de cliente y los enlaces de los 4 archivos. Después, en **⚙ Fuentes → Copiar enlace para el celular**, obtienes un enlace que configura cualquier otro dispositivo de una vez. Ese enlace contiene los IDs de tus archivos: no lo compartas.

Al entrar, Google puede mostrar «Google no ha verificado esta app». Es normal en una app personal en modo de prueba; elige continuar.

## 4. Uso diario

- **En el celular:** abre el enlace de configuración una vez y toca «Entrar con Google». Para tenerlo como app:
  - **iPhone:** Safari → Compartir → «Agregar a pantalla de inicio».
  - **Android:** Chrome → ⋮ → «Agregar a la pantalla principal».
- **Actualizar:** el botón ↻ vuelve a leer tus hojas.
  - En **⚙ Fuentes** eliges la actualización automática: desactivada, 5, 15, 30 o 60 minutos.
  - Arriba se ve la fecha y hora de la última lectura correcta.
  - Si la sesión expiró, el panel lo avisa y espera a que toques «Actualizar».
- **Si algo falla:** cada archivo se lee por separado.
  - Si uno falla, sus datos anteriores se marcan con la hora en que se leyeron.
  - Si nunca se pudo leer, no se muestra ninguna cifra suya.
  - Una celda vacía o con error se muestra como tal, nunca como $0.

## 5. Conectar otro negocio

1. Agrega el archivo en `js/fuentes.js`: nombre, rangos y una clave nueva en `ORDEN_ARCHIVOS`. El formulario de configuración pedirá su enlace automáticamente.
2. Escribe su lector:
   - Si el DASHBOARD del negocio tiene un texto de recordatorio con el mismo formato (📅 día, líneas con COBRAR/PAGAR o 🎧 persona | 📌 eventos | 💰 monto), reutiliza `leerPrestamos` o `leerDeuda` de `js/parsers.js`.
   - Si no, escribe un lector parecido.
3. En `js/modelo.js`, convierte lo leído en pendientes, con `negocio`, `urgencia` y `origen`.

Para las finanzas no hace falta código: si agregas una columna del negocio en DASHBOARD BALANCE GENERAL, entre MES y GANANCIA MENSUAL, el panel la muestra sola.

## 6. Desarrollo

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
├── js/fuentes.js    qué se lee de cada archivo (sin IDs)
├── js/config.js     configuración privada en el navegador
├── js/auth.js       inicio de sesión con Google (solo lectura)
├── js/sheets.js     API de Google Sheets y utilidades de rangos
├── js/carga.js      lectura en paralelo y estado por archivo
├── js/parsers.js    lectura de los textos de recordatorio
├── js/modelo.js     pendientes, agenda, deuda, préstamos y finanzas
├── js/graficas.js   barras y líneas sin librerías
├── js/app.js        interfaz
├── js/demo.js       DATOS DE EJEMPLO (inventados)
└── test/            pruebas y simulador
```
