import { useMemo, useState, type ReactNode } from 'react'
import { useDatos } from '../datos'
import { serieDeISO } from '../calc/fechas'
import { fechaCorta, numero, porcentaje } from '../calc/formato'
import { resumenInversion, resumenPrestamo, totalesDeudor, estadoCuenta, type TipoResumen } from '../calc/mensajes'
import { suma, type Fila } from '../calc/motor'
import type { Divisa, Pago, TipoOperacion } from '../calc/tipos'
import { Chips, Copiable, Dato, Dinero, Insignia, Modal, ir, useConfirmar, useRuta } from '../ui'
import { FormLiquidar, FormOperacion, FormPago } from './Formularios'

const ruta = (tipo: TipoOperacion) => (tipo === 'prestamo' ? '/prestamos' : '/inversores')

function TotalesPorDivisa({ filas }: { filas: Fila[] }) {
  const divisas: Divisa[] = ['MXN', 'USDT']
  return (
    <div className="totales">
      {divisas.map((d) => {
        const de = filas.filter((f) => f.op.divisa === d)
        if (!de.length) return null
        return (
          <span key={d}>
            {d}: capital <b><Dinero valor={suma(de, (f) => f.op.cantidad)} /></b> · interés restante{' '}
            <b><Dinero valor={suma(de, (f) => f.intRestante)} /></b>
          </span>
        )
      })}
    </div>
  )
}

