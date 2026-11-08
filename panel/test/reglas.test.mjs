// Pruebas de lectura y reglas con DATOS SINTÉTICOS (nombres y cifras inventados).
//   cd panel && npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { leerAgenda, leerDeuda, leerPrestamos, leerControl, estadoCelda } from '../js/parsers.js';
import { idxDesdeYMD, hoyCDMX, inferirFecha, ymdDesdeIdx, horaDesdeFraccion, leerEtiquetaMes } from '../js/fechas.js';
import { leerMontoTexto, dinero } from '../js/formato.js';
import { numeroCelda, textoBajoEncabezado, tablaPorEncabezados, letraColumna } from '../js/sheets.js';
import { construirModelo, mensajeDeuda } from '../js/modelo.js';
import { fuentesDemo } from '../js/demo.js';

const HOY = idxDesdeYMD(2026, 11, 7); // sábado

test('hoy se calcula en Ciudad de México, no en la zona del equipo', () => {
  // 05:30 UTC del 8 nov = 11:30 p.m. del 7 nov en CDMX
  assert.equal(hoyCDMX(new Date('2026-11-08T05:30:00Z')).d, 7);
  assert.equal(hoyCDMX(new Date('2026-11-08T06:30:00Z')).d, 8);
});

test('el año se infiere por cercanía y día de la semana', () => {
  const enero = inferirFecha(2, 1, idxDesdeYMD(2026, 12, 30));
  assert.deepEqual(ymdDesdeIdx(enero), { y: 2027, m: 1, d: 2 });
  const pasado = inferirFecha(30, 12, idxDesdeYMD(2027, 1, 3), { modo: 'pasado' });
  assert.equal(ymdDesdeIdx(pasado).y, 2026);
});

test('montos de los recordatorios con coma o punto de miles', () => {
  assert.equal(leerMontoTexto('$12.000'), 12000);
  assert.equal(leerMontoTexto('$2,900'), 2900);
  assert.equal(leerMontoTexto('$-7.494'), -7494);
  assert.equal(leerMontoTexto('sin monto'), null);
  assert.equal(dinero(4853.32), '$4,853.32');
});

test('recordatorio de eventos: días, ciudades, DJs y eventos sin DJ', () => {
  const texto = [
    '📅 *HOY SÁBADO 7 DE NOVIEMBRE*', '', '📌 4 EVENTOS',
    '🟣 GUADALAJARA: DJ UNO, DJ DOS (2)', '🟠 LEON: DJ TRES', '',
    '📅 *MAÑANA DOMINGO 8 DE NOVIEMBRE*', '', '📌 1 EVENTO', '🎧 Sin DJ asignado',
  ].join('\n');
  const a = leerAgenda(texto, HOY);
  assert.equal(a.estado, 'ok');
  assert.equal(a.dias.length, 2);
  assert.equal(a.dias[0].idx, HOY);
  assert.equal(a.dias[0].eventos, 4);
  assert.deepEqual(a.dias[0].ciudades[0].djs, [{ nombre: 'DJ UNO', eventos: 1 }, { nombre: 'DJ DOS', eventos: 2 }]);
  assert.equal(a.dias[0].eventosSinDj, 0);
  assert.equal(a.dias[1].eventosSinDj, 1);
  assert.equal(leerAgenda('😴 No hay eventos en los próximos días', HOY).estado, 'sin-eventos');
  assert.equal(leerAgenda('#REF!', HOY).estado, 'error');
  assert.equal(leerAgenda('', HOY).estado, 'vacia');
});

test('recordatorio de deuda: personas, fechas y total', () => {
  const texto = '💸 RECORDATORIO DE DEUDA\n\n🎧 DJ UNO | 📌 2 eventos | 💰 $3,100\n📅 30 octubre - viernes\n📅 31 octubre - sábado\n\n💰 TOTAL DE DEUDA: $3,100';
  const d = leerDeuda(texto, HOY);
  assert.equal(d.personas[0].eventos, 2);
  assert.equal(d.personas[0].monto, 3100);
  assert.deepEqual(d.personas[0].fechas.map((f) => ymdDesdeIdx(f.idx)), [{ y: 2026, m: 10, d: 30 }, { y: 2026, m: 10, d: 31 }]);
  assert.equal(d.cuadraTotal, true);
  assert.equal(leerDeuda('✅ SIN DEUDAS', HOY).estado, 'sin-deudas');
});

test('recordatorio de 5 días: COBRAR, PAGAR en USDT y capital por liquidar', () => {
  const texto = [
    '🟨 *RECORDATORIO 5 DÍAS*', '', '📅 *HOY SÁBADO 07 DE NOVIEMBRE*', '🟢 COBRAR | PERSONA A | $12.000',
    '', '📅 *EN 3 DÍAS MARTES 10 DE NOVIEMBRE*', '🟣 PAGAR | PERSONA B | $900 MXN (50 USDT)',
    '', '💰 *CAPITAL POR LIQUIDAR*', '', '🔴 *PERSONA C*', '💵 Capital: $50.000', '⏳ Faltan 3 días | 📅 10-nov',
  ].join('\n');
  const p = leerPrestamos(texto, HOY);
  assert.equal(p.dias[0].movimientos[0].accion, 'COBRAR');
  assert.equal(p.dias[0].movimientos[0].monto, 12000);
  assert.equal(p.dias[1].desfase, 3);
  assert.equal(p.dias[1].movimientos[0].usdt, 50);
  assert.equal(p.dias[1].movimientos[0].monto, 900);
  assert.equal(p.liquidaciones[0].capital, 50000);
  assert.equal(p.liquidaciones[0].idx, idxDesdeYMD(2026, 11, 10));
  assert.equal(leerPrestamos('', HOY).estado, 'sin-recordatorios');
});

