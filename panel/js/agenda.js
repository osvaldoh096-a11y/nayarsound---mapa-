// Agenda de dinero: todo lo que cobras y todo lo que pagas en los próximos
// días, en una sola lista por fecha y con totales por semana.
//   Cobras: intereses de tus clientes (REGISTRO PRESTAMOS, cada mes en el día
//           de su FECHA INICIO; J J H F no entra porque se maneja distinto).
//   Pagas:  intereses a tus inversores (REGISTRO DE INVERSORES) y las cuotas
//           de tus créditos (SINDICATO, BBVA, Mercado Pago…) según su calendario.

import { ymdDesdeIdx, idxDesdeYMD } from './fechas.js?v=202611270237';
import { TIPO_CAMBIO_USDT } from './fuentes.js?v=202611270237';

/** Fechas de un pago mensual (mismo día cada mes) entre desde y hasta. */
export function fechasMensuales(dia, desde, hasta, inicioIdx = null) {
  if (!dia) return [];
  const salida = [];
  let { y, m } = ymdDesdeIdx(desde);
  for (let k = 0; k < 3; k++) {
    const ultimo = ymdDesdeIdx(idxDesdeYMD(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) - 1).d;
    const idx = idxDesdeYMD(y, m, Math.min(dia, ultimo));
    if (idx >= desde && idx <= hasta && (inicioIdx === null || idx > inicioIdx)) salida.push(idx);
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return salida;
}

const aMXN = (monto, divisa) => (divisa === 'USDT' ? monto * TIPO_CAMBIO_USDT : monto);

/**
 * Movimientos de los próximos `dias` días (hoy incluido). Lo atrasado se pone
 * hoy, marcado como vencido.
 */
export function agendaDinero({ clientes = [], inversiones = [], propios = [] }, hoyIdx, dias = 30) {
  const hasta = hoyIdx + dias - 1;
  const items = [];
  for (const c of clientes) {
    if (!(c.pagoMes > 0)) continue;
    for (const idx of fechasMensuales(c.dia, hoyIdx, hasta, c.inicioIdx)) {
      items.push({ idx, tipo: 'cobrar', grupo: 'Cliente', nombre: c.nombre, detalle: c.op ? `op. ${c.op}` : '', monto: c.pagoMes, divisa: c.divisa, montoMXN: aMXN(c.pagoMes, c.divisa) });
    }
  }
  for (const x of inversiones) {
    if (!(x.pagoMes > 0) || x.inicioIdx === null || x.inicioIdx === undefined) continue;
    const dia = ymdDesdeIdx(x.inicioIdx).d;
    const saltar = new Set();
    if (x.pago?.estado === 'atrasado') {
      items.push({ idx: hoyIdx, vencido: true, tipo: 'pagar', grupo: 'Inversor', nombre: x.nombre, detalle: `op. ${x.op} · atrasado`, monto: x.pagoMes, divisa: x.divisa, montoMXN: aMXN(x.pagoMes, x.divisa) });
      saltar.add(x.pago.idx);
    }
    if (x.pago?.estado === 'pagado' && x.pago.vence !== undefined) saltar.add(x.pago.vence);
    for (const idx of fechasMensuales(dia, hoyIdx, hasta, x.inicioIdx)) {
      if (saltar.has(idx)) continue;
      items.push({ idx, tipo: 'pagar', grupo: 'Inversor', nombre: x.nombre, detalle: `op. ${x.op}`, monto: x.pagoMes, divisa: x.divisa, montoMXN: aMXN(x.pagoMes, x.divisa) });
    }
  }
  for (const P of propios) {
    const r = P.resumen?.(hoyIdx);
    for (const p of r?.pagos ?? []) {
      if (p.estado === 'pagado' || p.monto === null) continue;
      const falta = Math.round((p.monto - p.cubierto) * 100) / 100;
      if (falta <= 0.5) continue;
      const vencido = p.vence === null || p.vence < hoyIdx;
      if (!vencido && p.vence > hasta) continue;
      items.push({ idx: vencido ? hoyIdx : p.vence, vencido, tipo: 'pagar', grupo: 'Crédito', nombre: P.titulo.replace(/^Préstamo\s+/i, ''),
        detalle: `pago ${p.n} de ${r.nPagos}${p.cubierto > 0.5 ? ' · resto' : ''}${vencido ? ' · atrasado' : ''}`, monto: falta, divisa: 'MXN', montoMXN: falta });
    }
  }
  items.sort((a, b) => a.idx - b.idx || (a.tipo === b.tipo ? 0 : a.tipo === 'pagar' ? -1 : 1) || b.montoMXN - a.montoMXN);

  // Semanas de lunes a domingo.
  const semanas = [];
  for (const it of items) {
    const dow = (new Date(it.idx * 86400000).getUTCDay() + 6) % 7;
    const ini = it.idx - dow;
    let s = semanas.at(-1);
    if (!s || s.ini !== ini) { s = { ini, fin: ini + 6, items: [], entra: 0, sale: 0 }; semanas.push(s); }
    s.items.push(it);
    if (it.tipo === 'cobrar') s.entra += it.montoMXN; else s.sale += it.montoMXN;
  }
  for (const s of semanas) { s.neto = s.entra - s.sale; s.pesada = s.sale > s.entra; }
  const entra = items.filter((i) => i.tipo === 'cobrar').reduce((t, i) => t + i.montoMXN, 0);
  const sale = items.filter((i) => i.tipo === 'pagar').reduce((t, i) => t + i.montoMXN, 0);
  return { desde: hoyIdx, hasta, items, semanas, entra, sale, neto: entra - sale };
}
