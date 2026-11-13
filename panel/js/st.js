// Negocio ST (🖥️ST- SISTEMAS Y TECNOLOGIA - PERSONAL): lee su DASHBOARD,
// el REGISTRO DE VENTAS y el resumen de stock y caja. No recalcula lo que la
// hoja ya calcula: lo toma por su etiqueta.

import { normalizar, idxDesdeSerial, idxDesdeYMD, ymdDesdeIdx, inferirFecha } from './fechas.js?v=202611130532';
import { importeCelda } from './dashprestamos.js?v=202611130532';

const texto = (v) => String(v ?? '').trim();
const MESES_TXT = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DIC: 12 };

/** Fecha de venta: número de serie o texto «23 sep» / «1-nov» (sin año: la más reciente que no sea futura). */
function fechaVenta(v, hoyIdx) {
  if (typeof v === 'number' && Number.isFinite(v)) return idxDesdeSerial(v);
  const m = normalizar(v).match(/^(\d{1,2})[\s\-/]+([A-Z]{3,4})/);
  if (!m || !MESES_TXT[m[2]]) return null;
  return inferirFecha(Number(m[1]), MESES_TXT[m[2]], hoyIdx, { modo: 'pasado' });
}

/** Valor a la derecha de una etiqueta, buscando después de un título de bloque. */
function valorTras(filas, titulo, etiqueta) {
  const t = normalizar(titulo);
  const e = normalizar(etiqueta);
  let desde = 0;
  if (titulo) {
    desde = filas.findIndex((f) => (f ?? []).some((v) => normalizar(v).startsWith(t)));
    if (desde < 0) return null;
  }
  for (let f = desde; f < filas.length; f++) {
    const fila = filas[f] ?? [];
    const c = fila.findIndex((v) => normalizar(v) === e);
    if (c >= 0) return { valor: importeCelda(fila[c + 1]), texto: texto(fila[c + 1]) };
  }
  return null;
}

