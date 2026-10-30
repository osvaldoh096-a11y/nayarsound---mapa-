export type TipoOperacion = 'prestamo' | 'inversion'
export type TipoPersona = 'prestatario' | 'inversor'
export type Divisa = 'MXN' | 'USDT'
export type Estado = 'ACTIVO' | 'LIQUIDADO'

export interface Persona {
  id: string
  tipo: TipoPersona
  nombre: string
  pago_diferido: boolean
  creado?: string
  actualizado?: string
  eliminado: string | null
}

export interface Operacion {
  id: string
  tipo: TipoOperacion
  op: number
  persona_id: string
  pago_mensual: 'SI' | 'NO' | null
  fecha_inicio: string // ISO yyyy-mm-dd
  divisa: Divisa
  cantidad: number
  equivalencia: number | null
  tasa: number // interés mensual como fracción (0.08 = 8%)
  fecha_compromiso: string | null
  dia_final: string | null // null = HOY() dinámico
  estado: Estado
  creado?: string
  actualizado?: string
  eliminado: string | null
}

export interface Pago {
  id: string
  tipo: TipoOperacion
  operacion_id: string | null
  fecha: string
  cantidad: number
  orden: number
  creado?: string
  actualizado?: string
  eliminado: string | null
}

export interface Ajustes {
  tipo_cambio: number
  zona_horaria: string
}

export const AJUSTES_INICIALES: Ajustes = { tipo_cambio: 18, zona_horaria: 'America/Los_Angeles' }

export interface Datos {
  personas: Persona[]
  operaciones: Operacion[]
  pagos: Pago[]
  ajustes: Ajustes
}

export const tipoPersonaDe = (t: TipoOperacion): TipoPersona => (t === 'prestamo' ? 'prestatario' : 'inversor')
