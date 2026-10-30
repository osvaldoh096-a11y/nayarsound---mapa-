// Mensajes de texto que la hoja arma con fórmulas (para copiar a WhatsApp).
import { EDATE, partes, type Serie } from './fechas'
import {
  fechaDdMmm,
  fechaDdMmmAaaa,
  fechaDdMmmYy,
  fechaLarga,
  textoDecimal3,
  textoMiles,
  textoMilesPunto,
  textoPorcentaje,
} from './formato'
import { inversoresActivos } from './dashboard'
import { esActivo, suma, type Fila, type Modelo } from './motor'

const NL = '\n'

export type TipoResumen = 'CREDITO NUEVO' | 'REESTRUCTURACION DE CREDITO'

// REGISTRO PRESTAMOS!F2 ("RESUMEN PARA" de un préstamo).
export function resumenPrestamo(f: Fila | undefined, tipo: TipoResumen, abonado: number): string {
  if (!f || f.nombre === '') return ''
  const cliente = f.nombre
  const E5 = f.inicio
  const E6 = f.op.cantidad
  const t = f.op.tasa
  const pct = textoPorcentaje(t)
  if (tipo === 'REESTRUCTURACION DE CREDITO') {
    const total = E6 * (1 + t)
    const nuevo = total - abonado
    return (
      '📌 *RENOVACION DE PRESTAMO*' + NL + NL +
      '👤 *Cliente:* ' + cliente + NL +
      '📆 *Periodo anterior:* ' + fechaDdMmm(E5) + ' a ' + fechaDdMmm(EDATE(E5, 1)) + NL +
      '💰 *Total a pagar:* $' + textoMiles(total) + NL +
      '💵 *Abonado:* $' + textoMiles(abonado) + NL + NL +
      '🔁 *Nuevo préstamo:* $' + textoMiles(nuevo) + NL +
      '📈 *Interés (' + pct + '):* $' + textoMiles(nuevo * t) + NL +
      '📆 *Nuevo periodo:* ' + fechaDdMmm(EDATE(E5, 1)) + ' a ' + fechaDdMmm(EDATE(E5, 2)) + NL +
      '💳 *A pagar:* $' + textoMiles(nuevo * (1 + t))
    )
  }
  // IF(E6<10000; ROUNDUP(E6*30%;-2); ROUNDUP(E6*30%;-3))
  const redondearArriba = (x: number, paso: number) => Math.ceil(x / paso - 1e-9) * paso
  const ejemplo = E6 < 10000 ? redondearArriba(E6 * 0.3, 100) : redondearArriba(E6 * 0.3, 1000)
  const resto = E6 * (1 + t) - ejemplo
  return (
    '📌 *NUEVO PRESTAMO*' + NL + NL +
    '👤 *Cliente:* ' + cliente + NL +
    '📆 *Periodo:* ' + fechaDdMmm(E5) + ' a ' + fechaDdMmm(EDATE(E5, 1)) + NL +
    '💰 *Préstamo:* $' + textoMiles(E6) + NL +
    '📈 *Interés Mensual (' + pct + '): $' + textoMiles(E6 * t) + NL +
    '💳 *A pagar al final del mes:* $' + textoMiles(E6 * (1 + t)) + NL + NL +
    '📌 *¿Cómo funciona?*' + NL +
    'Pediste *$' + textoMiles(E6) + '* al *' + pct + '* → debes *$' + textoMiles(E6 * (1 + t)) + '*.' + NL + NL +
    '💵 Puedes pagar *solo intereses ($' + textoMiles(E6 * t) + ')* o *interés + capital*.' + NL + NL +
    '*Ejemplo: si abonas $' + textoMiles(ejemplo) + ':*' + NL +
    'Te quedan *$' + textoMiles(resto) + '*.' + NL +
    '📈 + ' + pct + ' (*$' + textoMiles(resto * t) + '*) → próximo mes: *$' + textoMiles(resto * (1 + t)) + '*.'
  )
}

