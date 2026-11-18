// Préstamos que tú pagas cada mes (SINDICATO, MERCADOLIBRE…). Cada uno tiene
// su pestaña en tu hoja «TO DO · Dashboard personal»:
//   A:B  datos del préstamo (MONTO, TOTAL A PAGAR, PAGO MENSUAL, …)
//   D:F  tus abonos (FECHA, ABONO, NOTA)
//   H:I  (opcional) calendario: N, VENCE. Sin calendario se usan quincenas
//        desde INICIO PRIMERA QUINCENA (como el SINDICATO).

import { TAREAS } from './fuentes.js?v=202611180502';
import { leerRangos, agregarFila, borrarRango } from './api.js?v=202611180502';
import { idxDesdeSerial, idxDesdeYMD, ymdDesdeIdx, normalizar } from './fechas.js?v=202611180502';

const numero = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[$,\s%]/g, '')));
const fechaDe = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return idxDesdeSerial(v);
  const m = String(v ?? '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return m ? idxDesdeYMD(Number(m[1]), Number(m[2]), Number(m[3])) : null;
};

/** Lee la pestaña: datos (A:B), abonos (D:F) y calendario (H:I). */
export function leerSindicato(valores) {
  const datos = {};
  const abonos = [];
  const vencimientos = [];
  (valores ?? []).forEach((f, i) => {
    const etq = normalizar(f?.[0]);
    if (etq && i > 0) datos[etq] = f?.[1];
    const monto = numero(f?.[4]);
    if (i > 0 && f?.[3] !== undefined && f?.[3] !== '' && Number.isFinite(monto) && monto !== 0) {
      abonos.push({ fila: i + 1, idx: fechaDe(f[3]), fechaTexto: String(f[3]), monto, nota: String(f?.[5] ?? '').trim() });
    }
    const n = numero(f?.[7]);
    if (i > 0 && Number.isInteger(n) && n > 0) vencimientos.push({ n, vence: fechaDe(f?.[8]) });
  });
  return { datos, abonos: abonos.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0)), vencimientos: vencimientos.sort((a, b) => a.n - b.n) };
}

/** Ventanas quincenales: 16–fin de mes y 1–15, desde la primera quincena. */
function quincenas(inicioIdx, n) {
  const lista = [];
  let { y, m, d } = ymdDesdeIdx(inicioIdx);
  let primera = d < 16;
  for (let q = 0; q < n; q++) {
    const ini = idxDesdeYMD(y, m, primera ? 1 : 16);
    const fin = primera ? idxDesdeYMD(y, m, 15) : idxDesdeYMD(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) - 1;
    lista.push({ ini, fin });
    if (primera) primera = false;
    else { primera = true; m += 1; if (m > 12) { m = 1; y += 1; } }
  }
  return lista;
}

/** Fecha de hoy en Ciudad de México como texto para la hoja (AAAA-MM-DD). */
function hoyTexto() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
}

/**
 * Un préstamo propio. clave: id de la sección; pestana: pestaña en la hoja
 * TO DO; gid: id de la pestaña (enlace); titulo: nombre en pantalla.
 */
