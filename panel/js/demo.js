// DATOS DE EJEMPLO para probar el panel sin iniciar sesión (…/panel/?demo).
// Nombres y cifras inventados. Imitan la forma de tus hojas, no su contenido.
// La página muestra una banda «DATOS DE EJEMPLO» cuando se usan.

import { hoyCDMX, ymdDesdeIdx, MESES, etiquetaMes } from './fechas.js?v=202611130532';

const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const serial = (idx) => idx + 25569;
const diaSemana = (idx) => new Date(idx * 86400000).getUTCDay();

function tituloDia(prefijo, idx, { cero = false } = {}) {
  const { d, m } = ymdDesdeIdx(idx);
  return `📅 *${prefijo}${DIAS[diaSemana(idx)]} ${cero ? String(d).padStart(2, '0') : d} DE ${MESES[m - 1]}*`;
}

function rejilla(filas, columnas) {
  return filas.map((f) => Array.from({ length: columnas }, (_, i) => f[i] ?? ''));
}

const MARCA = { GUADALAJARA: '🟣', LEON: '🟠', TEPIC: '🔵', MONTERREY: '🟢' };

export function fuentesDemo(hoy = hoyCDMX()) {
  const h = hoy.idx;

  // ---------------- AMAL AGENDA (filas 9-11 controles, 12 encabezados)
  const eventos = [
    ['GUADALAJARA', 'DJ ALFA', h, 20 / 24, 5, 3000, 300],
    ['TEPIC', 'BUSCAR', h + 5, 18 / 24, 4, 2800, ''],
    ['GUADALAJARA', 'DJ BETA', h, 18 / 24, 4, 2800, 250],
    ['GUADALAJARA', 'DJ BETA', h, 22 / 24, 3, 2500, 250],
    ['GUADALAJARA', '', h, 17 / 24, 5, 3200, 300],
    ['LEON', 'DJ GAMA', h, '', 5, 2600, ''],
    ['TEPIC', 'DJ DELTA', h, 19 / 24, 5, 2500, ''],
    ['TEPIC', 'DJ DELTA', h + 1, 16 / 24, 4, 2400, ''],
    ['GUADALAJARA', 'buscar', h + 1, 21 / 24, 5, 3000, ''],
    ['GUADALAJARA', 'DJ ALFA', h - 3, 20 / 24, 5, 3000, 300],
  ];
  const agendaFilas = [
    ['', '', '', 'HAY 2 BUSCAR ❌'],
    ['', '', '', 'HAY 1 VACIO ❌'],
    ['', '', '', '', '✅ Fechas en orden', '', 'HAY 1 ERRORES ❌', '', '', '', '', 'EN ORDEN ✅', '', 'HAY 1 ERRORES ❌'],
    ['', 'SONIDO DE', 'CIUDAD', 'DJ', 'FECHA', 'TIPO EVENTO', 'INICIO DEL EVENTO', 'TOT.HORAS', 'CLIENTE',
      'TIPO MUSICA', 'DOMICILIO', 'TOTAL EVENTO', 'ANTICIPO', 'GAS A COBRAR', 'REALIZADO', 'OP'],
    ...eventos.map(([ciudad, dj, idx, inicio, horas, total, gas], i) => ['', 'EJEMPLO', ciudad, dj, serial(idx), 'CUMPLEAÑOS',
      inicio, horas, 'CLIENTE DEMO', 'VARIADA', 'DOMICILIO DEMO', total, 500, gas, idx < h ? 'SI' : 'NO', i + 1]),
  ];

  // Texto de RECORDATORIOS con la misma forma que la fórmula de la hoja.
  const bloques = [];
  [['HOY ', h], ['MAÑANA ', h + 1], ['PASADO MAÑANA ', h + 2], ['', h + 3]].forEach(([prefijo, idx]) => {
    const delDia = eventos.filter((e) => e[2] === idx);
    if (!delDia.length) return;
    const ciudades = [...new Set(delDia.filter((e) => e[1]).map((e) => e[0]))].sort();
    const lineas = ciudades.map((c) => {
      const lista = delDia.filter((e) => e[0] === c && e[1]).map((e) => e[1]);
      const nombres = [...new Set(lista)].sort();
      return `${MARCA[c]} ${c}: ${nombres.map((n) => {
        const k = lista.filter((x) => x === n).length;
        return k > 1 ? `${n} (${k})` : n;
      }).join(', ')}`;
    });
    bloques.push(`${tituloDia(prefijo, idx)}\n\n📌 ${delDia.length} ${delDia.length === 1 ? 'EVENTO' : 'EVENTOS'}\n${lineas.join('\n') || '🎧 Sin DJ asignado'}`);
  });
  const textoAgenda = bloques.join('\n\n') || '😴 No hay eventos en los próximos días';

  // ---------------- AGENDA Y VENTAS (deudas) y DASHBOARD de NayarSound
  const deudas = [['DJ ALFA', h - 3, 2100], ['DJ ALFA', h - 6, 1800], ['DJ GAMA', h - 2, 1500]];
  const ventas = [
    ['', '', '', '', '', '', '', '', '', '', '', '❌ HAY 1 ERRORES', '', '', '', '', '', '', '❌ FALTAN 3 DE PAGAR'],
    ['OP', 'SONIDO DE', 'CIUDAD', 'DJ', 'FECHA', 'TIPO EVENTO', 'TOT.HORAS', 'CLIENTE', 'TOTAL EVENTO', 'ANTICIPO',
      'GAS A COBRAR', 'DJ ', 'GANANCIA', 'GANANCIA 2', 'ENTREGAR A OSVALDO', 'REALIZADO', 'DIA', 'MES', 'PAGADO', 'PAGO'],
    // Sonido de OSVALDO: entregar = total − anticipo − DJ + gas (fórmula de la hoja).
    ...deudas.map(([dj, idx, entregar], i) => [i + 1, 'OSVALDO', 'GUADALAJARA', dj, serial(idx), 'XV AÑOS', 5, 'CLIENTE DEMO',
      entregar + 1000, 500, 300, 800, entregar + 500, entregar + 500, entregar, 'SI', '', '', 'DEUDOR', 'NO']),
    [4, 'EJEMPLO', 'TEPIC', 'DJ DELTA', serial(h - 1), 'BODA', 5, 'CLIENTE DEMO', 2500, 500, 0, 700, 1300, 650, 650, 'SI', '', '', 'PAGADO', 'SI'],
  ];
  // Historial de eventos (14 meses) para la operación mensual: ya pagados o por realizar.
  const ciudadesDemo = ['GUADALAJARA', 'TEPIC', 'LEON', 'MONTERREY'];
  const tiposDemo = ['CUMPLEAÑOS', 'XV', 'BODA', 'BAUTIZO'];
  const djsDemo = ['DJ ALFA', 'DJ BETA', 'DJ GAMA', 'DJ DELTA', 'DJ SOL'];
  let opDemo = 100;
  for (let d = -330; d <= 50; d += 3) {
    const n = 1 + ((Math.abs(d) * 7) % 4);
    for (let i = 0; i < n; i++) {
      const idx = h + d;
      const total = 2500 + ((d + i * 3) % 3 === 0 ? 1000 : 500);
      const hecho = idx < h - 1;
      const pagoDj = 1200;
      ventas.push([opDemo++, 'OSVALDO', ciudadesDemo[(i + Math.abs(d)) % 4], djsDemo[(i + Math.abs(d)) % 5], serial(idx), tiposDemo[(i + d + 400) % 4], 5, 'CLIENTE DEMO',
        total, 100, 0, hecho ? pagoDj : '', hecho ? total - pagoDj : '', hecho ? total - pagoDj : '', hecho ? total - pagoDj - 100 : '', hecho ? 'SI' : 'NO', '', '', hecho ? 'PAGADO' : '', hecho ? 'SI' : '']);
    }
  }
  const fmt = (n) => n.toLocaleString('en-US');
  const personas = [...new Set(deudas.map((d) => d[0]))].sort();
  const mesLargo = (idx) => MESES[ymdDesdeIdx(idx).m - 1].toLowerCase();
  const textoDeuda = `💸 RECORDATORIO DE DEUDA\n\n${personas.map((p) => {
    const suyas = deudas.filter((d) => d[0] === p);
    return `🎧 ${p} | 📌 ${suyas.length} eventos | 💰 $${fmt(suyas.reduce((s, d) => s + d[2], 0))}\n${suyas
      .map((d) => `📅 ${String(ymdDesdeIdx(d[1]).d).padStart(2, '0')} ${mesLargo(d[1])} - ${DIAS[diaSemana(d[1])].toLowerCase()}`).join('\n')}`;
  }).join('\n\n')}\n\n💰 TOTAL DE DEUDA: $${fmt(deudas.reduce((s, d) => s + d[2], 0))}`;
  const dashboardNs = rejilla([
    ['', '120 EVENTOS REALIZADOS AL DÍA DE HOY'], [], ['', 'CIUDAD', 'MES'], [], ['', 'GLOBAL', 'OCTUBRE 2026'], [], ['', 'OPERACION MENSUAL DE GLOBAL'], [],
    ['', 'GENERADO', 100000], ['', 'PAGADO A DJS', '$48,000 (48%)'], ['', 'PUBLICIDAD', '$7,000 (7%)'], ['', 'OPERACION Y AT CLIENTE', '$2,000 (2%)'],
    ['', 'GANANCIA NETA MENSUAL', 43000], ['', 'GANANCIA NETA MENSUAL PER.', 40000], ['', 'ME QUEDA X EVENTO', 1100], [],
    ['', 'POR CADA $1 MXN INVERTIDO EN ADS'], ['', 'GENERO EN VENTAS', 'GANANCIA NETA'], ['', '$14.29x', '$6.14x'], [],
    ['', 'RESULTADO HISTORICO DE GLOBAL'], ['', 'INVERSION TOTAL STOCK', 50000], ['', 'UTILIDAD ACUMULADA ', 250000], ['', 'EXCEDENTE SOBRE INVERSION', 200000], [],
    ['', 'GANANCIA PERSONAL HISTORICA'], ['', 'UTILIDAD TEPIC (50%)', 40000], ['', 'UTILIDAD GUADALAJARA (100%)', 90000], ['', 'TOTAL GANANCIA PERSONAL ', 130000], [],
    ['', 'RECORDATORIOS'], ['', textoAgenda], [], [], ['', 'RECORDATORIO DE DEUDA'], ['', textoDeuda],
  ], 5);

  // ---------------- REGISTRO DE PRESTAMOS
  const registro = [
    ['OP.', 'PAGO MENSUAL', 'FECHA INICIO', 'NOMBRE', 'DIVISA', 'CANTIDAD', 'EQUIVALENCIA.', 'INT/MES', 'FECHA COMPROMISO', 'DIA FINAL', 'ESTADO', 'INT RESTANTE', 'PAGO MES'],
    [1, 'SI', serial(h - 40), 'CLIENTE DEMO UNO', 'MXN', 50000, '', 0.05, serial(h + 1), '', 'ACTIVO', 1200, 2500],
    [2, 'SI', serial(h - 70), 'CLIENTE DEMO DOS', 'MXN', 20000, '', 0.05, serial(h + 3), '', 'ACTIVO', 0, 1000],
    [3, 'SI', serial(h - 400), 'CLIENTE DEMO TRES', 'MXN', 10000, '', 0.05, serial(h + 2), '', 'LIQUIDADO', 0, 500],
  ];
  const inversores = [
    ['OP.', 'PAGO MENSUAL', 'FECHA INICIO', 'NOMBRE', 'DIVISA', 'CANTIDAD', 'EQUIVALENCIA', 'INT/MES', 'FECHA COMPROMISO', 'DIA FIN/ACT',
      'ESTADO', 'INTERES RESTANTE', 'PAGO MES', 'INT. GEN. DIA.', 'INT. TOTAL', 'TOT. DIAS ', 'TOT. MESES', 'FECHA DINAMICA'],
    [1, 'SI', serial(h - 28), 'INVERSOR DEMO UNO', 'MXN', 100000, '', 0.03, serial(h + 10), '', 'ACTIVO', 0, 3000, '', '', '', '', serial(h + 2)],
    [2, 'SI', serial(h - 26), 'INVERSOR DEMO DOS', 'USDT', 2000, 34000, 0.025, serial(h + 60), '', 'ACTIVO', 0, 50, '', '', '', '', serial(h + 4)],
    [3, 'SI', serial(h - 70), 'INVERSOR DEMO TRES', 'MXN', 40000, '', 0.04, serial(h + 90), '', 'ACTIVO', 0, 1600, '', '', '', '', serial(h + 20)],
    [4, 'SI', serial(h - 3), 'INVERSOR DEMO CUATRO', 'MXN', 60000, '', 0, serial(h + 200), '', 'ACTIVO', 0, 0, '', '', '', '', serial(h + 27)],
  ];
  // Registro de pagos (columnas U:AA): el TRES ya pagó los dos meses que lleva.
  const pagosInv = [[3, serial(h - 40), 1600, 40000, 'MXN', 'INVERSOR DEMO TRES', ''], [3, serial(h - 10), 1600, 40000, 'MXN', 'INVERSOR DEMO TRES', '']];
  inversores[0].push('AUXILIAR', '', '', 'FECHA ', 'CANTIDAD', 'INVERTIDO', 'DIVISA', 'NOMBRE', 'AUXILIAR');
  pagosInv.forEach((p, i) => {
    const fila = inversores[i + 1];
    while (fila.length < 20) fila.push('');
    fila.push(...p);
  });
  const pagoTxt = (n) => fmt(n).replace(/,/g, '.');
  const textoPrestamos = [
    '🟨 *RECORDATORIO 5 DÍAS*',
    '',
    tituloDia('MAÑANA ', h + 1, { cero: true }),
    `🟢 COBRAR | CLIENTE DEMO UNO | $${pagoTxt(2500)}`,
    '',
    tituloDia('EN 2 DÍAS ', h + 2, { cero: true }),
    `🟠 PAGAR | INVERSOR DEMO UNO | $${pagoTxt(3000)}`,
    '',
    tituloDia('EN 3 DÍAS ', h + 3, { cero: true }),
    `🟢 COBRAR | CLIENTE DEMO DOS | $${pagoTxt(1000)}`,
    '',
    tituloDia('EN 4 DÍAS ', h + 4, { cero: true }),
    `🟣 PAGAR | INVERSOR DEMO DOS | $${pagoTxt(900)} MXN (${pagoTxt(50)} USDT)`,
    '',
    '💰 *CAPITAL POR LIQUIDAR*',
    '',
    '🔴 *INVERSOR DEMO UNO*',
    `💵 Capital: $${pagoTxt(100000)}`,
    `⏳ Faltan 10 días | 📅 ${String(ymdDesdeIdx(h + 10).d).padStart(2, '0')}-${MESES[ymdDesdeIdx(h + 10).m - 1].slice(0, 3).toLowerCase()}`,
  ].join('\n');
  // DASHBOARD de préstamos con los mismos bloques que tu hoja (cifras inventadas).
  const dashboardPr = rejilla([
    ['', 'RESUMEN FINANCIERO', '', '', 'GANANCIAS HISTORICAS', '', '', '', '', 'FLUJO HISTORICO', '', '', 'PRESTAMOS ACTIVOS'],
    [],
    ['', 'CAPITAL PRESTADO', 500000],
    ['', 'CAPITAL PROPIO', 300000, '', 'TOTAL AÑOS', 'TOTAL GENERADO', 'TOTAL PAGADO', 'GANANCIA TOTAL', '', 'MES', 'GANANCIA', '', 'NOMBRE', 'CAPITAL TOTAL', 'INTERES RESTANTE TOTAL', 'PAGO MENSUAL'],
    ['', 'CAPITAL DE INVERSORES', 200000, '', 2, 150000, 50000, 100000, '', 'ENERO 2026', 4000, '', ' CLIENTE UNO ', 300000, 60000, 20000],
    ['', 'INTERES PROMEDIO MENSUAL', 0.065, '', '', '', '', '', '', 'FEBRERO 2026', -1500, '', ' CLIENTE DOS ', 200000, 40000, 10000],
    ['', 'PROYECCION MENSUAL', 30000, '', 'AÑO', 'GENERADO', 'PAGADO', 'GANANCIA', '', 'MARZO 2026', 2500],
    ['', 'PAGO MENSUAL A INVERSORES', 3000],
    ['', 'PENDIENTE INTERES A COBRAR', 80000, '', 2025, 90000, 30000, 60000],
    ['', 'RESTANTE PROPIO', 120000, '', 2026, 60000, 20000, 40000],
    [],
    ['', 'RESUMEN GENERAL', '', '', 'AÑO', 2026, '', '', '', '', '', '', 'INVERSORES ACTIVOS'],
    ['', '', '', '', 'MES', 'INTERESES COBRADOS', 'PAGADO', 'GANANCIA TOTAL'],
    ['', textoPrestamos, '', '', 'ENERO 2026', 5000, 1000, 4000, '', '', '', '', 'NOMBRE', 'FECHA COMPROMISO PAGO', 'CAPITAL TOTAL', 'PAGO MENSUAL'],
    ['', '', '', '', 'FEBRERO 2026', 2000, 3500, -1500, '', '', '', '', ' INVERSOR DEMO UNO ', serial(h + 10), 100000, 3000],
    ['', '', '', '', 'TOTAL MESES 2', 7000, 4500, 2500, '', '', '', '', ' INVERSOR DEMO DOS ', serial(h + 40), 100000, 0],
    [],
    ['', 'CASHFLOW MES ACTUAL', '', '', 'PAGO A INVERSORES MXN', '', 'PAGO A INVERSORES USDT'],
    [],
    ['', '💰 Ingresos: $6.000 | 💸 Pagos: $9.500 | 📊 Balance: $-3.500', '', '', '🟢 MES ACTUAL\n💵 TOTAL MXN A PAGAR: $3,000', '', '🟢 MES ACTUAL\n💵 TOTAL: $900 MXN | 50 USDT'],
    ['', 'CASHFLOW MES SIGUIENTE'],
    [],
    ['', '💰 Ingresos: $12.000 | 💸 Pagos: $3.000 | 📊 Balance: $9.000'],
    ['', 'COBRO INTERESES CLIENTES'],
    [],
    ['', '📌 RESUMEN DE COBRO\n\n📊 TOTAL PENDIENTE ESTE MES: $6.000'],
  ], 16);

  // ---------------- GASTOS PERSONALES (tabla mensual y gastos por motivo)
  const categorias = ['COMIDA', 'TRANSPORTE', 'RENTA', 'SERVICIOS', 'ENTRETENIMIENTO', 'SALUD'];
  const gastos = [['OP', 'FECHA', 'CANTIDAD', 'MOTIVO', 'GASTADO CON', 'AUX', 'DIA']];
  const meses = [];
  for (let m = 1; m <= hoy.m; m++) meses.push(etiquetaMes(hoy.y, m));
  let op = 1;
  meses.forEach((etq, i) => {
    if (i === meses.length - 1 && hoy.d < 3) return; // mes actual sin gastos todavía
    categorias.forEach((c, k) => {
      const cantidad = 800 + ((i * 7 + k * 13) % 9) * 450 + (c === 'RENTA' ? 6000 : 0);
      gastos.push([op++, '', cantidad, c, 'YO', etq, '']);
    });
  });
  // Año anterior (para la vista por año): solo en ANALISIS, como en tu hoja.
  const anterior = [];
  for (let m = 6; m <= 12; m++) anterior.push(etiquetaMes(hoy.y - 1, m));
  anterior.forEach((etq, i) => {
    categorias.slice(0, 3).forEach((c, k) => gastos.push([op++, '', 500 + i * 100 + k * 50, c, 'YO', etq, '']));
  });
  const balanceMeses = [
    ['', '', 'MES', 'NEGOCIO A', 'NEGOCIO B', 'PRESTAMOS', 'OTROS', 'GANANCIA MENSUAL', 'GASTOS PERSONALES', 'SOBRANTE MENSUAL'],
    ...meses.map((etq, i) => {
      const a = 30000 + ((i * 37) % 11) * 4000;
      const b = 8000 + ((i * 17) % 7) * 1500;
      const p = ((i * 29) % 5) * 1200 - 2000;
      const o = i % 4 === 0 ? 1500 : 0;
      const g = a + b + p + o;
      const s = gastos.filter((r) => r[5] === etq).reduce((t, r) => t + r[2], 0);
      return ['', '', etq, a, b, p, o, g, s, g - s];
    }),
  ];
  // ANALISIS BALANCE GENERAL: una tabla «GANANCIA MES …» por negocio; NEGOCIO A en dos partes por mes.
  const nombres = ['NEGOCIO A', 'NEGOCIO B', 'PRESTAMOS', 'OTROS'];
  const columnas = nombres.map((n) => [
    ...anterior.map((etq, i) => [etq, n === 'NEGOCIO A' ? 20000 + i * 1000 : n === 'NEGOCIO B' ? 5000 : 0]),
    ...balanceMeses.slice(1).flatMap((f) => {
      const v = f[3 + nombres.indexOf(n)];
      return n === 'NEGOCIO A' ? [[f[2], v - 10000], [f[2], 10000]] : [[f[2], v]];
    }),
  ]);
  const largo = Math.max(...columnas.map((c) => c.length));
  const analisis = [
    ['', ...nombres.flatMap((n) => [`GANANCIA MES ${n}`, '', ''])], [], [],
    ['', ...nombres.flatMap(() => ['MES', 'GANANCIA PERSONAL', ''])],
    ...Array.from({ length: largo }, (_, k) => ['', ...columnas.flatMap((c) => (c[k] ? [c[k][0], c[k][1], ''] : ['', '', '']))]),
  ];
  const totalAnio = balanceMeses.slice(1).reduce((t, f) => [t[0] + f[7], t[1] + f[8]], [0, 0]);
  const balance = [ // DASHBOARD BALANCE GENERAL desde A1: resumen anual (filas 4-5) y tabla mensual (fila 7)
    [], [], [],
    ['', '', 'AÑO', 'TOTAL NEGOCIO A', 'TOTAL NEGOCIO B', 'TOTAL PRESTAMOS', '', '', 'TOTAL GANANCIA', 'TOTAL GASTOS'],
    ['', '', hoy.y, '', '', '', '', '', totalAnio[0], totalAnio[1]],
    [],
    ...balanceMeses,
  ];

  // ---------------- ST (cifras inventadas con la misma forma que tu hoja)
  const stDashboard = [
    ['CIUDAD', 'MES'], [], ['GLOBAL', 'GLOBAL'], [], ['GANANCIA SOCIOOS MENSUAL DE GLOBAL'], [], [],
    ['TOTAL DE VENTAS', 200000], [], ['PAGADO STOCK', 110000], [], ['DESTINADO A CAJA', 20000], [], ['GANANCIA TOTAL OPERATIVA', 70000], [],
    ['GANANCIA NETA MENSUAL PERSONAL', 38000], [], [], ['GANANCIA DE NEGOCIO MENSUAL DE GLOBAL'], [], ['TOTAL DE VENTAS', 200000], [], ['PAGADO STOCK', 110000], [],
    ['PAGADO PUBLICIDAD', 10000], [], ['PAGADO OPERACION Y AT CLIENTE', 9000], [], [], ['UTILIDAD NEGOCIO', 71000], [], ['POR CADA $1 MXN INVERTIDO EN ADS'],
    ['GENERO EN VENTAS', 'GANANCIA NETA'], ['$20.00x', '$7.10x'], [], [], ['GANANCIA PERSONAL HISTORICA'], [], [],
    ['UTILIDAD TEPIC (50%)', 30000], ['UTILIDAD GUADALAJARA (100%)', 8000], ['TOTAL GANANCIA PERSONAL ', 38000], [], ['GLOBAL'], [],
    ['INDICADOR ROA POR CIUDAD: PUBLICIDAD → VENDIDO → NETO'],
    ['CIUDAD', 'PUBLICIDAD (ADS)', 'VENDIDO (GENERADO)', 'NETO (GANANCIA OPERATIVA)', '$1 EN ADS, VENDE', '$1 EN ADS NETO'],
    ['GUADALAJARA', 2000, 30000, 8000, '$15.00x', '$4.00x'], ['TEPIC', 8000, 170000, 62000, '$21.25x', '$7.75x'], ['TOTAL', 10000, 200000, 70000, '$20.00x', '$7.00x'],
  ];
  const stVentas = [
    ['OP', 'FECHA', 'CIUDAD', 'CLIENTE', 'PROGRAMA ', 'KIT', 'PRODUCTO 1', '', '', '', '', '', '', '', '', '', '', '', '', '', ' TOT.STOCK ', 'VENTA', 'DESTINADO A CAJA', 'GANANCIA TOTAL', 'GANANCIA /2 O /1', 'LIQUIDADO'],
    ...[[h - 40, 'TEPIC', 'USO RUDO', 6700, 'SI'], [h - 6, 'TEPIC', 'BASICO', 5700, 'SI'], [h - 2, 'GUADALAJARA', 'TABLET', 6700, 'NO'], [h - 1, 'TEPIC', 'CAMARA', 7000, 'SI']]
      .map(([idx, ciudad, kit, venta, liq], i) => [i + 1, serial(idx), ciudad, 'CLIENTE DEMO', 'ELEVENTA', kit, 'PRODUCTO', ...Array(13).fill(''), venta * 0.5, venta, venta * 0.1, venta * 0.4, venta * 0.2, liq]),
  ];
  const stStock = [
    ['CAJA TEPIC'], ['$20,000 generado en caja'], ['$-15,000 gastado'], [], ['$5,000 disponible'], [], [],
    ['', '', '', '', '', '', 'TEPIC', 'GUADALAJARA'],
    ['', '', '', '', '', '', '5 ROLLOS - 8 en stock', 'NO HAY STOCK'],
    ['', '', '', '', '', '', 'TARJETA WIFI - 40 en stock'],
  ];

  const meta = (titulo, pestanas) => ({ titulo, zona: 'America/Mexico_City', pestanas });
  return {
    nayarsound: { clave: 'nayarsound', id: 'DEMO', demo: true, meta: meta('🐯NAYARSOUND - PERSONAL', { DASHBOARD: 1, 'AGENDA Y VENTAS': 2 }),
      rangos: { dashboard: dashboardNs, ventas } },
    agenda: { clave: 'agenda', id: 'DEMO', demo: true, meta: meta('AMAL AGENDA', { AGENDA: 0 }), rangos: { agenda: agendaFilas, djs: [
      ['', 'DJ CON PENDIENTES', 'FECHAS DJ', '', 'FECHA', '', '', '', '', '', '', '', '', '', '', 'CIUDAD', 'NOMBRE', 'COORDENADAS', 'SONIDO', 'TELEFONO'],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'GUADALAJARA', 'DJ ALFA', '20.6, -103.4', 'MACKIE', '(33) 1234-5678'],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'LEON', 'DJ GAMA', '21.1, -101.6', 'MACKIE', '123'],
    ] } },
    prestamos: { clave: 'prestamos', id: 'DEMO', demo: true, meta: meta('💵REGISTRO DE PRESTAMOS', { DASHBOARD: 3, 'REGISTRO PRESTAMOS': 4, 'REGISTRO DE INVERSORES': 5 }),
      rangos: { dashboard: dashboardPr, registro, inversores } },
    gastos: { clave: 'gastos', id: 'DEMO', demo: true, meta: meta('🚹GASTOS PERSONALES - OSVALDO', { 'DASHBOARD BALANCE GENERAL': 6, 'ANALISIS GASTOS PERSONALES': 7, 'ANALISIS BALANCE GENERAL': 8 }),
      rangos: { balance, gastos, analisis } },
    st: { clave: 'st', id: 'DEMO', demo: true, meta: meta('🖥️ST- SISTEMAS Y TECNOLOGIA - PERSONAL', { DASHBOARD: 9, 'HOJA DE VENTAS': 10, 'STOCK, OPERACION': 11 }),
      rangos: { dashboard: stDashboard, ventas: stVentas, stock: stStock } },
  };
}
