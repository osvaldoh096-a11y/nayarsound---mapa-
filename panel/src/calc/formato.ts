import { partes, type Serie } from './fechas'

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// Redondeo de la hoja: mitades hacia afuera del cero, con corrección del error binario
// (ROUND(1.005; 2) = 1.01 en Sheets).
export function redondear(x: number, decimales = 0): number {
  const f = 10 ** decimales
  const v = Math.abs(x) * f
  const r = Math.round(v + v * 1e-12 + 1e-12) / f
  return x < 0 ? -r : r
}

function agrupar(entero: string, separador: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, separador)
}

// TEXT(x; "#,##0")
export function textoMiles(x: number): string {
  const r = redondear(x, 0)
  const s = agrupar(String(Math.abs(r)), ',')
  return r < 0 ? '-' + s : s
}

// SUBSTITUTE(TEXT(x; "#,##0"); ","; ".")
export function textoMilesPunto(x: number): string {
  return textoMiles(x).replace(/,/g, '.')
}

// TEXT(x; "0%")
export function textoPorcentaje(x: number): string {
  return redondear(x * 100, 0) + '%'
}

// TEXT(x; "#.##0"): sin separador de miles, de 1 a 3 decimales y sin cero a la izquierda.
export function textoDecimal3(x: number): string {
  const r = redondear(x, 3)
  let [ent, dec] = Math.abs(r).toFixed(3).split('.')
  dec = dec.replace(/0+$/, '')
  if (dec.length === 0) dec = '0'
  if (ent === '0') ent = ''
  return (r < 0 ? '-' : '') + ent + '.' + dec
}

const dos = (n: number) => String(n).padStart(2, '0')

// TEXT(fecha; "dd-mmm")
export function fechaDdMmm(s: Serie): string {
  const p = partes(s)
  return `${dos(p.dia)}-${MESES_CORTOS[p.mes - 1]}`
}

// TEXT(fecha; "dd-mmm-yy")
export function fechaDdMmmYy(s: Serie): string {
  const p = partes(s)
  return `${dos(p.dia)}-${MESES_CORTOS[p.mes - 1]}-${dos(p.anio % 100)}`
}

// TEXT(fecha; "dd-mmm-aaaa") tal como lo resuelve la hoja en es_MX: "10-oct-sábado".
export function fechaDdMmmAaaa(s: Serie): string {
  const p = partes(s)
  return `${dos(p.dia)}-${MESES_CORTOS[p.mes - 1]}-${DIAS_SEMANA[p.diaSemana]}`
}

// TEXT(fecha; "dddd dd ""de"" mmmm")
export function fechaLarga(s: Serie): string {
  const p = partes(s)
  return `${DIAS_SEMANA[p.diaSemana]} ${dos(p.dia)} de ${MESES[p.mes - 1]}`
}

// UPPER(TEXT(fecha; "mmmm yyyy"))
export function etiquetaMes(s: Serie): string {
  const p = partes(s)
  return `${MESES[p.mes - 1]} ${p.anio}`.toUpperCase()
}

// Formatos de pantalla (no de la hoja).
const fmt2 = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export function dinero(x: number | null | undefined): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—'
  const r = redondear(x, 2)
  return (r < 0 ? '-$' : '$') + fmt2.format(Math.abs(r))
}

export function porcentaje(x: number | null | undefined, decimales = 2): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—'
  return redondear(x * 100, decimales).toFixed(decimales) + '%'
}

export function numero(x: number, decimales = 0): string {
  return new Intl.NumberFormat('es-MX', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
    .format(redondear(x, decimales))
}

export function fechaCorta(s: Serie | null | undefined): string {
  if (s === null || s === undefined) return '—'
  const p = partes(s)
  return `${p.dia}-${MESES_CORTOS[p.mes - 1]}-${dos(p.anio % 100)}`
}