export function Operaciones({ tipo }: { tipo: TipoOperacion }) {
  const { modelo } = useDatos()
  const { params } = useRuta()
  const personaFiltro = params.get('persona')
  const [estado, setEstado] = useState<'ACTIVO' | 'LIQUIDADO' | 'todos'>('ACTIVO')
  const [divisa, setDivisa] = useState<'todas' | Divisa>('todas')
  const [buscar, setBuscar] = useState('')
  const [mes, setMes] = useState('')
  const [nuevo, setNuevo] = useState(false)

  const todas = tipo === 'prestamo' ? modelo.prestamos : modelo.inversiones
  const meses = useMemo(() => [...new Map(todas.map((f) => [f.auxiliar, f.inicio])).entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e), [todas])
  const texto = buscar.trim().toUpperCase()
  const filas = todas
    .filter((f) => !personaFiltro || f.op.persona_id === personaFiltro)
    .filter((f) => estado === 'todos' || f.op.estado === estado)
    .filter((f) => divisa === 'todas' || f.op.divisa === divisa)
    .filter((f) => !mes || f.auxiliar === mes)
    .filter((f) => !texto || f.nombre.toUpperCase().includes(texto) || String(f.op.op) === texto.replace(/^OP\s*/, ''))
    .sort((a, b) => b.op.op - a.op.op)
  const persona = personaFiltro ? modelo.personas.get(personaFiltro) : undefined

  return (
    <>
      <div className="cabecera">
        <h1>{tipo === 'prestamo' ? 'Préstamos' : 'Inversores'}</h1>
        <span className="sub">{filas.length} de {todas.length}</span>
      </div>
      <div className="filtros">
        <input type="search" placeholder="Buscar por nombre u OP" value={buscar} onChange={(e) => setBuscar(e.target.value)} autoComplete="off" />
        <Chips opciones={[['ACTIVO', 'Activos'], ['LIQUIDADO', 'Liquidados'], ['todos', 'Todos']]} valor={estado} onCambio={setEstado} />
        <div className="linea">
          <Chips opciones={[['todas', 'Todas las divisas'], ['MXN', 'MXN'], ['USDT', 'USDT']]} valor={divisa} onCambio={setDivisa} />
          <select className="compacto" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes de inicio">
            <option value="">Cualquier mes de inicio</option>
            {meses.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {persona && (
          <div>
            <button className="chip activo" onClick={() => ir(ruta(tipo))}>{persona.nombre} ✕</button>
          </div>
        )}
      </div>
      <TotalesPorDivisa filas={filas} />
      <div className="lista">
        {filas.map((f) => (
          <a key={f.op.id} className="item" href={'#' + ruta(tipo) + '/' + f.op.id}>
            <div className="fila1">
              <span className="titulo">OP {f.op.op} · {f.nombre}</span>
              <Insignia estado={f.op.estado} />
            </div>
            <div className="detalles">
              <span>Capital <b><Dinero valor={f.op.cantidad} divisa={f.op.divisa} /></b></span>
              <span>Interés {porcentaje(f.op.tasa)}</span>
              <span>Interés restante <b><Dinero valor={f.intRestante} /></b></span>
              <span>Pago mes <b><Dinero valor={f.pagoMes} /></b></span>
              {f.op.estado === 'ACTIVO' && <span>Próx. pago {fechaCorta(f.fechaDinamica)}</span>}
              {f.compromiso !== null && <span>Compromiso {fechaCorta(f.compromiso)}</span>}
            </div>
          </a>
        ))}
        {filas.length === 0 && <div className="vacio">No hay registros con estos filtros.</div>}
      </div>
      <button className="boton primario flotante" onClick={() => setNuevo(true)}>+ {tipo === 'prestamo' ? 'Préstamo' : 'Inversión'}</button>
      {nuevo && (
        <FormOperacion
          tipo={tipo}
          onCerrar={(g) => {
            setNuevo(false)
            if (g) ir(ruta(tipo) + '/' + g.id)
          }}
        />
      )}
    </>
  )
}

export function Ficha({ tipo, id }: { tipo: TipoOperacion; id: string }) {
  const { modelo, datos, eliminar, guardarOperacion, avisar } = useDatos()
  const [confirmacion, confirmar] = useConfirmar()
  const [editar, setEditar] = useState(false)
  const [liquidar, setLiquidar] = useState(false)
  const [pagoNuevo, setPagoNuevo] = useState(false)
  const [pagoEditar, setPagoEditar] = useState<Pago | null>(null)
  const [estadoCuentaAbierto, setEstadoCuentaAbierto] = useState(false)
  const [tipoMensaje, setTipoMensaje] = useState<TipoResumen>('CREDITO NUEVO')
  const [abonado, setAbonado] = useState('')
  const [duracion, setDuracion] = useState('1-4 meses')

  const f = modelo.porId.get(id)
  const op = datos.operaciones.find((o) => o.id === id)
  if (!f || !op || op.tipo !== tipo) {
    return (
      <div className="vacio">
        {op?.eliminado ? 'Este registro está en la papelera.' : 'No se encontró el registro.'}
        <div style={{ marginTop: 12 }}><a className="boton" href={'#' + ruta(tipo)}>Volver</a></div>
      </div>
    )
  }

  const nAbonado = Number(abonado.replace(/[$,\s]/g, '')) || 0
  const mensaje = tipo === 'prestamo' ? resumenPrestamo(f, tipoMensaje, nAbonado) : resumenInversion(f, tipoMensaje, nAbonado, duracion)

  const borrar = async () => {
    const ok = await confirmar({
      titulo: `Eliminar OP ${op.op}`,
      texto: `La operación y sus ${f.pagos.length} pago(s) dejarán de contar en los cálculos. Podrás recuperarla desde la papelera.`,
      boton: 'Eliminar',
      peligro: true,
    })
    if (!ok) return
    await eliminar('operaciones', op.id)
    avisar(`OP ${op.op} enviada a la papelera`)
    ir(ruta(tipo))
  }
  const borrarPago = async (p: Pago) => {
    const ok = await confirmar({
      titulo: 'Eliminar pago',
      texto: `Pago del ${fechaCorta(serieDeISO(p.fecha))} por ${numero(p.cantidad, 2)} ${op.divisa}. Podrás recuperarlo desde la papelera.`,
      boton: 'Eliminar',
      peligro: true,
    })
    if (!ok) return
    await eliminar('pagos', p.id)
    avisar('Pago enviado a la papelera')
  }
  const reactivar = async () => {
    const ok = await confirmar({
      titulo: `Reactivar OP ${op.op}`,
      texto: 'Volverá a ACTIVO y el día final será otra vez HOY (se actualiza solo).',
      boton: 'Reactivar',
    })
    if (!ok) return
    await guardarOperacion({ id: op.id, estado: 'ACTIVO', dia_final: null })
    avisar(`OP ${op.op} reactivada`)
  }

  return (
    <>
      <div className="cabecera">
        <div>
          <a href={'#' + ruta(tipo)} className="suave pequeno">← {tipo === 'prestamo' ? 'Préstamos' : 'Inversores'}</a>
          <h1>OP {op.op} · {f.nombre}</h1>
        </div>
        <Insignia estado={op.estado} />
      </div>

      <div className="tarjeta">
        <div className="kpis">
          <Kpi2 titulo="Interés restante" valor={<Dinero valor={f.intRestante} divisa={op.divisa} />} />
          <Kpi2 titulo="Pago mes" valor={<Dinero valor={f.pagoMes} divisa={op.divisa} />} />
          <Kpi2 titulo="Capital" valor={<Dinero valor={op.cantidad} divisa={op.divisa} />} />
        </div>
      </div>

      <div className="tarjeta">
        <h2>Datos</h2>
        <div className="datos">
          <Dato etiqueta="Fecha inicio">{fechaCorta(f.inicio)}</Dato>
          <Dato etiqueta="Pago mensual">{op.pago_mensual ?? '—'}</Dato>
          <Dato etiqueta="Divisa">{op.divisa}</Dato>
          <Dato etiqueta="Cantidad"><Dinero valor={op.cantidad} /></Dato>
          <Dato etiqueta="Equivalencia">{op.equivalencia === null ? '—' : <Dinero valor={op.equivalencia} />}</Dato>
          <Dato etiqueta="Int/mes">{porcentaje(op.tasa)}</Dato>
          <Dato etiqueta="Fecha compromiso">{fechaCorta(f.compromiso)}</Dato>
          <Dato etiqueta="Día final">{fechaCorta(f.diaFinal)}{f.diaFinalDinamico && <span className="suave pequeno"> (hoy)</span>}</Dato>
          <Dato etiqueta="Estado">{op.estado}</Dato>
        </div>
        <h3>Calculado</h3>
        <div className="datos">
          <Dato etiqueta="Int. restante"><Dinero valor={f.intRestante} /></Dato>
          <Dato etiqueta="Pago mes"><Dinero valor={f.pagoMes} /></Dato>
          <Dato etiqueta="Int. gen. diario"><Dinero valor={f.intDiario} /></Dato>
          <Dato etiqueta="Tot. días">{f.totDias}</Dato>
          <Dato etiqueta="Tot. meses">{numero(f.totMeses, 0)}</Dato>
          <Dato etiqueta="Int. total"><Dinero valor={f.intTotal} /></Dato>
          <Dato etiqueta="Pagado"><Dinero valor={f.pagado} /></Dato>
          <Dato etiqueta="Fecha dinámica">{fechaCorta(f.fechaDinamica)}</Dato>
          <Dato etiqueta="Auxiliar">{f.auxiliar}</Dato>
        </div>
        <div className="acciones" style={{ marginTop: 14 }}>
          <button className="boton" onClick={() => setEditar(true)}>Editar</button>
          {op.estado === 'ACTIVO'
            ? <button className="boton" onClick={() => setLiquidar(true)}>Liquidar</button>
            : <button className="boton" onClick={() => void reactivar()}>Reactivar</button>}
          {tipo === 'prestamo' && <button className="boton" onClick={() => setEstadoCuentaAbierto(true)}>Estado de cuenta</button>}
          <button className="boton peligro" onClick={() => void borrar()}>Eliminar</button>
        </div>
      </div>

      <div className="tarjeta">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Pagos ({f.pagos.length})</h2>
          <button className="boton primario" onClick={() => setPagoNuevo(true)}>+ Pago</button>
        </div>
        {f.pagos.length === 0 && <div className="suave">Sin pagos registrados.</div>}
        {f.pagos.length > 0 && (
          <table className="tabla">
            <thead><tr><th>Fecha</th><th className="der">Cantidad</th><th></th></tr></thead>
            <tbody>
              {f.pagos.map((p) => (
                <tr key={p.id}>
                  <td>{fechaCorta(serieDeISO(p.fecha))}</td>
                  <td className="der"><Dinero valor={p.cantidad} /></td>
                  <td className="der" style={{ whiteSpace: 'nowrap' }}>
                    <button className="boton" style={{ minHeight: 34, padding: '4px 10px' }} onClick={() => setPagoEditar(p)}>Editar</button>{' '}
                    <button className="boton peligro" style={{ minHeight: 34, padding: '4px 10px' }} onClick={() => void borrarPago(p)} aria-label="Eliminar pago">✕</button>
                  </td>
                </tr>
              ))}
              <tr className="total"><td>Total pagado</td><td className="der"><Dinero valor={f.pagado} /></td><td></td></tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="tarjeta">
        <h2>Resumen para</h2>
        <Chips<TipoResumen>
          opciones={[['CREDITO NUEVO', 'Crédito nuevo'], ['REESTRUCTURACION DE CREDITO', 'Reestructuración']]}
          valor={tipoMensaje}
          onCambio={setTipoMensaje}
        />
        <div className="dos" style={{ marginTop: 10 }}>
          <div className="campo">
            <label htmlFor="m-abonado">Abonado</label>
            <input id="m-abonado" type="text" inputMode="decimal" value={abonado} onChange={(e) => setAbonado(e.target.value)} autoComplete="off" />
          </div>
          {tipo === 'inversion' && (
            <div className="campo">
              <label htmlFor="m-duracion">Duración</label>
              <input id="m-duracion" type="text" value={duracion} onChange={(e) => setDuracion(e.target.value)} autoComplete="off" />
            </div>
          )}
        </div>
      </div>
      <Copiable titulo="Mensaje" texto={mensaje} />

      {editar && <FormOperacion tipo={tipo} operacion={op} onCerrar={() => setEditar(false)} />}
      {liquidar && <FormLiquidar operacion={op} onCerrar={() => setLiquidar(false)} />}
      {pagoNuevo && <FormPago tipo={tipo} operacionId={op.id} onCerrar={() => setPagoNuevo(false)} />}
      {pagoEditar && <FormPago tipo={tipo} pago={pagoEditar} onCerrar={() => setPagoEditar(null)} />}
      {estadoCuentaAbierto && <EstadoCuenta personaId={op.persona_id} onCerrar={() => setEstadoCuentaAbierto(false)} />}
      {confirmacion}
    </>
  )
}

function Kpi2({ titulo, valor }: { titulo: string; valor: ReactNode }) {
  return (
    <div className="kpi">
      <div className="titulo">{titulo}</div>
      <div className="valor">{valor}</div>
    </div>
  )
}

export function EstadoCuenta({ personaId, onCerrar }: { personaId: string; onCerrar: () => void }) {
  const { modelo } = useDatos()
  const t = totalesDeudor(modelo, personaId)
  return (
    <Modal titulo={'Estado de cuenta · ' + (modelo.personas.get(personaId)?.nombre.trim() ?? '')} onCerrar={onCerrar}>
      <div className="datos" style={{ marginBottom: 12 }}>
        <Dato etiqueta="Créditos activos">{t.creditos}</Dato>
        <Dato etiqueta="Capital a deber"><Dinero valor={t.capital} /></Dato>
        <Dato etiqueta="Interés a deber"><Dinero valor={t.interes} /></Dato>
        <Dato etiqueta="Total a deber"><Dinero valor={t.total} /></Dato>
        <Dato etiqueta="Interés mensual"><Dinero valor={t.interesMensual} /></Dato>
      </div>
      <Copiable titulo="Mensaje" texto={estadoCuenta(modelo, personaId)} />
    </Modal>
  )
}
