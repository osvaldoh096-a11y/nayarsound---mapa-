/**
 * NayarSound · Pagos a DJs
 *
 * Pega este código en tu hoja 🐯NAYARSOUND - PERSONAL:
 *   Extensiones → Apps Script → borra lo que haya → pega esto → Guardar (💾).
 * No pide permisos: es un activador simple (onEdit) que solo toca esta hoja.
 *
 * Qué hace: cuando escribes en la columna DJ (L) o PAGO (T) de AGENDA Y VENTAS,
 * guarda ese valor en la pestaña PAGOS DJ con la CLAVE del evento (columna W)
 * y deja otra vez la fórmula. Así el pago se queda pegado a su evento aunque
 * en AMAL AGENDA se inserten o reordenen filas. El panel guarda en el mismo
 * lugar, así que puedes editar desde la hoja o desde el panel.
 */
const HOJA = 'AGENDA Y VENTAS';
const PAGOS = 'PAGOS DJ';
const PRIMERA_FILA = 13;
const COL_CLAVE = 23; // W
// Columna en AGENDA Y VENTAS → columna en PAGOS DJ (E = PAGO DJ, F = PAGADO)
const DESTINO = { 12: 5, 20: 6 };
const FORMULA = {
  12: "=ARRAYFORMULA(IF(W13:W=\"\",,IFERROR(VLOOKUP(W13:W,'PAGOS DJ'!A:E,5,FALSE),)))",
  20: "=ARRAYFORMULA(IF(W13:W=\"\",,IFERROR(VLOOKUP(W13:W,'PAGOS DJ'!A:F,6,FALSE),)))",
};

function onEdit(e) {
  const rango = e.range;
  const hoja = rango.getSheet();
  if (hoja.getName() !== HOJA) return;
  const f1 = Math.max(rango.getRow(), PRIMERA_FILA);
  const f2 = rango.getLastRow();
  if (f2 < f1) return;
  const columnas = Object.keys(DESTINO).map(Number)
    .filter((c) => c >= rango.getColumn() && c <= rango.getLastColumn());
  if (!columnas.length) return;

  const n = f2 - f1 + 1;
  const pagos = e.source.getSheetByName(PAGOS);
  const claves = hoja.getRange(f1, COL_CLAVE, n, 1).getDisplayValues();
  const datos = hoja.getRange(f1, 1, n, 8).getValues(); // D = DJ, E = FECHA, H = CLIENTE
  const ultima = pagos.getLastRow();
  const lista = ultima > 1 ? pagos.getRange(2, 1, ultima - 1, 1).getDisplayValues().map((x) => String(x[0]).trim()) : [];
  const ahora = Utilities.formatDate(new Date(), 'America/Mexico_City', 'yyyy-MM-dd HH:mm');

  for (const c of columnas) {
    const valores = hoja.getRange(f1, c, n, 1).getValues();
    for (let i = 0; i < n; i++) {
      const clave = String(claves[i][0] || '').trim();
      if (!clave || clave.startsWith('#')) continue;
      let valor = valores[i][0];
      if (c === 20) valor = String(valor).trim().toUpperCase();
      const k = lista.indexOf(clave);
      if (k >= 0) {
        pagos.getRange(k + 2, DESTINO[c]).setValue(valor);
        pagos.getRange(k + 2, 7).setValue(ahora);
      } else if (valor !== '') {
        const fecha = datos[i][4] instanceof Date ? Utilities.formatDate(datos[i][4], 'America/Mexico_City', 'yyyy-MM-dd') : datos[i][4];
        pagos.appendRow([clave, fecha, String(datos[i][3]).trim(), String(datos[i][7]).trim(),
          c === 12 ? valor : '', c === 20 ? valor : '', ahora]);
        lista.push(clave);
      }
    }
    // Quita lo escrito para que la fórmula vuelva a mostrar el valor (ya guardado en PAGOS DJ).
    hoja.getRange(f1, c, n, 1).clearContent();
    hoja.getRange(PRIMERA_FILA, c).setFormula(FORMULA[c]);
  }
}