// Meses de la duración escrita como "1-4 meses" (el número entre "-" y "MES").
export function mesesDeDuracion(duracion: string): number | null {
  const guion = duracion.indexOf('-')
  const mes = duracion.toUpperCase().indexOf('MES')
  if (guion < 0 || mes < 0) return null
  const n = Number(duracion.slice(guion + 1, mes).trim())
  return Number.isFinite(n) && duracion.slice(guion + 1, mes).trim() !== '' ? n : null
}

// REGISTRO DE INVERSORES!E2 ("RESUMEN PARA" de un inversor).
export function resumenInversion(f: Fila | undefined, tipo: TipoResumen, abonado: number, duracion: string): string {
  if (!f || f.nombre === '') return ''
  const meses = mesesDeDuracion(duracion)
  if (meses === null) return ''
  const D6 = f.inicio
  const D7 = f.op.cantidad
  const i = f.op.tasa
  const divisa = f.op.divisa
  const n = (x: number) => textoDecimal3(x).replace(/,/g, '.')
  const comoFunciona =
    '📌 *¿Cómo funciona?*' + NL +
    '• Se liquida el interés de forma mensual.' + NL +
    '• O al finalizar el crédito se paga el total de interés + capital.'
  if (tipo === 'REESTRUCTURACION DE CREDITO') {
    const total = D7 * (1 + i)
    return (
      '📌 *RENOVACION DE PRESTAMO*' + NL + NL +
      '👤 *Cliente:* ' + f.nombre + NL +
      '📅 *Inicio del préstamo:* ' + fechaDdMmmAaaa(f.inicio) + NL +
      '⏳ *Duración maxima:* ' + duracion + NL +
      '📆 *Periodo actual:* ' + fechaDdMmm(D6) + ' a ' + fechaDdMmm(EDATE(D6, meses)) + NL +
      '💰 *Préstamo:* ' + divisa + ' $' + n(D7) + NL +
      '📈 *Interés (' + textoPorcentaje(i) + '): $' + n(D7 * i) + NL +
      '🧾 *Total a pagar:* $' + n(total) + NL + NL +
      '💵 *Abonado:* $' + n(abonado) + NL +
      '🔁 *Inicio del nuevo préstamo por:* ' + divisa + ' $' + n(total - abonado) + NL +
      '📊 *Interés mensua:* $' + n((total - abonado) * i) + NL +
      '🔁 *Nuevo periodo:* ' + fechaDdMmm(EDATE(D6, meses)) + ' a ' + fechaDdMmm(EDATE(D6, meses * 2)) + NL + NL +
      comoFunciona
    )
  }
  return (
    '📌 *NUEVO INVERSOR*' + NL + NL +
    '👤 *Cliente:* ' + f.nombre + NL +
    '📅 *Inicio del préstamo:* ' + fechaDdMmmAaaa(f.inicio) + NL +
    '⏳ *Duración maxima:* ' + duracion + NL +
    '📆 *Periodo:* ' + fechaDdMmm(D6) + ' a ' + fechaDdMmm(EDATE(D6, meses)) + NL +
    '💰 *Préstamo:* ' + divisa + ' $' + n(D7) + NL +
    '📈 *Interés mensual* (' + textoPorcentaje(i) + '): $' + n(D7 * i) + NL + NL +
    comoFunciona
  )
}

// REGISTRO PRESTAMOS!K1 ("ESTADO DE CUENTA" de un deudor).
export function estadoCuenta(m: Modelo, personaId: string): string {
  const persona = m.personas.get(personaId)
  if (!persona) return ''
  const filas = m.prestamos
    .filter((f) => f.op.persona_id === personaId && esActivo(f))
    .sort((a, b) => a.inicio - b.inicio)
  const capital = suma(filas, (f) => f.op.cantidad)
  const interes = suma(filas, (f) => f.intRestante)
  const detalle = filas.length
    ? filas
        .map((f, k) => {
          const ip = f.intRestante
          const pm = f.pagoMes
          const ms = pm === 0 ? 0 : Math.floor(ip / pm)
          return (
            '🔹 *Crédito ' + (k + 1) + '* · ' + fechaDdMmmYy(f.inicio) + NL +
            '💰 $' + textoMiles(f.op.cantidad) + (f.op.divisa === 'USDT' ? ' USDT' : '') + ' · ' +
            textoPorcentaje(f.op.tasa) + ' · Pago $' + textoMiles(pm) + NL +
            '📈 Interés pendiente: $' + textoMiles(ip) + NL +
            '⏰ ' + partes(f.inicio).dia + ' de cada mes' +
            (ip > pm ? NL + '🚨 *Debe ' + ms + (ms === 1 ? ' mes' : ' meses') + ' de interés*' : '')
          )
        })
        .join(NL + NL)
    : 'Sin créditos activos'
  return (
    '📌 *ESTADO DE CUENTA* · ' + fechaDdMmmYy(m.hoy) + NL +
    '👤 ' + persona.nombre.trim() + NL + NL +
    '💰 Capital: $' + textoMiles(capital) + NL +
    '📈 Interés: $' + textoMiles(interes) + NL +
    '💳 *Total: $' + textoMiles(capital + interes) + '*' + NL + NL +
    detalle
  )
}