export function crearPrestamo({ clave, pestana, gid, titulo, demo }) {
  const H = `'${pestana}'`;
  const P = {
    clave, pestana, titulo,
    url: `https://docs.google.com/spreadsheets/d/${TAREAS.id}/edit#gid=${gid}`,
    S: { estado: 'sin-leer', datos: {}, abonos: [], vencimientos: [], error: null, guardando: false, demo: false },
  };
  const S = P.S;

  P.cargar = async (token) => {
    if (S.demo) return;
    try {
      const [v] = await leerRangos(token, TAREAS.id, [`${H}!A1:I200`]);
      Object.assign(S, leerSindicato(v), { estado: 'ok', error: null });
    } catch (error) {
      S.estado = S.abonos.length ? 'ok' : 'error';
      S.error = error.message;
    }
  };

  P.usarDemo = (hoyIdx) => Object.assign(S, { demo: true, estado: 'ok', error: null, ...demo(hoyIdx) });

  /** Avance: lo abonado contra lo que ya debería ir pagado. */
  P.resumen = (hoyIdx) => {
    const d = S.datos;
    const total = numero(d['TOTAL A PAGAR']);
    const mensual = numero(d['PAGO MENSUAL']);
    const abonado = S.abonos.reduce((t, a) => t + a.monto, 0);
    const nMensual = numero(d['NUMERO DE PAGOS MENSUALES']) || numero(d['NUMERO DE PAGOS']);
    const nq = numero(d.QUINCENAS);
    const r = {
      monto: numero(d.MONTO), total, mensual, interes: numero(d['INTERES TOTAL']), tasa: numero(d['TASA ANUAL']), cat: numero(d.CAT),
      quincenas: Number.isFinite(nq) && nq > 0 ? nq : null, meses: Number.isFinite(nMensual) && nMensual > 0 ? nMensual : null,
      abonado, restante: Number.isFinite(total) ? total - abonado : null, avance: total ? abonado / total : null, abonos: S.abonos,
    };
    if (!Number.isFinite(total)) return r;

    // Calendario: de la hoja (H:I) o por quincenas (SINDICATO).
    let filas = null;
    if (S.vencimientos.length) {
      filas = S.vencimientos.map((v, i) => ({ n: v.n, vence: v.vence, ini: i > 0 && S.vencimientos[i - 1].vence !== null && v.vence !== null ? S.vencimientos[i - 1].vence + 1 : null }));
    } else {
      const inicioV = d['INICIO PRIMERA QUINCENA'];
      const inicioIdx = typeof inicioV === 'number' ? idxDesdeSerial(inicioV) : fechaDe(inicioV);
      if (inicioIdx === null) return r;
      const q = r.quincenas || 48;
      const qs = quincenas(inicioIdx, q);
      filas = [];
      for (let k = 0; k < q; k += 2) filas.push({ n: k / 2 + 1, ini: qs[k].ini, vence: qs[Math.min(k + 1, q - 1)].fin });
    }
    const nPagos = filas.length;
    r.pagos = [];
    let acumulado = 0;
    for (const f of filas) {
      // Pago mensual de tu hoja; el último ajusta la diferencia para llegar al total.
      const monto = Number.isFinite(mensual) && mensual > 0
        ? (f.n < nPagos ? mensual : Math.round((total - mensual * (nPagos - 1)) * 100) / 100)
        : total / nPagos;
      const desdeA = acumulado; acumulado += monto;
      const cubierto = Math.max(0, Math.min(monto, abonado - desdeA));
      const pagado = cubierto >= monto - 0.5;
      // Sin fecha de vencimiento (pagos viejos del calendario) cuenta como ya vencido.
      const vencido = f.vence === null ? true : f.vence < hoyIdx;
      const enCurso = f.ini !== null ? f.ini <= hoyIdx : f.vence !== null && f.vence - 31 <= hoyIdx;
      r.pagos.push({ ...f, monto, cubierto, vencido,
        estado: pagado ? 'pagado' : vencido ? 'atrasado' : enCurso ? 'en-curso' : cubierto > 0 ? 'parcial' : 'pendiente' });
    }
    r.inicioIdx = r.pagos[0].ini ?? fechaDe(d['FECHA SOLICITUD']);
    r.finIdx = r.pagos.at(-1).vence;
    r.esperado = r.pagos.filter((p) => p.vencido).reduce((t, p) => t + p.monto, 0);
    r.diferencia = abonado - r.esperado;
    r.actual = r.pagos.find((p) => p.estado !== 'pagado') ?? null;
    r.pagados = r.pagos.filter((p) => p.estado === 'pagado').length;
    const { y, m } = ymdDesdeIdx(hoyIdx);
    r.abonadoMes = S.abonos.filter((a) => a.idx !== null && ymdDesdeIdx(a.idx).y === y && ymdDesdeIdx(a.idx).m === m).reduce((t, a) => t + a.monto, 0);
    return r;
  };

  P.agregarAbono = async ({ monto, fecha, nota }, obtenerToken) => {
    const valor = Number(String(monto).replace(/[$,\s]/g, ''));
    if (!Number.isFinite(valor) || valor <= 0) throw new Error('Escribe un monto válido, por ejemplo 10310.');
    const f = /^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '') ? fecha : hoyTexto();
    if (S.demo) {
      const [y, m, d] = f.split('-').map(Number);
      S.abonos.push({ fila: Math.max(1, ...S.abonos.map((a) => a.fila)) + 1, idx: idxDesdeYMD(y, m, d), monto: valor, nota: String(nota ?? '').trim() });
      return;
    }
    const token = await obtenerToken();
    // Fecha como fecha de Sheets; monto como número; nota tal cual.
    await agregarFila(token, TAREAS.id, `${H}!D1:F1`, [f, valor, String(nota ?? '').trim()], { entrada: 'USER_ENTERED', texto: [2] });
    await P.cargar(token);
  };

  P.borrarAbono = async (fila, obtenerToken) => {
    const a = S.abonos.find((x) => x.fila === fila);
    if (!a) return;
    if (S.demo) { S.abonos = S.abonos.filter((x) => x !== a); return; }
    const token = await obtenerToken();
    const [v] = await leerRangos(token, TAREAS.id, [`${H}!E${fila}`]);
    if (numero(v?.[0]?.[0]) !== a.monto) throw new Error('Ese abono cambió en tu hoja. Toca «Actualizar» y vuelve a intentarlo.');
    await borrarRango(token, TAREAS.id, `${H}!D${fila}:F${fila}`);
    await P.cargar(token);
  };
  return P;
}

