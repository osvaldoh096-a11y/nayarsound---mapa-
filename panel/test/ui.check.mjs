// Prueba de la interfaz en Chromium con el simulador de Google (sesión y API de Sheets).
//   node panel/test/ui.check.mjs                      → datos de ejemplo (sintéticos)
//   node panel/test/ui.check.mjs --snapshot ruta.json --hoy 2026-11-07 --esperado ruta.json
// El snapshot real y las cifras esperadas se guardan FUERA del repositorio.

import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { servir, simularGoogle, datosDesdeFuentes, IDS } from './simulador.mjs';
import { fuentesDemo } from '../js/demo.js';
import { construirModelo } from '../js/modelo.js';
import { idxDesdeYMD } from '../js/fechas.js';
import { dinero } from '../js/formato.js';

// Playwright viene instalado de forma global; createRequire lo encuentra igual que require().
const { chromium, devices } = createRequire(import.meta.url)('playwright');

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
  await pagina.goto(`${url}/panel/`);
  await pagina.getByRole('button', { name: 'Entrar con Google' }).click();
  await pagina.waitForSelector('.inicio-rejilla');
}

const texto = async (pagina, sel) => (await pagina.locator(sel).first().innerText()).trim();

try {
  // ---------------------------------------------------------------- flujo completo
  {
    const { pagina, errores, lecturas, contexto } = await nuevaPagina();
    await pagina.goto(`${url}/panel/`);
    await pagina.waitForSelector('[data-accion="entrar"]');
    revisar(await pagina.locator('.inicio-rejilla').count() === 0 && lecturas.length === 0, 'Sin iniciar sesión no se consulta ni se muestra nada');
    await entrar(pagina);
    const total = await texto(pagina, '.protagonista .cifra-xl');
    revisar(total === String(esperado.pendientes.length), `Pendientes en Inicio: ${total} (esperado ${esperado.pendientes.length})`);
    for (const u of ['hoy', 'proximo', 'sin-fecha']) {
      const n = await texto(pagina, `.clase.u-${u} .clase-num`);
      revisar(n === String(esperado.conteo[u]), `  ${u}: ${n} (esperado ${esperado.conteo[u]})`);
    }
    const eventos = await pagina.locator('.eventos .par .cifra').allInnerTexts();
    revisar(eventos[0] === String(esperado.eventos.hoy) && eventos[1] === String(esperado.eventos.manana),
      `Eventos hoy/mañana: ${eventos.join('/')} (esperado ${esperado.eventos.hoy}/${esperado.eventos.manana})`);
    const tiles = await pagina.locator('.fin-fila .cifra').allInnerTexts();
    const mes = esperado.mesActual;
    const esperadoTiles = [mes.ganancia, mes.gastos, mes.sobrante].map((c) => dinero(c.valor));
    revisar(JSON.stringify(tiles) === JSON.stringify(esperadoTiles), `Finanzas del mes en Inicio: ${tiles.join(' · ')} (esperado ${esperadoTiles.join(' · ')})`);
    if (extra?.inicio) revisar(JSON.stringify(tiles) === JSON.stringify(extra.inicio), `  coincide con la hoja: ${extra.inicio.join(' · ')}`);
    revisar(/Actualizado/.test(await texto(pagina, '#estado-lectura')), 'Muestra fecha y hora de la última actualización');
    revisar(lecturas.length > 0 && lecturas.every((l) => l.metodo === 'GET'), `Todas las consultas a Sheets son de lectura (${lecturas.length} GET)`);
    await pagina.reload();
    await pagina.waitForSelector('.inicio-rejilla');
    revisar(await pagina.locator('[data-accion="entrar"]').count() === 0, 'Al recargar con la sesión vigente no pide la cuenta otra vez');

    // modo privado: el ojo oculta todos los importes y se recuerda al recargar
    await pagina.locator('#btn-privado').click();
    const oculto = await pagina.locator('#vista').innerText();
    revisar(!/\$\s?\d/.test(oculto) && oculto.includes('$*****'), 'Ojo: los importes se vuelven asteriscos');
    await pagina.reload();
    await pagina.waitForSelector('.inicio-rejilla');
    revisar(!/\$\s?\d/.test(await pagina.locator('#vista').innerText()), 'Ojo: el modo privado se recuerda al recargar');
    await pagina.locator('#btn-privado').click();
    revisar(/\$\d/.test(await pagina.locator('#vista').innerText()), 'Ojo: al tocarlo otra vez vuelven las cifras');

    // detalle con origen
    await pagina.locator('.bloque-alertas .fila-pend').first().click();
    await pagina.waitForSelector('#detalle[open]');
    revisar(/Origen/i.test(await texto(pagina, '#detalle')), 'El detalle muestra el origen de la información');
    await pagina.locator('[data-cerrar]').click();

    // NayarSound
    await pagina.goto(`${url}/panel/#/nayarsound`);
    {
      await pagina.waitForSelector('#controles-desplegable');
      revisar(!(await pagina.locator('.lista-controles').isVisible()) && /aviso/.test(await pagina.locator('#controles-desplegable summary').innerText()),
        'Avisos de captura: empieza contraído, mostrando cuántos hay');
      await pagina.locator('#controles-desplegable summary').click();
      await pagina.waitForSelector('.lista-controles', { state: 'visible' });
      const avisos = await pagina.locator('.lista-controles').innerText();
      revisar(!/sin DJ|Orden de fechas|hora de inicio/i.test(avisos), 'Avisos de captura: sin «vacío», «fecha desordenada» ni «hora de inicio»');
      const buscar = await pagina.locator('.lista-buscar li').allInnerTexts();
      if (!rutaSnapshot) revisar(buscar.length === 2 && /Guadalajara/.test(buscar[0]) && /mañana/.test(buscar[0]) && /Tepic/.test(buscar[1]) && /en 5 días/.test(buscar[1]),
        `DJ «buscar»: fecha y ciudad, de la más cercana a la más lejana (${buscar.map((b) => b.replace(/\s+/g, ' ')).join(' | ')})`);
    }
    await pagina.waitForSelector('.dia');
    const deuda = esperado.nayarsound.deuda;
    if (deuda?.estado === 'ok') {
      revisar(!(await pagina.locator('#deuda-desplegable .tabla').isVisible()) && /total por cobrar/.test(await pagina.locator('#deuda-desplegable summary').innerText()),
        'Recordatorio de deuda: empieza contraído, mostrando solo el total');
      await pagina.locator('#deuda-desplegable summary').click();
      revisar(await pagina.locator('#deuda-desplegable .tabla').isVisible(), 'Recordatorio de deuda: al tocarlo se despliega la tabla');
      const totalDeuda = await texto(pagina, '.tabla tfoot .num');
      revisar(totalDeuda === dinero(deuda.total, 0), `Total de deuda: ${totalDeuda} (esperado ${dinero(deuda.total, 0)})`);
      if (extra?.deuda) revisar(totalDeuda === extra.deuda, `  coincide con la hoja: ${extra.deuda}`);
    }
    if (deuda?.estado === 'ok') {
      await pagina.locator('.tabla tbody tr').first().click();
      await pagina.waitForSelector('#detalle[open]');
      const msg = await pagina.locator('.det-mensaje pre').innerText();
      revisar(msg.startsWith('*PAGOS PENDIENTES - ') && msg.includes('TOTAL A ENVIAR'), 'Deuda: mensaje «PAGOS PENDIENTES» listo para copiar');
      await pagina.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await pagina.locator('[data-accion="copiar-mensaje"]').click();
      await pagina.waitForTimeout(150);
      const copiado = await pagina.evaluate(() => navigator.clipboard.readText());
      revisar(copiado === msg, 'Deuda: «Copiar» pone el mensaje completo en el portapapeles');
      await pagina.locator('[data-cerrar]').click();
      // Pago al DJ: se edita en el detalle y se escribe en la columna DJ (L).
      await pagina.locator('.tabla tbody tr').first().click();
      await pagina.waitForSelector('#detalle[open]');
      const campo = pagina.locator('input[data-fila-pagodj]').first();
      const filaCampo = await campo.getAttribute('data-fila-pagodj');
      const vista = pagina.locator(`[data-enviar-fila="${filaCampo}"]`);
      if (await vista.count()) {
        const antesVista = await vista.innerText();
        const pagoActual = Number(await campo.inputValue() || 0);
        await campo.fill(String(pagoActual + 100));
        const despues = await vista.innerText();
        const num = (t) => Number(t.replace(/[$,]/g, ''));
        revisar(Math.abs(num(antesVista) - num(despues) - 100) < 0.01, `Vista previa: subir 100 el pago al DJ baja «Enviar» de ${antesVista} a ${despues}`);
      }
      await campo.fill('1234');
      pagina.once('dialog', (d) => d.accept());
      const previo = lecturas.length;
      await pagina.locator('[data-accion="guardar-pagodj"]').first().click();
      for (let i = 0; i < 30 && !lecturas.slice(previo).some((l) => l.metodo === 'PUT'); i++) await pagina.waitForTimeout(100);
      const pagoDj = lecturas.slice(previo).filter((l) => l.metodo === 'PUT');
      revisar(pagoDj.length === 1 && /^'AGENDA Y VENTAS'!L\d+$/.test(pagoDj[0].celda) && pagoDj[0].valor === 1234,
        `Pago al DJ: escribe 1234 en la columna DJ (${pagoDj.map((e) => `${e.celda}=${e.valor}`).join(', ')})`);
      await pagina.waitForSelector('#detalle', { state: 'hidden' });
      await pagina.waitForSelector('.dia');

      // Marcar como pagado: confirma, verifica la fila y escribe SI en PAGO.
      await pagina.locator('.tabla tbody tr').first().click();
      await pagina.waitForSelector('#detalle[open]');
      pagina.once('dialog', (d) => d.accept());
      const antes = lecturas.length;
      await pagina.locator('button.boton-exito[data-accion="marcar-pagado"]').click();
      await pagina.waitForSelector('#detalle:not([open])', { state: 'hidden' });
      await pagina.waitForSelector('.fila-1, .inicio-rejilla, .dia');
      const primera = deuda.personas[0];
      for (let i = 0; i < 30 && lecturas.slice(antes).filter((l) => l.metodo === 'PUT').length < primera.eventos; i++) await pagina.waitForTimeout(100);
      const escrituras = lecturas.slice(antes).filter((l) => l.metodo === 'PUT');
      revisar(escrituras.length === primera.eventos && escrituras.every((e) => e.valor === 'SI' && /^'AGENDA Y VENTAS'!T\d+$/.test(e.celda)),
        `Marcar pagado: escribe «SI» en PAGO de ${primera.eventos} evento(s) (${escrituras.map((e) => e.celda).join(', ')})`);
      revisar(lecturas.filter((l) => l.clave !== 'tareas').every((l) => l.metodo === 'GET' || l.metodo === 'PUT') && lecturas.filter((l) => l.metodo === 'PUT' && l.clave !== 'tareas').every((l) => /^'AGENDA Y VENTAS'!(T|L)\d+$/.test(l.celda)), 'Solo se escribe en PAGO (T) y pago al DJ (L) de AGENDA Y VENTAS');
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
      if (x.categorias?.length) {
        const filas = await pagina.locator('.rejilla-finanzas, main').locator('.graf-pct').allInnerTexts();
        const valores = x.categorias.map((c) => c.total).sort((a, b) => b - a);
        const total = valores.reduce((t, v) => t + v, 0);
        const esperados = valores.map((v) => `${((v / total) * 100).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
        const suma = filas.reduce((t, f) => t + Number(f.replace('%', '').replace(',', '')), 0);
        revisar(JSON.stringify(filas) === JSON.stringify(esperados) && Math.abs(suma - 100) < 0.5,
          `  categorías de mayor a menor con su % (${filas.slice(0, 4).join(', ')}…, suman ${suma.toFixed(1)}%)`);
      }
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
    await pagina.goto(`${url}/panel/#/fuentes`);
    await pagina.getByRole('button', { name: /Cerrar sesión/ }).click();
    await pagina.waitForSelector('[data-accion="entrar"]');
    revisar(true, '«Cerrar sesión» vuelve a pedir la cuenta de Google');
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
    revisar(!/\$0\.00/.test(await texto(pagina, '.bloque-finanzas')), 'Archivo sin permiso: no muestra cifras en cero');
    revisar(/parcial/i.test(await texto(pagina, '#estado-lectura')), 'Cabecera indica actualización parcial');
    await contexto.close();
  }
  {
    let veces = 0;
    // La primera lectura funciona; en la siguiente, préstamos falla.
    const { pagina, contexto } = await nuevaPagina({ fallas: { prestamos: () => (veces++ >= 1 ? 500 : 0) } });
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
    await entrar(pagina);
    await pagina.goto(`${url}/panel/#/finanzas`);
    await pagina.waitForSelector('#sel-mes');
    await pagina.selectOption('#sel-mes', String(esperado.finanzas.meses.length - 1));
    const gastos = await pagina.locator('.rejilla-tiles .tile').nth(1).innerText();
    revisar(/Celda vacía/.test(gastos) && !/\$0\.00/.test(gastos), 'Celda vacía se muestra como «Celda vacía», no como $0.00');
    await contexto.close();
  }

  // ---------------------------------------------------------------- tareas
  for (const movil of [false, true]) {
    const { pagina, errores, lecturas, contexto } = await nuevaPagina(movil ? { ancho: 390, alto: 844, movil: true } : {});
    await entrar(pagina);
    await pagina.waitForSelector('#tareas-caja .tarea');
    const caja = pagina.locator('#tareas-caja');
    const yTareas = (await caja.boundingBox()).y;
    const yPend = (await pagina.locator('.protagonista').boundingBox()).y;
    revisar(yTareas < yPend, `Tareas arriba del Inicio${movil ? ' (celular)' : ''}`);
    revisar(/Llamar al banco/.test(await caja.innerText()), 'Lee las tareas de la hoja TAREAS');
    await caja.locator('input[name="tarea"]').fill('=HYPERLINK("x")  Comprar   cables');
    await caja.locator('input[name="tarea"]').press('Enter');
    for (let i = 0; i < 30 && !lecturas.tareas.some((f) => /cables/.test(f[0])); i++) await pagina.waitForTimeout(100);
    const agregada = lecturas.tareas.find((f) => /cables/.test(f[0]));
    revisar(agregada?.[0] === '=HYPERLINK("x") Comprar cables' && lecturas.some((l) => l.clave === 'tareas' && /:append$/.test(l.celda)), 'Agregar: añade una fila al final (texto tal cual, sin fórmula: RAW)');
    revisar(await caja.locator('input[name="tarea"]').inputValue() === '', 'El cuadro se vacía al agregar');
    await pagina.waitForFunction(() => !document.querySelector('#tareas-caja input[type=checkbox][disabled]'));
    await caja.locator('.tarea', { hasText: 'Llamar al banco' }).locator('input[type=checkbox]').check();
    for (let i = 0; i < 30 && lecturas.tareas[1][1] !== 'SI'; i++) await pagina.waitForTimeout(100);
    revisar(lecturas.tareas[1][1] === 'SI' && /^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(lecturas.tareas[1][3]), 'Marcar hecha: escribe SI y la fecha en la fila correcta');
    revisar(/1 hecha/.test(await caja.innerText()), 'Las hechas se agrupan aparte');
    pagina.once('dialog', (d) => d.accept());
    await caja.locator('.tarea', { hasText: 'cables' }).locator('[data-accion="borrar-tarea"]').click();
    for (let i = 0; i < 30 && lecturas.tareas.some((f) => /cables/.test(f[0] ?? '')); i++) await pagina.waitForTimeout(100);
    revisar(!lecturas.tareas.some((f) => /cables/.test(f[0] ?? '')) && !/cables/.test(await caja.innerText()), 'Borrar: vacía la fila en la hoja y la quita de la lista');
    revisar(lecturas.filter((l) => l.clave === 'tareas' && l.metodo !== 'GET').every((l) => /^'TAREAS'!/.test(l.celda)), 'Las tareas solo escriben en la pestaña TAREAS de su propio archivo');
    // La fila cambió en la hoja: no se toca.
    lecturas.tareas[1][0] = 'Otra cosa';
    await caja.locator('details.tareas-hechas summary').click();
    await caja.locator('.tarea', { hasText: 'Llamar al banco' }).locator('input[type=checkbox]').click();
    await pagina.waitForSelector('#tareas-caja .tareas-error');
    revisar(lecturas.tareas[1][1] === 'SI', 'Si la fila cambió en la hoja, no escribe y avisa');
    if (capturas && movil) await pagina.screenshot({ path: `${capturas}/tareas-movil.png`, fullPage: false });
    if (capturas && !movil) await pagina.screenshot({ path: `${capturas}/tareas.png`, fullPage: false });
    // WhatsApp: enlace con el número (52 + 10 dígitos) y el mensaje de pagos pendientes.
    if (!rutaSnapshot && !movil) {
      await pagina.locator('[data-filtro="sin-fecha"]').first().click();
      await pagina.locator('[data-pendiente*="DJ ALFA"]').first().click();
      const href = await pagina.locator('#detalle a.boton-whatsapp').getAttribute('href');
      const u = new URL(href);
      revisar(u.origin + u.pathname === 'https://wa.me/523312345678' && /PAGOS PENDIENTES/.test(u.searchParams.get('text')),
        'WhatsApp: enlace al número del DJ con el mensaje listo');
      {
        const tel = await navegador.newContext({ ...devices['iPhone 13'] });
        await simularGoogle(tel, datos);
        const pg = await tel.newPage();
        await pg.clock.setFixedTime(relojFijo);
        await entrar(pg);
        await pg.locator('[data-filtro="sin-fecha"]').first().click();
        await pg.locator('[data-pendiente*="DJ ALFA"]').first().click();
        const enlace = await pg.locator('#detalle a.boton-whatsapp');
        revisar(/^whatsapp:\/\/send\?phone=523312345678&text=/.test(await enlace.getAttribute('href')) && !(await enlace.getAttribute('target')),
          'WhatsApp en iPhone: abre directo la app personal (whatsapp://), sin pasar por el navegador');
        await tel.close();
      }
      await pagina.locator('#detalle [data-cerrar]').first().click();
      await pagina.locator('[data-pendiente*="DJ GAMA"]').first().click();
      revisar(await pagina.locator('#detalle a.boton-whatsapp').count() === 0 && /no es válido/.test(await pagina.locator('#detalle').innerText()),
        'WhatsApp: si el teléfono está mal escrito no hay botón y se avisa');
      await pagina.locator('#detalle [data-cerrar]').first().click();
    }
    revisar(!errores.length, `Sin errores de consola en tareas: ${errores.join(' | ')}`);
    await contexto.close();
  }

  // ---------------------------------------------------------------- ordenar tareas arrastrando
  for (const movil of [false, true]) {
    const contexto = await navegador.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } });
    const tareas = [['TAREA', 'HECHA', 'CREADA', 'COMPLETADA', 'ORDEN'], ['Uno', '', '', '', ''], ['Dos', '', '', '', ''], ['Tres', '', '', '', '']];
    const lecturas = await simularGoogle(contexto, datos, { tareas });
    const pagina = await contexto.newPage();
    await pagina.clock.setFixedTime(relojFijo);
    await entrar(pagina);
    await pagina.waitForSelector('#tareas-caja [data-asa]');
    const textos = () => pagina.locator('#tareas-caja .lista-ordenable .tarea-texto').allInnerTexts();
    const asa = pagina.locator('#tareas-caja .tarea', { hasText: 'Tres' }).locator('[data-asa]');
    const caja = await asa.boundingBox();
    const destino = await pagina.locator('#tareas-caja .tarea', { hasText: 'Uno' }).boundingBox();
    const x = caja.x + caja.width / 2;
    if (movil) {
      // Toque: eventos de puntero táctiles.
      const cdp = await contexto.newCDPSession(pagina);
      const toque = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await toque('touchStart', caja.y + caja.height / 2);
      for (let y = caja.y + caja.height / 2; y >= destino.y + 4; y -= 8) await toque('touchMove', y);
      await toque('touchEnd');
    } else {
      await pagina.mouse.move(x, caja.y + caja.height / 2);
      await pagina.mouse.down();
      for (let y = caja.y + caja.height / 2; y >= destino.y + 4; y -= 8) await pagina.mouse.move(x, y);
      await pagina.mouse.up();
    }
    revisar((await textos()).join() === 'Tres,Uno,Dos', `Arrastrar${movil ? ' con el dedo' : ''}: «Tres» queda primero (${(await textos()).join(', ')})`);
    for (let i = 0; i < 30 && tareas[3][4] !== 1; i++) await pagina.waitForTimeout(100);
    revisar(tareas[3][4] === 1 && tareas[1][4] === 2 && tareas[2][4] === 3, `Arrastrar${movil ? ' con el dedo' : ''}: guarda el orden en la columna ORDEN (${tareas.slice(1).map((f) => `${f[0]}=${f[4]}`).join(', ')})`);
    // Al volver a leer la hoja se respeta el orden.
    await pagina.reload();
    await pagina.waitForSelector('#tareas-caja .lista-ordenable');
    revisar((await textos()).join() === 'Tres,Uno,Dos', 'El orden se conserva al recargar');
    revisar(lecturas.filter((l) => l.clave === 'tareas' && l.metodo !== 'GET').every((l) => /^'TAREAS'!E2:E\d+$/.test(l.celda)), 'Ordenar solo escribe la columna ORDEN');
    await contexto.close();
  }

  // ---------------------------------------------------------------- demo
  {
    const contexto = await navegador.newContext({ viewport: { width: 1280, height: 900 } });
    const pagina = await contexto.newPage();
    await pagina.goto(`${url}/panel/?demo#/inicio`);
    await pagina.waitForSelector('.inicio-rejilla');
    revisar(/DATOS DE EJEMPLO/.test(await texto(pagina, '#aviso-global')), 'Modo de ejemplo identificado con una banda visible');
    await contexto.close();
  }
} finally {
  await navegador.close();
  servidor.close();
}

console.log(fallos ? `\n${fallos} comprobación(es) fallaron.` : '\nTodas las comprobaciones pasaron.');
process.exit(fallos ? 1 : 0);
