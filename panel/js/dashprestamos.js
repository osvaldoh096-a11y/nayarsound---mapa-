// Dashboard financiero de 💵REGISTRO DE PRESTAMOS › DASHBOARD: lee los mismos
// bloques que ves en tu hoja (resumen, ganancias, flujo, préstamos e
// inversores activos, cashflow y pagos) buscando cada uno por su título.
// No recalcula nada: muestra lo que tu hoja ya calcula.

import { normalizar, idxDesdeSerial } from './fechas.js?v=202611092213';
import { letraColumna } from './sheets.js?v=202611092213';

/** Importe de una celda: número, o texto como «$ 18,696.68» o « $ -   » (cero). */
export function importeCelda(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const t = String(v ?? '').trim();
  if (!t) return null;
  if (/^\$?\s*-\s*$/.test(t)) return 0;
  const pct = t.match(/^(-?[\d.,]+)\s*%$/);
  if (pct) return Number(pct[1].replace(/,/g, '')) / 100;
  const limpio = t.replace(/[$\s,]/g, '');
  const n = Number(limpio);
  return limpio && Number.isFinite(n) ? n : null;
}

const texto = (v) => String(v ?? '').trim();

/** Primera celda cuyo texto (normalizado) es exactamente `etiqueta`. */
function buscar(filas, etiqueta, { desde = 0 } = {}) {
  const b = normalizar(etiqueta);
  for (let f = desde; f < filas.length; f++) {
    const c = (filas[f] ?? []).findIndex((v) => normalizar(v) === b);
    if (c >= 0) return { f, c };
  }
  return null;
}

/** Fila de encabezados que contiene todas las etiquetas, en columnas seguidas. */
function buscarEncabezados(filas, etiquetas, { desde = 0 } = {}) {
  const bs = etiquetas.map(normalizar);
  for (let f = desde; f < filas.length; f++) {
    const fila = (filas[f] ?? []).map(normalizar);
    for (let c = 0; c < fila.length; c++) {
      if (bs.every((b, k) => fila[c + k] === b)) return { f, c };
    }
  }
  return null;
}

/** Filas debajo de un encabezado hasta la primera con la primera columna vacía. */
function filasDebajo(filas, { f, c }, ancho, { parar } = {}) {
  const salida = [];
  for (let k = f + 1; k < filas.length; k++) {
    const fila = filas[k] ?? [];
    const primera = texto(fila[c]);
    if (!primera || parar?.(primera)) break;
    salida.push({ fila: k, valores: Array.from({ length: ancho }, (_, j) => fila[c + j]) });
  }
  return salida;
}

/** Texto grande debajo de un título (como «CASHFLOW MES ACTUAL»). */
function textoDebajo(filas, etiqueta) {
  const p = buscar(filas, etiqueta);
  if (!p) return null;
  for (let k = 1; k <= 4; k++) {
    const t = texto(filas[p.f + k]?.[p.c]);
    if (t) return { texto: t, f: p.f + k, c: p.c };
  }
  return { texto: '', f: p.f + 1, c: p.c };
}

/**
 * filas: rango leído de DASHBOARD; inicio: { fila, col } de ese rango;
 * a1(f, c) da la referencia de una celda para los enlaces.
 */