const mesAnterior = (hoyIdx, dia) => {
  const { y, m } = ymdDesdeIdx(hoyIdx);
  return idxDesdeYMD(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1, dia);
};

export const SINDICATO = crearPrestamo({
  clave: 'sindicato', pestana: 'SINDICATO', gid: 778, titulo: 'Préstamo SINDICATO',
  demo: (hoyIdx) => ({
    datos: { MONTO: 100000, 'TOTAL A PAGAR': 120000, 'PAGO MENSUAL': 5000, 'NUMERO DE PAGOS MENSUALES': 24, QUINCENAS: 48, 'TASA ANUAL': 0.13, 'INTERES TOTAL': 20000,
      'INICIO PRIMERA QUINCENA': mesAnterior(hoyIdx, 16) + 25569 },
    abonos: [{ fila: 2, idx: hoyIdx - 20, monto: 5000, nota: 'Transferencia' }],
    vencimientos: [],
  }),
});

export const MERCADOLIBRE = crearPrestamo({
  clave: 'mercadolibre', pestana: 'MERCADOLIBRE', gid: 780, titulo: 'Préstamo MERCADOLIBRE',
  demo: (hoyIdx) => ({
    datos: { MONTO: 18000, 'TOTAL A PAGAR': 22454.28, 'PAGO MENSUAL': 1871.19, 'NUMERO DE PAGOS MENSUALES': 12, 'TASA ANUAL': 0.39, CAT: 0.4678, 'INTERES TOTAL': 4454.28 },
    abonos: [{ fila: 2, idx: hoyIdx - 5, monto: 5613.57, nota: 'Mensualidades 1 a 3' }],
    vencimientos: Array.from({ length: 12 }, (_, i) => ({ n: i + 1, vence: i < 3 ? null : hoyIdx + 30 * (i - 2) })),
  }),
});

export const PRESTAMOS_PROPIOS = [SINDICATO, MERCADOLIBRE];

// Compatibilidad: el SINDICATO con los nombres de antes.
export const S = SINDICATO.S;
export const URL_SINDICATO = SINDICATO.url;
export const cargarSindicato = (token) => SINDICATO.cargar(token);
export const usarDemoSindicato = (hoyIdx) => SINDICATO.usarDemo(hoyIdx);
export const resumenSindicato = (hoyIdx) => SINDICATO.resumen(hoyIdx);
export const agregarAbono = (datos, obtenerToken) => SINDICATO.agregarAbono(datos, obtenerToken);
export const borrarAbono = (fila, obtenerToken) => SINDICATO.borrarAbono(fila, obtenerToken);
