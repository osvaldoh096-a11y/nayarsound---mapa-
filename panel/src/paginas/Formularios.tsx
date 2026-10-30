import { useState, type FormEvent } from 'react'
import { useDatos } from '../datos'
import { isoDeSerie } from '../calc/fechas'
import type { Divisa, Estado, Operacion, Pago, TipoOperacion } from '../calc/tipos'
import { tipoPersonaDe } from '../calc/tipos'
import { Chips, Modal } from '../ui'

const aNumero = (texto: string): number | null => {
  const limpio = texto.replace(/[$,\s]/g, '')
  if (limpio === '') return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}
// "8" → 0.08 sin arrastrar error binario (8/100 = 0.08, 21.43/100 = 0.2143).
const porcentajeAFraccion = (n: number) => Number((n / 100).toPrecision(12))
const fraccionAPorcentaje = (n: number) => String(Number((n * 100).toPrecision(12)))

export function FormOperacion({ tipo, operacion, onCerrar }: { tipo: TipoOperacion; operacion?: Operacion; onCerrar: (guardada?: Operacion) => void }) {
  const { datos, modelo, guardarOperacion, guardarPersona, avisar } = useDatos()
  const tipoPersona = tipoPersonaDe(tipo)
  const personas = datos.personas
    .filter((p) => p.tipo === tipoPersona && (!p.eliminado || p.id === operacion?.persona_id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
  const hoyISO = isoDeSerie(modelo.hoy)

  const [personaId, setPersonaId] = useState(operacion?.persona_id ?? '')
  const [nuevaPersona, setNuevaPersona] = useState('')
  const [pagoMensual, setPagoMensual] = useState<'SI' | 'NO' | ''>(operacion ? operacion.pago_mensual ?? '' : 'SI')
  const [fechaInicio, setFechaInicio] = useState(operacion?.fecha_inicio ?? hoyISO)
  const [divisa, setDivisa] = useState<Divisa>(operacion?.divisa ?? 'MXN')
  const [cantidad, setCantidad] = useState(operacion ? String(operacion.cantidad) : '')
  const [equivalencia, setEquivalencia] = useState(operacion?.equivalencia != null ? String(operacion.equivalencia) : '')
  const [tasa, setTasa] = useState(operacion ? fraccionAPorcentaje(operacion.tasa) : '')
  const [compromiso, setCompromiso] = useState(operacion?.fecha_compromiso ?? '')
  const [finalDinamico, setFinalDinamico] = useState(operacion ? operacion.dia_final === null : true)
  const [diaFinal, setDiaFinal] = useState(operacion?.dia_final ?? hoyISO)
  const [estado, setEstado] = useState<Estado>(operacion?.estado ?? 'ACTIVO')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const nCantidad = aNumero(cantidad)
    const nTasa = aNumero(tasa)
    const nEquivalencia = aNumero(equivalencia)
    if (personaId === '' && nuevaPersona.trim() === '') return setError('Elige o escribe el nombre.')
    if (!fechaInicio) return setError('Falta la fecha de inicio.')
    if (nCantidad === null) return setError('La cantidad no es un número válido.')
    if (nTasa === null) return setError('El interés mensual no es un número válido.')
    if (equivalencia.trim() !== '' && nEquivalencia === null) return setError('La equivalencia no es un número válido.')
    if (!finalDinamico && !diaFinal) return setError('Falta el día final.')
    setGuardando(true)
    try {
      let idPersona = personaId
      if (idPersona === '') {
        const existente = personas.find((p) => p.nombre === nuevaPersona.trim())
        idPersona = existente ? existente.id : (await guardarPersona({ tipo: tipoPersona, nombre: nuevaPersona.trim() })).id
      }
      const guardada = await guardarOperacion({
        ...(operacion ? { id: operacion.id } : { tipo }),
        persona_id: idPersona,
        pago_mensual: pagoMensual === '' ? null : pagoMensual,
        fecha_inicio: fechaInicio,
        divisa,
        cantidad: nCantidad,
        equivalencia: nEquivalencia,
        tasa: porcentajeAFraccion(nTasa),
        fecha_compromiso: compromiso || null,
        dia_final: finalDinamico ? null : diaFinal,
        estado,
      })
      avisar(operacion ? 'Cambios guardados' : `OP ${guardada.op} creada`)
      onCerrar(guardada)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={operacion ? `Editar OP ${operacion.op}` : tipo === 'prestamo' ? 'Nuevo préstamo' : 'Nueva inversión'} onCerrar={() => onCerrar()}>
      <form onSubmit={(e) => void enviar(e)} autoComplete="off">
        <div className="campo">
          <label htmlFor="f-persona">Nombre</label>
          <select id="f-persona" value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
            <option value="">{personas.length ? '— Nueva persona —' : 'Escribe el nombre abajo'}</option>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          {personaId === '' && (
            <input type="text" placeholder="Nombre de la nueva persona" value={nuevaPersona} onChange={(e) => setNuevaPersona(e.target.value.toUpperCase())} />
          )}
        </div>
        <div className="dos">
          <div className="campo">
            <label htmlFor="f-inicio">Fecha inicio</label>
            <input id="f-inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
          </div>
          <div className="campo">
            <span className="etiqueta">Pago mensual</span>
            <Chips<'SI' | 'NO' | ''> opciones={[['SI', 'Sí'], ['NO', 'No']]} valor={pagoMensual} onCambio={setPagoMensual} />
          </div>
        </div>
        <div className="dos">
          <div className="campo">
            <span className="etiqueta">Divisa</span>
            <Chips<Divisa> opciones={[['MXN', 'MXN'], ['USDT', 'USDT']]} valor={divisa} onCambio={setDivisa} />
          </div>
          <div className="campo">
            <label htmlFor="f-cantidad">Cantidad</label>
            <input id="f-cantidad" type="text" inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required />
          </div>
        </div>
        <div className="dos">
          <div className="campo">
            <label htmlFor="f-tasa">Interés mensual (%)</label>
            <input id="f-tasa" type="text" inputMode="decimal" placeholder="8" value={tasa} onChange={(e) => setTasa(e.target.value)} required />
          </div>
          <div className="campo">
            <label htmlFor="f-equiv">Equivalencia</label>
            <input id="f-equiv" type="text" inputMode="decimal" placeholder="Opcional" value={equivalencia} onChange={(e) => setEquivalencia(e.target.value)} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="f-compromiso">Fecha compromiso</label>
          <input id="f-compromiso" type="date" value={compromiso} onChange={(e) => setCompromiso(e.target.value)} />
        </div>
        <div className="campo">
          <span className="etiqueta">Día final</span>
          <Chips<'hoy' | 'fecha'>
            opciones={[['hoy', 'Hoy (se actualiza solo)'], ['fecha', 'Fecha fija']]}
            valor={finalDinamico ? 'hoy' : 'fecha'}
            onCambio={(v) => setFinalDinamico(v === 'hoy')}
          />
          {!finalDinamico && <input type="date" value={diaFinal} onChange={(e) => setDiaFinal(e.target.value)} aria-label="Día final" />}
        </div>
        <div className="campo">
          <span className="etiqueta">Estado</span>
          <Chips<Estado> opciones={[['ACTIVO', 'Activo'], ['LIQUIDADO', 'Liquidado']]} valor={estado} onCambio={setEstado} />
        </div>
        {error && <div className="error-caja">{error}</div>}
        <button className="boton primario bloque" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </Modal>
  )
}

export function FormPago({ tipo, pago, operacionId, onCerrar }: { tipo: TipoOperacion; pago?: Pago; operacionId?: string; onCerrar: () => void }) {
  const { modelo, guardarPago, avisar } = useDatos()
  const filas = tipo === 'prestamo' ? modelo.prestamos : modelo.inversiones
  const opciones = [...filas].sort((a, b) => (a.op.estado === b.op.estado ? b.op.op - a.op.op : a.op.estado === 'ACTIVO' ? -1 : 1))
  const [operacion, setOperacion] = useState(pago ? pago.operacion_id ?? '' : operacionId ?? '')
  const [fecha, setFecha] = useState(pago?.fecha ?? isoDeSerie(modelo.hoy))
  const [cantidad, setCantidad] = useState(pago ? String(pago.cantidad) : '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const elegida = operacion ? modelo.porId.get(operacion) : undefined

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const n = aNumero(cantidad)
    if (!operacion && !(pago && pago.operacion_id === null)) return setError('Elige la operación (OP).')
    if (!fecha) return setError('Falta la fecha.')
    if (n === null) return setError('La cantidad no es un número válido.')
    setGuardando(true)
    try {
      await guardarPago({ ...(pago ? { id: pago.id } : { tipo }), operacion_id: operacion || null, fecha, cantidad: n })
      avisar(pago ? 'Pago actualizado' : 'Pago registrado')
      onCerrar()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={pago ? 'Editar pago' : 'Registrar pago'} onCerrar={onCerrar}>
      <form onSubmit={(e) => void enviar(e)} autoComplete="off">
        <div className="campo">
          <label htmlFor="g-op">Operación</label>
          <select id="g-op" value={operacion} onChange={(e) => setOperacion(e.target.value)}>
            <option value="">{pago && pago.operacion_id === null ? 'Sin OP (registro histórico)' : 'Elige la OP…'}</option>
            {opciones.map((f) => (
              <option key={f.op.id} value={f.op.id}>
                OP {f.op.op} · {f.nombre} · {f.op.divisa}{f.op.estado === 'LIQUIDADO' ? ' (liquidado)' : ''}
              </option>
            ))}
          </select>
          {elegida && (
            <span className="ayuda">
              Interés restante actual: {elegida.intRestante.toLocaleString('es-MX', { maximumFractionDigits: 2 })} {elegida.op.divisa} · Pago mes:{' '}
              {elegida.pagoMes.toLocaleString('es-MX', { maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
        <div className="dos">
          <div className="campo">
            <label htmlFor="g-fecha">Fecha</label>
            <input id="g-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </div>
          <div className="campo">
            <label htmlFor="g-cant">Cantidad{elegida ? ` (${elegida.op.divisa})` : ''}</label>
            <input id="g-cant" type="text" inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required />
          </div>
        </div>
        {error && <div className="error-caja">{error}</div>}
        <button className="boton primario bloque" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar pago'}</button>
      </form>
    </Modal>
  )
}

export function FormLiquidar({ operacion, onCerrar }: { operacion: Operacion; onCerrar: () => void }) {
  const { modelo, guardarOperacion, avisar } = useDatos()
  const fila = modelo.porId.get(operacion.id)
  const [fecha, setFecha] = useState(isoDeSerie(modelo.hoy))
  const [error, setError] = useState('')
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await guardarOperacion({ id: operacion.id, estado: 'LIQUIDADO', dia_final: fecha })
      avisar(`OP ${operacion.op} liquidada`)
      onCerrar()
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <Modal titulo={`Liquidar OP ${operacion.op}`} onCerrar={onCerrar}>
      <form onSubmit={(e) => void enviar(e)}>
        <p className="suave" style={{ marginTop: 0 }}>
          Se marca como LIQUIDADO y el día final queda fijo en la fecha elegida.
          {fila && fila.intRestante > 1 && ` Interés restante hoy: ${fila.intRestante.toLocaleString('es-MX', { maximumFractionDigits: 2 })} ${operacion.divisa}; registra el pago antes si corresponde.`}
        </p>
        <div className="campo">
          <label htmlFor="l-fecha">Día final</label>
          <input id="l-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </div>
        {error && <div className="error-caja">{error}</div>}
        <button className="boton primario bloque" type="submit">Liquidar</button>
      </form>
    </Modal>
  )
}
