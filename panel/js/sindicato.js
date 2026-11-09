// Préstamo SINDICATO: tú lo pagas cada mes y anotas tus abonos en la
// pestaña SINDICATO de tu hoja «TO DO · Dashboard personal» (datos del
// préstamo en A:B; abonos en D:F: FECHA, ABONO, NOTA).

import { TAREAS } from './fuentes.js?v=202611092314';
import { leerRangos, agregarFila, borrarRango } from './api.js?v=202611092314';
import { idxDesdeSerial, idxDesdeYMD, ymdDesdeIdx, normalizar } from './fechas.js?v=202611092314';

const H = "'SINDICATO'";
export const URL_SINDICATO = `https://docs.google.com/spreadsheets/d/${TAREAS.id}/edit#gid=778`;

/** Estado: { estado: 'sin-leer'|'ok'|'error', datos, abonos, error, guardando } */
export const S = { estado: 'sin-leer', datos: {}, abonos: [], error: null, guardando: false, demo: false };

const numero = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[$,\s%]/g, '')));

export function leerSindicato(valores) {
  const datos = {};
  const abonos = [];
  (valores ?? []).forEach((f, i) => {
    const etq = normalizar(f?.[0]);
    if (etq && i > 0) datos[etq] = f?.[1];
    const monto = numero(f?.[4]);
    if (i > 0 && f?.[3] !== undefined && f?.[3] !== '' && Number.isFinite(monto) && monto !== 0) {
      abonos.push({ fila: i + 1, idx: typeof f[3] === 'number' ? idxDesdeSerial(f[3]) : null, fechaTexto: String(f[3]), monto, nota: String(f?.[5] ?? '').trim() });
    }
  });
  return { datos, abonos: abonos.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0)) };
}

export async function cargarSindicato(token) {
  if (S.demo) return;
  try {
    const [v] = await leerRangos(token, TAREAS.id, [`${H}!A1:F200`]);
    Object.assign(S, leerSindicato(v), { estado: 'ok', error: null });
  } catch (error) {
    S.estado = S.abonos.length ? 'ok' : 'error';
    S.error = error.message;
  }
}

export function usarDemoSindicato(hoyIdx) {
  const { y, m } = ymdDesdeIdx(hoyIdx);
  Object.assign(S, {
    demo: true, estado: 'ok', error: null,
    datos: { MONTO: 100000, 'TOTAL A PAGAR': 120000, 'PAGO MENSUAL': 5000, 'NUMERO DE PAGOS MENSUALES': 24, QUINCENAS: 48, 'TASA ANUAL': 0.13, 'INTERES TOTAL': 20000,
      'INICIO PRIMERA QUINCENA': idxDesdeYMD(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1, 16) + 25569 },
    abonos: [{ fila: 2, idx: hoyIdx - 20, monto: 5000, nota: 'Transferencia' }],
  });
}

/** Ventanas quincenales: 16–fin de mes y 1–15, desde la primera quincena. */
function quincenas(inicioIdx, n) {
  const lista = [];
  let { y, m, d } = ymdDesdeIdx(inicioIdx);
  let primera = d >= 16 ? false : true;
  for (let q = 0; q < n; q++) {
    const ini = idxDesdeYMD(y, m, primera ? 1 : 16);
    const fin = primera ? idxDesdeYMD(y, m, 15) : idxDesdeYMD(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) - 1;
    lista.push({ ini, fin });
    if (primera) primera = false;
    else { primera = true; m += 1; if (m > 12) { m = 1; y += 1; } }
  }
  return lista;
}