// Totales del cuadro "RESUMEN PARA" del deudor (créditos activos, capital, interés, total, interés mensual).
export function totalesDeudor(m: Modelo, personaId: string) {
  const filas = m.prestamos.filter((f) => f.op.persona_id === personaId && esActivo(f))
  const capital = suma(filas, (f) => f.op.cantidad)
  const interes = suma(filas, (f) => f.intRestante)
  return { creditos: filas.length, capital, interes, total: capital + interes, interesMensual: suma(filas, (f) => f.pagoMes) }
}

const EMOJIS_6 = ['🟢', '🔵', '🟠', '🟣', '🟡', '🔴']
const EMOJIS_14 = ['🟢', '🔵', '🟠', '🟣', '🟡', '🔴', '🟤', '⚫', '⚪', '🔶', '🔷', '🔸', '🔹', '⭐']
const EMOJIS_7 = ['🟢', '🔵', '🟠', '🟣', '🟡', '🔴', '⚫']

// REGISTRO PRESTAMOS!S1 y X1 ("CRÉDITOS 1-6" y "CRÉDITOS 7-20").
export function listaCreditos(m: Modelo): { primeros: string; siguientes: string } {
  const lista = m.prestamos.filter(esActivo).map((f) => 'OP ' + f.op.op + ' | ' + f.nombre + ' | PAGO: $' + textoMiles(f.pagoMes))
  const primeros = lista.length
    ? '🟢 *CRÉDITOS 1-6*' + NL + NL + lista.slice(0, 6).map((l, k) => EMOJIS_6[k] + ' ' + l).join(NL)
    : 'Sin préstamos activos'
  const siguientes =
    lista.length <= 6
      ? ''
      : '🟢 *CRÉDITOS 7-20*' + NL + NL + lista.slice(6, 20).map((l, k) => EMOJIS_14[k] + ' ' + l).join(NL)
  return { primeros, siguientes }
}

// REGISTRO DE INVERSORES!U1 ("CRÉDITOS 1-7").
export function listaCreditosInversores(m: Modelo): string {
  const lista = m.inversiones
    .filter(esActivo)
    .map((f) => 'OP ' + f.op.op + ' | ' + f.nombre + ' | PAGO: $' + textoMiles(f.pagoMes) + ' ' + f.op.divisa)
  return lista.length
    ? '🟢 *CRÉDITOS 1-7*' + NL + NL + lista.slice(0, 7).map((l, k) => EMOJIS_7[k] + ' ' + l).join(NL)
    : 'Sin préstamos activos'
}

