// Operación de NayarSound: eventos y dinero por mes a partir de AGENDA Y
// VENTAS (todos los eventos, realizados y agendados) y los números del
// DASHBOARD de la hoja (operación mensual, resultado histórico).

import { normalizar, ymdDesdeIdx, idxDesdeYMD } from './fechas.js?v=202611100136';
import { importeCelda } from './dashprestamos.js?v=202611100136';

const texto = (v) => String(v ?? '').trim();
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : importeCelda(v));

/** «$171,372 (49%)» → { valor: 171372, pct: 0.49 } */
function montoConPct(v) {
  if (typeof v === 'number') return { valor: v, pct: null };
  const t = texto(v);
  const pct = t.match(/\((-?[\d.,]+)\s*%\)/);
  const base = t.replace(/\(.*\)/, '').trim();
  return { valor: importeCelda(base), pct: pct ? Number(pct[1].replace(/,/g, '')) / 100 : null };
}

const claveMes = (y, m) => y * 12 + (m - 1);
const desdeClave = (k) => ({ y: Math.floor(k / 12), m: (k % 12) + 1 });

/**
 * registros: filas de AGENDA Y VENTAS ya leídas (fecha idx, ciudad, dj, tipo,
 * total, ganancia, ganancia2, realizado). dashboard: rango del DASHBOARD.
 */
export function modeloOperacion(registros, dashboard, hoyIdx) {
  const hoy = ymdDesdeIdx(hoyIdx);
  const kHoy = claveMes(hoy.y, hoy.m);
  const eventos = (registros ?? []).filter((r) => r.idx !== null && r.idx !== undefined && num(r.total) !== null);

  const meses = new Map();
  const mesDe = (k) => {
    if (!meses.has(k)) meses.set(k, { k, ...desdeClave(k), eventos: 0, realizados: 0, agendados: 0, generado: 0, ganancia: 0, gananciaPersonal: 0, pagoDj: 0, conGanancia: 0 });
    return meses.get(k);
  };
  for (const r of eventos) {
    const { y, m } = ymdDesdeIdx(r.idx);
    const x = mesDe(claveMes(y, m));
    const realizado = normalizar(r.realizado) === 'SI';
    x.eventos += 1;
    if (realizado) x.realizados += 1; else x.agendados += 1;
    x.generado += num(r.total) ?? 0;
    const g = num(r.ganancia); const g2 = num(r.ganancia2); const dj = num(r.pagoDj);
    if (g !== null && texto(r.ganancia) !== '') { x.ganancia += g; x.conGanancia += 1; }
    if (g2 !== null && texto(r.ganancia2) !== '') x.gananciaPersonal += g2;
    if (dj !== null && texto(r.pagoDj) !== '') x.pagoDj += dj;
  }
  // Serie: 12 meses atrás hasta 2 adelante (con los meses vacíos en cero de eventos).
  const serie = [];
  for (let k = kHoy - 11; k <= kHoy + 2; k++) serie.push(meses.get(k) ?? { k, ...desdeClave(k), eventos: 0, realizados: 0, agendados: 0, generado: 0, ganancia: 0, gananciaPersonal: 0, pagoDj: 0, conGanancia: 0 });
  const vacio = (k) => ({ k, ...desdeClave(k), eventos: 0, realizados: 0, agendados: 0, generado: 0, ganancia: 0, gananciaPersonal: 0, pagoDj: 0, conGanancia: 0 });
  const anterior = meses.get(kHoy - 1) ?? vacio(kHoy - 1);
  const actual = meses.get(kHoy) ?? vacio(kHoy);
  const proximo = meses.get(kHoy + 1) ?? vacio(kHoy + 1);

  // Desglose del mes actual: por ciudad, DJ, tipo de evento y día de la semana
  const delMes = eventos.filter((r) => { const { y, m } = ymdDesdeIdx(r.idx); return claveMes(y, m) === kHoy; });
  const agrupar = (lista, clave, nombre = (r) => texto(r[clave]) || 'Sin dato') => {
    const g = new Map();
    for (const r of lista) {
      const n = normalizar(nombre(r)) || 'SIN DATO';
      const x = g.get(n) ?? { nombre: texto(nombre(r)).replace(/\s+/g, ' ') || 'Sin dato', eventos: 0, generado: 0 };
      x.eventos += 1; x.generado += num(r.total) ?? 0;
      g.set(n, x);
    }
    return [...g.values()].sort((a, b) => b.eventos - a.eventos || b.generado - a.generado);
  };
  const ciudades = agrupar(delMes, 'ciudad');
  const djs = agrupar(delMes.filter((r) => texto(r.dj)), 'dj');
  const tipos = agrupar(delMes, 'tipo', (r) => texto(r.tipo) || 'Sin tipo');
  const sinDj = delMes.filter((r) => !texto(r.dj)).length;
  // Próximos 7 días por día
  const proximos = eventos.filter((r) => r.idx >= hoyIdx && r.idx < hoyIdx + 7);
  const porDia = [];
  for (let d = 0; d < 7; d++) {
    const lista = proximos.filter((r) => r.idx === hoyIdx + d);
    porDia.push({ idx: hoyIdx + d, eventos: lista.length, generado: lista.reduce((t, r) => t + (num(r.total) ?? 0), 0) });
  }
  // Ciudades en los últimos 12 meses (participación)
  const desde = idxDesdeYMD(desdeClave(kHoy - 11).y, desdeClave(kHoy - 11).m, 1);
  const ciudadesAnio = agrupar(eventos.filter((r) => r.idx >= desde && r.idx <= hoyIdx), 'ciudad');

  return {
    serie, anterior, actual, proximo, ciudades, djs, tipos, sinDj, porDia, ciudadesAnio,
    totalEventos: eventos.filter((r) => normalizar(r.realizado) === 'SI').length,
    dashboard: leerDashboardNs(dashboard ?? []),
  };
}

