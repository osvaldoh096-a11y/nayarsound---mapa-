import { useState, type FormEvent } from 'react'
import { useDatos } from '../datos'
import { esActivo, suma } from '../calc/motor'
import type { Persona, TipoPersona } from '../calc/tipos'
import { Chips, Dinero, Modal, ir, useConfirmar } from '../ui'
import { EstadoCuenta } from './Operaciones'

export function Personas() {
  const { datos, modelo, eliminar, avisar } = useDatos()
  const [confirmacion, confirmar] = useConfirmar()
  const [tipo, setTipo] = useState<TipoPersona>('prestatario')
  const [buscar, setBuscar] = useState('')
  const [editar, setEditar] = useState<Persona | 'nueva' | null>(null)
  const [estadoDe, setEstadoDe] = useState<string | null>(null)

  const filasDe = (p: Persona) => (tipo === 'prestatario' ? modelo.prestamos : modelo.inversiones).filter((f) => f.op.persona_id === p.id)
  const texto = buscar.trim().toUpperCase()
  const personas = datos.personas
    .filter((p) => p.tipo === tipo && !p.eliminado)
    .filter((p) => !texto || p.nombre.toUpperCase().includes(texto))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const borrar = async (p: Persona) => {
    const usadas = datos.operaciones.filter((o) => o.persona_id === p.id && !o.eliminado).length
    if (usadas > 0) {
      avisar(`Tiene ${usadas} operación(es); elimínalas primero`)
      return
    }
    const ok = await confirmar({ titulo: 'Eliminar persona', texto: `${p.nombre} pasará a la papelera.`, boton: 'Eliminar', peligro: true })
    if (!ok) return
    await eliminar('personas', p.id)
    avisar('Persona enviada a la papelera')
  }

  return (
    <>
      <div className="cabecera">
        <h1>Personas</h1>
        <button className="boton primario" onClick={() => setEditar('nueva')}>+ Persona</button>
      </div>
      <div className="filtros">
        <Chips<TipoPersona> opciones={[['prestatario', 'Prestatarios'], ['inversor', 'Inversores']]} valor={tipo} onCambio={setTipo} />
        <input type="search" placeholder="Buscar nombre" value={buscar} onChange={(e) => setBuscar(e.target.value)} autoComplete="off" />
      </div>
      <div className="lista">
        {personas.map((p) => {
          const filas = filasDe(p)
          const activas = filas.filter(esActivo)
          return (
            <div key={p.id} className="item">
              <div className="fila1">
                <span className="titulo">{p.nombre}</span>
                <span className="suave pequeno">{activas.length} activa(s) · {filas.length} total</span>
              </div>
              {activas.length > 0 && (
                <div className="detalles">
                  <span>Capital activo <b><Dinero valor={suma(activas, (f) => f.op.cantidad)} /></b></span>
                  <span>Interés restante <b><Dinero valor={suma(activas, (f) => f.intRestante)} /></b></span>
                </div>
              )}
              {p.pago_diferido && <div className="detalles"><span className="insignia aviso">Pago diferido</span></div>}
              <div className="acciones" style={{ marginTop: 10 }}>
                <button className="boton" onClick={() => ir(`/${tipo === 'prestatario' ? 'prestamos' : 'inversores'}?persona=${p.id}`)}>Ver operaciones</button>
                {tipo === 'prestatario' && activas.length > 0 && <button className="boton" onClick={() => setEstadoDe(p.id)}>Estado de cuenta</button>}
                <button className="boton" onClick={() => setEditar(p)}>Editar</button>
                <button className="boton peligro" onClick={() => void borrar(p)} aria-label={`Eliminar ${p.nombre}`}>✕</button>
              </div>
            </div>
          )
        })}
        {personas.length === 0 && <div className="vacio">Sin personas.</div>}
      </div>
      {editar && <FormPersona tipo={tipo} persona={editar === 'nueva' ? undefined : editar} onCerrar={() => setEditar(null)} />}
      {estadoDe && <EstadoCuenta personaId={estadoDe} onCerrar={() => setEstadoDe(null)} />}
      {confirmacion}
    </>
  )
}

function FormPersona({ tipo, persona, onCerrar }: { tipo: TipoPersona; persona?: Persona; onCerrar: () => void }) {
  const { guardarPersona, avisar } = useDatos()
  const [nombre, setNombre] = useState(persona?.nombre ?? '')
  const [diferido, setDiferido] = useState(persona?.pago_diferido ?? false)
  const [error, setError] = useState('')
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (nombre.trim() === '') return setError('Escribe el nombre.')
    try {
      await guardarPersona({ ...(persona ? { id: persona.id } : {}), tipo: persona?.tipo ?? tipo, nombre: persona ? nombre : nombre.trim(), pago_diferido: diferido })
      avisar('Guardado')
      onCerrar()
    } catch (err) {
      setError((err as Error).message)
    }
  }
  const esPrestatario = (persona?.tipo ?? tipo) === 'prestatario'
  return (
    <Modal titulo={persona ? 'Editar persona' : esPrestatario ? 'Nuevo prestatario' : 'Nuevo inversor'} onCerrar={onCerrar}>
      <form onSubmit={(e) => void enviar(e)} autoComplete="off">
        <div className="campo">
          <label htmlFor="p-nombre">Nombre</label>
          <input id="p-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value.toUpperCase())} />
        </div>
        {esPrestatario && (
          <label className="check">
            <input type="checkbox" checked={diferido} onChange={(e) => setDiferido(e.target.checked)} />
            <span>
              Pago diferido
              <div className="suave pequeno">Sus cobros se listan aparte y no cuentan como ingresos del cashflow, igual que en el Sheets.</div>
            </span>
          </label>
        )}
        {error && <div className="error-caja">{error}</div>}
        <button className="boton primario bloque" type="submit" style={{ marginTop: 8 }}>Guardar</button>
      </form>
    </Modal>
  )
}
