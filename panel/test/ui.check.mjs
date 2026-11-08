// Prueba de la interfaz en Chromium con el simulador de Google.
//   node panel/test/ui.check.mjs                      → datos de ejemplo (sintéticos)
//   node panel/test/ui.check.mjs --snapshot ruta.json --hoy 2026-11-07 --esperado ruta.json
// El snapshot real y las cifras esperadas se guardan FUERA del repositorio.

import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { servir, simularGoogle, datosDesdeFuentes, IDS, CLIENTE } from './simulador.mjs';
import { codificarConfig } from '../js/config.js';
import { fuentesDemo } from '../js/demo.js';
import { construirModelo } from '../js/modelo.js';
import { idxDesdeYMD } from '../js/fechas.js';
import { dinero } from '../js/formato.js';

// Playwright viene instalado de forma global; createRequire lo encuentra igual que require().
const { chromium } = createRequire(import.meta.url)('playwright');

const args = process.argv.slice(2);
const opcion = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const rutaSnapshot = opcion('--snapshot');
const hoyTexto = opcion('--hoy') ?? '2026-11-07';
const capturas = opcion('--capturas');
const [y, m, d] = hoyTexto.split('-').map(Number);
const hoy = { y, m, d, idx: idxDesdeYMD(y, m, d) };
const relojFijo = new Date(Date.UTC(y, m - 1, d, 20, 30)); // 2:30 p.m. en CDMX

let fallos = 0;
function revisar(condicion, mensaje) {
  console.log(`${condicion ? '✓' : '✗'} ${mensaje}`);
  if (!condicion) fallos += 1;
}

const datos = rutaSnapshot
  ? JSON.parse(readFileSync(rutaSnapshot, 'utf8'))
  : datosDesdeFuentes(fuentesDemo(hoy));

// Modelo esperado calculado con los mismos datos, para comparar lo que se ve.
const { ARCHIVOS } = await import('../js/fuentes.js');
const fuentesDesdeDatos = (dat) => Object.fromEntries(Object.entries(dat).map(([k, v]) => [k, {
  clave: k, id: IDS[k], meta: v.meta,
  rangos: Object.fromEntries(Object.keys(ARCHIVOS[k].rangos).map((r, i) => [r, v.valores[i] ?? []])),
}]));
const esperado = construirModelo(fuentesDesdeDatos(datos), hoy);
const extra = opcion('--esperado') ? JSON.parse(readFileSync(opcion('--esperado'), 'utf8')) : null;

const { servidor, url } = await servir();
const navegador = await chromium.launch();
const enlaceConfig = `${url}/panel/#config=${codificarConfig({ clienteId: CLIENTE, archivos: IDS })}`;

async function nuevaPagina({ ancho = 1280, alto = 900, fallas = {}, movil = false } = {}) {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto }, locale: 'es-MX', isMobile: movil, hasTouch: movil });
  const lecturas = await simularGoogle(contexto, datos, { fallas });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));
  pagina.on('console', (msg) => { if (msg.type() === 'error') errores.push(msg.text()); });
  await pagina.clock.setFixedTime(relojFijo);
  return { contexto, pagina, errores, lecturas };
}

async function entrar(pagina) {
  await pagina.goto(enlaceConfig);
  await pagina.getByRole('button', { name: 'Entrar con Google' }).click();
  await pagina.waitForSelector('.rejilla-resumen');
}

const texto = async (pagina, sel) => (await pagina.locator(sel).first().innerText()).trim();

