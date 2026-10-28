const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSheet, loadCore } = require('./load');
const fx = require('./fixtures');

const sheet = loadSheet();
const core = loadCore();

function model(today, overrides) {
  return core.prepare(fx.payload(sheet, today, overrides));
}
const ALL = { city: 'ALL', period: { type: 'all' } };
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} ≠ ${b}`);
// Los objetos creados dentro del sandbox vm tienen otro prototipo: se comparan como JSON.
const plain = (x) => JSON.parse(JSON.stringify(x));

test('totales históricos con las reglas del archivo', () => {
  const t = core.summarize(model(), ALL).totals;
  for (const [k, v] of Object.entries(fx.EXPECTED_ALL)) close(t[k], v);
  close(t.salesPerAd, 16500 / 650);
  close(t.profitPerAd, 8970 / 650);
});

test('gasolina como ingreso solo en Guadalajara desde febrero 2026 (ANALISIS!E)', () => {
  const m = model();
  const oct = m.events.find((e) => e.date === '2025-10-10');
  const mar = m.events.find((e) => e.date === '2026-03-14');
  const tepic = m.events.find((e) => e.date === '2026-03-28');
  assert.equal(oct.revenue, 3000);
  assert.equal(mar.revenue, 3200);
  assert.equal(tepic.revenue, 2600);
});

test('reparto personal por ciudad y mes (ANALISIS!M), incluido el bono de sonido propio en Tepic', () => {
  const m = model();
  assert.equal(m.events.find((e) => e.date === '2025-10-10').personal, 900);
  assert.equal(m.events.find((e) => e.date === '2026-03-21').personal, 750);
  assert.equal(m.events.find((e) => e.date === '2026-03-28').personal, 1725);
  assert.equal(core.personalFactor('LEON', '2026-04'), 1);
});

test('gastos que el archivo no suma quedan fuera, con su motivo', () => {
  const m = model();
  const spaced = m.expenses.find((x) => x.category === 'PUBLICIDAD ');
  const leon = m.expenses.find((x) => x.date === '2026-02-10');
  const lower = m.expenses.find((x) => x.category === 'publicidad');
  assert.equal(spaced.counted, false);
  assert.match(spaced.excludedReason, /espacios/);
  assert.equal(leon.counted, false);
  assert.match(leon.excludedReason, /No hay eventos de León/);
  assert.equal(lower.counted, true); // SUMIFS no distingue mayúsculas
});

test('coincide celda por celda con la hoja ANALISIS', () => {
  const v = core.verify(model());
  assert.equal(v.available, true);
  assert.equal(v.mismatches.length, 0);
  assert.equal(v.checks, 6 * 8);
  assert.ok(v.totals.every((t) => t.ok));
});

test('detecta diferencias con ANALISIS', () => {
  const values = fx.analysisValues();
  values[2][4] = 6000; // GENERADO de Guadalajara, marzo 2026
  const v = core.verify(model(null, { analysis: values }));
  assert.equal(v.mismatches.length, 1);
  assert.equal(v.mismatches[0].field.key, 'generado');
  assert.equal(v.mismatches[0].city, 'GUADALAJARA');
});

test('filtros coherentes: la suma por ciudad y por periodo da el total', () => {
  const m = model();
  for (const period of [{ type: 'all' }, { type: 'year' }, { type: 'month' }, { type: 'custom', from: '2026-03-01', to: '2026-04-30' }]) {
    const s = core.summarize(m, { city: 'ALL', period });
    for (const key of ['revenue', 'djCost', 'ads', 'operacion', 'atCliente', 'operating', 'personal', 'saldo', 'realizedCount', 'upcomingCount']) {
      close(s.byCity.reduce((a, c) => a + c[key], 0), s.totals[key]);
      close(s.buckets.list.reduce((a, b) => a + b.totals[key], 0), s.totals[key]);
    }
  }
});

test('filtro de ciudad y periodo personalizado', () => {
  const m = model();
  const s = core.summarize(m, { city: 'TEPIC', period: { type: 'custom', from: '2026-03-01', to: '2026-03-31' } });
  close(s.totals.revenue, 5100);
  close(s.totals.personal, 2425);
  assert.deepEqual(plain(s.byCity.map((c) => c.city.key)), ['TEPIC']);
  assert.ok(s.events.every((e) => e.city === 'TEPIC'));
});

test('mes actual agrupa por semana; año actual por mes', () => {
  const m = model('2026-03-25');
  const month = core.summarize(m, { city: 'ALL', period: { type: 'month' } });
  assert.equal(month.range.from, '2026-03-01');
  assert.equal(month.range.to, '2026-03-31');
  assert.equal(month.buckets.granularity, 'week');
  const year = core.summarize(m, { city: 'ALL', period: { type: 'year' } });
  assert.equal(year.buckets.granularity, 'month');
  assert.equal(year.buckets.list.length, 12);
  assert.ok(year.buckets.list.find((b) => b.key === '2026-04').isFuture);
  assert.ok(year.buckets.list.find((b) => b.key === '2026-03').isCurrent);
});

test('rango personalizado inválido no produce números', () => {
  const m = model();
  const bad = core.summarize(m, { city: 'ALL', period: { type: 'custom', from: '2026-05-01', to: '2026-04-01' } });
  assert.match(bad.range.error, /posterior/);
  assert.equal(bad.events.length, 0);
  const empty = core.periodRange({ type: 'custom', from: '', to: '' }, '2026-03-25');
  assert.match(empty.error, /Elige/);
});

test('«No disponible» cuando no hay publicidad (divisor en cero)', () => {
  const s = core.summarize(model(), { city: 'GUADALAJARA', period: { type: 'custom', from: '2025-10-01', to: '2025-10-31' } });
  assert.equal(s.totals.ads, 0);
  assert.equal(s.totals.salesPerAd, null);
  assert.equal(core.formatRatio(s.totals.salesPerAd), 'No disponible');
  assert.equal(core.formatMoney(null), 'No disponible');
});

test('ciudades detectadas de los datos, en orden de aparición y con color estable', () => {
  const m = model();
  // Por fecha del primer evento: Guadalajara (oct 2025), Tepic (mar 2026), León (abr 2026).
  assert.deepEqual(plain(m.cities.map((c) => c.key)), ['GUADALAJARA', 'TEPIC', 'LEON']);
  assert.deepEqual(plain(m.cities.map((c) => c.slot)), [1, 2, 3]);
  assert.equal(m.cities[2].name, 'León');
  // Una ciudad que solo tiene gastos va al final aunque su gasto sea más antiguo.
  const expenses = fx.expenseValues();
  expenses.push(['', 99, fx.toDate('2025-01-05'), 'OSVALDO', 'QUERETARO', 'PUBLICIDAD', 'ADS', 90, 'ACTIVO', '', '']);
  const m2 = model(null, { expenses });
  assert.deepEqual(plain(m2.cities.map((c) => c.key)), ['GUADALAJARA', 'TEPIC', 'LEON', 'QUERETARO']);
  assert.equal(m2.cities[3].name, 'Querétaro');
});

test('recordatorios con las condiciones del archivo', () => {
  const r = core.reminders(model('2026-11-05'), ALL);
  const byId = Object.fromEntries(r.map((x) => [x.id, x]));
  assert.equal(byId.djOwed.events.length, 1);
  assert.equal(byId.noDj.events.length, 2); // «BUSCAR» y vacío
  assert.equal(byId.soon.events.length, 1); // 7 nov dentro de hoy + 3 días
  assert.deepEqual(plain(byId.atCliente.months), ['2025-10', '2026-04']);
});

test('posibles duplicados se reportan pero no se eliminan', () => {
  const m = model();
  const d = core.possibleDuplicates(m);
  assert.equal(d.length, 1);
  assert.equal(d[0].length, 2);
  assert.equal(core.summarize(m, ALL).totals.realizedCount, 6);
});

test('inversión en equipo con la regla de STOCK OPERACION!V6', () => {
  const eq = core.equipment(model(), ALL);
  assert.equal(eq.total, 15000);
  assert.equal(eq.osvaldoNet, 11000 - 600);
  assert.equal(eq.osvaldoWithPartners, 10400 + 4000 / 2);
});

test('formato en pesos mexicanos y fechas en español', () => {
  assert.equal(core.formatMoney(1234567), '$1,234,567');
  assert.equal(core.formatMoney(-755.54, 2), '-$755.54');
  assert.equal(core.formatDate('2026-10-31'), '31 oct 2026');
  assert.equal(core.formatDateWeekday('2026-10-31'), 'sáb 31 oct 2026');
  assert.equal(core.monthLabel('2026-02', true), 'febrero 2026');
});