test('controles de captura', () => {
  assert.deepEqual(leerControl('HAY 2 BUSCAR ❌'), { estado: 'falla', texto: 'HAY 2 BUSCAR ❌', cantidad: 2 });
  assert.equal(leerControl('EN ORDEN ✅').estado, 'ok');
  assert.equal(leerControl('texto cualquiera'), null);
  assert.equal(estadoCelda('Loading...'), 'cargando');
});

test('una celda vacía o con error nunca se vuelve cero', () => {
  assert.deepEqual(numeroCelda(''), { valor: null, estado: 'vacia' });
  assert.equal(numeroCelda('#N/A').estado, 'error');
  assert.equal(numeroCelda('abc').estado, 'texto');
  assert.deepEqual(numeroCelda(0), { valor: 0, estado: 'ok' });
});

test('busca textos y columnas por encabezado, sin depender de la posición', () => {
  const rejilla = [[], ['', 'RECORDATORIOS'], ['', ''], ['', 'texto del recordatorio']];
  assert.deepEqual(textoBajoEncabezado(rejilla, 'Recordatorios', { col: 0, fila: 1 }), { encontrado: true, texto: 'texto del recordatorio', a1: 'B4' });
  const tabla = tablaPorEncabezados([['DJ', 'FECHA', 'DJ '], ['A', 1, 100]], 0, { nombre: ['DJ', 1], pago: ['DJ', 2] }, { col: 0, fila: 12 });
  assert.deepEqual(tabla.registros, [{ fila: 13, nombre: 'A', pago: 100 }]);
  assert.equal(letraColumna(27), 'AB');
  assert.equal(horaDesdeFraccion(0.8333333), '8:00 p.m.');
  assert.deepEqual(leerEtiquetaMes('NOVIEMBRE 2026'), { y: 2026, m: 11 });
});

test('modelo con datos de ejemplo: pendientes únicos y separados de los eventos', () => {
  const hoy = { y: 2026, m: 11, d: 7, idx: HOY };
  const m = construirModelo(fuentesDemo(hoy), hoy);
  const ids = m.pendientes.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  // Hoy: DJ ALFA, DJ BETA (2 eventos = 1 pendiente), DJ GAMA, DJ DELTA y 1 evento sin DJ.
  assert.equal(m.eventos.hoy, 6);
  assert.equal(m.pendientes.filter((p) => p.tipo === 'agenda' && p.fechaIdx === HOY).length, 5);
  assert.equal(m.conteo.vencido, 0);
  assert.equal(m.conteo['sin-fecha'], 2); // deudas sin fecha límite
  assert.equal(m.nayarsound.deuda.total, 5400);
  assert.equal(m.nayarsound.deuda.cruce.coincide, true);
  // USDT convertido con la tasa del archivo (18) y totales separados
  assert.equal(m.prestamos.totales.pagarMXN, 3000 + 900);
  assert.equal(m.prestamos.totales.pagarUSDT, 50);
  assert.equal(m.prestamos.totales.cobrarMXN, 2500 + 1000);
  // Finanzas: mes actual y categorías que cuadran con la hoja
  assert.equal(m.mesActual.etiqueta, 'NOVIEMBRE 2026');
  assert.ok(m.finanzas.meses.every((x) => x.gastosCuadran !== false));
  // Banderas de acción según las reglas actuales de la agenda
  const gama = m.pendientes.find((p) => p.titulo === 'DJ GAMA' && p.tipo === 'agenda');
  assert.deepEqual(gama.banderas.map((b) => b.id), ['sin-inicio']);
});

test('mensaje de pagos pendientes con la fórmula de AGENDA Y VENTAS!I3', () => {
  const sabado = idxDesdeYMD(2026, 11, 7) + 25569;
  const jueves = idxDesdeYMD(2026, 11, 5) + 25569;
  const texto = mensajeDeuda('DJ PRUEBA', [
    { fecha: sabado, dia: 'sábado', horas: 6, total: 3500, anticipo: 100, gas: 200, pagoDj: 1500, entregar: 2100 },
    { fecha: jueves, dia: 'jueves', horas: '', total: 2000, anticipo: 0, gas: '', pagoDj: '', entregar: 900 },
  ]);
  assert.equal(texto, [
    '*PAGOS PENDIENTES - DJ PRUEBA*', '',
    '🎵 *07-nov (sábado, 6h)*', '💵 $3,600', '➖ DJ: $1,500', '✅ Enviar: *$2,100*', '',
    '🎵 *05-NOV (JUEVES)*', '⚠️ *NO HAY REGISTRO DE PAGO DEL DJ*', '',
    '━━━━━━━━━━━━━━', '💰 *TOTAL A ENVIAR: $2,100*',
  ].join('\n'));
});

test('vista previa de «Enviar» con la fórmula de AGENDA Y VENTAS', async () => {
  const { entregarCon } = await import('../js/modelo.js');
  const nov = idxDesdeYMD(2026, 11, 7) + 25569;
  const base = { realizado: 'SI', fecha: nov, total: 3500, anticipo: 100, gas: 200 };
  assert.equal(entregarCon({ ...base, sonido: 'OSVALDO' }, 1500), 2100); // 3500 − 100 − 1500 + 200
  assert.equal(entregarCon({ ...base, sonido: 'OSVALDO', fecha: idxDesdeYMD(2026, 1, 10) + 25569 }, 1500), 1900);
  assert.equal(entregarCon({ ...base, sonido: 'JORGE' }, 1000), 3500 - 100 - 1000 - 1250); // socio: (3500 − 1000) / 2
  assert.equal(entregarCon({ ...base, sonido: 'OSVALDO', realizado: 'NO' }, 1500), null);
});
