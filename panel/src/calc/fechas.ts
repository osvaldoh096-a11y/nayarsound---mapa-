// Las fechas se manejan como número de serie de Google Sheets (días desde 1899-12-30),
// así las restas y comparaciones dan exactamente lo mismo que en la hoja.
export type Serie = number

const EPOCA = Date.UTC(1899, 11, 30)
const DIA_MS = 86_400_000

export function serieDeISO(iso: string): Serie {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - EPOCA) / DIA_MS)
}

export function isoDeSerie(s: Serie): string {
  return new Date(EPOCA + s * DIA_MS).toISOString().slice(0, 10)
}

export interface Partes {
  anio: number
  mes: number // 1-12
  dia: number
  diaSemana: number // 0 = domingo
}

export function partes(s: Serie): Partes {
  const d = new Date(EPOCA + s * DIA_MS)
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate(), diaSemana: d.getUTCDay() }
}

// DATE(año; mes; día): igual que en Sheets, los meses y días fuera de rango se desbordan
// al siguiente periodo (p. ej. DATE(2026; 11; 31) = 1-dic-2026).
export function DATE(anio: number, mes: number, dia: number): Serie {
  return Math.round((Date.UTC(anio, mes - 1, dia) - EPOCA) / DIA_MS)
}

// EDATE(fecha; meses): mismo día n meses después; si ese día no existe, último día del mes.
export function EDATE(s: Serie, meses: number): Serie {
  const p = partes(s)
  const total = p.anio * 12 + (p.mes - 1) + meses
  const anio = Math.floor(total / 12)
  const mes = total - anio * 12 + 1
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  return DATE(anio, mes, Math.min(p.dia, ultimo))
}

// TODAY() en la zona horaria configurada (la hoja usaba America/Los_Angeles).
export function hoyEn(zona: string, ahora: Date = new Date()): Serie {
  const texto = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora)
  return serieDeISO(texto)
}

// "MES AÑO" como la columna AUXILIAR: UPPER(TEXT(DATE(YEAR(x);MONTH(x);1);"mmmm yyyy")).
export function primerDiaMes(s: Serie): Serie {
  const p = partes(s)
  return DATE(p.anio, p.mes, 1)
}
