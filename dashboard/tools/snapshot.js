// Lee una copia de la hoja descargada con la API de Google Sheets
// (spreadsheets.get con includeGridData y effectiveValue) y devuelve cada
// hoja como matriz de valores, igual que getValues() en Apps Script.
const fs = require('fs');

function readSnapshot(file) {
  const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));

  function sheetValues(title) {
    const sheet = snapshot.sheets.find((s) => s.properties.title === title);
    if (!sheet) return null;
    const grid = [];
    for (const block of sheet.data || []) {
      const r0 = block.startRow || 0;
      const c0 = block.startColumn || 0;
      (block.rowData || []).forEach((row, i) => {
        const target = grid[r0 + i] || (grid[r0 + i] = []);
        (row.values || []).forEach((cell, j) => {
          const ev = cell.effectiveValue;
          let v = '';
          if (ev) {
            if ('numberValue' in ev) v = ev.numberValue;
            else if ('stringValue' in ev) v = ev.stringValue;
            else if ('boolValue' in ev) v = ev.boolValue;
            else if ('errorValue' in ev) v = '#ERROR';
          }
          target[c0 + j] = v;
        });
      });
    }
    let width = 0;
    for (let i = 0; i < grid.length; i++) width = Math.max(width, grid[i] ? grid[i].length : 0);
    const values = [];
    for (let i = 0; i < grid.length; i++) {
      const r = grid[i] || [];
      const out = [];
      for (let j = 0; j < width; j++) out.push(r[j] === undefined ? '' : r[j]);
      values.push(out);
    }
    return { name: title, values };
  }

  return { sheetValues };
}

/** Arma el mismo objeto que devuelve getDashboardData() a partir del snapshot. */
function payloadFromSnapshot(server, file, today) {
  const snap = readSnapshot(file);
  const payload = server.buildPayload({
    agenda: snap.sheetValues('AGENDA Y VENTAS'),
    expenses: snap.sheetValues('STOCK OPERACION'),
    analysis: snap.sheetValues('ANALISIS')
  }, (d) => d.toISOString().slice(0, 10));
  payload.today = today;
  payload.generatedAt = new Date().toISOString();
  payload.spreadsheetName = 'Copia local de la hoja';
  return { payload, snap };
}

module.exports = { readSnapshot, payloadFromSnapshot };
