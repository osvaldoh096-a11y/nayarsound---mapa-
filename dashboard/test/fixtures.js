// Datos SINTÉTICOS para pruebas (no son datos reales del negocio).
// Reproducen la forma de las hojas: filas de avisos arriba, encabezados en la
// fila 12 (AGENDA Y VENTAS) y 10 (STOCK OPERACION), dos columnas «DJ», etc.

const AGENDA_HEADER = ['OP', 'SONIDO DE', 'CIUDAD', 'DJ', 'FECHA', 'TIPO EVENTO', 'TOT.HORAS', 'CLIENTE',
  'TOTAL EVENTO', 'ANTICIPO', 'GAS A COBRAR', 'DJ ', 'GANANCIA', 'GANANCIA 2', 'ENTREGAR A OSVALDO',
  'REALIZADO', 'DIA', 'MES', 'PAGADO', 'PAGO'];

// [sonido, ciudad, dj, fecha, tipo, cliente, total, anticipo, gas, pagoDj, ganancia2, entregar, realizado, pagado]
const EVENTS = [
  ['OSVALDO', 'GUADALAJARA', 'DJ UNO', '2025-10-10', 'XV', 'Cliente Uno', 3000, 300, 100, 1200, 1800, 1500, 'SI', 'PAGADO'],
  ['OSVALDO', 'GUADALAJARA', 'DJ DOS', '2026-03-14', 'BODA', 'Cliente Dos', '$3,000.00', 100, 200, 1300, 1900, 1800, 'SI', 'PAGADO'],
  ['JORGE', 'TEPIC', 'DJ TRES', '2026-03-21', 'INFANTIL', 'Cliente Tres', 2500, 100, '', 1000, 750, 650, 'SI', 'PAGADO'],
  ['OSVALDO', 'TEPIC', 'DJ CUATRO', '2026-03-28', 'XV', 'Cliente Cuatro', 2600, 100, 50, 900, 1750, 1650, 'SI', 'PAGADO'],
  ['OSVALDO', 'LEON', 'DJ CINCO', '2026-04-02', 'BODA', 'Cliente Cinco', 2000, 100, '', 1000, 1000, 900, 'SI', 'DEUDOR'],
  ['OSVALDO', 'GUADALAJARA', 'BUSCAR', '2026-11-07', 'XV', 'Cliente Seis', 3500, 500, 150, '', 0, '', 'NO', ''],
  ['PAUL', 'TEPIC', '', '2026-11-14', 'POSADA', 'Cliente Siete', 2500, '', '', '', 0, '', 'NO', ''],
  // Mismo evento que la fila 2: posible duplicado (se conserva).
  ['OSVALDO', 'GUADALAJARA', 'DJ DOS', '2026-03-14', 'BODA', 'Cliente Dos', 3000, 100, 200, 1300, 1900, 1800, 'SI', 'PAGADO']
];

const EXPENSE_HEADER = ['OP.', 'FECHA DE COMPRA', 'DUEÑO', 'CIUDAD', 'STOCK/ OPERACION', 'PRODUCTO', 'TOTAL', 'STATUS', 'PRECIO VENTA', 'AUX'];
// [fecha, dueño, ciudad, categoría, producto, total, status, precioVenta]
const EXPENSES = [
  ['2026-03-05', 'OSVALDO', 'GUADALAJARA', 'PUBLICIDAD', 'ADS', 500, 'ACTIVO', ''],
  ['2026-03-06', 'OSVALDO', 'TEPIC', 'PUBLICIDAD ', 'ADS', 300, 'ACTIVO', ''],
  ['2026-02-10', 'OSVALDO', 'LEON', 'PUBLICIDAD', 'ADS', 200, 'ACTIVO', ''],
  ['2026-03-20', 'JORGE', 'TEPIC', 'AT. CLIENTE', 'PAGO AMAL', 100, 'ACTIVO', ''],
  ['2026-04-01', 'OSVALDO', 'LEON', 'OPERACION', 'MANTENIMIENTO', 80, 'ACTIVO', ''],
  ['2026-01-15', 'OSVALDO', 'GUADALAJARA', 'STOCK', 'BOCINA', 10000, 'ACTIVO', ''],
  ['2026-02-01', 'JORGE', 'TEPIC', 'STOCK', 'CABINA', 4000, 'ACTIVO', ''],
  ['2025-12-01', 'OSVALDO', 'GUADALAJARA', 'STOCK', 'MICRO', 1000, 'VENDIDO', 600],
  ['2026-04-03', 'OSVALDO', 'LEON', 'publicidad', 'ADS', 150, 'ACTIVO', '']
];

// Lo que la hoja ANALISIS mostraría para estos datos (calculado a mano).
const ANALYSIS_HEADER = ['CIUDAD', 'MES', 'MES CON FECHA', 'EVENTOS REALIZADOS', 'GENERADO', 'DJ', 'ADS', 'OPERACION',
  'AT CLIENTE', 'GANANCIA OPERATIVA', 'MARGEN DEL NEGOCIO', 'GANANCIA POR EVENTO', 'GAN. OPERATIVA PERSONAL'];