/** Cálculo del avance: lo abonado contra lo que ya debería ir pagado. */
export function resumenSindicato(hoyIdx) {
  const d = S.datos;
  const total = numero(d['TOTAL A PAGAR']);
  const mensual = numero(d['PAGO MENSUAL']);
  const nq = numero(d.QUINCENAS) || 48;
  const inicioV = d['INICIO PRIMERA QUINCENA'];
  const inicioIdx = typeof inicioV === 'number' ? idxDesdeSerial(inicioV) : null;
  const abonado = S.abonos.reduce((t, a) => t + a.monto, 0);
  const r = {
    monto: numero(d.MONTO), total, mensual, interes: numero(d['INTERES TOTAL']), tasa: numero(d['TASA ANUAL']), quincenas: nq,
    abonado, restante: Number.isFinite(total) ? total - abonado : null, avance: total ? abonado / total : null, abonos: S.abonos,
  };
  if (inicioIdx === null || !Number.isFinite(total)) return r;
  const porQuincena = total / nq;
  const qs = quincenas(inicioIdx, nq);
  r.inicioIdx = qs[0].ini; r.finIdx = qs.at(-1).fin;
  // Pagos mensuales = 2 quincenas; vence al terminar la segunda.
  r.pagos = [];
  let acumulado = 0;
  const nPagos = Math.ceil(nq / 2);
  for (let k = 0; k < nq; k += 2) {
    // Pago mensual de tu hoja; el último ajusta la diferencia para llegar al total.
    const n = k / 2 + 1;
    const monto = Number.isFinite(mensual) && mensual > 0
      ? (n < nPagos ? mensual : Math.round((total - mensual * (nPagos - 1)) * 100) / 100)
      : porQuincena * Math.min(2, nq - k);
    const desdeA = acumulado; acumulado += monto;
    const cubierto = Math.max(0, Math.min(monto, abonado - desdeA));
    const vence = qs[Math.min(k + 1, nq - 1)].fin;
    r.pagos.push({ n: k / 2 + 1, ini: qs[k].ini, vence, monto, cubierto,
      estado: cubierto >= monto - 0.5 ? 'pagado' : vence < hoyIdx ? 'atrasado' : qs[k].ini <= hoyIdx ? 'en-curso' : cubierto > 0 ? 'parcial' : 'pendiente' });
  }
  // Lo que ya debería ir pagado: pagos vencidos.
  const vencidos = r.pagos.filter((p) => p.vence < hoyIdx);
  r.esperado = vencidos.reduce((t, p) => t + p.monto, 0);
  r.diferencia = abonado - r.esperado;
  r.actual = r.pagos.find((p) => p.estado !== 'pagado') ?? null;
  r.pagados = r.pagos.filter((p) => p.estado === 'pagado').length;
  const { y, m } = ymdDesdeIdx(hoyIdx);
  r.abonadoMes = S.abonos.filter((a) => a.idx !== null && ymdDesdeIdx(a.idx).y === y && ymdDesdeIdx(a.idx).m === m).reduce((t, a) => t + a.monto, 0);
  return r;
}

/** Fecha de hoy en Ciudad de México como texto para la hoja (AAAA-MM-DD). */
function hoyTexto() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
}

export async function agregarAbono({ monto, fecha, nota }, obtenerToken) {
  const valor = Number(String(monto).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Escribe un monto válido, por ejemplo 10310.');
  const f = /^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '') ? fecha : hoyTexto();
  if (S.demo) {
    const [y, m, d] = f.split('-').map(Number);
    S.abonos.push({ fila: S.abonos.length + 2, idx: idxDesdeYMD(y, m, d), monto: valor, nota: String(nota ?? '').trim() });
    return;
  }
  const token = await obtenerToken();
  // Fecha como fecha de Sheets; monto como número; nota tal cual.
  await agregarFila(token, TAREAS.id, `${H}!D1:F1`, [f, valor, String(nota ?? '').trim()], { entrada: 'USER_ENTERED', texto: [2] });
  await cargarSindicato(token);
}

export async function borrarAbono(fila, obtenerToken) {
  const a = S.abonos.find((x) => x.fila === fila);
  if (!a) return;
  if (S.demo) { S.abonos = S.abonos.filter((x) => x !== a); return; }
  const token = await obtenerToken();
  const [v] = await leerRangos(token, TAREAS.id, [`${H}!E${fila}`]);
  if (numero(v?.[0]?.[0]) !== a.monto) throw new Error('Ese abono cambió en tu hoja. Toca «Actualizar» y vuelve a intentarlo.');
  await borrarRango(token, TAREAS.id, `${H}!D${fila}:F${fila}`);
  await cargarSindicato(token);
}
