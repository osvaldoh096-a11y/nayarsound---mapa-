// Pruebas del motor con datos ficticios (no contienen registros reales).
import { describe, expect, it } from 'vitest'
import { DATE, EDATE, isoDeSerie, serieDeISO } from './fechas'
import { redondear, textoDecimal3, textoMiles, textoMilesPunto, textoPorcentaje } from './formato'
import { calcularModelo, fechaDinamica } from './motor'
import {
  cashflowMesActual,
  cashflowMesSiguiente,
  gananciasPorAnio,
  interesPagadoPorPersona,
  inversoresActivos,
  liquidadosConInteres,
  mesesOperando,
  prestamosActivosPorPersona,
  resumenAnual,
  resumenFinanciero,
} from './dashboard'
import {
  estadoCuenta,
  listaCreditos,
  pagosInversoresMXN,
  pagosInversoresUSDT,
  recordatorio5Dias,
  resumenCobro,
  resumenInversion,
  resumenPrestamo,
} from './mensajes'
import type { Datos, Operacion, Pago, Persona } from './tipos'

const persona = (id: string, tipo: Persona['tipo'], nombre: string, pago_diferido = false): Persona => ({
  id, tipo, nombre, pago_diferido, eliminado: null,
})
const op = (o: Partial<Operacion> & Pick<Operacion, 'id' | 'tipo' | 'op' | 'persona_id' | 'fecha_inicio' | 'cantidad' | 'tasa' | 'estado'>): Operacion => ({
  pago_mensual: 'SI', divisa: 'MXN', equivalencia: null, fecha_compromiso: null, dia_final: null, eliminado: null, ...o,
})
let orden = 0
const pago = (tipo: Pago['tipo'], operacion_id: string | null, fecha: string, cantidad: number): Pago => ({
  id: 'g' + ++orden, tipo, operacion_id, fecha, cantidad, orden, eliminado: null,
})

const HOY = serieDeISO('2026-10-29')

const datos: Datos = {
  ajustes: { tipo_cambio: 18, zona_horaria: 'America/Los_Angeles' },
  personas: [
    persona('ana', 'prestatario', 'ANA PRUEBA'),
    persona('beto', 'prestatario', 'BETO EJEMPLO', true),
    persona('carla', 'inversor', 'CARLA FICTICIA'),
    persona('dani', 'inversor', 'DANIEL DEMO'),
  ],
  operaciones: [
    op({ id: 'p1', tipo: 'prestamo', op: 101, persona_id: 'ana', fecha_inicio: '2026-05-20', cantidad: 100000, tasa: 0.08, estado: 'ACTIVO', fecha_compromiso: '2026-10-30' }),
    op({ id: 'p2', tipo: 'prestamo', op: 102, persona_id: 'beto', fecha_inicio: '2026-09-03', cantidad: 20000, tasa: 0.1, estado: 'ACTIVO', fecha_compromiso: '2026-11-03' }),
    op({ id: 'p3', tipo: 'prestamo', op: 103, persona_id: 'ana', fecha_inicio: '2026-01-31', divisa: 'USDT', cantidad: 500, tasa: 0.1, estado: 'LIQUIDADO', dia_final: '2026-03-01' }),
    op({ id: 'p4', tipo: 'prestamo', op: 104, persona_id: 'beto', fecha_inicio: '2025-12-15', cantidad: 5000, tasa: 0.1, estado: 'LIQUIDADO', dia_final: '2026-10-05' }),
    op({ id: 'p5', tipo: 'prestamo', op: 105, persona_id: 'ana', fecha_inicio: '2026-02-01', cantidad: 999, tasa: 0.5, estado: 'ACTIVO', eliminado: '2026-10-01T00:00:00Z' }),
    op({ id: 'i1', tipo: 'inversion', op: 51, persona_id: 'carla', fecha_inicio: '2026-09-30', cantidad: 200000, tasa: 0.015, estado: 'ACTIVO', fecha_compromiso: '2026-11-15' }),
    op({ id: 'i2', tipo: 'inversion', op: 52, persona_id: 'dani', fecha_inicio: '2026-07-24', divisa: 'USDT', cantidad: 3000, equivalencia: 58000, tasa: 0.035, estado: 'ACTIVO' }),
  ],
  pagos: [
    pago('prestamo', 'p1', '2026-06-20', 8000),
    pago('prestamo', 'p1', '2026-07-20', 8000),
    pago('prestamo', 'p3', '2026-03-01', 55),
    pago('prestamo', 'p4', '2026-01-15', 500),
    pago('prestamo', 'p5', '2026-03-01', 777),
    pago('inversion', 'i2', '2026-08-24', 105),
    pago('inversion', 'i2', '2026-09-24', 105),
    pago('inversion', null, '2023-02-17', 2000),
  ],
}