export function leerDashboardPrestamos(filas, inicio) {
  const a1 = (f, c) => `${letraColumna(inicio.col + c)}${inicio.fila + f}`;
  const d = { secciones: 0 };

  // Resumen financiero: etiqueta | valor
  const rf = buscar(filas, 'RESUMEN FINANCIERO');
  if (rf) {
    d.resumen = [];
    for (let k = rf.f + 1; k < filas.length; k++) {
      const etiqueta = texto(filas[k]?.[rf.c]);
      const crudo = filas[k]?.[rf.c + 1];
      if (!etiqueta) { if (d.resumen.length) break; continue; }
      if (normalizar(etiqueta) === 'RESUMEN GENERAL') break;
      const valor = importeCelda(crudo);
      const esPct = /%/.test(String(crudo)) || (/PROMEDIO|PORCENTAJE|%/.test(normalizar(etiqueta)) && valor !== null && Math.abs(valor) < 1);
      d.resumen.push({ etiqueta, valor, esPct, a1: a1(k, rf.c + 1) });
    }
    d.secciones++;
  }

  // Ganancias históricas: totales y tabla por año
  const tot = buscarEncabezados(filas, ['TOTAL AÑOS', 'TOTAL GENERADO', 'TOTAL PAGADO', 'GANANCIA TOTAL']);
  if (tot) {
    const v = filas[tot.f + 1] ?? [];
    d.historico = {
      anios: importeCelda(v[tot.c]), generado: importeCelda(v[tot.c + 1]),
      pagado: importeCelda(v[tot.c + 2]), ganancia: importeCelda(v[tot.c + 3]), a1: a1(tot.f + 1, tot.c + 3),
    };
    d.secciones++;
  }
  const porAnio = buscarEncabezados(filas, ['AÑO', 'GENERADO', 'PAGADO', 'GANANCIA']);
  if (porAnio) {
    d.porAnio = filasDebajo(filas, porAnio, 4).map(({ valores: [y, g, p, n] }) => ({
      anio: texto(y), generado: importeCelda(g), pagado: importeCelda(p), ganancia: importeCelda(n),
    }));
  }

  // Ganancia por mes del año elegido en tu hoja
  const meses = buscarEncabezados(filas, ['MES', 'INTERESES COBRADOS', 'PAGADO', 'GANANCIA TOTAL']);
  if (meses) {
    const anioCelda = buscar(filas, 'AÑO', { desde: Math.max(0, meses.f - 2) });
    const anio = anioCelda && anioCelda.f < meses.f ? texto(filas[anioCelda.f]?.[anioCelda.c + 1]) : '';
    const todas = [];
    let total = null;
    for (let k = meses.f + 1; k < filas.length; k++) {
      const fila = filas[k] ?? [];
      const mes = texto(fila[meses.c]);
      if (/^TOTAL/i.test(mes)) {
        total = { etiqueta: mes, cobrado: importeCelda(fila[meses.c + 1]), pagado: importeCelda(fila[meses.c + 2]), ganancia: importeCelda(fila[meses.c + 3]) };
        break;
      }
      if (!mes) { if (k - meses.f > 20) break; continue; }
      todas.push({ mes, cobrado: importeCelda(fila[meses.c + 1]), pagado: importeCelda(fila[meses.c + 2]), ganancia: importeCelda(fila[meses.c + 3]) });
    }
    d.meses = { anio, filas: todas, total };
    d.secciones++;
  }

  // Flujo histórico: MES | GANANCIA
  const flujo = buscar(filas, 'FLUJO HISTORICO');
  const flujoEnc = flujo && buscarEncabezados(filas, ['MES', 'GANANCIA'], { desde: flujo.f });
  if (flujoEnc) {
    d.flujo = filasDebajo(filas, flujoEnc, 2).map(({ valores: [mes, g] }) => ({ mes: texto(mes), ganancia: importeCelda(g) }))
      .filter((x) => x.ganancia !== null || x.mes);
    d.secciones++;
  }

  // Préstamos activos e inversores activos
  const prest = buscarEncabezados(filas, ['NOMBRE', 'CAPITAL TOTAL', 'INTERES RESTANTE TOTAL', 'PAGO MENSUAL']);
  if (prest) {
    d.prestamosActivos = filasDebajo(filas, prest, 4).map(({ valores: [n, c, i, p] }) => ({
      nombre: texto(n), capital: importeCelda(c), interes: importeCelda(i), pago: importeCelda(p),
    }));
    d.secciones++;
  }
  const inv = buscarEncabezados(filas, ['NOMBRE', 'FECHA COMPROMISO PAGO', 'CAPITAL TOTAL', 'PAGO MENSUAL']);
  if (inv) {
    d.inversoresActivos = filasDebajo(filas, inv, 4).map(({ valores: [n, f, c, p] }) => ({
      nombre: texto(n), fecha: typeof f === 'number' ? idxDesdeSerial(f) : null, fechaTexto: typeof f === 'number' ? '' : texto(f),
      capital: importeCelda(c), pago: importeCelda(p),
    }));
    d.secciones++;
  }

  // Textos que arma tu hoja
  d.textos = {};
  for (const [clave, etiqueta] of [
    ['cashflowActual', 'CASHFLOW MES ACTUAL'], ['cashflowSiguiente', 'CASHFLOW MES SIGUIENTE'],
    ['cobroIntereses', 'COBRO INTERESES CLIENTES'],
    ['pagoMXN', 'PAGO A INVERSORES MXN'], ['pagoUSDT', 'PAGO A INVERSORES USDT'],
  ]) {
    const t = textoDebajo(filas, etiqueta);
    if (t) { d.textos[clave] = { texto: t.texto, a1: a1(t.f, t.c) }; d.secciones++; }
  }
  return d;
}

/** Ingresos, pagos y balance de una línea de cashflow («💰 Ingresos: $6.293 | 💸 Pagos: …»). */
export function leerCashflow(t) {
  const num = (re) => {
    const m = String(t ?? '').match(re);
    if (!m) return null;
    const n = Number(m[1].replace(/[.,]/g, '').replace(/^\$/, ''));
    return Number.isFinite(n) ? (/-/.test(m[0]) ? -Math.abs(n) : n) : null;
  };
  return {
    ingresos: num(/Ingresos:\s*\$?\s*(-?[\d.,]+)/i),
    pagos: num(/Pagos:\s*\$?\s*(-?[\d.,]+)/i),
    balance: num(/Balance:\s*\$?\s*(-?[\d.,]+)/i),
  };
}
