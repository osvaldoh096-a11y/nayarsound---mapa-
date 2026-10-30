// Indicadores de la hoja DASHBOARD y de la tabla mensual de HOJA DATA.
import { partes, primerDiaMes, serieDeISO, type Serie } from './fechas'
import { etiquetaMes, redondear } from './formato'
import { esActivo, suma, type Fila, type Modelo } from './motor'

const conTc = (f: Fila, tc: number) => (f.op.divisa === 'USDT' ? tc : 1)

export interface ResumenFinanciero {
  capitalPrestado: number
  capitalPropio: number
  capitalInversores: number
  interesDia: number
  utilidadPropiaDia: number
  utilidadInversorDia: number
  interesPromedioMensual: number | null
  proyeccionMensual: number
  pagoMensualInversores: number
  pendienteCobrar: number
  pendienteInversores: number
  restantePropio: number
}

export function resumenFinanciero(m: Modelo): ResumenFinanciero {
  const tc = m.tc
  const pAct = m.prestamos.filter(esActivo)
  const iAct = m.inversiones.filter(esActivo)
  const mxn = (f: Fila) => f.op.divisa === 'MXN'
  const usdt = (f: Fila) => f.op.divisa === 'USDT'

  const capitalPrestado = suma(pAct.filter(mxn), (f) => f.op.cantidad)
  const capitalInversores = suma(iAct.filter(usdt), (f) => f.op.equivalencia ?? 0) + suma(iAct.filter(mxn), (f) => f.op.cantidad)
  const interesDia = suma(pAct, (f) => f.intDiario)
  const utilidadInversorDia = suma(iAct.filter(usdt), (f) => f.intDiario * tc) + suma(iAct.filter(mxn), (f) => f.intDiario)
  const pendienteCobrar = suma(pAct.filter(mxn), (f) => f.intRestante) + suma(pAct.filter(usdt), (f) => f.intRestante) * tc
  const pendienteInversores = suma(iAct.filter(mxn), (f) => f.intRestante) + suma(iAct.filter(usdt), (f) => f.intRestante) * tc

  return {
    capitalPrestado,
    capitalPropio: capitalPrestado - capitalInversores,
    capitalInversores,
    interesDia,
    utilidadPropiaDia: interesDia - utilidadInversorDia,
    utilidadInversorDia,
    interesPromedioMensual: capitalPrestado === 0 ? null : (interesDia / capitalPrestado) * 30,
    proyeccionMensual: interesDia * 30,
    pagoMensualInversores: suma(iAct.filter(mxn), (f) => f.pagoMes) + suma(iAct.filter(usdt), (f) => f.pagoMes * tc),
    pendienteCobrar,
    pendienteInversores,
    restantePropio: pendienteCobrar - pendienteInversores,
  }
}

export interface Mes {
  inicio: Serie
  etiqueta: string // "ENERO 2023"
  anio: number
  entradas: number // ENTRADAS REALES
  salidas: number // SALIDAS REALES
  flujo: number
  acumulado: number
}

// HOJA DATA columnas G:L ("MES OPERANDO" … "FLUJO ACUMULADO").
export function mesesOperando(m: Modelo): Mes[] {
  const claves = new Set<Serie>()
  for (const f of m.prestamos) claves.add(primerDiaMes(f.inicio))
  for (const p of m.pagosInversion) claves.add(primerDiaMes(serieDeISO(p.fecha)))
  for (const f of m.inversiones) claves.add(primerDiaMes(f.inicio))
  claves.add(primerDiaMes(m.hoy))

  const entradas = new Map<Serie, number>()
  const salidas = new Map<Serie, number>()
  const acumular = (mapa: Map<Serie, number>, fila: Fila | undefined, fecha: string, cantidad: number) => {
    if (!fila) return // pago sin OP o con OP inexistente: la hoja no le encuentra divisa
    const k = primerDiaMes(serieDeISO(fecha))
    mapa.set(k, (mapa.get(k) ?? 0) + cantidad * conTc(fila, m.tc))
  }
  for (const p of m.pagosPrestamo) acumular(entradas, p.operacion_id ? m.porId.get(p.operacion_id) : undefined, p.fecha, p.cantidad)
  for (const p of m.pagosInversion) acumular(salidas, p.operacion_id ? m.porId.get(p.operacion_id) : undefined, p.fecha, p.cantidad)

  let acumulado = 0
  return [...claves]
    .sort((a, b) => a - b)
    .map((k) => {
      const e = entradas.get(k) ?? 0
      const s = salidas.get(k) ?? 0
      acumulado += e - s
      return { inicio: k, etiqueta: etiquetaMes(k), anio: partes(k).anio, entradas: e, salidas: s, flujo: e - s, acumulado }
    })
}

export interface FilaAnio {
  anio: number
  generado: number
  pagado: number
  ganancia: number
}

// GANANCIAS HISTORICAS. Cada fila de año suma sobre la ventana de HOJA DATA que usa su fórmula
// (H3:H101 para el primer año, H4:H102 para el segundo, …).
export function gananciasPorAnio(meses: Mes[]): { filas: FilaAnio[]; totalAnios: number; generado: number; pagado: number; ganancia: number } {
  const anios = [...new Set(meses.map((x) => x.anio))].sort((a, b) => a - b)
  const filas = anios.map((anio, k) => {
    const ventana = meses.filter((x, i) => i >= k && i <= 98 + k && x.anio === anio)
    const generado = suma(ventana, (x) => x.entradas)
    const pagado = suma(ventana, (x) => x.salidas)
    return { anio, generado, pagado, ganancia: generado - pagado }
  })
  const generado = suma(filas, (f) => f.generado)
  const pagado = suma(filas, (f) => f.pagado)
  return { filas, totalAnios: filas.length, generado, pagado, ganancia: generado - pagado }
}