const m = calcularModelo(datos, HOY)
const fila = (id: string) => m.porId.get(id)!

describe('fechas y formatos de la hoja', () => {
  it('DATE se desborda como en Sheets y EDATE ajusta al fin de mes', () => {
    expect(isoDeSerie(DATE(2026, 11, 31))).toBe('2026-12-01')
    expect(isoDeSerie(DATE(2026, 13, 5))).toBe('2027-01-05')
    expect(isoDeSerie(EDATE(serieDeISO('2026-01-31'), 1))).toBe('2026-02-28')
    expect(serieDeISO('2023-01-18')).toBe(44944) // mismo número de serie que la celda C9
  })
  it('FECHA DINAMICA', () => {
    expect(isoDeSerie(fechaDinamica(serieDeISO('2026-05-20'), HOY))).toBe('2026-10-20')
    expect(isoDeSerie(fechaDinamica(serieDeISO('2026-10-10'), HOY))).toBe('2026-11-10')
    expect(isoDeSerie(fechaDinamica(serieDeISO('2023-01-18'), HOY))).toBe('2026-10-18')
    expect(isoDeSerie(fechaDinamica(serieDeISO('2026-12-05'), serieDeISO('2026-12-20')))).toBe('2027-01-05')
    expect(isoDeSerie(fechaDinamica(serieDeISO('2026-08-31'), serieDeISO('2026-11-15')))).toBe('2026-12-01')
  })
  it('TEXT con los formatos usados', () => {
    expect(textoMiles(1234567.5)).toBe('1,234,568')
    expect(textoMiles(-1641.4)).toBe('-1,641')
    expect(textoMilesPunto(3724.2)).toBe('3.724')
    expect(textoPorcentaje(0.035)).toBe('4%')
    expect(textoPorcentaje(0.015)).toBe('2%')
    expect(textoDecimal3(148000)).toBe('148000.0')
    expect(textoDecimal3(3749.333333)).toBe('3749.333')
    expect(textoDecimal3(0.5)).toBe('.5')
    expect(redondear(1.005, 2)).toBe(1.01)
  })
})

describe('columnas calculadas', () => {
  it('préstamo activo: días con +1, interés total y restante con pagos parciales', () => {
    const f = fila('p1')
    expect(f.diaFinalDinamico).toBe(true)
    expect(f.totDias).toBe(163)
    expect(f.pagoMes).toBe(8000)
    expect(f.intDiario).toBeCloseTo(266.6667, 4)
    expect(f.intTotal).toBeCloseTo(43466.6667, 4)
    expect(f.pagado).toBe(16000)
    expect(f.intRestante).toBeCloseTo(27466.6667, 4)
    expect(f.auxiliar).toBe('MAYO 2026')
  })
  it('préstamo liquidado con sobrepago deja interés negativo', () => {
    const f = fila('p3')
    expect(f.totDias).toBe(30)
    expect(f.intTotal).toBeCloseTo(50, 10)
    expect(f.intRestante).toBeCloseTo(-5, 10)
    expect(isoDeSerie(f.fechaDinamica)).toBe('2026-10-31')
  })
  it('inversión: días sin +1', () => {
    expect(fila('i1').totDias).toBe(29)
    expect(fila('i1').intTotal).toBeCloseTo(2900, 8)
    expect(fila('i2').totDias).toBe(97)
    expect(fila('i2').intTotal).toBeCloseTo(339.5, 8)
    expect(fila('i2').intRestante).toBeCloseTo(129.5, 8)
  })
  it('operaciones eliminadas y sus pagos no cuentan', () => {
    expect(m.porId.has('p5')).toBe(false)
    expect(m.pagosPrestamo.some((p) => p.operacion_id === 'p5')).toBe(false)
  })
})

