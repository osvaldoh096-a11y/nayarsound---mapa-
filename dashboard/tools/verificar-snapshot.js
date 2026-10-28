#!/usr/bin/env node
// Verifica el dashboard contra una copia de la hoja descargada con la API de
// Google Sheets (spreadsheets.get con includeGridData y effectiveValue).
//
// Uso: node dashboard/tools/verificar-snapshot.js <snapshot.json> [--hoy AAAA-MM-DD]
//
// Solo imprime totales agregados (sin clientes ni teléfonos). Guarda el
// snapshot FUERA del repositorio: contiene datos privados.
const { loadSheet, loadCore } = require('../test/load');
const { payloadFromSnapshot } = require('./snapshot');

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--hoy');
if (!file) {
  console.error('Uso: node dashboard/tools/verificar-snapshot.js <snapshot.json> [--hoy AAAA-MM-DD]');
  process.exit(2);
}
const hoyIdx = args.indexOf('--hoy');
const today = hoyIdx !== -1 ? args[hoyIdx + 1]
  : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());

const sheet = loadSheet();
const core = loadCore();
const { payload, snap } = payloadFromSnapshot(sheet, file, today);
const model = core.prepare(payload);
const money = (v) => core.formatMoney(v, 2);
let failures = 0;
const mark = (ok) => {
  if (ok === false) failures++;
  return ok === null ? '·' : ok ? '✓' : '✗';
};

console.log(`Hoy: ${today} · eventos leídos: ${model.events.length} · gastos leídos: ${model.expenses.length} · problemas de lectura: ${payload.issues.length}`);
payload.issues.slice(0, 10).forEach((i) => console.log(`  ${i.sheet} fila ${i.row} · ${i.field}: ${i.message}`));

// 1) Celda por celda contra ANALISIS (ciudad × mes × indicador).
const v = core.verify(model);
if (!v.available) {
  console.log('ANALISIS no disponible:', v.reason);
} else {
  console.log(`\nANALISIS: ${v.rowCount} filas ciudad/mes · ${v.checks} comparaciones · diferencias: ${v.mismatches.length}`);
  failures += v.mismatches.length;
  v.mismatches.slice(0, 20).forEach((m) => console.log(`  ✗ ${m.city} ${m.month} ${m.field.label}: dashboard ${m.mine} · archivo ${m.file}`));
  v.totals.forEach((t) => console.log(`  ${mark(t.ok)} ${t.field.label.padEnd(20)} dashboard ${String(t.field.count ? t.mine : money(t.mine)).padStart(16)} · archivo ${String(t.field.count ? t.file : money(t.file)).padStart(16)}`));
}

// 2) Global histórico y cada ciudad contra DATA!AP4:AU9 («INDICADOR ROA POR CIUDAD»).
const data = snap.sheetValues('DATA');
if (data) {
  const roa = {};
  data.values.forEach((row) => {
    const i = row.findIndex((c, j) => typeof c === 'string' && c.trim() && typeof row[j + 1] === 'number' && typeof row[j + 5] === 'number');
    if (i !== -1) roa[row[i].trim()] = { ads: row[i + 1], vendido: row[i + 2], neto: row[i + 3], vende: row[i + 4], netoX: row[i + 5] };
  });
  const check = (label, mine, file, fmt) => {
    const ok = file === undefined ? null : Math.abs(mine - file) < 0.0001 * Math.max(1, Math.abs(file));
    console.log(`  ${mark(ok)} ${label.padEnd(34)} dashboard ${fmt(mine).padStart(16)} · archivo ${file === undefined ? '—' : fmt(file).padStart(16)}`);
  };
  Object.keys(roa).forEach((label) => {
    const city = label === 'TOTAL' ? 'ALL' : sheet.cityKey(label);
    const file = roa[label];
    const s = core.summarize(model, { city, period: { type: 'all' } }).totals;
    console.log(`\nDATA!AP:AU · ${label} (histórico)`);
    check('Publicidad', s.ads, file.ads, money);
    check('Vendido (ingresos generados)', s.revenue, file.vendido, money);
    check('Neto (ganancia operativa)', s.operating, file.neto, money);
    check('Ventas por cada $1 de publicidad', s.salesPerAd, file.vende, (x) => x.toFixed(4));
    check('Ganancia por cada $1 de publicidad', s.profitPerAd, file.netoX, (x) => x.toFixed(4));
  });
}

// 3) Indicadores de DASHBOARD (selector GLOBAL/GLOBAL).
const dash = snap.sheetValues('DASHBOARD');
if (dash) {
  const s = core.summarize(model, { city: 'ALL', period: { type: 'all' } }).totals;
  const find = (label) => {
    for (const row of dash.values) {
      const i = row.findIndex((c) => typeof c === 'string' && c.trim() === label);
      if (i !== -1) return row[i + 1];
    }
    return undefined;
  };
  const parse = (x) => (typeof x === 'number' ? x : x === undefined ? undefined : parseFloat(String(x).replace(/[$,]/g, '')));
  console.log('\nDASHBOARD (selector GLOBAL / GLOBAL)');
  [['GENERADO', s.revenue], ['PAGADO A DJS', s.djCost], ['PUBLICIDAD', s.ads],
    ['OPERACION Y AT CLIENTE', s.operacion + s.atCliente], ['GANANCIA TOTAL OPERATIVA', s.operating],
    ['GANANCIA NETA MENSUAL PER.', s.personal]].forEach(([label, mine]) => {
    const file = parse(find(label));
    // El archivo redondea a pesos algunos montos que muestra como texto («$12,345 (40%)»).
    const ok = file === undefined || isNaN(file) ? null : Math.abs(mine - file) < 1;
    console.log(`  ${mark(ok)} ${label.padEnd(28)} dashboard ${money(mine).padStart(16)} · archivo ${file === undefined ? '—' : money(file).padStart(16)}`);
  });
  const title = dash.values.map((r) => r.find((c) => typeof c === 'string' && /EVENTOS REALIZADOS/.test(c))).find(Boolean);
  const fileCount = title ? parseInt(title, 10) : undefined;
  console.log(`  ${mark(fileCount === undefined ? null : fileCount === s.realizedCount)} ${'EVENTOS REALIZADOS'.padEnd(28)} dashboard ${String(s.realizedCount).padStart(16)} · archivo ${fileCount === undefined ? '—' : String(fileCount).padStart(16)}`);
}

// 4) Registros que el archivo no suma.
const excluded = model.expenses.filter((x) => x.excludedReason);
console.log(`\nGastos que las fórmulas del archivo no suman: ${excluded.length}`);
excluded.forEach((x) => console.log(`  fila ${x.row} · ${x.date} · ${x.city} · ${money(x.total)} · ${x.excludedReason}`));
console.log(`Posibles duplicados (no se eliminan): ${core.possibleDuplicates(model).length} grupos`);
console.log(failures ? `\n✗ ${failures} diferencias` : '\n✓ Sin diferencias');
process.exit(failures ? 1 : 0);
