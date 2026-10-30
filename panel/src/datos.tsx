import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { hoyEn } from './calc/fechas'
import { calcularModelo, type Modelo } from './calc/motor'
import { AJUSTES_INICIALES, type Ajustes, type Datos, type Operacion, type Pago, type Persona } from './calc/tipos'

type Tabla = 'personas' | 'operaciones' | 'pagos'

interface Contexto {
  datos: Datos
  modelo: Modelo
  recargar: () => Promise<void>
  guardarPersona: (p: Partial<Persona> & Pick<Persona, 'tipo' | 'nombre'>) => Promise<Persona>
  guardarOperacion: (o: Partial<Operacion>) => Promise<Operacion>
  guardarPago: (p: Partial<Pago>) => Promise<Pago>
  eliminar: (tabla: Tabla, id: string) => Promise<void>
  restaurar: (tabla: Tabla, id: string) => Promise<void>
  borrarDefinitivo: (tabla: Tabla, id: string) => Promise<void>
  guardarAjustes: (a: Ajustes) => Promise<void>
  avisar: (texto: string) => void
}

const Ctx = createContext<Contexto | null>(null)

export function useDatos(): Contexto {
  const c = useContext(Ctx)
  if (!c) throw new Error('useDatos fuera del proveedor')
  return c
}

// Columnas numeric llegan como número desde la API; se normalizan por si llegan como texto.
const num = (x: unknown) => (x === null || x === undefined ? null : Number(x))

async function leerTodo<T>(tabla: string, orden: string): Promise<T[]> {
  const filas: T[] = []
  const paso = 1000
  for (let desde = 0; ; desde += paso) {
    const { data, error } = await supabase.from(tabla).select('*').order(orden).range(desde, desde + paso - 1)
    if (error) throw new Error(error.message)
    filas.push(...(data as T[]))
    if (!data || data.length < paso) break
  }
  return filas
}

export async function descargarDatos(): Promise<Datos> {
  const [personas, operaciones, pagos, ajustes] = await Promise.all([
    leerTodo<Persona>('personas', 'nombre'),
    leerTodo<Operacion>('operaciones', 'op'),
    leerTodo<Pago>('pagos', 'orden'),
    leerTodo<Ajustes>('ajustes', 'owner_id'),
  ])
  return {
    personas,
    operaciones: operaciones.map((o) => ({
      ...o,
      cantidad: Number(o.cantidad),
      tasa: Number(o.tasa),
      equivalencia: num(o.equivalencia),
    })),
    pagos: pagos.map((p) => ({ ...p, cantidad: Number(p.cantidad), orden: Number(p.orden) })),
    ajustes: ajustes[0]
      ? { tipo_cambio: Number(ajustes[0].tipo_cambio), zona_horaria: ajustes[0].zona_horaria }
      : AJUSTES_INICIALES,
  }
}

function mensajeError(e: { message: string; code?: string }): string {
  if (e.code === '23505') return 'Ya existe un registro con ese nombre o número de OP.'
  if (e.code === '23503') return 'El registro está relacionado con otros datos y no se puede borrar.'
  return e.message
}

export function ProveedorDatos({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    try {
      setDatos(await descargarDatos())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 2200)
    return () => clearTimeout(t)
  }, [aviso])

  const zona = datos?.ajustes.zona_horaria ?? AJUSTES_INICIALES.zona_horaria
  const hoy = hoyEn(zona)
  const modelo = useMemo(() => (datos ? calcularModelo(datos, hoy) : null), [datos, hoy])

  const valor = useMemo<Contexto | null>(() => {
    if (!datos || !modelo) return null
    const escribir = async <T,>(tabla: Tabla, fila: Partial<T> & { id?: string }): Promise<T> => {
      const { id, ...resto } = fila as { id?: string } & Record<string, unknown>
      const consulta = id
        ? supabase.from(tabla).update(resto).eq('id', id).select().single()
        : supabase.from(tabla).insert(resto).select().single()
      const { data, error } = await consulta
      if (error) throw new Error(mensajeError(error))
      await recargar()
      return data as T
    }
    return {
      datos,
      modelo,
      recargar,
      guardarPersona: (p) => escribir<Persona>('personas', p),
      guardarOperacion: (o) => escribir<Operacion>('operaciones', o),
      guardarPago: (p) => escribir<Pago>('pagos', p),
      eliminar: async (tabla, id) => {
        const { error } = await supabase.from(tabla).update({ eliminado: new Date().toISOString() }).eq('id', id)
        if (error) throw new Error(mensajeError(error))
        await recargar()
      },
      restaurar: async (tabla, id) => {
        const { error } = await supabase.from(tabla).update({ eliminado: null }).eq('id', id)
        if (error) throw new Error(mensajeError(error))
        await recargar()
      },
      borrarDefinitivo: async (tabla, id) => {
        if (tabla === 'operaciones') {
          const { error } = await supabase.from('pagos').delete().eq('operacion_id', id)
          if (error) throw new Error(mensajeError(error))
        }
        const { error } = await supabase.from(tabla).delete().eq('id', id)
        if (error) throw new Error(mensajeError(error))
        await recargar()
      },
      guardarAjustes: async (a) => {
        const { data: sesion } = await supabase.auth.getSession()
        const { error } = await supabase
          .from('ajustes')
          .upsert({ owner_id: sesion.session?.user.id, tipo_cambio: a.tipo_cambio, zona_horaria: a.zona_horaria })
        if (error) throw new Error(mensajeError(error))
        await recargar()
      },
      avisar: setAviso,
    }
  }, [datos, modelo, recargar])

  if (error && !datos) {
    return (
      <div className="app">
        <div className="error-caja">No se pudieron cargar los datos: {error}</div>
        <button className="boton" onClick={() => void recargar()}>Reintentar</button>
      </div>
    )
  }
  if (!valor) return <div className="vacio">Cargando…</div>
  return (
    <Ctx.Provider value={valor}>
      {children}
      {aviso && <div className="aviso-flotante" role="status">{aviso}</div>}
    </Ctx.Provider>
  )
}