describe('dashboard', () => {
  it('resumen financiero', () => {
    const r = resumenFinanciero(m)
    expect(r.capitalPrestado).toBe(120000)
    expect(r.capitalInversores).toBe(258000)
    expect(r.capitalPropio).toBe(-138000)
    expect(r.interesDia).toBeCloseTo(333.3333, 4)
    expect(r.utilidadInversorDia).toBeCloseTo(163, 8)
    expect(r.utilidadPropiaDia).toBeCloseTo(170.3333, 4)
    expect(r.interesPromedioMensual).toBeCloseTo(0.083333, 6)
    expect(r.proyeccionMensual).toBeCloseTo(10000, 8)
    expect(r.pagoMensualInversores).toBeCloseTo(4890, 8)
    expect(r.pendienteCobrar).toBeCloseTo(31266.6667, 4)
    expect(r.pendienteInversores).toBeCloseTo(5231, 8)
    expect(r.restantePropio).toBeCloseTo(26035.6667, 4)
  })
  it('meses operando, entradas y salidas reales como en HOJA DATA', () => {
    const meses = mesesOperando(m)
    expect(meses.map((x) => x.etiqueta)).toEqual([
      'FEBRERO 2023', 'DICIEMBRE 2025', 'ENERO 2026', 'MAYO 2026', 'JULIO 2026', 'AGOSTO 2026', 'SEPTIEMBRE 2026', 'OCTUBRE 2026',
    ])
    const porEtiqueta = Object.fromEntries(meses.map((x) => [x.etiqueta, x]))
    expect(porEtiqueta['ENERO 2026'].entradas).toBe(500)
    expect(porEtiqueta['JULIO 2026'].entradas).toBe(8000)
    expect(porEtiqueta['AGOSTO 2026'].salidas).toBe(1890)
    expect(porEtiqueta['FEBRERO 2023'].salidas).toBe(0) // pago sin OP
    expect(meses[meses.length - 1].acumulado).toBe(8500 - 3780)

    const anios = gananciasPorAnio(meses)
    expect(anios.filas.map((f) => f.anio)).toEqual([2023, 2025, 2026])
    expect(anios.filas[2]).toEqual({ anio: 2026, generado: 8500, pagado: 3780, ganancia: 4720 })
    expect(anios.totalAnios).toBe(3)

    const anual = resumenAnual(meses, 2026)
    expect(anual.totalMeses).toBe(6)
    expect(anual.cobrados).toBe(8500)
  })
  it('tablas de activos e intereses por persona', () => {
    expect(prestamosActivosPorPersona(m)).toEqual([
      { nombre: 'ANA PRUEBA', capital: 100000, interesRestante: expect.closeTo(27466.6667, 3), pagoMensual: 8000 },
      { nombre: 'BETO EJEMPLO', capital: 20000, interesRestante: expect.closeTo(3800, 8), pagoMensual: 2000 },
    ])
    const inv = inversoresActivos(m)
    expect(inv.map((r) => [r.nombre, r.capital, r.pagoMensual])).toEqual([
      ['CARLA FICTICIA', 200000, 3000],
      ['DANIEL DEMO', 54000, expect.closeTo(1890, 8)],
    ])
    const pagados = interesPagadoPorPersona(m)
    expect(pagados[0].nombre).toBe('ANA PRUEBA')
    expect(pagados[0].interes).toBeCloseTo(16055, 8)
    expect(pagados[1].interes).toBeCloseTo(500, 8)
    expect(liquidadosConInteres(m).map((f) => f.op.op)).toEqual([104])
  })
  it('el pago mensual por persona respeta el rango de cada fila de la hoja', () => {
    const bajos: Datos = {
      ...datos,
      operaciones: datos.operaciones.map((o) => (o.id === 'p1' ? { ...o, op: 3 } : o)),
    }
    expect(prestamosActivosPorPersona(calcularModelo(bajos, HOY))[0].pagoMensual).toBe(0)
  })
  it('cashflow excluye a las personas con pago diferido', () => {
    expect(cashflowMesActual(m)).toEqual({ ingresos: 8000, pagos: 4890, balance: 3110 })
    expect(cashflowMesSiguiente(m)).toEqual({ ingresos: 8000, pagos: 4890, balance: 3110 })
  })
})

