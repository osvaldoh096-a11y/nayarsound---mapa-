const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSheet } = require('./load');
const fx = require('./fixtures');

const sheet = loadSheet();
// Los objetos creados dentro del sandbox vm tienen otro prototipo: se comparan como JSON.
const plain = (x) => JSON.parse(JSON.stringify(x));

test('normaliza encabezados sin acentos, mayúsculas ni espacios', () => {
  assert.equal(sheet.normalizeHeader(' DJ '), 'DJ');
  assert.equal(sheet.normalizeHeader('STOCK/ OPERACION'), 'STOCK/OPERACION');
  assert.equal(sheet.normalizeHeader('Dueño'), 'DUENO');
  assert.equal(sheet.normalizeHeader('OP.'), 'OP');
  assert.equal(sheet.normalizeHeader('GAN. OPERATIVA PERSONAL'), 'GAN. OPERATIVA PERSONAL');
});

test('encuentra la fila de encabezados y distingue las dos columnas «DJ»', () => {
  const t = sheet.extractTable(fx.agendaValues(), sheet.AGENDA_COLUMNS, 'AGENDA Y VENTAS');
  assert.equal(t.headerRow, 11); // fila 12 de la hoja
  assert.equal(t.columns.dj, 3); // D: nombre del DJ
  assert.equal(t.columns.djPay, 11); // L: pago al DJ
  assert.equal(t.columns.ganancia2, 13);
});

test('no depende de la posición de las columnas', () => {
  // Invierte el orden de las columnas de pago y anticipo y agrega una columna nueva al inicio.
  const values = fx.agendaValues().map((r) => {
    const row = r.slice();
    const tmp = row[9]; row[9] = row[10]; row[10] = tmp;
    return ['nueva'].concat(row);
  });
  values[11][0] = 'NOTAS';
  const a = fx.payload(sheet).events;
  const b = fx.payload(sheet, null, { agenda: values }).events;
  assert.deepEqual(b.map((e) => [e.anticipo, e.gas, e.total]), a.map((e) => [e.anticipo, e.gas, e.total]));
});

test('interpreta montos con formato y marca los que no son montos', () => {
  assert.deepEqual(plain(sheet.parseAmount('$3,000.00')), { value: 3000, error: null });
  assert.deepEqual(plain(sheet.parseAmount('(150)')), { value: -150, error: null });
  assert.deepEqual(plain(sheet.parseAmount(' - ')), { value: 0, error: null });
  assert.deepEqual(plain(sheet.parseAmount('')), { value: null, error: null });
  assert.equal(sheet.parseAmount(1250.5).value, 1250.5);
  assert.equal(sheet.parseAmount('N/A').value, null);
  assert.match(sheet.parseAmount('N/A').error, /no es un monto/);
  assert.match(sheet.parseAmount('#REF!').error, /error de fórmula/);
});

test('interpreta fechas: objeto Date, número de serie y texto dd/mm/aaaa', () => {
  const fmt = fx.formatDate;
  assert.equal(sheet.parseDate(fx.toDate('2026-03-14'), fmt).value, '2026-03-14');
  assert.equal(sheet.parseDate(46095, fmt).value, '2026-03-14');
  assert.equal(sheet.parseDate('14/03/2026', fmt).value, '2026-03-14');
  assert.equal(sheet.parseDate('2026-03-14', fmt).value, '2026-03-14');
  assert.match(sheet.parseDate('mañana', fmt).error, /no reconocida/);
});

test('omite filas vacías y reporta filas incompletas sin inventar valores', () => {
  const extra = [
    ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [99, 'OSVALDO', 'TEPIC', 'X', '', '', '', 'Sin fecha', 1000, 0, 0, 0, '', 0, 0, 'SI', '', '', '', ''],
    [100, 'OSVALDO', 'TEPIC', 'X', fx.toDate('2026-03-30'), '', '', 'Monto raro', 'N/A', 0, 0, 0, '', 0, 0, 'SI', '', '', '', '']
  ];
  const p = fx.payload(sheet, null, { agenda: fx.agendaValues({ extraRows: extra }) });
  assert.equal(p.events.length, 9); // 8 eventos válidos + el del monto raro (con total null)
  const raro = p.events.find((e) => e.client === 'Monto raro');
  assert.equal(raro.total, null);
  assert.ok(p.issues.some((i) => i.field === 'FECHA' && /sin fecha/.test(i.message)));
  assert.ok(p.issues.some((i) => i.field === 'TOTAL EVENTO' && /no es un monto/.test(i.message)));
});

test('conserva la categoría tal cual (con espacios) para respetar el SUMIFS del archivo', () => {
  const p = fx.payload(sheet);
  assert.ok(p.expenses.some((x) => x.category === 'PUBLICIDAD '));
  assert.equal(p.expenses.length, 9);
});

test('falla con un mensaje claro si faltan encabezados obligatorios', () => {
  const values = fx.agendaValues();
  values[11] = values[11].map((h) => (h === 'TOTAL EVENTO' ? 'TOTAL' : h));
  assert.throws(() => fx.payload(sheet, null, { agenda: values }), /TOTAL EVENTO.*AGENDA Y VENTAS/);
});

test('si falta la hoja ANALISIS, sigue funcionando y lo informa', () => {
  const p = fx.payload(sheet, null, { analysis: null });
  assert.equal(p.analysis, null);
  assert.match(p.analysisError, /ANALISIS/);
  assert.equal(p.events.length, 8);
});

test('describe de qué columna sale cada campo', () => {
  const p = fx.payload(sheet);
  assert.equal(p.sources.agenda.headerRow, 12);
  assert.equal(p.sources.agenda.columns.total.column, 'I');
  assert.equal(p.sources.agenda.columns.djPay.column, 'L');
  assert.equal(p.sources.expenses.columns.total.column, 'H');
  assert.equal(sheet.columnLetter(27), 'AB');
});
