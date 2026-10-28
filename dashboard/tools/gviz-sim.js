// Simula la respuesta de Google Sheets «gviz/tq» (la que usan el mapa y el
// dashboard) a partir de matrices de valores, para probar sin conexión.
//
// Imita lo importante de gviz:
//  - range (A1:AZ40) y headers (0 o 1, con la primera fila como etiquetas);
//  - cada columna toma el tipo más frecuente y los valores de otro tipo llegan
//    en null (por eso el dashboard lee los encabezados como etiquetas);
//  - fechas como "Date(año,mes-1,día)" y el prefijo /*O_o*/.

function colIndex(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function colLetter(index) {
  let n = index + 1, s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function parseRange(range) {
  const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range);
  if (!m) throw new Error('Rango no soportado: ' + range);
  return { c1: colIndex(m[1]), r1: +m[2] - 1, c2: colIndex(m[3]), r2: +m[4] - 1 };
}

// Un valor de entrada puede ser número, texto, booleano, Date o {date:'AAAA-MM-DD'}.
function typeOf(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date || (v && v.date)) return 'date';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  return 'string';
}
function isoOf(v) { return v instanceof Date ? v.toISOString().slice(0, 10) : v.date; }
function cellJson(v, type) {
  if (type === 'date') {
    const iso = isoOf(v);
    return { v: `Date(${+iso.slice(0, 4)},${+iso.slice(5, 7) - 1},${+iso.slice(8, 10)})`, f: iso };
  }
  if (type === 'number') return { v, f: String(v) };
  return { v };
}

/** Marca como fecha los números de serie en columnas cuyo encabezado dice FECHA. */
function markDates(values) {
  const headerRow = values.findIndex((r) => r && r.some((c) => typeof c === 'string' && c.trim().toUpperCase() === 'CIUDAD'));
  if (headerRow === -1) return values;
  const dateCols = [];
  values[headerRow].forEach((c, i) => { if (typeof c === 'string' && /FECHA/i.test(c)) dateCols.push(i); });
  return values.map((row, r) => (r <= headerRow || !row ? row : row.map((c, i) => {
    if (dateCols.includes(i) && typeof c === 'number' && c > 20000 && c < 80000) {
      return { date: new Date(Date.UTC(1899, 11, 30) + c * 86400000).toISOString().slice(0, 10) };
    }
    return c;
  })));
}

// options.strictColumns: responde error si el rango pide columnas más allá de la hoja.
// options.dropEmptyRows: omite las filas completamente vacías (posible comportamiento de gviz).
// options.dropEmptyRowsFromTop: igual, pero solo en lecturas que empiezan en la fila 1.
function respond(workbook, url, options) {
  const opts = options || {};
  const u = new URL(url);
  const sheet = u.searchParams.get('sheet');
  const tqx = u.searchParams.get('tqx') || '';
  const callback = (/responseHandler:([\w$]+)/.exec(tqx) || [])[1] || 'google.visualization.Query.setResponse';
  const values = workbook[sheet];
  if (!values) {
    const err = { version: '0.6', status: 'error', errors: [{ reason: 'invalid_query', message: 'INVALID_QUERY', detailed_message: 'Invalid sheet: ' + sheet }] };
    return `/*O_o*/\n${callback}(${JSON.stringify(err)});`;
  }
  const sheetWidth = Math.max(0, ...values.map((r) => (r ? r.length : 0)));
  let c1 = 0, r1 = 0, c2 = sheetWidth - 1, r2 = values.length - 1;
  if (u.searchParams.get('range')) {
    ({ c1, r1, c2, r2 } = parseRange(u.searchParams.get('range')));
    if (opts.strictColumns && c2 >= sheetWidth) {
      const err = { version: '0.6', status: 'error', errors: [{ reason: 'invalid_query', message: 'INVALID_QUERY', detailed_message: 'Range exceeds grid limits' }] };
      return `/*O_o*/\n${callback}(${JSON.stringify(err)});`;
    }
  }
  const limit = /limit\s+(\d+)/i.exec(u.searchParams.get('tq') || '');
  if (limit) r2 = Math.min(r2, r1 + +limit[1] - 1);
  const headers = +(u.searchParams.get('headers') || 0);
  let last = -1;
  for (let r = r1; r <= Math.min(r2, values.length - 1); r++) {
    if ((values[r] || []).some((c) => typeOf(c))) last = r;
  }
  const width = Math.max(0, ...values.slice(r1, last + 1).map((r) => (r ? r.length : 0)));
  const cEnd = Math.min(c2, width - 1);
  const rows = [];
  for (let r = r1; r <= last; r++) {
    const row = (values[r] || []).slice(c1, cEnd + 1);
    const drop = opts.dropEmptyRows || (opts.dropEmptyRowsFromTop && r1 === 0);
    if (drop && !row.some((c) => typeOf(c))) continue;
    rows.push(row);
  }
  const labelsRow = headers ? rows.shift() || [] : [];
  const cols = [];
  for (let c = 0; c <= cEnd - c1; c++) {
    const count = {};
    rows.forEach((row) => { const t = typeOf(row[c]); if (t) count[t] = (count[t] || 0) + 1; });
    const type = Object.keys(count).sort((a, b) => count[b] - count[a])[0] || 'string';
    const label = labelsRow[c] === undefined || labelsRow[c] === null ? '' : String(labelsRow[c] && labelsRow[c].date ? labelsRow[c].date : labelsRow[c]);
    cols.push({ id: colLetter(c1 + c), label, type });
  }
  const table = {
    cols,
    rows: rows.map((row) => ({
      c: cols.map((col, c) => {
        const t = typeOf(row[c]);
        if (!t || t !== col.type) return null; // gviz descarta el tipo minoritario
        return cellJson(row[c], t);
      })
    }))
  };
  return `/*O_o*/\n${callback}(${JSON.stringify({ version: '0.6', reqId: '0', status: 'ok', sig: '1', table })});`;
}

module.exports = { respond, markDates };
