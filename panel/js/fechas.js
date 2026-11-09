// Fechas: todo se calcula como "día" entero (días desde 1970-01-01) en la
// zona horaria America/Mexico_City, para que "hoy", "mañana" y "mes actual"
// no dependan de la zona del dispositivo.

export const ZONA = 'America/Mexico_City';
const MS_DIA = 86400000;

export const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO',
  'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

const MESES_ABREV = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8,
  SEP: 9, SEPT: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12,
};

// getUTCDay(): 0 = domingo
const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function idxDesdeYMD(y, m, d) {
  return Math.round(Date.UTC(y, m - 1, d) / MS_DIA);
}

export function ymdDesdeIdx(idx) {
  const f = new Date(idx * MS_DIA);
  return { y: f.getUTCFullYear(), m: f.getUTCMonth() + 1, d: f.getUTCDate() };
}

export function diaSemanaIdx(idx) {
  return new Date(idx * MS_DIA).getUTCDay();
}

/** Hoy en Ciudad de México: { y, m, d, idx }. */
export function hoyCDMX(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(ahora);
  const v = (t) => Number(partes.find((p) => p.type === t).value);
  const y = v('year'); const m = v('month'); const d = v('day');
  // minuto: minutos transcurridos del día en Ciudad de México (para saber si un evento ya terminó).
  return { y, m, d, idx: idxDesdeYMD(y, m, d), minuto: (v('hour') % 24) * 60 + v('minute') };
}

/** Número de serie de Google Sheets (días desde 1899-12-30) a día entero. */
export function idxDesdeSerial(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  return Math.floor(serial) - 25569;
}

export function mesDesdeNombre(nombre) {
  const n = normalizar(nombre).replace(/\.$/, '');
  const completo = MESES.indexOf(n);
  if (completo >= 0) return completo + 1;
  return MESES_ABREV[n] ?? null;
}

export function diaSemanaDesdeNombre(nombre) {
  const i = DIAS.indexOf(normalizar(nombre));
  return i >= 0 ? i : null;
}

/**
 * Los textos de las hojas traen día y mes, pero no año. Se elige el año que
 * coincide con el día de la semana (si viene) y queda más cerca de hoy.
 * modo 'pasado' prefiere fechas que ya ocurrieron (deudas de eventos).
 */
export function inferirFecha(d, m, hoyIdx, { diaSemana = null, modo = 'cercano' } = {}) {
  if (!d || !m) return null;
  const { y } = ymdDesdeIdx(hoyIdx);
  let candidatos = [y - 1, y, y + 1].map((anio) => idxDesdeYMD(anio, m, d))
    .filter((idx) => ymdDesdeIdx(idx).d === d);
  if (diaSemana !== null) {
    const coinciden = candidatos.filter((idx) => diaSemanaIdx(idx) === diaSemana);
    if (coinciden.length) candidatos = coinciden;
  }
  if (modo === 'pasado') {
    const pasados = candidatos.filter((idx) => idx <= hoyIdx + 1);
    if (pasados.length) return Math.max(...pasados);
  }
  return candidatos.reduce((mejor, idx) =>
    (Math.abs(idx - hoyIdx) < Math.abs(mejor - hoyIdx) ? idx : mejor), candidatos[0]);
}

export function etiquetaMes(y, m) {
  return `${MESES[m - 1]} ${y}`;
}

/** "NOVIEMBRE 2026" -> { y: 2026, m: 11 } */
export function leerEtiquetaMes(texto) {
  const t = normalizar(texto).match(/^([A-Z]+)\s+(\d{4})$/);
  if (!t) return null;
  const m = mesDesdeNombre(t[1]);
  return m ? { y: Number(t[2]), m } : null;
}

const fmtLarga = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
});
const fmtCorta = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short',
});
const fmtMes = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', month: 'long', year: 'numeric' });

/** "sábado 7 de noviembre" */
export function fechaLarga(idx) {
  return fmtLarga.format(new Date(idx * MS_DIA));
}

/** "sáb, 7 nov" */
export function fechaCorta(idx) {
  return fmtCorta.format(new Date(idx * MS_DIA));
}

export function nombreMes(y, m) {
  const t = fmtMes.format(new Date(Date.UTC(y, m - 1, 1)));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function diasRelativos(diferencia) {
  if (diferencia === 0) return 'Hoy';
  if (diferencia === 1) return 'Mañana';
  if (diferencia === -1) return 'Ayer';
  if (diferencia > 1) return `En ${diferencia} días`;
  return `Hace ${-diferencia} días`;
}

/** Fracción de día (0.8333) -> "8:00 p.m." */
export function horaDesdeFraccion(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null;
  const minutos = Math.round((valor - Math.floor(valor)) * 1440) % 1440;
  const h = Math.floor(minutos / 60);
  const min = minutos % 60;
  const sufijo = h < 12 ? 'a.m.' : 'p.m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${sufijo}`;
}

const fmtMomento = new Intl.DateTimeFormat('es-MX', {
  timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short',
  hour: 'numeric', minute: '2-digit',
});
const fmtHora = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, hour: 'numeric', minute: '2-digit' });

/** Momento real (Date) en hora de CDMX: "sáb, 7 nov, 10:41 p.m." */
export function momento(fecha) {
  return fmtMomento.format(fecha);
}

export function hora(fecha) {
  return fmtHora.format(fecha);
}
