#!/usr/bin/env node
// Prueba de la interfaz en Chromium (Playwright) con la página real
// (dashboard/index.html) y Google Sheets simulado (tools/gviz-sim.js).
//
// Uso:
//   node dashboard/test/ui.check.js [--capturas <carpeta>]
//   node dashboard/test/ui.check.js --snapshot <snapshot.json> --hoy AAAA-MM-DD [--capturas <carpeta>]
//
// Con --snapshot compara los números de la pantalla contra los calculados con
// la misma copia de la hoja (guárdala FUERA del repositorio).
// Requiere Playwright instalado (no es dependencia del proyecto).
const path = require('path');
const { chromium } = require('playwright');
const gvizSim = require('../tools/gviz-sim');
const fx = require('./fixtures');
const { loadSheet, loadCore } = require('./load');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const shotsDir = opt('--capturas');
const snapshotFile = opt('--snapshot');
const PAGE = 'file://' + path.join(__dirname, '..', 'index.html');
const SHEET_ID = 'HojaDePruebaSintetica_0123456789';

let failures = 0;
function check(ok, label) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + label);
  if (!ok) failures++;
}
function tile(page, label) {
  return page.locator('.kpi', { has: page.locator('.kpi-label', { hasText: new RegExp('^' + label + '$') }) });
}
async function kpi(page, label) {
  return tile(page, label).locator('.kpi-value').innerText();
}

// Libro simulado. En la prueba de interfaz los montos van como números (en la
// hoja real así llegan); las pruebas unitarias cubren montos escritos como texto.
function fixtureWorkbook() {
  const numeric = (rows) => rows.map((r) => r.map((c) => (typeof c === 'string' && /^\$[\d,]+(\.\d+)?$/.test(c) ? parseFloat(c.replace(/[$,]/g, '')) : c)));
  return {
    'AGENDA Y VENTAS': numeric(fx.agendaValues()),
    'STOCK OPERACION': fx.expenseValues(),
    ANALISIS: fx.analysisValues()
  };
}
function snapshotWorkbook(file) {
  const snap = require('../tools/snapshot').readSnapshot(file);
  const out = {};
  ['AGENDA Y VENTAS', 'STOCK OPERACION', 'ANALISIS'].forEach((t) => { out[t] = gvizSim.markDates(snap.sheetValues(t).values); });
  return out;
}

