// Columnas calculadas de "REGISTRO PRESTAMOS" y "REGISTRO DE INVERSORES".
import { DATE, partes, primerDiaMes, serieDeISO, type Serie } from './fechas'
import { etiquetaMes } from './formato'
import type { Datos, Operacion, Pago, Persona } from './tipos'

export interface Fila {
  op: Operacion
  persona: Persona | undefined
  nombre: string // D
  inicio: Serie // C
  compromiso: Serie | null // I
  diaFinal: Serie // J
  diaFinalDinamico: boolean // J = TODAY()
  pagoMes: number // M = F*H
  intDiario: number // N = F*H/30
  totDias: number // préstamos: J-C+1 · inversores: J-C
  totMeses: number // días/30
  intTotal: number // préstamos Q · inversores O = F*H*días/30
  pagado: number // SUMIF(OP de pagos; OP; CANT)
  intRestante: number // L = interés total - pagado
  fechaDinamica: Serie // R
  auxiliar: string // S
  pagos: Pago[]
  diferido: boolean
}

export interface Modelo {
  hoy: Serie
  tc: number
  prestamos: Fila[]
  inversiones: Fila[]
  porId: Map<string, Fila>
  personas: Map<string, Persona>
  pagosPrestamo: Pago[]
  pagosInversion: Pago[]
}

// FECHA DINAMICA (columna R) de ambas hojas.
export function fechaDinamica(inicio: Serie, hoy: Serie): Serie {
  const c = partes(inicio)
  const t = partes(hoy)
  const anioBase = c.anio < t.anio ? t.anio : c.anio
  const mesPago = c.mes === t.mes ? t.mes + 1 : t.mes
  const anioPago = mesPago > 12 ? anioBase + 1 : anioBase
  const mesFinal = mesPago > 12 ? 1 : mesPago
  return DATE(anioPago, mesFinal, c.dia)
}

export function calcularFila(op: Operacion, persona: Persona | undefined, pagos: Pago[], hoy: Serie): Fila {
  const inicio = serieDeISO(op.fecha_inicio)
  const diaFinal = op.dia_final ? serieDeISO(op.dia_final) : hoy
  const F = op.cantidad
  const H = op.tasa
  const totDias = op.tipo === 'prestamo' ? diaFinal - inicio + 1 : diaFinal - inicio
  const intTotal = (F * H * totDias) / 30
  const pagado = pagos.reduce((a, p) => a + p.cantidad, 0)
  return {
    op,
    persona,
    nombre: persona?.nombre ?? '',
    inicio,
    compromiso: op.fecha_compromiso ? serieDeISO(op.fecha_compromiso) : null,
    diaFinal,
    diaFinalDinamico: !op.dia_final,
    pagoMes: F * H,
    intDiario: (F * H) / 30,
    totDias,
    totMeses: totDias / 30,
    intTotal,
    pagado,
    intRestante: intTotal - pagado,
    fechaDinamica: fechaDinamica(inicio, hoy),
    auxiliar: etiquetaMes(primerDiaMes(inicio)),
    pagos,
    diferido: persona?.pago_diferido ?? false,
  }
}

export function calcularModelo(datos: Datos, hoy: Serie): Modelo {
  const personas = new Map(datos.personas.map((p) => [p.id, p]))
  const vigentes = datos.operaciones.filter((o) => !o.eliminado).sort((a, b) => a.op - b.op)
  const idsVigentes = new Set(vigentes.map((o) => o.id))
  const pagos = datos.pagos
    .filter((p) => !p.eliminado && (p.operacion_id === null || idsVigentes.has(p.operacion_id)))
    .sort((a, b) => a.orden - b.orden)

  const pagosPorOp = new Map<string, Pago[]>()
  for (const p of pagos) {
    if (!p.operacion_id) continue
    const lista = pagosPorOp.get(p.operacion_id)
    if (lista) lista.push(p)
    else pagosPorOp.set(p.operacion_id, [p])
  }

  const porId = new Map<string, Fila>()
  const prestamos: Fila[] = []
  const inversiones: Fila[] = []
  for (const o of vigentes) {
    const fila = calcularFila(o, personas.get(o.persona_id), pagosPorOp.get(o.id) ?? [], hoy)
    porId.set(o.id, fila)
    ;(o.tipo === 'prestamo' ? prestamos : inversiones).push(fila)
  }

  return {
    hoy,
    tc: datos.ajustes.tipo_cambio,
    prestamos,
    inversiones,
    porId,
    personas,
    pagosPrestamo: pagos.filter((p) => p.tipo === 'prestamo'),
    pagosInversion: pagos.filter((p) => p.tipo === 'inversion'),
  }
}

export const esActivo = (f: Fila) => f.op.estado === 'ACTIVO'
export const suma = <T,>(lista: T[], valor: (x: T) => number) => lista.reduce((a, x) => a + valor(x), 0)