// DASHBOARD!B18 ("RECORDATORIO 5 DÍAS").
export function recordatorio5Dias(m: Modelo): string {
  const tc = m.tc
  const base: { dia: Serie; texto: string }[] = []
  for (const f of m.prestamos) {
    if (f.compromiso === null || !esActivo(f)) continue
    base.push({ dia: f.compromiso, texto: '🟢 COBRAR | ' + f.nombre + ' | $' + textoMilesPunto(f.pagoMes) })
  }
  for (const f of m.inversiones) {
    if (!esActivo(f) || f.op.divisa !== 'MXN') continue
    base.push({ dia: f.fechaDinamica, texto: '🟠 PAGAR | ' + f.nombre + ' | $' + textoMilesPunto(f.pagoMes) })
  }
  for (const f of m.inversiones) {
    if (!esActivo(f) || f.op.divisa !== 'USDT') continue
    base.push({
      dia: f.fechaDinamica,
      texto:
        '🟣 PAGAR | ' + f.nombre + ' | $' + textoMilesPunto(f.pagoMes * tc) +
        ' MXN (' + textoMilesPunto(f.pagoMes) + ' USDT)',
    })
  }

  const titulos = ['HOY', 'MAÑANA', 'EN 2 DÍAS', 'EN 3 DÍAS', 'EN 4 DÍAS']
  const bloques: string[] = []
  titulos.forEach((titulo, k) => {
    const dia = m.hoy + k
    const lineas = base.filter((b) => b.dia === dia).map((b) => b.texto)
    if (lineas.length) bloques.push('📅 *' + titulo + ' ' + fechaLarga(dia).toUpperCase() + '*' + NL + lineas.join(NL))
  })
  const resumen = bloques.join(NL + NL)

  const liquidaciones = inversoresActivos(m)
    .filter((r) => r.compromiso !== null && r.compromiso >= m.hoy && r.compromiso <= m.hoy + 30)
    .map((r) => {
      const fecha = r.compromiso as Serie
      const faltan = fecha - m.hoy
      return (
        '🔴 *' + r.nombre + '*' + NL +
        '💵 Capital: $' + textoMilesPunto(r.capital) + NL +
        (faltan === 0
          ? '🚨 *LIQUIDAR HOY* | 📅 ' + fechaDdMmm(fecha)
          : '⏳ Faltan ' + faltan + (faltan === 1 ? ' día' : ' días') + ' | 📅 ' + fechaDdMmm(fecha))
      )
    })
    .join(NL + NL)

  if (resumen === '' && liquidaciones === '') return ''
  return (
    '🟨 *RECORDATORIO 5 DÍAS*' +
    (resumen === '' ? '' : NL + NL + resumen) +
    (liquidaciones === '' ? '' : NL + NL + '💰 *CAPITAL POR LIQUIDAR*' + NL + NL + liquidaciones)
  )
}

// DASHBOARD!B51 ("RESUMEN DE COBRO").
export function resumenCobro(m: Modelo): string {
  const t = partes(m.hoy)
  const sig = partes(EDATE(m.hoy, 1))
  const delMes = (anio: number, mes: number) =>
    m.prestamos
      .filter((f) => f.compromiso !== null && esActivo(f) && partes(f.compromiso).mes === mes && partes(f.compromiso).anio === anio)
      .sort((a, b) => (a.compromiso as number) - (b.compromiso as number))
  const linea = (f: Fila) =>
    '👤 ' + f.nombre + ' | 🧾 ' + fechaDdMmm(f.compromiso as Serie) + ' | 💰 $' + textoMilesPunto(f.pagoMes)
  const total = (filas: Fila[]) => (filas.length ? textoMilesPunto(suma(filas, (f) => f.pagoMes)) : '0')

  const bloque = (filas: Fila[], cabeceraTotal: string, titulo: string, vacio: string, tituloDiferido: string, totalFinal: string) => {
    const normales = filas.filter((f) => !f.diferido)
    const diferidos = filas.filter((f) => f.diferido)
    return (
      cabeceraTotal + total(normales) + NL + NL +
      titulo + NL +
      (normales.length ? normales.map(linea).join(NL) : vacio) +
      (suma(diferidos, (f) => f.pagoMes) > 0 ? NL + NL + tituloDiferido + NL + diferidos.map(linea).join(NL) : '') +
      NL + NL + totalFinal + total(filas)
    )
  }

  return (
    '📌 RESUMEN DE COBRO' + NL + NL +
    bloque(
      delMes(t.anio, t.mes),
      '💰 TOTAL PENDIENTE A COBRAR ESTE MES: $',
      '🟢 ESTE MES',
      'Sin cobros disponibles este mes',
      '⏳ PAGO DIFERIDO ESTE MES',
      '📊 TOTAL PENDIENTE ESTE MES: $',
    ) +
    NL + NL + NL +
    bloque(
      delMes(sig.anio, sig.mes),
      '💰 TOTAL PENDIENTE A COBRAR PRÓXIMO MES: $',
      '🔵 PRÓXIMO MES',
      'Sin cobros disponibles el próximo mes',
      '⏳ PAGO DIFERIDO',
      '📊 TOTAL PENDIENTE PRÓXIMO MES: $',
    )
  )
}