async function newPage(browser, workbook, today, options) {
  const o = options || {};
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 1366, height: 900 }, isMobile: !!o.mobile, hasTouch: !!o.mobile, deviceScaleFactor: o.mobile ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|net::ERR/.test(m.text())) errors.push(m.text()); });
  const state = { mode: 'ok', requests: 0, strictColumns: !!o.strictColumns };
  const testConfig = "var NS_CONFIG = { spreadsheetId: '', mapUrl: '../', timezone: 'America/Mexico_City' };";
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.endsWith('/js/config.js') && !o.realConfig) return route.fulfill({ contentType: 'application/javascript', body: testConfig });
    if (url.startsWith('file://')) return route.continue();
    if (url.includes('/gviz/tq')) {
      state.requests++;
      if (state.mode === 'fail') return route.abort();
      return route.fulfill({ contentType: 'application/javascript', body: gvizSim.respond(workbook, url, { strictColumns: state.strictColumns }) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await page.clock.setFixedTime(new Date(today + 'T12:00:00-06:00'));
  return { page, ctx, errors, state };
}

async function runFixture(browser) {
  const workbook = fixtureWorkbook();
  const allErrors = [];

  console.log('Primera visita sin hoja guardada');
  {
    const { page, errors } = await newPage(browser, workbook, '2026-03-25');
    await page.goto(PAGE);
    await page.waitForSelector('#sheetInput');
    check(await page.locator('.kpi').count() === 0, 'Sin hoja: pide el enlace y no muestra números');
    await page.fill('#sheetInput', 'hola');
    await page.click('.sheet-form button[type=submit]');
    check(/enlace completo/.test(await page.locator('.sheet-form .detail').innerText()), 'Enlace inválido: mensaje claro');
    await page.fill('#sheetInput', 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/edit#gid=0');
    await page.click('.sheet-form button[type=submit]');
    await page.waitForSelector('.kpi');
    check(await kpi(page, 'Ingresos generados') === '$13,500', 'Con el enlace pegado carga el dashboard');
    allErrors.push(...errors);
  }

  console.log('Configuración publicada (config.js con la hoja)');
  {
    const c = await newPage(browser, workbook, '2026-03-25', { realConfig: true });
    await c.page.goto(PAGE);
    await c.page.waitForSelector('.kpi');
    check(await kpi(c.page, 'Ingresos generados') === '$13,500', 'Abre directo, sin pedir el enlace');
    allErrors.push(...c.errors); // después se sale del dashboard (a la carpeta del mapa)
    await c.page.click('#siteNav a[data-page="djs"]');
    await c.page.waitForURL((u) => !u.pathname.includes('/dashboard/'));
    check(await c.page.evaluate(() => localStorage.getItem('nayarCurrentPage')) === 'djs', 'DJS abre el mapa en su página DJS');
  }

  console.log('Escritorio · enlace con #hoja= (hoy = 25 mar 2026)');
  const { page, errors, state } = await newPage(browser, workbook, '2026-03-25');
  await page.goto(PAGE + '#hoja=' + SHEET_ID);
  await page.waitForSelector('.kpi');
  check(!page.url().includes('hoja='), 'El ID de la hoja se quita de la dirección');
  check(await page.locator('.kpi').count() === 6, '6 tarjetas principales');
  check(await kpi(page, 'Ingresos generados') === '$13,500', 'Año actual: ingresos $13,500');
  check(await kpi(page, 'Ganancia personal') === '$6,495', 'Año actual: ganancia personal $6,495');
  check(await kpi(page, 'Saldo por cobrar') === '$5,650', 'Año actual: saldo por cobrar $5,650');
  check(await kpi(page, 'Gasto en publicidad') === '$650', 'Año actual: publicidad $650');
  check(await page.locator('.history').count() === 1, 'Franja de resultados históricos visible fuera de «Histórico»');
  check(await page.locator('#tab-resumen .card').count() === 4, '4 gráficas en la vista inicial');
  check(await page.locator('#tab-resumen svg.chart-svg').count() === 4, 'Las 4 gráficas se dibujan');
  check(/Actualizado: /.test(await page.locator('#syncStatus').innerText()), 'Muestra la hora de la última actualización');
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'escritorio-resumen.png'), fullPage: true });

  await page.click('#cityFilter button[data-city="TEPIC"]');
  check(await kpi(page, 'Ingresos generados') === '$5,100', 'Filtro Tepic: ingresos $5,100');
  check(await kpi(page, 'Ganancia personal') === '$2,425', 'Filtro Tepic: ganancia personal (con bono de sonido propio) $2,425');
  const legend = await page.locator('#tab-resumen .legend').allInnerTexts();
  check(legend.every((t) => !/Guadalajara/.test(t)), 'Las gráficas respetan el filtro de ciudad');

  await page.click('#cityFilter button[data-city="ALL"]');
  await page.click('#periodFilter button[data-period="all"]');
  check(await kpi(page, 'Ingresos generados') === '$16,500', 'Histórico: ingresos $16,500');
  check(await kpi(page, 'Ganancia personal') === '$7,395', 'Histórico: ganancia personal $7,395');
  check(await page.locator('.history').count() === 0, 'En «Histórico» no se repite la franja histórica');
  check(/\$500 registrado que el archivo no suma/.test(await tile(page, 'Gasto en publicidad').innerText()), 'Avisa la publicidad que el archivo no suma');

  await page.click('#periodFilter button[data-period="month"]');
  check(/Ingresos y ganancia personal por semana/.test(await page.locator('#tab-resumen').innerText()), 'Mes actual: evolución por semana');

  await page.click('#periodFilter button[data-period="custom"]');
  await page.fill('#fromDate', '2026-05-01');
  await page.fill('#toDate', '2026-04-01');
  await page.dispatchEvent('#toDate', 'change');
  check(/posterior a la final/.test(await page.locator('#scope').innerText()), 'Rango inválido: mensaje claro');
  check(await page.locator('.kpi').count() === 0, 'Rango inválido: no muestra números');
  await page.fill('#fromDate', '2025-10-01');
  await page.fill('#toDate', '2025-10-31');
  await page.dispatchEvent('#toDate', 'change');
  check(/No disponible/.test(await tile(page, 'Gasto en publicidad').innerText()), 'Sin publicidad: «No disponible» en lugar de un cociente');

  await page.click('#periodFilter button[data-period="all"]');
  await tile(page, 'Ganancia personal').click();
  await page.waitForSelector('#drawer:not([hidden])');
  check((await page.locator('#drawerTitle').innerText()) === 'Ganancia personal', 'Las tarjetas abren su desglose');
  check(/Ganancia operativa/.test(await page.locator('#drawerBody').innerText()), 'El desglose muestra cómo se llega al resultado');
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'escritorio-desglose.png') });
  await page.keyboard.press('Escape');
  check(await page.locator('#drawer').isHidden(), 'Escape cierra el desglose');

  const card = page.locator('#tab-resumen .card', { hasText: 'Ganancia por ciudad' });
  await card.locator('button', { hasText: 'VER TABLA' }).click();
  check(await card.locator('table').count() === 1, 'Cada gráfica tiene su vista de tabla');
  await card.locator('button', { hasText: 'VER GRÁFICA' }).click();
  await card.locator('g.bar-row').first().click();
  check(!(await page.locator('#drawer').isHidden()), 'Las barras abren el desglose de la ciudad');
  await page.keyboard.press('Escape');

  for (const tab of ['analisis', 'operacion', 'fuentes']) {
    await page.click(`#tab-btn-${tab}`);
    check(!(await page.locator(`#tab-${tab}`).isHidden()) && (await page.locator(`#tab-${tab} .card`).count()) > 0, `Pestaña ${tab} con contenido`);
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `escritorio-${tab}.png`), fullPage: true });
  }
  check(/Coincide con la hoja ANALISIS/.test(await page.locator('#tab-fuentes').innerText()), 'Verificación contra ANALISIS: coincide');
  check(/PUBLICIDAD /.test(await page.locator('#tab-fuentes').innerText()), 'Lista los gastos que el archivo no suma');
  check(/fila 12/.test(await page.locator('#tab-fuentes').innerText()), 'Ubica los encabezados en la fila real de la hoja');

  await page.click('#themeBtn');
  check((await page.getAttribute('html', 'data-theme')) === 'light', 'Cambio a tema claro');
  await page.click('#tab-btn-resumen');
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'escritorio-claro.png'), fullPage: true });
  await page.click('#themeBtn');

  console.log('Errores de conexión');
  state.mode = 'fail';
  await page.click('#refreshBtn');
  await page.waitForSelector('#banner:not([hidden])');
  check(/no datos actuales/.test(await page.locator('#banner').innerText()), 'Falla al actualizar: los datos se marcan como no actuales');
  check(/Sin actualizar desde/.test(await page.locator('#syncStatus').innerText()), 'Falla al actualizar: muestra desde cuándo no se actualiza');
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'error-actualizar.png') });
  allErrors.push(...errors);

  {
    const p2 = await newPage(browser, workbook, '2026-03-25');
    p2.state.mode = 'fail';
    await p2.page.goto(PAGE + '#hoja=' + SHEET_ID);
    await p2.page.waitForSelector('#state h2:has-text("No se pudieron cargar")');
    check(await p2.page.locator('.kpi').count() === 0, 'Error inicial: no muestra indicadores en cero');
    check(/Sin conexión/.test(await p2.page.locator('#syncStatus').innerText()), 'Error inicial: estado de conexión claro');
    if (shotsDir) await p2.page.screenshot({ path: path.join(shotsDir, 'error-inicial.png') });
  }

  console.log('Google rechaza rangos más anchos que la hoja');
  {
    const s = await newPage(browser, workbook, '2026-03-25', { strictColumns: true });
    await s.page.goto(PAGE + '#hoja=' + SHEET_ID);
    await s.page.waitForSelector('.kpi');
    check(await kpi(s.page, 'Ingresos generados') === '$13,500', 'Lee la hoja con el ancho real cuando el rango ancho falla');
    allErrors.push(...s.errors);
  }

  console.log('Celular (390 × 844)');
  {
    const m = await newPage(browser, workbook, '2026-03-25', { viewport: { width: 390, height: 844 }, mobile: true });
    await m.page.goto(PAGE + '#hoja=' + SHEET_ID);
    await m.page.waitForSelector('.kpi');
    for (const tab of ['resumen', 'analisis', 'operacion', 'fuentes']) {
      await m.page.click(`#tab-btn-${tab}`);
      const overflow = await m.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(overflow <= 0, `Sin desplazamiento horizontal de la página en ${tab} (${overflow}px)`);
      if (shotsDir) await m.page.screenshot({ path: path.join(shotsDir, `celular-${tab}.png`), fullPage: true });
    }
    allErrors.push(...m.errors);
  }
  check(allErrors.length === 0, 'Sin errores de JavaScript' + (allErrors.length ? ': ' + allErrors.join(' | ') : ''));
}