const ANALYSIS = [
  ['GUADALAJARA', 'OCTUBRE 2025', '2025-10-01', 1, 3000, 1200, '', '', '', 1800, '', '', 900],
  ['GUADALAJARA', 'MARZO 2026', '2026-03-01', 2, 6400, 2600, 500, '', '', 3300, '', '', 3300],
  ['TEPIC', 'MARZO 2026', '2026-03-01', 2, 5100, 1900, '', '', 100, 3100, '', '', 2425],
  ['LEON', 'ABRIL 2026', '2026-04-01', 1, 2000, 1000, 150, 80, '', 770, '', '', 770],
  ['GUADALAJARA', 'NOVIEMBRE 2026', '2026-11-01', 0, '', '', '', '', '', '', '', '', ''],
  ['TEPIC', 'NOVIEMBRE 2026', '2026-11-01', 0, '', '', '', '', '', '', '', '', '']
];

const EXPECTED_ALL = {
  realizedCount: 6,
  upcomingCount: 2,
  revenue: 16500,
  djCost: 6700,
  ads: 650,
  operacion: 80,
  atCliente: 100,
  operating: 8970,
  personal: 7395,
  saldo: 5650,
  djOwed: 900,
  adsExcluded: 500
};

function toDate(iso) {
  return new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
}

// Arriba de los encabezados, como en la hoja real: avisos y resúmenes de texto
// intercalados con filas vacías (Google puede omitir esas filas vacías).
function topRows(width, cells) {
  const rows = [];
  for (let i = 0; i < cells.length; i++) {
    const row = new Array(width).fill('');
    (cells[i] || []).forEach(([c, v]) => { row[c] = v; });
    rows.push(row);
  }
  return rows;
}

function agendaValues(options) {
  const opts = options || {};
  const rows = topRows(AGENDA_HEADER.length, [
    [[8, 'RESUMEN DE PAGOS']], [[3, 'AMAL'], [4, 'TEPIC'], [5, 'GUADALAJARA']], [[3, 'Texto de resumen']],
    [[4, 'Texto']], [[5, 'Texto']], [[5, 'Texto']], [[5, 'Texto']], [[5, 'Texto']], [],
    [[3, 'HAY 1 VACIO ❌']], [[4, '✅ Fechas en orden'], [11, '✅ EN ORDEN'], [18, '❌ FALTAN 3 DE PAGAR']]
  ]);
  rows.push(AGENDA_HEADER.slice());
  EVENTS.forEach((e, i) => {
    const [sonido, city, dj, date, type, client, total, anticipo, gas, djPay, g2, entregar, realizado, pagado] = e;
    rows.push([i + 1, sonido, city, dj, toDate(date), type, 5, client, total, anticipo, gas, djPay,
      '', g2, entregar, realizado, '', '', pagado, pagado === 'PAGADO' ? 'SI' : '']);
    if (i === 3) rows.push(new Array(AGENDA_HEADER.length).fill('')); // fila vacía intermedia
  });
  if (opts.extraRows) opts.extraRows.forEach((r) => rows.push(r));
  return rows;
}

function expenseValues() {
  const rows = topRows(EXPENSE_HEADER.length + 1, [
    [[1, 'REGISTRO STOCK Y OPERACIONES']], [], [[3, 'JORGE'], [4, 'PAUL'], [5, 'OTROS']],
    [[1, '% PUBLICIDAD TEPIC'], [3, 'Resumen de publicidad']], [],
    [[1, 'MES'], [2, '26 sep 2026 – 26 oct 2026'], [7, 'MES']], [[1, 'TOTAL A PAGAR'], [2, 6616], [7, 'TOTAL A PAGAR'], [8, 3000]],
    [], []
  ]);
  rows.push([''].concat(EXPENSE_HEADER));
  EXPENSES.forEach((x, i) => {
    const [date, owner, city, category, product, total, status, sale] = x;
    rows.push(['', i + 1, toDate(date), owner, city, category, product, total, status, sale, '']);
  });
  return rows;
}

function analysisValues() {
  return [ANALYSIS_HEADER.slice()].concat(ANALYSIS.map((r) => {
    const row = r.slice();
    row[2] = toDate(row[2]);
    return row;
  }));
}

const formatDate = (d) => d.toISOString().slice(0, 10);

function payload(sheet, today, overrides) {
  const o = overrides || {};
  const p = sheet.buildPayload({
    agenda: { name: 'AGENDA Y VENTAS', values: o.agenda || agendaValues() },
    expenses: { name: 'STOCK OPERACION', values: o.expenses || expenseValues() },
    analysis: o.analysis === null ? null : { name: 'ANALISIS', values: o.analysis || analysisValues() }
  }, formatDate);
  p.today = today || '2026-03-25';
  p.generatedAt = '2026-03-25T18:30:00.000Z';
  p.spreadsheetName = 'Hoja de prueba (datos sintéticos)';
  return p;
}

module.exports = {
  AGENDA_HEADER, EXPENSE_HEADER, ANALYSIS_HEADER, EXPECTED_ALL,
  agendaValues, expenseValues, analysisValues, payload, formatDate, toDate
};