// DASHBOARD!E37 ("PAGO A INVERSORES MXN").
export function pagosInversoresMXN(m: Modelo): string {
  const t = partes(m.hoy)
  const activos = m.inversiones.filter((f) => f.op.divisa === 'MXN' && esActivo(f)).sort((a, b) => a.fechaDinamica - b.fechaDinamica)
  const esteMes = activos.filter((f) => {
    const r = partes(f.fechaDinamica)
    return f.fechaDinamica >= m.hoy + 2 && r.mes === t.mes && r.anio === t.anio
  })
  const bloque = (f: Fila) =>
    '👤 ' + f.nombre + NL +
    '📅 Pago: ' + fechaDdMmm(f.fechaDinamica) + NL +
    '💰 Capital: $' + textoMiles(f.op.cantidad) + NL +
    '📊 % préstamo: ' + textoPorcentaje(f.op.tasa) + NL +
    '📈 Int. mensual: $' + textoMiles(f.pagoMes)
  return (
    '🟢 MES ACTUAL' + NL +
    '💵 TOTAL MXN A PAGAR: $' + textoMiles(suma(esteMes, (f) => f.pagoMes)) + NL + NL +
    (esteMes.length ? esteMes.map(bloque).join(NL + NL) : 'Sin pagos este mes') +
    NL + NL + NL +
    '🔵 PRÓXIMO MES' + NL +
    '💵 TOTAL MXN A PAGAR: $' + textoMiles(suma(activos, (f) => f.pagoMes)) + NL + NL +
    (activos.length ? activos.map(bloque).join(NL + NL) : 'Sin pagos activos')
  )
}

// DASHBOARD!G37 ("PAGO A INVERSORES USDT").
export function pagosInversoresUSDT(m: Modelo): string {
  const t = partes(m.hoy)
  const tc = m.tc
  const activos = m.inversiones.filter((f) => f.op.divisa === 'USDT' && esActivo(f)).sort((a, b) => a.fechaDinamica - b.fechaDinamica)
  const esteMes = activos.filter((f) => {
    const r = partes(f.fechaDinamica)
    return f.fechaDinamica >= m.hoy + 2 && r.mes === t.mes && r.anio === t.anio
  })
  const bloque = (f: Fila) =>
    '👤 ' + f.nombre + ' | 📅 ' + fechaDdMmm(f.fechaDinamica) + ' | 📊 ' + textoPorcentaje(f.op.tasa) + NL +
    '💰 ' + textoMiles(f.op.cantidad) + ' USDT | 💵 $' + textoMiles(f.op.equivalencia ?? 0) + ' MXN' + NL +
    '📈 ' + textoMiles(f.pagoMes) + ' USDT | 💸 $' + textoMiles(f.pagoMes * tc) + ' MXN'
  const totales = (filas: Fila[]) =>
    '💵 TOTAL: $' + textoMiles(suma(filas, (f) => f.pagoMes * tc)) + ' MXN | ' + textoMiles(suma(filas, (f) => f.pagoMes)) + ' USDT'
  return (
    '🟢 MES ACTUAL' + NL + totales(esteMes) + NL + NL +
    (esteMes.length ? esteMes.map(bloque).join(NL + NL) : 'Sin pagos este mes') +
    NL + NL + NL +
    '🔵 PRÓXIMO MES' + NL + totales(activos) + NL + NL +
    (activos.length ? activos.map(bloque).join(NL + NL) : 'Sin pagos activos')
  )
}

// Texto de la celda de CASHFLOW.
export function textoCashflow(c: { ingresos: number; pagos: number; balance: number }): string {
  return (
    '💰 Ingresos: $' + textoMilesPunto(c.ingresos) +
    ' | 💸 Pagos: $' + textoMilesPunto(c.pagos) +
    ' | 📊 Balance: $' + textoMilesPunto(c.balance)
  )
}