describe('mensajes', () => {
  it('recordatorio de 5 días', () => {
    expect(recordatorio5Dias(m)).toBe(
      '🟨 *RECORDATORIO 5 DÍAS*\n\n' +
        '📅 *MAÑANA VIERNES 30 DE OCTUBRE*\n🟢 COBRAR | ANA PRUEBA | $8.000\n🟠 PAGAR | CARLA FICTICIA | $3.000\n\n' +
        '💰 *CAPITAL POR LIQUIDAR*\n\n🔴 *CARLA FICTICIA*\n💵 Capital: $200.000\n⏳ Faltan 17 días | 📅 15-nov',
    )
  })
  it('resumen de cobro con pago diferido', () => {
    expect(resumenCobro(m)).toBe(
      '📌 RESUMEN DE COBRO\n\n' +
        '💰 TOTAL PENDIENTE A COBRAR ESTE MES: $8.000\n\n🟢 ESTE MES\n👤 ANA PRUEBA | 🧾 30-oct | 💰 $8.000\n\n' +
        '📊 TOTAL PENDIENTE ESTE MES: $8.000\n\n\n' +
        '💰 TOTAL PENDIENTE A COBRAR PRÓXIMO MES: $0\n\n🔵 PRÓXIMO MES\nSin cobros disponibles el próximo mes\n\n' +
        '⏳ PAGO DIFERIDO\n👤 BETO EJEMPLO | 🧾 03-nov | 💰 $2.000\n\n📊 TOTAL PENDIENTE PRÓXIMO MES: $2.000',
    )
  })
  it('estado de cuenta', () => {
    expect(estadoCuenta(m, 'ana')).toBe(
      '📌 *ESTADO DE CUENTA* · 29-oct-26\n👤 ANA PRUEBA\n\n💰 Capital: $100,000\n📈 Interés: $27,467\n💳 *Total: $127,467*\n\n' +
        '🔹 *Crédito 1* · 20-may-26\n💰 $100,000 · 8% · Pago $8,000\n📈 Interés pendiente: $27,467\n⏰ 20 de cada mes\n🚨 *Debe 3 meses de interés*',
    )
  })
  it('renovación y nuevo préstamo', () => {
    const f = { ...fila('p1'), op: { ...fila('p1').op, cantidad: 12000, tasa: 0.1 }, inicio: serieDeISO('2026-09-24') }
    expect(resumenPrestamo(f, 'REESTRUCTURACION DE CREDITO', 1500)).toBe(
      '📌 *RENOVACION DE PRESTAMO*\n\n👤 *Cliente:* ANA PRUEBA\n📆 *Periodo anterior:* 24-sep a 24-oct\n' +
        '💰 *Total a pagar:* $13,200\n💵 *Abonado:* $1,500\n\n🔁 *Nuevo préstamo:* $11,700\n📈 *Interés (10%):* $1,170\n' +
        '📆 *Nuevo periodo:* 24-oct a 24-nov\n💳 *A pagar:* $12,870',
    )
    expect(resumenPrestamo(f, 'CREDITO NUEVO', 0)).toContain('*Ejemplo: si abonas $4,000:*\nTe quedan *$9,200*.\n📈 + 10% (*$920*) → próximo mes: *$10,120*.')
  })
  it('mensaje de inversor', () => {
    expect(resumenInversion(fila('i1'), 'CREDITO NUEVO', 0, '1-4 meses')).toBe(
      '📌 *NUEVO INVERSOR*\n\n👤 *Cliente:* CARLA FICTICIA\n📅 *Inicio del préstamo:* 30-sep-miércoles\n' +
        '⏳ *Duración maxima:* 1-4 meses\n📆 *Periodo:* 30-sep a 30-ene\n💰 *Préstamo:* MXN $200000.0\n' +
        '📈 *Interés mensual* (2%): $3000.0\n\n📌 *¿Cómo funciona?*\n• Se liquida el interés de forma mensual.\n' +
        '• O al finalizar el crédito se paga el total de interés + capital.',
    )
    expect(resumenInversion(fila('i1'), 'CREDITO NUEVO', 0, 'sin duración')).toBe('')
  })
  it('pagos a inversores y listas de créditos', () => {
    expect(pagosInversoresMXN(m)).toBe(
      '🟢 MES ACTUAL\n💵 TOTAL MXN A PAGAR: $0\n\nSin pagos este mes\n\n\n🔵 PRÓXIMO MES\n💵 TOTAL MXN A PAGAR: $3,000\n\n' +
        '👤 CARLA FICTICIA\n📅 Pago: 30-oct\n💰 Capital: $200,000\n📊 % préstamo: 2%\n📈 Int. mensual: $3,000',
    )
    expect(pagosInversoresUSDT(m)).toBe(
      '🟢 MES ACTUAL\n💵 TOTAL: $0 MXN | 0 USDT\n\nSin pagos este mes\n\n\n🔵 PRÓXIMO MES\n💵 TOTAL: $1,890 MXN | 105 USDT\n\n' +
        '👤 DANIEL DEMO | 📅 24-oct | 📊 4%\n💰 3,000 USDT | 💵 $58,000 MXN\n📈 105 USDT | 💸 $1,890 MXN',
    )
    expect(listaCreditos(m)).toEqual({
      primeros: '🟢 *CRÉDITOS 1-6*\n\n🟢 OP 101 | ANA PRUEBA | PAGO: $8,000\n🔵 OP 102 | BETO EJEMPLO | PAGO: $2,000',
      siguientes: '',
    })
  })
})