/** Números del DASHBOARD de NayarSound (etiqueta en una columna, valor a la derecha). */
export function leerDashboardNs(filas) {
  const buscar = (etq) => {
    const e = normalizar(etq);
    for (const f of filas) {
      const c = (f ?? []).findIndex((v) => normalizar(v) === e);
      if (c >= 0) return f[c + 1];
    }
    return undefined;
  };
  const d = {};
  const titulo = filas.flat().map(texto).find((t) => /EVENTOS REALIZADOS/i.test(t));
  d.realizadosTexto = titulo ?? null;
  const fF = filas.findIndex((f) => (f ?? []).some((v) => normalizar(v) === 'CIUDAD') && (f ?? []).some((v) => normalizar(v) === 'MES'));
  if (fF >= 0) {
    const cC = filas[fF].findIndex((v) => normalizar(v) === 'CIUDAD');
    const fila = filas[fF + 2] ?? filas[fF + 1] ?? [];
    d.filtro = { ciudad: texto(fila[cC]), mes: texto(fila[cC + 1]) };
  }
  const op = {};
  for (const [k, etq] of [['generado', 'GENERADO'], ['djs', 'PAGADO A DJS'], ['publicidad', 'PUBLICIDAD'], ['operacion', 'OPERACION Y AT CLIENTE'],
    ['neta', 'GANANCIA NETA MENSUAL'], ['netaPersonal', 'GANANCIA NETA MENSUAL PER.'], ['porEvento', 'ME QUEDA X EVENTO']]) {
    const v = buscar(etq);
    if (v !== undefined) op[k] = montoConPct(v);
  }
  d.operacion = Object.keys(op).length ? op : null;
  const fR = filas.findIndex((f) => (f ?? []).some((v) => normalizar(v).startsWith('POR CADA $1')));
  if (fR >= 0) {
    const c = filas[fR].findIndex((v) => normalizar(v).startsWith('POR CADA $1'));
    const x = (t) => { const n = Number(String(t ?? '').replace(/[^\d.,-]/g, '').replace(/,/g, '')); return String(t ?? '').trim() && Number.isFinite(n) ? n : null; };
    d.roas = { ventas: x(filas[fR + 2]?.[c]), neta: x(filas[fR + 2]?.[c + 1]) };
  }
  const hist = {};
  for (const [k, etq] of [['stock', 'INVERSION TOTAL STOCK'], ['utilidad', 'UTILIDAD ACUMULADA'], ['excedente', 'EXCEDENTE SOBRE INVERSION']]) {
    const v = buscar(etq);
    if (v !== undefined) hist[k] = num(v);
  }
  d.historico = Object.keys(hist).length ? hist : null;
  const personal = [];
  for (const f of filas) {
    for (let c = 0; c < (f ?? []).length; c++) {
      const t = normalizar(f[c]);
      if (/^UTILIDAD (TEPIC|GUADALAJARA|LEON|MONTERREY)/.test(t) || t.startsWith('TOTAL GANANCIA PERSONAL')) {
        personal.push({ etiqueta: texto(f[c]), valor: num(f[c + 1]), total: t.startsWith('TOTAL') });
      }
    }
  }
  d.personal = personal.length ? personal : null;
  return d;
}