// RESUMEN GENERAL por año (meses del año seleccionado, máximo 12).
export function resumenAnual(meses: Mes[], anio: number) {
  const filas = meses.filter((x) => x.etiqueta.includes(String(anio))).slice(0, 12)
  const cobrados = suma(filas, (x) => x.entradas)
  const pagado = suma(filas, (x) => x.salidas)
  return { filas, totalMeses: filas.length, cobrados, pagado, ganancia: cobrados - pagado }
}

export interface FilaPersonaActiva {
  nombre: string
  capital: number
  interesRestante: number
  pagoMensual: number
}

// PRESTAMOS ACTIVOS (QUERY agrupado por nombre) con la columna PAGO MENSUAL.
// La fórmula de PAGO MENSUAL de la fila k empieza en la fila 13+k del registro (OP ≥ 5+k).
export function prestamosActivosPorPersona(m: Modelo): FilaPersonaActiva[] {
  const grupos = new Map<string, { capital: number; interes: number }>()
  for (const f of m.prestamos) {
    if (!esActivo(f)) continue
    const g = grupos.get(f.nombre) ?? { capital: 0, interes: 0 }
    g.capital += f.op.cantidad
    g.interes += f.intRestante
    grupos.set(f.nombre, g)
  }
  const filas = [...grupos.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .sort((a, b) => b[1].capital + b[1].interes - (a[1].capital + a[1].interes))
  return filas.map(([nombre, g], k) => ({
    nombre,
    capital: g.capital,
    interesRestante: g.interes,
    pagoMensual: suma(
      m.prestamos.filter((f) => f.nombre === nombre && esActivo(f) && f.op.op >= 5 + k && f.op.op <= 992 + k),
      (f) => f.pagoMes * conTc(f, m.tc),
    ),
  }))
}

export interface FilaInversorActivo {
  fila: Fila
  nombre: string
  compromiso: Serie | null
  capital: number
  pagoMensual: number
}

// INVERSORES ACTIVOS: ordenados por fecha compromiso; capital y pago en MXN (USDT × tipo de cambio).
export function inversoresActivos(m: Modelo): FilaInversorActivo[] {
  const filas = m.inversiones
    .filter(esActivo)
    .map((f) => ({ f, clave: f.compromiso ?? 999999, capital: f.op.cantidad * conTc(f, m.tc) }))
    .sort((a, b) => a.clave - b.clave)
  return filas.map(({ f, capital }, k) => ({
    fila: f,
    nombre: f.nombre,
    compromiso: f.compromiso,
    capital,
    pagoMensual: suma(
      m.inversiones.filter(
        (g) =>
          g.nombre === f.nombre &&
          esActivo(g) &&
          redondear(g.op.cantidad * conTc(g, m.tc), 2) === redondear(capital, 2) &&
          g.op.op >= 4 + k &&
          g.op.op <= 991 + k,
      ),
      (g) => g.pagoMes * conTc(g, m.tc),
    ),
  }))
}

// INTERES TOTAL por nombre: sum(Q) - sum(L) de todos los préstamos.
export function interesPagadoPorPersona(m: Modelo): { nombre: string; interes: number }[] {
  const grupos = new Map<string, number>()
  for (const f of m.prestamos) {
    if (f.nombre === '') continue
    grupos.set(f.nombre, (grupos.get(f.nombre) ?? 0) + f.intTotal - f.intRestante)
  }
  return [...grupos.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .sort((a, b) => b[1] - a[1])
    .map(([nombre, interes]) => ({ nombre, interes }))
}

export interface Cashflow {
  ingresos: number
  pagos: number
  balance: number
}

// CASHFLOW MES ACTUAL
export function cashflowMesActual(m: Modelo): Cashflow {
  const t = partes(m.hoy)
  const entra = (f: Fila) => {
    const c = partes(f.inicio)
    const j = partes(f.diaFinal)
    const activoFueraDelMes = f.op.estado === 'ACTIVO' && (c.mes !== t.mes || c.anio !== t.anio)
    const liquidadoEnElMes = f.op.estado === 'LIQUIDADO' && j.mes === t.mes && j.anio === t.anio
    return activoFueraDelMes || liquidadoEnElMes
  }
  const ingresos = suma(m.prestamos.filter((f) => entra(f) && !f.diferido), (f) => f.pagoMes)
  const pagos = suma(m.inversiones.filter(entra), (f) => f.pagoMes * conTc(f, m.tc))
  return { ingresos, pagos, balance: ingresos - pagos }
}

// CASHFLOW MES SIGUIENTE
export function cashflowMesSiguiente(m: Modelo): Cashflow {
  const ingresos = suma(m.prestamos.filter((f) => esActivo(f) && !f.diferido), (f) => f.pagoMes)
  const pagos = suma(m.inversiones.filter(esActivo), (f) => f.pagoMes * conTc(f, m.tc))
  return { ingresos, pagos, balance: ingresos - pagos }
}

// Revisión de la celda K7: préstamos liquidados con interés restante mayor a 1.
export function liquidadosConInteres(m: Modelo): Fila[] {
  return m.prestamos.filter((f) => f.op.estado === 'LIQUIDADO' && f.intRestante > 1)
}
