import { useMemo, useState } from 'react'
import { useDatos } from '../datos'
import { primerDiaMes, serieDeISO } from '../calc/fechas'
import { etiquetaMes, fechaCorta } from '../calc/formato'
import { suma } from '../calc/motor'
import type { Pago, TipoOperacion } from '../calc/tipos'
import { Chips, Dinero, useConfirmar } from '../ui'
import { FormPago } from './Formularios'

export function Pagos() {
  const { modelo, eliminar, avisar } = useDatos()
  const [confirmacion, confirmar] = useConfirmar()
  const [tipo, setTipo] = useState<TipoOperacion>('prestamo')
  const [buscar, setBuscar] = useState('')
  const [mes, setMes] = useState('')
  const [nuevo, setNuevo] = useState(false)
  const [editar, setEditar] = useState<Pago | null>(null)

  const pagos = tipo === 'prestamo' ? modelo.pagosPrestamo : modelo.pagosInversion
  const conDatos = useMemo(
    () =>
      pagos.map((p) => {
        const fila = p.operacion_id ? modelo.porId.get(p.operacion_id) : undefined
        const fecha = serieDeISO(p.fecha)
        return { p, fila, fecha, mes: etiquetaMes(primerDiaMes(fecha)) }
      }),
    [pagos, modelo],
  )
  const meses = useMemo(() => [...new Map(conDatos.map((x) => [x.mes, primerDiaMes(x.fecha)])).entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e), [conDatos])
  const texto = buscar.trim().toUpperCase().replace(/^OP\s*/, '')
  const filas = conDatos
    .filter((x) => !mes || x.mes === mes)
    .filter((x) => !texto || (x.fila && (x.fila.nombre.toUpperCase().includes(texto) || String(x.fila.op.op) === texto)))
    .sort((a, b) => b.p.orden - a.p.orden)

  const borrar = async (p: Pago) => {
    const ok = await confirmar({
      titulo: 'Eliminar pago',
      texto: 'El pago dejará de contar en los cálculos. Podrás recuperarlo desde la papelera.',
      boton: 'Eliminar',
      peligro: true,
    })
    if (!ok) return
    await eliminar('pagos', p.id)
    avisar('Pago enviado a la papelera')
  }

  return (
    <>
      <div className="cabecera">
        <h1>Pagos</h1>
        <span className="sub">{filas.length} registros</span>
      </div>
      <div className="filtros">
        <Chips<TipoOperacion> opciones={[['prestamo', 'De préstamos'], ['inversion', 'A inversores']]} valor={tipo} onCambio={(t) => { setTipo(t); setMes('') }} />
        <input type="search" placeholder="Buscar por nombre u OP" value={buscar} onChange={(e) => setBuscar(e.target.value)} autoComplete="off" />
        <select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes">
          <option value="">Todos los meses</option>
          {meses.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="totales">
        {(['MXN', 'USDT'] as const).map((d) => {
          const de = filas.filter((x) => x.fila?.op.divisa === d)
          return de.length ? <span key={d}>Total {d}: <b><Dinero valor={suma(de, (x) => x.p.cantidad)} /></b></span> : null
        })}
      </div>
      <div className="lista">
        {filas.map(({ p, fila, fecha }) => (
          <div key={p.id} className="item" role="group">
            <div className="fila1">
              <span className="titulo">{fila ? `OP ${fila.op.op} · ${fila.nombre}` : 'Sin OP (histórico)'}</span>
              <Dinero valor={p.cantidad} divisa={fila?.op.divisa} />
            </div>
            <div className="detalles" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{fechaCorta(fecha)}</span>
              <span>
                {fila && <a href={`#/${tipo === 'prestamo' ? 'prestamos' : 'inversores'}/${fila.op.id}`}>Ver OP</a>}
                {'  '}
                <button className="boton" style={{ minHeight: 34, padding: '4px 10px', marginLeft: 8 }} onClick={() => setEditar(p)}>Editar</button>
                <button className="boton peligro" style={{ minHeight: 34, padding: '4px 10px', marginLeft: 6 }} onClick={() => void borrar(p)} aria-label="Eliminar pago">✕</button>
              </span>
            </div>
          </div>
        ))}
        {filas.length === 0 && <div className="vacio">No hay pagos con estos filtros.</div>}
      </div>
      <button className="boton primario flotante" onClick={() => setNuevo(true)}>+ Pago</button>
      {nuevo && <FormPago tipo={tipo} onCerrar={() => setNuevo(false)} />}
      {editar && <FormPago tipo={tipo} pago={editar} onCerrar={() => setEditar(null)} />}
      {confirmacion}
    </>
  )
}
