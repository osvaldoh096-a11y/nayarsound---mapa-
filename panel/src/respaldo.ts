// Respaldos: archivo JSON cifrado con contraseña (AES-256-GCM, clave derivada con PBKDF2-SHA256)
// y exportación a CSV en un .zip. Todo se procesa en el navegador.
import { strToU8, zipSync } from 'fflate'
import { isoDeSerie } from './calc/fechas'
import type { Modelo } from './calc/motor'
import type { Datos } from './calc/tipos'

export const FORMATO_RESPALDO = 'panel-respaldo-v1'
const FORMATO_CIFRADO = 'panel-cifrado-v1'
const ITERACIONES = 600_000

export interface Respaldo {
  formato: typeof FORMATO_RESPALDO
  creado: string
  personas: Datos['personas']
  operaciones: Datos['operaciones']
  pagos: Datos['pagos']
  ajustes: Datos['ajustes']
}

const sinDueno = <T extends object>(filas: T[]) =>
  filas.map((f) => {
    const { owner_id: _omitido, ...resto } = f as T & { owner_id?: string }
    return resto as T
  })

export function armarRespaldo(datos: Datos): Respaldo {
  return {
    formato: FORMATO_RESPALDO,
    creado: new Date().toISOString(),
    personas: sinDueno(datos.personas),
    operaciones: sinDueno(datos.operaciones),
    pagos: sinDueno(datos.pagos),
    ajustes: datos.ajustes,
  }
}

const aBase64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const deBase64 = (texto: string) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0))

async function derivarClave(contrasena: string, sal: Uint8Array, iteraciones: number) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(contrasena), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function cifrar(respaldo: Respaldo, contrasena: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const clave = await derivarClave(contrasena, sal, ITERACIONES)
  const datos = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, new TextEncoder().encode(JSON.stringify(respaldo))))
  return JSON.stringify({ formato: FORMATO_CIFRADO, kdf: 'PBKDF2-SHA256', iteraciones: ITERACIONES, sal: aBase64(sal), iv: aBase64(iv), datos: aBase64(datos) })
}

export async function descifrar(texto: string, contrasena: string): Promise<Respaldo> {
  let sobre: { formato?: string; iteraciones?: number; sal?: string; iv?: string; datos?: string }
  try {
    sobre = JSON.parse(texto)
  } catch {
    throw new Error('El archivo no es un respaldo válido.')
  }
  if (sobre.formato !== FORMATO_CIFRADO || !sobre.sal || !sobre.iv || !sobre.datos) throw new Error('El archivo no es un respaldo cifrado de este sistema.')
  try {
    const clave = await derivarClave(contrasena, deBase64(sobre.sal), sobre.iteraciones ?? ITERACIONES)
    const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deBase64(sobre.iv) }, clave, deBase64(sobre.datos))
    const respaldo = JSON.parse(new TextDecoder().decode(plano)) as Respaldo
    if (respaldo.formato !== FORMATO_RESPALDO) throw new Error('formato')
    return respaldo
  } catch {
    throw new Error('Contraseña incorrecta o archivo dañado.')
  }
}

export function descargar(nombre: string, contenido: BlobPart, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const fechaArchivo = () => new Date().toISOString().slice(0, 10)

const celda = (v: unknown) => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
const csv = (encabezados: string[], filas: unknown[][]) =>
  '﻿' + [encabezados, ...filas].map((f) => f.map(celda).join(',')).join('\r\n') + '\r\n'

// Exportación legible en hojas de cálculo: registros con sus columnas calculadas al día de hoy.
export function exportarCSV(modelo: Modelo, datos: Datos): Uint8Array {
  const operaciones = (filas: Modelo['prestamos']) =>
    csv(
      ['OP', 'PAGO MENSUAL', 'FECHA INICIO', 'NOMBRE', 'DIVISA', 'CANTIDAD', 'EQUIVALENCIA', 'INT/MES', 'FECHA COMPROMISO', 'DIA FINAL', 'ESTADO',
        'INT RESTANTE', 'PAGO MES', 'INT GEN DIARIO', 'TOT DIAS', 'TOT MESES', 'INT TOTAL', 'FECHA DINAMICA', 'AUXILIAR'],
      filas.map((f) => [
        f.op.op, f.op.pago_mensual, f.op.fecha_inicio, f.nombre, f.op.divisa, f.op.cantidad, f.op.equivalencia, f.op.tasa,
        f.op.fecha_compromiso, f.diaFinalDinamico ? `HOY (${isoDeSerie(f.diaFinal)})` : f.op.dia_final, f.op.estado,
        f.intRestante, f.pagoMes, f.intDiario, f.totDias, f.totMeses, f.intTotal, isoDeSerie(f.fechaDinamica), f.auxiliar,
      ]),
    )
  const pagos = (lista: Modelo['pagosPrestamo']) =>
    csv(
      ['FECHA', 'OP', 'CANTIDAD', 'DIVISA', 'NOMBRE'],
      lista.map((p) => {
        const f = p.operacion_id ? modelo.porId.get(p.operacion_id) : undefined
        return [p.fecha, f?.op.op ?? '', p.cantidad, f?.op.divisa ?? '', f?.nombre ?? '']
      }),
    )
  const personas = csv(
    ['TIPO', 'NOMBRE', 'PAGO DIFERIDO'],
    datos.personas.filter((p) => !p.eliminado).map((p) => [p.tipo, p.nombre, p.pago_diferido ? 'SI' : 'NO']),
  )
  return zipSync({
    'prestamos.csv': strToU8(operaciones(modelo.prestamos)),
    'inversores.csv': strToU8(operaciones(modelo.inversiones)),
    'pagos_prestamos.csv': strToU8(pagos(modelo.pagosPrestamo)),
    'pagos_inversores.csv': strToU8(pagos(modelo.pagosInversion)),
    'personas.csv': strToU8(personas),
  })
}
