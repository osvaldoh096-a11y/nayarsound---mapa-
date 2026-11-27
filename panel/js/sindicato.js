// Préstamos que tú pagas cada mes (SINDICATO, MERCADOLIBRE…). Cada uno tiene
// su pestaña en tu hoja «TO DO · Dashboard personal»:
//   A:B  datos del préstamo (MONTO, TOTAL A PAGAR, PAGO MENSUAL, …)
//   D:F  tus abonos (FECHA, ABONO, NOTA)
//   H:I  (opcional) calendario: N, VENCE. Sin calendario se usan quincenas
//        desde INICIO PRIMERA QUINCENA (como el SINDICATO).

import { TAREAS } from './fuentes.js?v=202611270224';
import { leerRangos, agregarFila, borrarRango, escribirRango, actualizarHoja } from './api.js?v=202611270224';
import { idxDesdeSerial, idxDesdeYMD, ymdDesdeIdx, normalizar } from './fechas.js?v=202611270224';

const numero = (v) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(/[$,\s%]/g, '')));
/** Número o null (celda vacía o texto). */
const dato = (v) => (v === '' || v === undefined || v === null ? null : (Number.isFinite(numero(v)) ? numero(v) : null));
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
    if (i > 0 && Number.isInteger(n) && n > 0) vencimientos.push({ n, vence: fechaDe(f?.[8]), monto: dato(f?.[9]) });
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
    url: `https://docs.google.com/spreadsheets/d/${TAREAS.id}/edit${gid !== null && gid !== undefined ? `#gid=${gid}` : ''}`,
    S: { estado: 'sin-leer', datos: {}, abonos: [], vencimientos: [], error: null, guardando: false, demo: false },
  };
  const S = P.S;

  P.cargar = async (token) => {
    if (S.demo) return;
    try {
      const [v] = await leerRangos(token, TAREAS.id, [`${H}!A1:J200`]);
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
    const monto = dato(d.MONTO);
    const abonado = S.abonos.reduce((t, a) => t + a.monto, 0);
    const nq = dato(d.QUINCENAS);
    // Todo se ve por MES: 48 quincenas = 24 meses.
    const meses = dato(d['NUMERO DE PAGOS MENSUALES']) ?? dato(d['NUMERO DE PAGOS']) ?? (nq ? Math.ceil(nq / 2) : null);
    const tasa = dato(d['TASA ANUAL']);
    let total = dato(d['TOTAL A PAGAR']);
    let estimado = false;
    // Sin total en la hoja: se calcula con la tasa y el plazo (pagos fijos, sistema francés).
    if (total === null && monto && tasa && (nq || meses)) {
      const periodos = nq || meses;
      const i = tasa / (nq ? 24 : 12);
      const cuota = monto * i / (1 - (1 + i) ** -periodos);
      total = Math.round(cuota * periodos * 100) / 100;
      estimado = true;
    }
    const mensual = dato(d['PAGO MENSUAL']) ?? (dato(d['PAGO QUINCENAL']) !== null ? dato(d['PAGO QUINCENAL']) * 2 : null) ?? (total !== null && meses ? Math.round(total / meses * 100) / 100 : null);
    // Solo capital e interés: cada peso pagado se reparte en la proporción capital / total.
    const parteCapital = total && monto ? monto / total : null;
    const capitalPagado = parteCapital !== null ? abonado * parteCapital : null;
    // Los pagos van como los pide cada institución: quincenales (SINDICATO, BBVA) o mensuales.
    const quincenal = !!nq || normalizar(d.FRECUENCIA) === 'QUINCENAL';
    const pagoPeriodo = quincenal
      ? (dato(d['PAGO QUINCENAL']) ?? (dato(d['PAGO MENSUAL']) !== null ? dato(d['PAGO MENSUAL']) / 2 : null) ?? (total !== null && nq ? Math.round(total / nq * 100) / 100 : null))
      : mensual;
    const r = {
      monto, total, mensual, estimado, tasa, cat: dato(d.CAT), saldo: dato(d['SALDO PENDIENTE']),
      interes: total !== null && monto !== null ? total - monto : dato(d['INTERES TOTAL']),
      quincenas: nq, meses, quincenal, pagoPeriodo, prop: parteCapital, etiquetaPago: quincenal ? 'Pago quincenal' : 'Pago mensual',
      capitalMes: monto !== null && meses ? monto / meses : null,
      interesMes: mensual !== null && monto !== null && meses ? mensual - monto / meses : null,
      capitalPagado, interesPagado: capitalPagado !== null ? abonado - capitalPagado : null,
      capitalPendiente: capitalPagado !== null ? monto - capitalPagado : null,
      abonado, restante: total !== null ? total - abonado : null, avance: total ? abonado / total : null, abonos: S.abonos,
      finIdx: fechaDe(d['FECHA VENCIMIENTO']), inicioIdx: fechaDe(d['FECHA CONTRATACION']) ?? fechaDe(d['FECHA SOLICITUD']),
    };
    if (total === null) return r;

    // Calendario: el de la hoja (H:J) si está completo; si no, por quincenas o por meses.
    const nEsperado = quincenal ? (nq || (meses ? meses * 2 : null)) : meses;
    let filas = null;
    if (S.vencimientos.length && (!nEsperado || S.vencimientos.length >= nEsperado)) {
      filas = S.vencimientos.map((v, i) => ({ n: v.n, vence: v.vence, monto: v.monto, ini: i > 0 && S.vencimientos[i - 1].vence !== null && v.vence !== null ? S.vencimientos[i - 1].vence + 1 : null }));
    } else {
      const inicioV = d['INICIO PRIMERA QUINCENA'];
      const inicioQ = (typeof inicioV === 'number' ? idxDesdeSerial(inicioV) : fechaDe(inicioV)) ?? (quincenal ? r.inicioIdx : null);
      filas = [];
      if (quincenal && inicioQ !== null && nEsperado) {
        // Un pago por quincena (1–15 y 16–fin de mes).
        quincenas(inicioQ, nEsperado).forEach((q, k) => filas.push({ n: k + 1, ini: q.ini, vence: q.fin, monto: null }));
      } else if (r.inicioIdx !== null && meses) {
        // Un pago por mes, el mismo día en que se contrató.
        const { y, m, d: dia } = ymdDesdeIdx(r.inicioIdx);
        let previo = r.inicioIdx;
        for (let k = 1; k <= meses; k++) {
          const mm = ((m - 1 + k) % 12) + 1;
          const yy = y + Math.floor((m - 1 + k) / 12);
          const ultimo = ymdDesdeIdx(idxDesdeYMD(mm === 12 ? yy + 1 : yy, mm === 12 ? 1 : mm + 1, 1) - 1).d;
          const vence = idxDesdeYMD(yy, mm, Math.min(dia, ultimo));
          filas.push({ n: k, ini: previo + 1, vence, monto: null });
          previo = vence;
        }
      } else return r;
    }
    // Total de pagos del préstamo (aunque el calendario de la hoja tenga solo algunos).
    r.nPagos = filas.length;
    const nPagos = filas.length;
    r.pagos = [];
    let acumulado = 0;
    for (const f of filas) {
      // Monto del calendario; si no, el pago de tu hoja (el último ajusta la diferencia para llegar al total).
      let monto = f.monto;
      if (monto === null && pagoPeriodo !== null && pagoPeriodo > 0) monto = f.n < nPagos || total === null ? pagoPeriodo : Math.round((total - acumulado) * 100) / 100;
      if (monto === null && total !== null) monto = total / nPagos;
      const desdeA = acumulado; acumulado += monto ?? 0;
      const cubierto = monto === null ? 0 : Math.max(0, Math.min(monto, abonado - desdeA));
      const pagado = monto !== null && cubierto >= monto - 0.5;
      // Sin fecha de vencimiento (pagos viejos del calendario) cuenta como ya vencido.
      const vencido = f.vence === null ? true : f.vence < hoyIdx;
      const enCurso = f.ini !== null ? f.ini <= hoyIdx : f.vence !== null && f.vence - (quincenal ? 16 : 31) <= hoyIdx;
      r.pagos.push({ ...f, monto, cubierto, vencido,
        estado: pagado ? 'pagado' : vencido ? 'atrasado' : enCurso ? 'en-curso' : cubierto > 0 ? 'parcial' : 'pendiente' });
    }
    r.inicioIdx ??= r.pagos[0]?.ini ?? null;
    r.finIdx ??= r.pagos.at(-1)?.vence ?? null;
    r.esperado = r.pagos.filter((p) => p.vencido).reduce((t, p) => t + (p.monto ?? 0), 0);
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

export const BBVA = crearPrestamo({
  clave: 'bbva', pestana: 'BBVA', gid: 781, titulo: 'Préstamo BBVA',
  demo: (hoyIdx) => ({
    datos: { MONTO: 110600, 'SALDO PENDIENTE': 112308.21, 'TASA ANUAL': 0.3516, QUINCENAS: 48, 'FECHA CONTRATACION': hoyIdx - 15 + 25569, 'FECHA VENCIMIENTO': hoyIdx + 715 + 25569 },
    abonos: [],
    vencimientos: [{ n: 1, vence: hoyIdx, monto: 1582.92 }],
  }),
});

export const PRESTAMOS_PROPIOS = [SINDICATO, MERCADOLIBRE, BBVA];

/**
 * Lista de créditos de la pestaña CREDITOS (CRÉDITO, PESTAÑA). Un crédito
 * nuevo aparece solo en cuanto tiene su fila ahí; uno que quitas, desaparece.
 * Sin la pestaña (o vacía) se quedan los tres de siempre.
 */
export function sincronizarCreditos(filas) {
  const lista = (filas ?? []).map((f) => ({ nombre: String(f?.[0] ?? '').trim(), pestana: String(f?.[1] ?? '').trim() }))
    .filter((x) => x.nombre && x.pestana);
  if (!lista.length) return;
  const actuales = new Map(PRESTAMOS_PROPIOS.map((P) => [normalizar(P.pestana), P]));
  const nueva = lista.map(({ nombre, pestana }) => {
    const P = actuales.get(normalizar(pestana)) ?? crearPrestamo({
      clave: normalizar(pestana).toLowerCase().replace(/[^a-z0-9]+/g, '-'), pestana, gid: null, titulo: '',
      demo: () => ({ datos: {}, abonos: [], vencimientos: [] }),
    });
    P.titulo = `Préstamo ${nombre}`;
    return P;
  });
  PRESTAMOS_PROPIOS.splice(0, PRESTAMOS_PROPIOS.length, ...nueva);
}

/** Lee la lista de CREDITOS y luego cada crédito. */
export async function cargarPrestamosPropios(token) {
  try {
    const [v] = await leerRangos(token, TAREAS.id, ["'CREDITOS'!A2:B60"]);
    sincronizarCreditos(v);
  } catch { /* sin pestaña CREDITOS: se quedan los de siempre */ }
  await Promise.all(PRESTAMOS_PROPIOS.map((P) => P.cargar(token)));
}

// Compatibilidad: el SINDICATO con los nombres de antes.
export const S = SINDICATO.S;
export const URL_SINDICATO = SINDICATO.url;
export const cargarSindicato = (token) => SINDICATO.cargar(token);
export const usarDemoSindicato = (hoyIdx) => SINDICATO.usarDemo(hoyIdx);
export const resumenSindicato = (hoyIdx) => SINDICATO.resumen(hoyIdx);
export const agregarAbono = (datos, obtenerToken) => SINDICATO.agregarAbono(datos, obtenerToken);
export const borrarAbono = (fila, obtenerToken) => SINDICATO.borrarAbono(fila, obtenerToken);


// ---------------------------------------------------------------- Crédito nuevo
const LET_TOTAL = 'capi,VLOOKUP("MONTO",A2:B30,2,FALSE),totx,IFERROR(VLOOKUP("TOTAL A PAGAR",A2:B30,2,FALSE),""),quin,IFERROR(VLOOKUP("QUINCENAS",A2:B30,2,FALSE),""),tasa,IFERROR(VLOOKUP("TASA ANUAL",A2:B30,2,FALSE),""),total,IF(totx<>"",totx,-PMT(tasa/24,quin,capi)*quin)';
/** Las mismas fórmulas que tienen SINDICATO, MERCADOLIBRE y BBVA. */
export const FORMULAS_CREDITO = {
  tablaMensual: `=IF(COUNT(E2:E)=0,"Sin abonos",IFERROR(LET(${LET_TOTAL},prop,capi/total,fechas,FILTER(D2:D,ISNUMBER(E2:E),E2:E<>0),montos,FILTER(E2:E,ISNUMBER(E2:E),E2:E<>0),meses,SORT(UNIQUE(EOMONTH(fechas,0))),abonos,MAP(meses,LAMBDA(x,SUMPRODUCT((EOMONTH(fechas,0)=x)*montos))),acum,SCAN(0,abonos,LAMBDA(s,v,s+v)),HSTACK(meses,abonos,abonos*prop,abonos*(1-prop),capi-acum*prop)),"Revisa los datos"))`,
  capitalPagado: `=LET(${LET_TOTAL},SUM(E2:E)*capi/total)`,
  capitalPendiente: '=VLOOKUP("MONTO",A2:B30,2,FALSE)-S2',
  pagoMensual: `=LET(${LET_TOTAL},meses,IFERROR(VLOOKUP("NUMERO DE PAGOS MENSUALES",A2:B30,2,FALSE),quin/2),pmes,IFERROR(VLOOKUP("PAGO MENSUAL",A2:B30,2,FALSE),""),IF(pmes<>"",pmes,total/meses))`,
  interesMensual: '=LET(capi,VLOOKUP("MONTO",A2:B30,2,FALSE),quin,IFERROR(VLOOKUP("QUINCENAS",A2:B30,2,FALSE),""),meses,IFERROR(VLOOKUP("NUMERO DE PAGOS MENSUALES",A2:B30,2,FALSE),quin/2),S4-capi/meses)',
};

const numeroDe = (v) => {
  const t = String(v ?? '').replace(/[$,\s%]/g, '');
  return t === '' ? null : Number(t);
};

/** Nombre de pestaña válido y que no se repita. */
export function nombrePestana(nombre, existentes) {
  const base = String(nombre ?? '').toUpperCase().replace(/[\[\]*/\\?:'"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'CREDITO';
  const usadas = new Set([...existentes].map((x) => normalizar(x)));
  let t = base; let k = 2;
  while (usadas.has(normalizar(t))) t = `${base} ${k++}`;
  return t;
}

/**
 * Datos del crédito listos para la hoja. Pide nombre, capital y meses, y al
 * menos uno de: pago mensual, total a pagar o tasa anual.
 */
export function datosCreditoNuevo(form) {
  const nombre = String(form.nombre ?? '').trim();
  const monto = numeroDe(form.monto);
  const meses = numeroDe(form.meses);
  const pago = numeroDe(form.pago);
  const total = numeroDe(form.total);
  const tasa = numeroDe(form.tasa);
  if (!nombre) throw new Error('Escribe el nombre del crédito (por ejemplo COPPEL).');
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('Escribe el capital que te prestaron.');
  if (!Number.isInteger(meses) || meses <= 0) throw new Error('Escribe en cuántos meses lo pagas.');
  if (![pago, total, tasa].some((x) => Number.isFinite(x) && x > 0)) throw new Error('Escribe el pago mensual, el total a pagar o la tasa anual.');
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(form.fecha ?? '') ? form.fecha : hoyTexto();
  const filas = [['DATO', 'VALOR'], ['MONTO', monto]];
  if (Number.isFinite(total) && total > 0) filas.push(['TOTAL A PAGAR', total]);
  else if (Number.isFinite(pago) && pago > 0) filas.push(['TOTAL A PAGAR', Math.round(pago * meses * 100) / 100]);
  else {
    // Solo con tasa: pagos fijos mensuales (sistema francés).
    const i = tasa / 100 / 12;
    const cuota = monto * i / (1 - (1 + i) ** -meses);
    filas.push(['TOTAL A PAGAR', Math.round(cuota * meses * 100) / 100]);
  }
  if (Number.isFinite(pago) && pago > 0) filas.push(['PAGO MENSUAL', pago]);
  filas.push(['NUMERO DE PAGOS MENSUALES', meses]);
  if (Number.isFinite(tasa) && tasa > 0) filas.push(['TASA ANUAL', tasa / 100]);
  filas.push(['FECHA CONTRATACION', fecha]);
  return { nombre, filas };
}

/**
 * Crea el crédito en tu hoja «TO DO»: su pestaña (datos, abonos, tabla
 * mensual y resumen) y su fila en CREDITOS. Así entra solo a la HOJA DATA y
 * a tu RESUMEN FINANCIERO.
 */
export async function crearCredito(form, obtenerToken) {
  const { nombre, filas } = datosCreditoNuevo(form);
  const token = await obtenerToken();
  const [lista] = await leerRangos(token, TAREAS.id, ["'CREDITOS'!A1:B60"]);
  const pestanas = (lista ?? []).slice(1).map((f) => String(f?.[1] ?? '')).filter(Boolean);
  if ((lista ?? []).slice(1).some((f) => normalizar(f?.[0]) === normalizar(nombre))) throw new Error(`Ya tienes un crédito llamado ${nombre}.`);
  const pestana = nombrePestana(nombre, [...pestanas, ...PRESTAMOS_PROPIOS.map((P) => P.pestana), 'TAREAS', 'HABITOS', 'CREDITOS']);
  const sheetId = 800 + Math.floor(Math.random() * 1e6);
  const azul = { red: 0.35686275, green: 0.60784316, blue: 0.8352941 };
  const blanco = { red: 1, green: 1, blue: 1 };
  const rango = (r0, r1, c0, c1) => ({ sheetId, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 });
  const formato = (r, f, campos) => ({ repeatCell: { range: r, cell: { userEnteredFormat: f }, fields: campos } });
  await actualizarHoja(token, TAREAS.id, [
    { addSheet: { properties: { sheetId, title: pestana, gridProperties: { rowCount: 200, columnCount: 20, frozenRowCount: 1 } } } },
    formato(rango(0, 1, 0, 19), { backgroundColor: azul, textFormat: { bold: true, foregroundColor: blanco } }, 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat'),
    formato(rango(1, 200, 3, 4), { numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' } }, 'userEnteredFormat.numberFormat'),
    formato(rango(1, 200, 4, 5), { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' } }, 'userEnteredFormat.numberFormat'),
    formato(rango(1, 200, 11, 12), { numberFormat: { type: 'DATE', pattern: 'mmmm yyyy' } }, 'userEnteredFormat.numberFormat'),
    formato(rango(1, 200, 12, 16), { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' } }, 'userEnteredFormat.numberFormat'),
    formato(rango(1, 5, 18, 19), { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' } }, 'userEnteredFormat.numberFormat'),
  ]);
  const H = `'${pestana}'`;
  await escribirRango(token, TAREAS.id, `${H}!A1:B${filas.length}`, filas, { entrada: 'USER_ENTERED' });
  await escribirRango(token, TAREAS.id, `${H}!D1:F1`, [['FECHA', 'ABONO', 'NOTA']]);
  await escribirRango(token, TAREAS.id, `${H}!L1:P2`, [['MES', 'ABONADO', 'A CAPITAL', 'A INTERÉS', 'CAPITAL PENDIENTE'], [FORMULAS_CREDITO.tablaMensual, '', '', '', '']], { entrada: 'USER_ENTERED' });
  await escribirRango(token, TAREAS.id, `${H}!R1:S5`, [['RESUMEN DEL CRÉDITO', ''], ['CAPITAL PAGADO', FORMULAS_CREDITO.capitalPagado],
    ['CAPITAL PENDIENTE', FORMULAS_CREDITO.capitalPendiente], ['PAGO MENSUAL', FORMULAS_CREDITO.pagoMensual], ['INTERES MENSUAL', FORMULAS_CREDITO.interesMensual]], { entrada: 'USER_ENTERED' });
  // Su fila en CREDITOS (la primera vacía): de ahí lo toman la HOJA DATA y el panel.
  let fila = 2;
  while (String(lista?.[fila - 1]?.[0] ?? '').trim()) fila += 1;
  await escribirRango(token, TAREAS.id, `'CREDITOS'!A${fila}:B${fila}`, [[nombre, pestana]]);
  await cargarPrestamosPropios(token);
  const P = PRESTAMOS_PROPIOS.find((x) => normalizar(x.pestana) === normalizar(pestana));
  if (P) P.url = `https://docs.google.com/spreadsheets/d/${TAREAS.id}/edit#gid=${sheetId}`;
  return { nombre, pestana };
}