try {
  // ---------------------------------------------------------------- flujo completo
  {
    const { pagina, errores, lecturas, contexto } = await nuevaPagina();
    await pagina.goto(`${url}/panel/`);
    revisar(await pagina.locator('#form-config').isVisible(), 'Sin configuración muestra el formulario (no datos)');
    await entrar(pagina);
    const total = await texto(pagina, '.kpi .cifra-xl');
    revisar(total === String(esperado.pendientes.length), `Pendientes en Inicio: ${total} (esperado ${esperado.pendientes.length})`);
    for (const u of ['vencido', 'hoy', 'proximo', 'sin-fecha']) {
      const n = await texto(pagina, `.chip-filtro.u-${u} b`);
      revisar(n === String(esperado.conteo[u]), `  ${u}: ${n} (esperado ${esperado.conteo[u]})`);
    }
    const eventos = await pagina.locator('.kpi .par .cifra').allInnerTexts();
    revisar(eventos[0] === String(esperado.eventos.hoy) && eventos[1] === String(esperado.eventos.manana),
      `Eventos hoy/mañana: ${eventos.join('/')} (esperado ${esperado.eventos.hoy}/${esperado.eventos.manana})`);
    const tiles = await pagina.locator('.rejilla-tiles .cifra').allInnerTexts();
    const mes = esperado.mesActual;
    const esperadoTiles = [mes.ganancia, mes.gastos, mes.sobrante].map((c) => dinero(c.valor));
    revisar(JSON.stringify(tiles) === JSON.stringify(esperadoTiles), `Finanzas del mes en Inicio: ${tiles.join(' · ')} (esperado ${esperadoTiles.join(' · ')})`);
    if (extra?.inicio) revisar(JSON.stringify(tiles) === JSON.stringify(extra.inicio), `  coincide con la hoja: ${extra.inicio.join(' · ')}`);
    revisar(/Actualizado/.test(await texto(pagina, '#estado-lectura')), 'Muestra fecha y hora de la última actualización');
    revisar(lecturas.every((l) => l.metodo === 'GET'), 'Todas las llamadas a Sheets son de lectura (GET)');

    // detalle con origen
    await pagina.locator('.bloque-alertas .fila-pend').first().click();
    await pagina.waitForSelector('#detalle[open]');
    revisar(/Origen/.test(await texto(pagina, '#detalle')), 'El detalle muestra el origen de la información');
    await pagina.locator('[data-cerrar]').click();

    // NayarSound
    await pagina.goto(`${url}/panel/#/nayarsound`);
    await pagina.waitForSelector('.dia');
    const deuda = esperado.nayarsound.deuda;
    if (deuda?.estado === 'ok') {
      const totalDeuda = await texto(pagina, '.tabla tfoot .num');
      revisar(totalDeuda === dinero(deuda.total, 0), `Total de deuda: ${totalDeuda} (esperado ${dinero(deuda.total, 0)})`);
      if (extra?.deuda) revisar(totalDeuda === extra.deuda, `  coincide con la hoja: ${extra.deuda}`);
    }
    const djs = await pagina.locator('.dia').first().locator('.dj').count();
    const primerDia = esperado.nayarsound.agenda.dias[0];
    const esperadosDj = primerDia.ciudades.reduce((s, c) => s + c.djs.length, 0) + (primerDia.eventosSinDj ?? 0);
    revisar(djs === esperadosDj, `DJs del primer día en pantalla: ${djs} (esperado ${esperadosDj})`);

    // Préstamos
    await pagina.goto(`${url}/panel/#/prestamos`);
    await pagina.waitForSelector('.lado-cobrar');
    const cobrar = await texto(pagina, '.lado-cobrar .cifra');
    const pagar = await texto(pagina, '.lado-pagar .cifra');
    const t = esperado.prestamos.totales;
    revisar(cobrar === dinero(t.cobrarMXN, 0) && pagar === dinero(t.pagarMXN, 0), `Préstamos: cobrar ${cobrar}, pagar ${pagar} (esperado ${dinero(t.cobrarMXN, 0)}, ${dinero(t.pagarMXN, 0)})`);
    if (extra?.prestamos) revisar(cobrar === extra.prestamos[0] && pagar === extra.prestamos[1], `  coincide con la hoja: ${extra.prestamos.join(', ')}`);

    // Finanzas: mes actual y otro mes
    await pagina.goto(`${url}/panel/#/finanzas`);
    await pagina.waitForSelector('#sel-mes');
    const seleccion = await pagina.locator('#sel-mes option:checked').innerText();
    revisar(/actual/.test(seleccion), `Mes seleccionado por defecto: ${seleccion}`);
    const otro = extra?.otroMes ?? esperado.finanzas.meses[0]?.etiqueta;
    const indice = esperado.finanzas.meses.findIndex((x) => x.etiqueta === otro);
    if (indice >= 0) {
      await pagina.selectOption('#sel-mes', String(indice));
      const cifras = await pagina.locator('.rejilla-tiles .cifra').allInnerTexts();
      const x = esperado.finanzas.meses[indice];
      const esp = [x.ganancia, x.gastos, x.sobrante].map((c) => dinero(c.valor));
      revisar(JSON.stringify(cifras) === JSON.stringify(esp), `${otro}: ${cifras.join(' · ')} (esperado ${esp.join(' · ')})`);
      if (extra?.otroMesCifras) revisar(JSON.stringify(cifras) === JSON.stringify(extra.otroMesCifras), `  coincide con la hoja: ${extra.otroMesCifras.join(' · ')}`);
      if (x.gastosCuadran) revisar(await pagina.locator('.nota.ok').count() > 0, '  las categorías suman lo mismo que la hoja');
    }
    revisar(await pagina.locator('#grafica-mensual svg').count() === 1, 'Gráfica de evolución mensual dibujada');
    if (capturas) {
      mkdirSync(capturas, { recursive: true });
      for (const r of ['inicio', 'nayarsound', 'prestamos', 'finanzas']) {
        await pagina.goto(`${url}/panel/#/${r}`);
        await pagina.waitForTimeout(150);
        await pagina.screenshot({ path: `${capturas}/escritorio-${r}.png`, fullPage: true });
      }
    }
    revisar(errores.length === 0, `Sin errores de JavaScript${errores.length ? `: ${errores.join(' | ')}` : ''}`);
    await contexto.close();
  }

  // ---------------------------------------------------------------- celular
  {
    const { pagina, contexto, errores } = await nuevaPagina({ ancho: 390, alto: 844, movil: true });
    await entrar(pagina);
    for (const r of ['inicio', 'nayarsound', 'prestamos', 'finanzas', 'fuentes']) {
      await pagina.goto(`${url}/panel/#/${r}`);
      await pagina.waitForTimeout(150);
      const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      revisar(desborde <= 0, `Celular (${r}): sin desplazamiento horizontal (${desborde}px)`);
      if (capturas) await pagina.screenshot({ path: `${capturas}/celular-${r}.png`, fullPage: true });
    }
    revisar(await pagina.locator('.pestanas-movil').isVisible(), 'Celular: navegación inferior visible');
    revisar(errores.length === 0, 'Celular: sin errores de JavaScript');
    await contexto.close();
  }

  // ---------------------------------------------------------------- errores de conexión
  {
    const { pagina, contexto } = await nuevaPagina({ fallas: { gastos: 403 } });
    await entrar(pagina);
    revisar(/No se pudo leer 🚹GASTOS PERSONALES/.test(await texto(pagina, '#vista')), 'Archivo sin permiso: aviso claro');
    revisar(!/\$0\.00/.test(await texto(pagina, '.rejilla-tiles')), 'Archivo sin permiso: no muestra cifras en cero');
    revisar(/parcial/i.test(await texto(pagina, '#estado-lectura')), 'Cabecera indica actualización parcial');
    await contexto.close();
  }
  {
    let veces = 0;
    const { pagina, contexto } = await nuevaPagina({ fallas: { prestamos: () => (veces++ >= 2 ? 500 : 0) } });
    await entrar(pagina);
    await pagina.getByRole('button', { name: /Actualizar/ }).click();
    await pagina.waitForSelector('.banda-alerta');
    revisar(/datos anteriores/.test(await texto(pagina, '.banda-alerta')), 'Falla al actualizar: conserva y marca los datos anteriores');
    await contexto.close();
  }

  // ---------------------------------------------------------------- celda vacía
  {
    const copia = JSON.parse(JSON.stringify(datos));
    const balance = copia.gastos.valores[0];
    const enc = balance.findIndex((f) => (f ?? []).includes('GASTOS PERSONALES'));
    const col = balance[enc].indexOf('GASTOS PERSONALES');
    const ultima = enc + esperado.finanzas.meses.length;
    balance[ultima][col] = '';
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    await simularGoogle(contexto, copia);
    const pagina = await contexto.newPage();
    await pagina.clock.setFixedTime(relojFijo);
    await pagina.goto(enlaceConfig);
    await pagina.getByRole('button', { name: 'Entrar con Google' }).click();
    await pagina.goto(`${url}/panel/#/finanzas`);
    await pagina.waitForSelector('#sel-mes');
    await pagina.selectOption('#sel-mes', String(esperado.finanzas.meses.length - 1));
    const gastos = await pagina.locator('.rejilla-tiles .tile').nth(1).innerText();
    revisar(/Celda vacía/.test(gastos) && !/\$0\.00/.test(gastos), 'Celda vacía se muestra como «Celda vacía», no como $0.00');
    await contexto.close();
  }

  // ---------------------------------------------------------------- demo
  {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const pagina = await contexto.newPage();
    await pagina.route('https://accounts.google.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
    await pagina.goto(`${url}/panel/?demo#/inicio`);
    await pagina.waitForSelector('.rejilla-resumen');
    revisar(/DATOS DE EJEMPLO/.test(await texto(pagina, '#aviso-global')), 'Modo de ejemplo identificado con una banda visible');
    await contexto.close();
  }
} finally {
  await navegador.close();
  servidor.close();
}

console.log(fallos ? `\n${fallos} comprobación(es) fallaron.` : '\nTodas las comprobaciones pasaron.');
process.exit(fallos ? 1 : 0);
