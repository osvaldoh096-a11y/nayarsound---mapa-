#!/usr/bin/env node
// Prueba de la interfaz en Chromium (Playwright) con datos sintéticos.
// Uso: node dashboard/test/ui.check.js [--capturas <carpeta>]
// Requiere Playwright instalado (no es dependencia del proyecto).
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const shotsDir = args.includes('--capturas') ? args[args.indexOf('--capturas') + 1] : null;
const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ns-ui-')), 'preview.html');
execFileSync(process.execPath, [path.join(__dirname, '..', 'tools', 'preview.js'), '--salida', file, '--hoy', '2026-03-25']);
const url = 'file://' + file;

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

async function run() {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|net::ERR/.test(m.text())) errors.push(m.text()); });

  console.log('Escritorio · datos sintéticos (hoy = 25 mar 2026)');
  await page.goto(url);
  await page.waitForSelector('.kpi');
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

  const bar = page.locator('#tab-resumen .card', { hasText: 'Ganancia por ciudad' }).locator('g.bar-row').first();
  await bar.click();
  check(!(await page.locator('#drawer').isHidden()), 'Las barras abren el desglose de la ciudad');
  await page.keyboard.press('Escape');

  for (const tab of ['analisis', 'operacion', 'fuentes']) {
    await page.click(`#tab-btn-${tab}`);
    check(!(await page.locator(`#tab-${tab}`).isHidden()) && (await page.locator(`#tab-${tab} .card`).count()) > 0, `Pestaña ${tab} con contenido`);
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `escritorio-${tab}.png`), fullPage: true });
  }
  check(/Coincide con la hoja ANALISIS/.test(await page.locator('#tab-fuentes').innerText()), 'Verificación contra ANALISIS: coincide');
  check(/PUBLICIDAD /.test(await page.locator('#tab-fuentes').innerText()), 'Lista los gastos que el archivo no suma');

  await page.click('#themeBtn');
  check((await page.getAttribute('html', 'data-theme')) === 'light', 'Cambio a tema claro');
  await page.click('#tab-btn-resumen');
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'escritorio-claro.png'), fullPage: true });
  await page.click('#themeBtn');

  console.log('Errores de conexión');
  const p2 = await ctx.newPage();
  p2.on('pageerror', (e) => errors.push(e.message));
  await p2.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p2.goto(url + '#fallo');
  await p2.waitForSelector('#state h2:has-text("No se pudieron cargar")');
  check(await p2.locator('.kpi').count() === 0, 'Error inicial: no muestra indicadores en cero');
  check(/Sin conexión/.test(await p2.locator('#syncStatus').innerText()), 'Error inicial: estado de conexión claro');
  if (shotsDir) await p2.screenshot({ path: path.join(shotsDir, 'error-inicial.png') });

  const p3 = await ctx.newPage();
  await p3.goto(url + '#fallo-despues');
  await p3.waitForSelector('.kpi');
  await p3.click('#refreshBtn');
  await p3.waitForSelector('#banner:not([hidden])');
  check(/no datos actuales/.test(await p3.locator('#banner').innerText()), 'Falla al actualizar: los datos se marcan como no actuales');
  check(/Sin actualizar desde/.test(await p3.locator('#syncStatus').innerText()), 'Falla al actualizar: muestra desde cuándo no se actualiza');
  if (shotsDir) await p3.screenshot({ path: path.join(shotsDir, 'error-actualizar.png') });

  console.log('Celular (390 × 844)');
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pm = await mobile.newPage();
  pm.on('pageerror', (e) => errors.push(e.message));
  await pm.goto(url);
  await pm.waitForSelector('.kpi');
  for (const tab of ['resumen', 'analisis', 'operacion', 'fuentes']) {
    await pm.click(`#tab-btn-${tab}`);
    const overflow = await pm.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `Sin desplazamiento horizontal de la página en ${tab} (${overflow}px)`);
    if (shotsDir) await pm.screenshot({ path: path.join(shotsDir, `celular-${tab}.png`), fullPage: true });
  }

  check(errors.length === 0, 'Sin errores de JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(failures ? `\n✗ ${failures} fallas` : '\n✓ Interfaz verificada');
  process.exit(failures ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