export function modeloST(fuente, hoy) {
  const salida = { disponible: !!fuente?.rangos, avisos: [] };
  if (!fuente?.rangos) return salida;
  const dash = fuente.rangos.dashboard ?? [];

  // Filtros que tiene elegidos tu DASHBOARD (CIUDAD y MES).
  const fFiltro = dash.findIndex((f) => normalizar(f?.[0]) === 'CIUDAD' && normalizar(f?.[1]) === 'MES');
  salida.filtro = fFiltro >= 0 ? { ciudad: texto(dash[fFiltro + 2]?.[0] ?? dash[fFiltro + 1]?.[0]), mes: texto(dash[fFiltro + 2]?.[1] ?? dash[fFiltro + 1]?.[1]) } : null;

  const v = (titulo, etq) => valorTras(dash, titulo, etq)?.valor ?? null;
  salida.socios = {
    ventas: v('GANANCIA SOCIOOS', 'TOTAL DE VENTAS') ?? v('GANANCIA SOCIOS', 'TOTAL DE VENTAS'),
    stock: v('GANANCIA SOCIOOS', 'PAGADO STOCK') ?? v('GANANCIA SOCIOS', 'PAGADO STOCK'),
    caja: v('GANANCIA SOCIOOS', 'DESTINADO A CAJA') ?? v('GANANCIA SOCIOS', 'DESTINADO A CAJA'),
    operativa: v('', 'GANANCIA TOTAL OPERATIVA'),
    personal: v('', 'GANANCIA NETA MENSUAL PERSONAL'),
  };
  salida.negocio = {
    ventas: v('GANANCIA DE NEGOCIO', 'TOTAL DE VENTAS'),
    stock: v('GANANCIA DE NEGOCIO', 'PAGADO STOCK'),
    publicidad: v('GANANCIA DE NEGOCIO', 'PAGADO PUBLICIDAD'),
    operacion: v('GANANCIA DE NEGOCIO', 'PAGADO OPERACION Y AT CLIENTE'),
    utilidad: v('GANANCIA DE NEGOCIO', 'UTILIDAD NEGOCIO'),
  };
  // ROAS: «POR CADA $1 MXN INVERTIDO EN ADS» → fila de encabezados y fila de valores (19.62x)
  const fRoas = dash.findIndex((f) => normalizar(f?.[0]).startsWith('POR CADA $1'));
  if (fRoas >= 0) {
    const x = (t) => { const n = Number(String(t ?? '').replace(/[^\d.,-]/g, '').replace(/,/g, '')); return Number.isFinite(n) && String(t ?? '').trim() ? n : null; };
    salida.roas = { ventas: x(dash[fRoas + 2]?.[0]), neta: x(dash[fRoas + 2]?.[1]) };
  }
  // Ganancia personal histórica: filas «UTILIDAD TEPIC (50%)», «UTILIDAD GUADALAJARA (100%)», «TOTAL GANANCIA PERSONAL»
  const fHist = dash.findIndex((f) => normalizar(f?.[0]) === 'GANANCIA PERSONAL HISTORICA');
  if (fHist >= 0) {
    salida.historica = [];
    for (let k = fHist + 1; k < dash.length && k < fHist + 12; k++) {
      const etq = texto(dash[k]?.[0]);
      if (!etq) { if (salida.historica.length) break; continue; }
      salida.historica.push({ etiqueta: etq, valor: importeCelda(dash[k]?.[1]), total: /^TOTAL/i.test(normalizar(etq)) });
    }
  }
  // ROA por ciudad
  const fRoa = dash.findIndex((f) => normalizar(f?.[0]) === 'CIUDAD' && normalizar(f?.[1]).startsWith('PUBLICIDAD'));
  if (fRoa >= 0) {
    salida.ciudades = [];
    for (let k = fRoa + 1; k < dash.length; k++) {
      const f = dash[k] ?? [];
      if (!texto(f[0])) break;
      const x = (t) => { const n = Number(String(t ?? '').replace(/[^\d.,-]/g, '').replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
      salida.ciudades.push({ ciudad: texto(f[0]), ads: importeCelda(f[1]), vendido: importeCelda(f[2]), neto: importeCelda(f[3]), roasVenta: x(f[4]), roasNeto: x(f[5]), total: normalizar(f[0]) === 'TOTAL' });
    }
  }

  // Registro de ventas
  const vf = fuente.rangos.ventas ?? [];
  const enc = vf.findIndex((f) => (f ?? []).map(normalizar).includes('VENTA') && (f ?? []).map(normalizar).includes('LIQUIDADO'));
  salida.ventas = [];
  if (enc >= 0) {
    const h = vf[enc].map(normalizar);
    const col = (n) => h.indexOf(n);
    const c = { op: col('OP'), fecha: col('FECHA'), ciudad: col('CIUDAD'), cliente: col('CLIENTE'), programa: col('PROGRAMA'), kit: col('KIT'),
      venta: col('VENTA'), caja: col('DESTINADO A CAJA'), ganancia: col('GANANCIA TOTAL'), personal: h.findIndex((x) => x.startsWith('GANANCIA /')), liquidado: col('LIQUIDADO') };
    for (let k = enc + 1; k < vf.length; k++) {
      const f = vf[k] ?? [];
      const venta = importeCelda(f[c.venta]);
      if (!texto(f[c.fecha]) || venta === null) continue;
      salida.ventas.push({
        op: texto(f[c.op]), idx: fechaVenta(f[c.fecha], hoy.idx), ciudad: texto(f[c.ciudad]), cliente: texto(f[c.cliente]),
        programa: texto(f[c.programa]), kit: texto(f[c.kit]), venta, caja: importeCelda(f[c.caja]),
        ganancia: importeCelda(f[c.ganancia]), personal: importeCelda(f[c.personal]),
        liquidado: normalizar(f[c.liquidado]) === 'SI',
      });
    }
  } else if (vf.length) salida.avisos.push('No encontré el REGISTRO DE VENTAS (encabezados VENTA y LIQUIDADO) en HOJA DE VENTAS.');
  const mes = (x) => x.idx !== null && ymdDesdeIdx(x.idx).y === hoy.y && ymdDesdeIdx(x.idx).m === hoy.m;
  const delMes = salida.ventas.filter(mes);
  const suma = (lista, k) => lista.reduce((t, x) => t + (x[k] ?? 0), 0);
  salida.mes = { ventas: delMes, cantidad: delMes.length, venta: suma(delMes, 'venta'), personal: suma(delMes, 'personal'), ganancia: suma(delMes, 'ganancia') };
  salida.sinLiquidar = salida.ventas.filter((x) => !x.liquidado);
  salida.ultimas = [...salida.ventas].sort((a, b) => (b.idx ?? 0) - (a.idx ?? 0) || Number(b.op) - Number(a.op)).slice(0, 8);
  salida.inicioMes = idxDesdeYMD(hoy.y, hoy.m, 1);

  // Caja y stock (STOCK, OPERACION)
  const so = fuente.rangos.stock ?? [];
  const caja = {};
  for (const f of so) {
    for (const t of (f ?? []).map(texto)) {
      const m = t.match(/^\$?(-?[\d,.]+)\s+(generado en caja|gastado|disponible)$/i);
      if (m) caja[normalizar(m[2]).split(' ')[0].toLowerCase()] = Number(m[1].replace(/,/g, ''));
    }
  }
  salida.caja = Object.keys(caja).length ? { generado: caja.generado ?? null, gastado: caja.gastado ?? null, disponible: caja.disponible ?? null } : null;
  const fCiud = so.findIndex((f) => (f ?? []).map(normalizar).includes('TEPIC'));
  salida.stock = [];
  if (fCiud >= 0) {
    (so[fCiud] ?? []).forEach((ciudad, c) => {
      if (!texto(ciudad)) return;
      const items = [];
      for (let k = fCiud + 1; k < so.length; k++) {
        const t = texto(so[k]?.[c]);
        if (!t) break;
        const m = t.match(/^(.*?)\s*-\s*(\d*)\s*en stock$/i);
        items.push(m ? { producto: m[1].trim(), cantidad: m[2] === '' ? null : Number(m[2]) } : { producto: t, cantidad: /NO HAY/i.test(t) ? 0 : null, nota: t });
      }
      salida.stock.push({ ciudad: texto(ciudad), items });
    });
  }
  return salida;
}
