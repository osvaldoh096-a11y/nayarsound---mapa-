# Panel personal

Panel privado de pendientes y finanzas. Se publica en GitHub Pages como el mapa y la tienda:

`https://osvaldoh096-a11y.github.io/nayarsound---mapa-/panel/`

- **Fuente de datos:** tus Google Sheets. El panel no tiene base de datos propia.
- **Acceso:** cualquiera con el enlace puede abrir la página, pero necesita la **contraseña** para ver algo.
- **Solo lectura:** usa la consulta pública de Google Sheets (gviz), como el mapa. No escribe ni cambia fórmulas.
- **Qué se publica:** el repositorio no tiene datos ni contraseñas. Los enlaces de tus hojas van cifrados en `acceso.json`.
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

## 2. Acceso y seguridad

- **Contraseña:** `acceso.json` guarda los enlaces de tus 4 hojas cifrados con AES-GCM. La clave sale de tu contraseña (PBKDF2-SHA256, 600 000 vueltas). Sin la contraseña, la página no sabe qué hojas leer y no consulta ninguna.
- **Recordar en este dispositivo:** guarda los enlaces ya descifrados en ese navegador para no pedir la contraseña cada vez. **⚙ Fuentes → Salir y olvidar en este dispositivo** los borra.
- **Requisito:** las 4 hojas deben estar compartidas como **«Cualquier persona con el enlace: Lector»**:
  - 🐯NAYARSOUND - PERSONAL
  - AMAL AGENDA
  - 💵REGISTRO DE PRESTAMOS
  - 🚹GASTOS PERSONALES - OSVALDO
- **Límite de esta protección:** quien consiga el enlace de una hoja la puede abrir directamente, sin el panel. La contraseña protege la página; tus hojas quedan protegidas solo mientras nadie más tenga sus enlaces.
- **Contraseña larga:** `acceso.json` es público y se puede atacar sin conexión. Usa al menos 10 caracteres sin significado.

### Cambiar la contraseña o las hojas

1. Crea, **fuera del repositorio**, un `config.json` con el ID (o enlace) de cada hoja. El formato está al inicio de `herramientas/cifrar-acceso.mjs`.
2. Ejecuta:
   ```bash
   node panel/herramientas/cifrar-acceso.mjs /ruta/config.json
   ```
3. Escribe la contraseña nueva y sube el `panel/acceso.json` que se genera. Los dispositivos que tenían «Recordar» siguen entrando hasta que toques «Salir».

## 3. Uso diario

- **En el celular:** abre la dirección del panel, escribe la contraseña y deja marcado «Recordar en este dispositivo». Para tenerlo como app:
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

1. Agrega el archivo en `js/fuentes.js`: nombre, rangos, tramos y una clave nueva en `ORDEN_ARCHIVOS`.
2. Agrega su ID en tu `config.json` y vuelve a generar `acceso.json` (sección 2).
3. Escribe su lector:
   - Si el DASHBOARD del negocio tiene un texto de recordatorio con el mismo formato (📅 día, líneas con COBRAR/PAGAR o 🎧 persona | 📌 eventos | 💰 monto), reutiliza `leerPrestamos` o `leerDeuda` de `js/parsers.js`.
   - Si no, escribe un lector parecido.
4. En `js/modelo.js`, convierte lo leído en pendientes, con `negocio`, `urgencia` y `origen`.

Para las finanzas no hace falta código: si agregas una columna del negocio en DASHBOARD BALANCE GENERAL, entre MES y GANANCIA MENSUAL, el panel la muestra sola.

## 5. Desarrollo

```bash
cd panel
npm test                       # reglas, lectura, cifrado y gviz, con datos sintéticos (Node 20+)
node test/ui.check.mjs         # interfaz en Chromium con un simulador de Google Sheets (requiere Playwright)
```

Para comparar con una copia real, guárdala **fuera** del repositorio:

```bash
node test/ui.check.mjs --snapshot /ruta/snapshot.json --esperado /ruta/esperado.json --hoy AAAA-MM-DD
```

```
panel/
├── index.html, css/panel.css, manifest, iconos
├── acceso.json      enlaces de tus hojas, cifrados con la contraseña
├── js/acceso.js     cifrado y descifrado (AES-GCM + PBKDF2)
├── js/fuentes.js    qué se lee de cada archivo (sin IDs)
├── js/config.js     acceso recordado en el navegador y preferencias
├── js/gviz.js       lectura de Google Sheets por gviz (JSONP)
├── js/sheets.js     utilidades de rangos, celdas y encabezados
├── js/carga.js      lectura en paralelo y estado por archivo
├── js/parsers.js    lectura de los textos de recordatorio
├── js/modelo.js     pendientes, agenda, deuda, préstamos y finanzas
├── js/graficas.js   barras y líneas sin librerías
├── js/app.js        interfaz
├── js/demo.js       DATOS DE EJEMPLO (inventados)
├── herramientas/    generar acceso.json
└── test/            pruebas y simulador
```
