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
    if (!rutaSnapshot) {
      // Cobros de eventos: primero a quien le falta anotar el pago al DJ, luego más días.
      await pagina.goto(`${url}/panel/#/inicio`);
      await pagina.locator('button.clase[data-filtro="sin-fecha"]').click();
      await pagina.waitForSelector('.grupo-ciudad');
      const deudores = await pagina.locator('.fila-pend .fp-titulo').allInnerTexts();
      revisar(/DJ GAMA/.test(deudores[0]) && /DJ ALFA/.test(deudores[1]) && await pagina.locator('.fp-falta').count() === 1,
        `Cobros: primero falta pago al DJ, después los que más días deben (${deudores.map((t) => t.split('\n')[0]).join(', ')})`);
      await pagina.locator('button.clase[data-filtro="sin-fecha"]').click();
      // Detalle del día: por ciudad y por hora de inicio (sin DJ dentro de su ciudad).
      await pagina.goto(`${url}/panel/#/inicio`);
      await pagina.locator('[data-dia]').first().click();
      await pagina.waitForSelector('#detalle[open] .det-horario');
      const gdl = await pagina.locator('#detalle .det-horario').first().locator('li').allInnerTexts();
      const horas = await pagina.locator('#detalle .det-horario').first().locator('.det-hora').allInnerTexts();
      revisar(/guadalajara/i.test(await pagina.locator('#detalle section h3').first().innerText())
        && JSON.stringify(horas.map((h) => h.split(' a ')[0])) === JSON.stringify(['5:00 p.m.', '6:00 p.m.', '8:00 p.m.', '10:00 p.m.'])
        && /Sin DJ asignado/.test(gdl[0]), `Día: agrupado por ciudad y de la hora más temprana a la más tarde (${horas.join(' | ')} · ${JSON.stringify(gdl[0])} · ${await pagina.locator('#detalle section h3').first().innerText()})`);
      await pagina.locator('#detalle [data-cerrar]').first().click();
      await pagina.goto(`${url}/panel/#/nayarsound`);
      await pagina.waitForSelector('.ns-cols');
      const op = esperado.nayarsound.operacion;
      revisar(await pagina.locator('.ns-col').count() === 14 && await pagina.locator('.ns-col.actual').count() === 1, 'NayarSound: eventos por mes (12 atrás, 2 adelante) con el mes actual resaltado');
      const comp = await pagina.locator('.ns-comp tbody tr').first().innerText();
      revisar(comp.includes(String(op.anterior.eventos)) && comp.includes(String(op.actual.eventos)) && comp.includes(String(op.proximo.eventos)), `NayarSound: mes anterior / este / próximo (${comp.replace(/\s+/g, ' ')})`);
      revisar(await pagina.locator('.ns-dia').count() === 7, 'NayarSound: próximos 7 días');
      await pagina.locator('.ns-col').nth(5).focus();
      revisar(await pagina.locator('.tip').isVisible(), 'Gráfica: al tocar una barra aparece su información');
      await pagina.mouse.wheel(0, 400);
      await pagina.waitForTimeout(200);
      revisar(!(await pagina.locator('.tip').isVisible()), 'Gráfica: la información se oculta al deslizar');
      revisar(await pagina.locator('.ns-fila-3 .graf-fila').count() > 0, 'NayarSound: desglose por ciudad, DJ y tipo');
      revisar(/\$100,000/.test(await pagina.locator('[data-pf="ns-operacion"] > summary').innerText()), 'NayarSound: números del DASHBOARD (operación mensual)');
    }
    {
      await pagina.waitForSelector('#controles-desplegable');
      revisar(!(await pagina.locator('.lista-controles').isVisible()) && /aviso/.test(await pagina.locator('#controles-desplegable summary').innerText()),
        'Avisos de captura: empieza contraído, mostrando cuántos hay');
      await pagina.locator('#controles-desplegable summary').click();
      await pagina.waitForSelector('.lista-controles', { state: 'visible' });
      const avisos = await pagina.locator('.lista-controles').innerText();
      revisar(!/sin DJ|Orden de fechas|hora de inicio/i.test(avisos), 'Avisos de captura: sin «vacío», «fecha desordenada» ni «hora de inicio»');
      const buscar = await pagina.locator('.lista-buscar li').allInnerTexts();
      if (!rutaSnapshot) revisar(buscar.length === 2 && /guadalajara/i.test(buscar[0]) && /mañana/.test(buscar[0]) && /tepic/i.test(buscar[1]) && /en 5 días/.test(buscar[1]),
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
      const previo = lecturas.length;
      await pagina.locator('[data-accion="guardar-pagodj"]').first().click();
      await pagina.waitForSelector('.pagodj-estado.ok, .pagodj-estado.mal');
      const pagoDj = lecturas.slice(previo).filter((l) => l.metodo === 'PUT');
      revisar(pagoDj.length === 1 && /^'AGENDA Y VENTAS'!L\d+$/.test(pagoDj[0].celda) && pagoDj[0].valor === 1234,
        `Pago al DJ: escribe 1234 en la columna DJ (${pagoDj.map((e) => `${e.celda}=${e.valor}`).join(', ')})`);
      // Se queda en la ventana, avisa «Guardado» y pasa al siguiente evento.
      await pagina.waitForSelector('.pagodj-estado.ok');
      revisar(await pagina.locator('#detalle[open]').count() === 1 && /Guardado/.test(await pagina.locator('.pagodj-estado.ok').first().innerText()), 'Pago al DJ: guarda sin cerrar la ventana');
      const entradasDj = pagina.locator('#detalle input[data-fila-pagodj]');
      if (await entradasDj.count() > 1) revisar(await entradasDj.nth(1).evaluate((el) => el === document.activeElement), 'Pago al DJ: el cursor pasa al siguiente evento');
      if (!rutaSnapshot) revisar(/\d+ horas?/.test(await pagina.locator('#detalle .det-lista').first().innerText()), 'Deuda: muestra la duración del evento en horas');
      await pagina.locator('#detalle [data-cerrar]').first().click();
      await pagina.waitForSelector('#detalle', { state: 'hidden' });
      await pagina.waitForTimeout(1600);
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
      for (let i = 0; i < 50 && lecturas.slice(antes).filter((l) => l.metodo === 'PUT').length < primera.eventos; i++) await pagina.waitForTimeout(100);
      await pagina.waitForTimeout(200);
      const escrituras = lecturas.slice(antes).filter((l) => l.metodo === 'PUT');
      revisar(escrituras.length === primera.eventos && escrituras.every((e) => e.valor === 'SI' && /^'AGENDA Y VENTAS'!T\d+$/.test(e.celda)),
        `Marcar pagado: escribe «SI» en PAGO de ${primera.eventos} evento(s) (${escrituras.map((e) => e.celda).join(', ')})`);
      revisar(lecturas.filter((l) => l.clave !== 'tareas').every((l) => l.metodo === 'GET' || l.metodo === 'PUT') && lecturas.filter((l) => l.metodo === 'PUT' && l.clave !== 'tareas').every((l) => /^'AGENDA Y VENTAS'!(T|L)\d+$/.test(l.celda)), 'Solo se escribe en PAGO (T) y pago al DJ (L) de AGENDA Y VENTAS');
    }
    const djs = await pagina.locator('.dia').first().locator('.dj').count();
    const primerDia = esperado.nayarsound.agenda.dias[0];
    const esperadosDj = primerDia.ciudades.reduce((s, c) => s + c.djs.length, 0) + (primerDia.eventosSinDj ?? 0);
    revisar(djs === esperadosDj, `DJs del primer día en pantalla: ${djs} (esperado ${esperadosDj})`);

    if (!rutaSnapshot) {
      await pagina.goto(`${url}/panel/#/inicio`);
      await pagina.waitForSelector('.bloque-finanzas');
      const diario = await pagina.locator('.bloque-finanzas .fin-diario').allInnerTexts();
      revisar(diario.length === 3 && diario.every((x) => /^-?\$[\d,]+ al día$/.test(x.trim())), `Finanzas: equivalente por día debajo de cada cifra (${diario.join(' | ')})`);
    }
    // Préstamos
    await pagina.goto(`${url}/panel/#/prestamos`);
    {
      // Cobro de préstamo: el detalle trae el mensaje para el cliente.
      await pagina.goto(`${url}/panel/#/inicio`);
      await pagina.locator('[data-pendiente^="COBRAR|"]').first().click();
      await pagina.waitForSelector('#detalle[open]');
      const msgCobro = await pagina.locator('#detalle .det-mensaje pre').innerText().catch(() => '');
      revisar(/^\*RECORDATORIO DE PAGO - /.test(msgCobro) && /Monto a pagar: \*\$/.test(msgCobro) && await pagina.locator('#detalle [data-accion="copiar-mensaje"]').count() === 1,
        'Préstamos: el cobro trae un mensaje para copiar al cliente');
      revisar(!/lista de DJs/.test(await pagina.locator('#detalle').innerText()), 'Préstamos: sin aviso de teléfono de DJs en un cobro');
      await pagina.locator('#detalle [data-cerrar]').first().click();
      if (!rutaSnapshot) {
        await pagina.locator('[data-accion="ver-sin-interes"]').click();
        await pagina.waitForSelector('#detalle[open] .det-tabla-interes');
        const txtInt = await pagina.locator('#detalle').innerText();
        revisar(/CLIENTE DEMO DOS/.test(txtInt) && /op\. 2/.test(txtInt) && /\$1,500/.test(txtInt), 'Préstamos: «No ha pagado interés» al tocarlo muestra cada crédito con su OP');
        await pagina.locator('#detalle [data-cerrar]').first().click();
      }
      await pagina.goto(`${url}/panel/#/prestamos`);
    }
    await pagina.waitForSelector('[data-pf="flujo"]');
    revisar(await pagina.locator('[data-pf="movimientos"]').count() === 0, 'Préstamos: sin la sección «Próximos movimientos»');
    revisar((await pagina.locator('.pf-tabs .pf-tab').allInnerTexts()).join() === 'Resumen,Préstamos,Inversores,Historial', 'Panel financiero: pestañas Resumen, Préstamos, Inversores, Historial');
    revisar(await pagina.locator('.pf details.pf-sec').count() > 0 && await pagina.locator('.pf details.pf-sec[open]').count() === 0, 'Panel financiero: todas las secciones empiezan contraídas');
    if (!rutaSnapshot) {
      const kpis = await pagina.locator('.pf-kpi .pf-kpi-valor .solo-escritorio').allInnerTexts();
      revisar(JSON.stringify(kpis) === JSON.stringify(['$500,000.00', '$300,000.00', '$200,000.00', '$3,000.00']), `Panel financiero: capital prestado, propio, inversores y pago mensual (${kpis.join(' · ')})`);
      const colores = await pagina.locator('[data-pf="rendimiento"], [data-pf="pendientes"]').evaluateAll((els) => els.map((e) => [...e.classList].find((c) => c.startsWith('pf-c-'))));
      revisar(colores.join() === 'pf-c-ambar,pf-c-rojo', `Panel financiero: grupos por color como la hoja (${colores.join(', ')})`);
      await pagina.locator('[data-pf="flujo"] > summary').click();
      const flujo = await pagina.locator('.pf-tabla-flujo').innerText();
      revisar(/-\$3,500/.test(flujo) && /\$9,000/.test(flujo) && /\$12,000/.test(flujo), 'Panel financiero: flujo de efectivo este mes y próximo');
      revisar(/Resultado 2026/.test(await pagina.locator('[data-pf="resultado"]').innerText()) && /\$2,500\.00/.test(await pagina.locator('[data-pf="resultado"] > summary').innerText()), 'Panel financiero: resultado del año');
      await pagina.reload();
      await pagina.waitForSelector('[data-pf="flujo"]');
      revisar(await pagina.locator('[data-pf="flujo"][open]').count() === 1 && await pagina.locator('[data-pf="capital"]').count() === 0, 'Panel financiero: recuerda las secciones abiertas');
      await pagina.locator('[data-pf="activos"] > summary').click();
      await pagina.locator('[data-pf="activos"] .pf-ver').click();
      // Préstamo SINDICATO: abierto por defecto, con su avance y el registro de abonos.
      const sec = pagina.locator('[data-pf="sindicato"]');
      revisar(await sec.getAttribute('open') !== null && /Capital pendiente \$208,738 de \$208,738 · interés pagado \$0/.test(await sec.locator('summary').innerText()), 'SINDICATO: sección con capital pendiente e interés pagado');
      revisar(await sec.locator('.sd-cal-fila').count() === 24, 'SINDICATO: calendario de 24 pagos mensuales (48 quincenas)');
      {
        const ml = pagina.locator('[data-pf="mercadolibre"]');
        const txt = await ml.innerText();
        revisar(/Capital pendiente \$13,500 de \$18,000 · interés pagado \$1,114/.test(await ml.locator('summary').innerText()) && /3 de 12 pagos/.test(txt) && /Pago 4 de 12/.test(txt) && /4 ene 2027/.test(txt) && /CAT 46\.78%/.test(txt),
          'MERCADOLIBRE: sección con 3 de 12 pagos, siguiente pago 4 ene 2027 y CAT');
        if (capturas) await ml.screenshot({ path: `${capturas}/mercadolibre.png` });
      }
      {
        const bb = pagina.locator('[data-pf="bbva"]');
        const txt = await bb.innerText();
        revisar(/Capital pendiente \$110,600 de \$110,600/.test(await bb.locator('summary').innerText()) && /Pago 1 de 24/.test(txt) && /\$6,449/.test(txt) && /estimado/.test(txt) && /24 meses/.test(txt) && /35\.16%|35%/.test(txt) && /1 nov 2028/.test(txt) && !/NaN/.test(txt),
          'BBVA: capital pendiente, 24 pagos mensuales estimados con su tasa, y vencimiento');
        if (capturas) await bb.screenshot({ path: `${capturas}/bbva.png` });
      }
      {
        // Crédito nuevo: basta su fila en CREDITOS para que aparezca y cuente.
        const nuevo = pagina.locator('[data-pf="coppel"]');
        revisar(await nuevo.count() === 1 && /Préstamo COPPEL/.test(await nuevo.locator('summary').innerText()) && /Capital pendiente \$9,167 de \$10,000/.test(await nuevo.locator('summary').innerText()),
          'Préstamos: un crédito nuevo en CREDITOS aparece solo con su capital pendiente');
        revisar(/Préstamo MERCADO PAGO/.test(await pagina.locator('[data-pf="mercadolibre"] summary').innerText()), 'Préstamos: el nombre sale de la pestaña CREDITOS');
      }
      {
        // Agregar crédito desde el panel: crea su pestaña y su fila en CREDITOS.
        const sec = pagina.locator('[data-pf="nuevo-credito"]');
        if (await sec.getAttribute('open') === null) await sec.locator('summary').click();
        const f = sec.locator('form[data-form="credito"]');
        await f.locator('input[name="nombre"]').fill('Nu');
        await f.locator('input[name="monto"]').fill('20000');
        await f.locator('input[name="meses"]').fill('10');
        await f.locator('input[name="pago"]').fill('2500');
        pagina.once('dialog', (dlg) => dlg.accept());
        await f.locator('button[type="submit"]').click();
        await pagina.waitForSelector('[data-pf="nu"]', { timeout: 10000 }).catch(() => {});
        const h = lecturas.hojasTodo;
        const fila = (h.CREDITOS ?? []).find((x) => x?.[0] === 'Nu');
        revisar(!!h.NU && fila?.[1] === 'NU' && h.NU.some((x) => x?.[0] === 'MONTO' && x?.[1] === 20000) && h.NU.some((x) => x?.[0] === 'TOTAL A PAGAR' && x?.[1] === 25000) && String(h.NU[1]?.[18] ?? '').startsWith('=LET('),
          'Agregar crédito: crea la pestaña NU con datos y fórmulas, y su fila en CREDITOS');
        revisar(await pagina.locator('[data-pf="nu"]').count() === 1 && /Capital pendiente \$20,000 de \$20,000/.test(await pagina.locator('[data-pf="nu"] summary').innerText()),
          'Agregar crédito: aparece en el panel con su capital');
      }
      await sec.locator('input[name="monto"]').fill('10310');
      await sec.locator('input[name="nota"]').fill('=PRUEBA transferencia');
      pagina.once('dialog', (dlg) => dlg.accept());
      await sec.locator('form[data-form="abono"] button[type="submit"]').click();
      for (let i = 0; i < 40 && !lecturas.sindicato.some((f) => f[4] === 10310); i++) await pagina.waitForTimeout(100);
      const filaAbono = lecturas.sindicato.find((f) => f[4] === 10310);
      revisar(!!filaAbono && typeof filaAbono[3] === 'number' && filaAbono[5] === '=PRUEBA transferencia', 'SINDICATO: el abono se guarda en la hoja (fecha, monto y nota como texto)');
      await pagina.waitForFunction(() => /Capital pendiente \$200,042/.test(document.querySelector('[data-pf="sindicato"] summary')?.innerText ?? ''));
      revisar(/interés pagado \$1,614/.test(await pagina.locator('[data-pf="sindicato"] summary').innerText()), 'SINDICATO: el abono se reparte en capital e interés');
      pagina.once('dialog', (dlg) => dlg.accept());
      await pagina.locator('[data-accion="borrar-abono"]').first().click();
      await pagina.waitForFunction(() => /Capital pendiente \$208,738 /.test(document.querySelector('[data-pf="sindicato"] summary')?.innerText ?? ''));
      revisar(!lecturas.sindicato.some((f) => f[4] === 10310), 'SINDICATO: borrar abono lo quita de la hoja');
      await pagina.locator('.pf-tab', { hasText: 'Resumen' }).click();
      await pagina.locator('[data-pf="activos"] .pf-ver').click();
      await pagina.locator('[data-pf="t-prestamos"] > summary').click();
      revisar(await pagina.locator('.pf-tab.activo').innerText() === 'Préstamos' && /100%/.test(await pagina.locator('[data-pf="t-prestamos"] tfoot').innerText()), 'Panel financiero: «Ver los…» abre la pestaña Préstamos con totales');
      await pagina.locator('.pf-tab', { hasText: 'Inversores' }).click();
      const secInv = await pagina.locator('.pf details.pf-sec').evaluateAll((els) => els.map((e) => e.dataset.pf));
      revisar(secInv.join() === 't-inversores', `Inversores: una sola sección (${secInv.join(', ')})`);
      await pagina.locator('[data-pf="t-inversores"] > summary').click();
      const filasInv = await pagina.locator('.pf-inv').allInnerTexts();
      revisar(filasInv.length === 4 && filasInv.every((t) => /Pagado|Pendiente|Atrasado|Sin pago este mes|Sin interés/.test(t)), 'Inversores: cada inversión muestra el estado del pago del mes');
      const alerta = await pagina.locator('.pf-inv.con-alerta').allInnerTexts();
      revisar(alerta.length === 1 && /INVERSOR DEMO UNO/.test(alerta[0]) && /faltan 10 días/.test(alerta[0]), 'Inversores: alerta de liquidación a 30 días o menos, con fecha y días');
      revisar(/USDT/.test(filasInv.join(' ')) && /MXN/.test(filasInv.join(' ')), 'Inversores: importe con moneda (MXN o USDT)');
      // ST
      await pagina.goto(`${url}/panel/#/st`);
      await pagina.waitForSelector('.pf-kpis');
      const kst = await pagina.locator('.pf-kpi .pf-kpi-valor .solo-escritorio').allInnerTexts();
      revisar(JSON.stringify(kst) === JSON.stringify(['$200,000.00', '$71,000.00', '$38,000.00', '$5,000.00']), `ST: ventas, utilidad, ganancia personal y caja (${kst.join(' · ')})`);
      const secST = await pagina.locator('.pf details.pf-sec').evaluateAll((els) => els.map((e) => e.dataset.pf));
      revisar(secST.includes('st-cobrar') && secST.includes('st-negocio') && secST.includes('st-stock') && await pagina.locator('.pf details.pf-sec[open]').count() === 0, `ST: secciones desplegables (${secST.join(', ')})`);
      revisar(/1 venta/.test(await pagina.locator('[data-pf="st-cobrar"] > summary').innerText()), 'ST: ventas sin liquidar');
      revisar(/sin stock en Guadalajara/.test(await pagina.locator('[data-pf="st-stock"] > summary').innerText()), 'ST: avisa sin stock por ciudad');
      await pagina.goto(`${url}/panel/#/prestamos`);
      await pagina.waitForSelector('.pf-tabs');
      await pagina.locator('.pf-tab', { hasText: 'Historial' }).click();
      await pagina.locator('[data-pf="h-flujo"] > summary').click();
      revisar(await pagina.locator('.df-cols .df-col').count() === 3, 'Panel financiero: historial con flujo mensual');
      await pagina.locator('.pf-tab', { hasText: 'Resumen' }).click();
    }

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
    // Vista por año
    for (const anio of esperado.finanzas.anios ?? []) {
      await pagina.selectOption('#sel-mes', `a${anio.y}`);
      const cifras = await pagina.locator('.rejilla-tiles .cifra').allInnerTexts();
      const esp = [anio.ganancia, anio.gastos, anio.sobrante].map((c) => dinero(c.valor));
      revisar(JSON.stringify(cifras) === JSON.stringify(esp) && /del año/.test(await pagina.locator('.rejilla-tiles').innerText()),
        `Todo ${anio.y}: ${cifras.join(' · ')} (esperado ${esp.join(' · ')})`);
    }
    if (capturas) {
      mkdirSync(capturas, { recursive: true });
      for (const r of ['inicio', 'nayarsound', 'prestamos', 'st', 'finanzas']) {
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
    for (const r of ['inicio', 'nayarsound', 'prestamos', 'st', 'finanzas', 'fuentes']) {
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
    // Hábitos: marcar hoy escribe una fila con la fecha y SI; desmarcar lo borra.
    await pagina.waitForSelector('#habitos-caja .hb-fila');
    revisar((await pagina.locator('.hb-nombre').allInnerTexts()).join() === 'Ir al gym,Caminar 30 minutos', 'Hábitos: ir al gym y caminar 30 minutos');
    await pagina.locator('.hb-check').first().click();
    for (let i = 0; i < 30 && lecturas.habitos.length < 2; i++) await pagina.waitForTimeout(100);
    const filaHb = lecturas.habitos[1] ?? [];
    revisar(typeof filaHb[0] === 'number' && filaHb[1] === 'SI' && filaHb[2] === '', `Hábitos: marcar «Ir al gym» guarda la fecha y SI (${JSON.stringify(filaHb)})`);
    revisar(/1\s*día seguido/.test(await pagina.locator('.hb-fila').first().innerText()), 'Hábitos: cuenta la racha de días');
    await pagina.waitForFunction(() => !/Guardando/.test(document.querySelector('#habitos-caja .tareas-estado')?.textContent ?? ''));
    await pagina.locator('.hb-check').nth(1).click();
    for (let i = 0; i < 30 && lecturas.habitos[1]?.[2] !== 'SI'; i++) await pagina.waitForTimeout(100);
    revisar(lecturas.habitos[1]?.[2] === 'SI' && lecturas.habitos.length === 2, 'Hábitos: el segundo hábito usa la misma fila del día');
    await pagina.waitForFunction(() => !/Guardando/.test(document.querySelector('#habitos-caja .tareas-estado')?.textContent ?? ''));
    await pagina.locator('.hb-check').first().click();
    for (let i = 0; i < 30 && lecturas.habitos[1]?.[1] !== ''; i++) await pagina.waitForTimeout(100);
    revisar(lecturas.habitos[1]?.[1] === '', 'Hábitos: desmarcar quita el SI');
    // Día olvidado: tocar un día anterior de la semana lo marca en su propia fila.
    await pagina.waitForFunction(() => !/Guardando/.test(document.querySelector('#habitos-caja .tareas-estado')?.textContent ?? ''));
    const diaAtras = pagina.locator('.hb-fila').first().locator('.hb-dia').nth(3);
    const idxAtras = Number(await diaAtras.getAttribute('data-hb-dia'));
    const filasAntes = lecturas.habitos.length;
    await diaAtras.click();
    for (let i = 0; i < 30 && lecturas.habitos.length === filasAntes; i++) await pagina.waitForTimeout(100);
    const nuevaHb = lecturas.habitos.at(-1) ?? [];
    revisar(lecturas.habitos.length === filasAntes + 1 && Math.round(nuevaHb[0]) - 25569 === idxAtras && nuevaHb[1] === 'SI',
      `Hábitos: tocar un día anterior lo marca con su fecha (${JSON.stringify(nuevaHb)})`);
    revisar(await diaAtras.evaluate((el) => el.classList.contains('si')), 'Hábitos: el día marcado se ve en verde');
    await pagina.waitForFunction(() => !/Guardando/.test(document.querySelector('#habitos-caja .tareas-estado')?.textContent ?? ''));
    const textoAntes = await pagina.locator('.hb-nav span').innerText();
    await pagina.locator('[data-accion="habitos-semana"][data-mover="1"]').click();
    revisar(await pagina.locator('.hb-nav span').innerText() !== textoAntes && await pagina.locator('.hb-dia:disabled').count() === 0, 'Hábitos: «Anterior» muestra la semana pasada');
    await pagina.locator('[data-accion="habitos-semana"][data-mover="-1"]').click();
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
    revisar(lecturas.filter((l) => l.clave === 'tareas' && l.metodo !== 'GET').every((l) => /^'(TAREAS|HABITOS)'!/.test(l.celda)), 'Tareas y hábitos solo escriben en sus pestañas (TAREAS, HABITOS) de su propio archivo');
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
      {
        const totalTxt = await pagina.locator('.grupo-total').innerText();
        const sumaCiudades = (await pagina.locator('.grupo-ciudad:not(.grupo-total) b').allInnerTexts()).reduce((t, x) => t + Number(x.replace(/[$,]/g, '')), 0);
        revisar(/Total de todas las ciudades/i.test(totalTxt) && totalTxt.includes(dinero(sumaCiudades, 0)), `Cobros: suma de todas las ciudades ${dinero(sumaCiudades, 0)} (${totalTxt.replace(/\s+/g, ' ')})`);
        if (capturas) await pagina.locator('.grupo-total').locator('xpath=..').screenshot({ path: `${capturas}/cobros-total.png` });
      }
      await pagina.locator('[data-pendiente*="DJ ALFA"]').first().click();
      const href = await pagina.locator('#detalle a.boton-whatsapp').getAttribute('href');
      const u = new URL(href);
      revisar(u.origin + u.pathname === 'https://wa.me/523312345678' && /PAGOS PENDIENTES/.test(u.searchParams.get('text')),
        'WhatsApp: enlace al número del DJ con el mensaje listo');
      // Evento de hoy: anotar el pago al DJ desde ya y sacar el resumen anticipado.
      revisar(await pagina.locator('#detalle .det-hoy').count() === 1, 'Evento de hoy: aparece la sección de cobro anticipado');
      const campoHoy = pagina.locator('#detalle .det-hoy input[data-fila-pagodj]').first();
      await campoHoy.fill('900');
      const antesHoy = lecturas.length;
      await pagina.locator('#detalle .det-hoy [data-accion="guardar-pagodj"]').first().click();
      await pagina.waitForSelector('#detalle .det-hoy .pagodj-estado.ok, #detalle .det-hoy .pagodj-estado.mal');
      const escHoy = lecturas.slice(antesHoy).filter((l) => l.metodo === 'PUT');
      revisar(escHoy.length === 1 && /^'AGENDA Y VENTAS'!L\d+$/.test(escHoy[0].celda) && escHoy[0].valor === 900, `Evento de hoy: escribe el pago al DJ en la columna DJ (${escHoy.map((e) => `${e.celda}=${e.valor}`).join(', ')})`);
      for (let i = 0; i < 60 && !/DJ: \$900/.test(await pagina.locator('.det-mensaje pre').innerText()); i++) await pagina.waitForTimeout(100);
      const msgHoy = await pagina.locator('.det-mensaje pre').innerText();
      revisar(/· HOY\*/.test(msgHoy) && /DJ: \$900/.test(msgHoy), 'Evento de hoy: el resumen anticipado incluye el evento de hoy con su pago al DJ');
      await pagina.locator('[data-accion="incluir-hoy"]').uncheck();
      revisar(!/· HOY/.test(await pagina.locator('.det-mensaje pre').innerText()), 'Evento de hoy: al quitar la casilla, el resumen queda solo con lo realizado');
      await pagina.locator('[data-accion="incluir-hoy"]').check();
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