async function runSnapshot(browser, file, today) {
  console.log('Copia real de la hoja (los números no se imprimen)');
  const workbook = snapshotWorkbook(file);
  const sheet = loadSheet();
  const core = loadCore();
  const model = core.prepare(require('../tools/snapshot').payloadFromSnapshot(sheet, file, today).payload);
  const { page, errors } = await newPage(browser, workbook, today);
  await page.goto(PAGE + '#hoja=' + SHEET_ID);
  await page.waitForSelector('.kpi', { timeout: 30000 });
  for (const [type, label] of [['all', 'Histórico'], ['year', 'Año actual'], ['month', 'Mes actual']]) {
    await page.click(`#periodFilter button[data-period="${type}"]`);
    const t = core.summarize(model, { city: 'ALL', period: { type } }).totals;
    check(await kpi(page, 'Ingresos generados') === core.formatMoney(t.revenue), `${label}: ingresos iguales al cálculo sobre la copia`);
    check(await kpi(page, 'Ganancia personal') === core.formatMoney(t.personal), `${label}: ganancia personal igual`);
    check(await kpi(page, 'Saldo por cobrar') === core.formatMoney(t.saldo), `${label}: saldo por cobrar igual`);
    check(await kpi(page, 'Eventos realizados') === core.formatNumber(t.realizedCount), `${label}: eventos realizados igual`);
    check(await kpi(page, 'Gasto en publicidad') === core.formatMoney(t.ads), `${label}: publicidad igual`);
  }
  for (const city of model.cities.map((c) => c.key)) {
    await page.click(`#cityFilter button[data-city="${city}"]`);
    await page.click('#periodFilter button[data-period="all"]');
    const t = core.summarize(model, { city, period: { type: 'all' } }).totals;
    check(await kpi(page, 'Ganancia personal') === core.formatMoney(t.personal), `${core.cityName(city)}: ganancia personal histórica igual`);
  }
  await page.click('#tab-btn-fuentes');
  check(/Coincide con la hoja ANALISIS/.test(await page.locator('#tab-fuentes').innerText()), 'Leída por gviz, coincide con la hoja ANALISIS');
  if (shotsDir) {
    await page.click('#cityFilter button[data-city="ALL"]');
    await page.click('#periodFilter button[data-period="year"]');
    await page.click('#tab-btn-resumen');
    await page.screenshot({ path: path.join(shotsDir, 'real-resumen.png'), fullPage: true });
  }
  check(errors.length === 0, 'Sin errores de JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
}

(async () => {
  const browser = await chromium.launch();
  try {
    if (snapshotFile) await runSnapshot(browser, snapshotFile, opt('--hoy'));
    else await runFixture(browser);
  } finally {
    await browser.close();
  }
  console.log(failures ? `\n✗ ${failures} fallas` : '\n✓ Interfaz verificada');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
