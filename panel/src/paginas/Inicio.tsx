import { useMemo, useState } from 'react'
import { useDatos } from '../datos'
import { partes } from '../calc/fechas'
import { fechaCorta, porcentaje } from '../calc/formato'
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
  type Cashflow,
} from '../calc/dashboard'
import {
  estadoCuenta,
  listaCreditos,
  listaCreditosInversores,
  pagosInversoresMXN,
  pagosInversoresUSDT,
  recordatorio5Dias,
  resumenCobro,
  textoCashflow,
} from '../calc/mensajes'
import { esActivo } from '../calc/motor'
import { Chips, Copiable, Dinero, Kpi, ir } from '../ui'

type Pestana = 'resumen' | 'historial' | 'mensajes'

export function Inicio() {
  const [pestana, setPestana] = useState<Pestana>('resumen')
  return (
    <>
      <div className="cabecera">
        <h1>Inicio</h1>
      </div>
      <div style={{ marginBottom: 12 }}>
        <Chips<Pestana>
          opciones={[['resumen', 'Resumen'], ['historial', 'Historial'], ['mensajes', 'Mensajes']]}
          valor={pestana}
          onCambio={setPestana}
        />
      </div>
      {pestana === 'resumen' && <Resumen />}
      {pestana === 'historial' && <Historial />}
      {pestana === 'mensajes' && <Mensajes />}
    </>
  )
}

function TarjetaCashflow({ titulo, c }: { titulo: string; c: Cashflow }) {
  return (
    <div className="tarjeta">
      <h2>{titulo}</h2>
      <div className="kpis">
        <Kpi titulo="Ingresos"><Dinero valor={c.ingresos} /></Kpi>
        <Kpi titulo="Pagos"><Dinero valor={c.pagos} /></Kpi>
        <Kpi titulo="Balance"><Dinero valor={c.balance} /></Kpi>
      </div>
    </div>
  )
}

function Resumen() {
  const { modelo } = useDatos()
  const r = resumenFinanciero(modelo)
  const revision = liquidadosConInteres(modelo)
  const porPersona = prestamosActivosPorPersona(modelo)
  const inversores = inversoresActivos(modelo)
  const idPorNombre = new Map(modelo.prestamos.map((f) => [f.nombre, f.op.persona_id]))
  const tc = modelo.tc

  return (
    <>
      {revision.length > 0 && (
        <div className="aviso-caja">
          <b>Revisión:</b> {revision.length} préstamo(s) liquidado(s) con interés restante mayor a 1:{' '}
          {revision.map((f, i) => (
            <span key={f.op.id}>
              {i > 0 && ', '}
              <a href={'#/prestamos/' + f.op.id}>OP {f.op.op}</a>
            </span>
          ))}
        </div>
      )}

      <div className="tarjeta">
        <h2>Resumen financiero</h2>
        <div className="kpis">
          <Kpi titulo="Capital prestado" nota="Préstamos activos en MXN"><Dinero valor={r.capitalPrestado} /></Kpi>
          <Kpi titulo="Capital propio"><Dinero valor={r.capitalPropio} /></Kpi>
          <Kpi titulo="Capital de inversores" nota="MXN + equivalencia de USDT"><Dinero valor={r.capitalInversores} /></Kpi>
          <Kpi titulo="Interés generado por día"><Dinero valor={r.interesDia} /></Kpi>
          <Kpi titulo="Utilidad propia por día"><Dinero valor={r.utilidadPropiaDia} /></Kpi>
          <Kpi titulo="Utilidad inversor por día" nota={`USDT × ${tc}`}><Dinero valor={r.utilidadInversorDia} /></Kpi>
          <Kpi titulo="Interés promedio mensual">{porcentaje(r.interesPromedioMensual)}</Kpi>
          <Kpi titulo="Proyección mensual"><Dinero valor={r.proyeccionMensual} /></Kpi>
          <Kpi titulo="Pago mensual a inversores" nota={`USDT × ${tc}`}><Dinero valor={r.pagoMensualInversores} /></Kpi>
          <Kpi titulo="Pendiente interés a cobrar" nota={`USDT × ${tc}`}><Dinero valor={r.pendienteCobrar} /></Kpi>
          <Kpi titulo="Pendiente interés a inversores" nota={`USDT × ${tc}`}><Dinero valor={r.pendienteInversores} /></Kpi>
          <Kpi titulo="Restante propio"><Dinero valor={r.restantePropio} /></Kpi>
        </div>
      </div>

      <TarjetaCashflow titulo="Cashflow mes actual" c={cashflowMesActual(modelo)} />
      <TarjetaCashflow titulo="Cashflow mes siguiente" c={cashflowMesSiguiente(modelo)} />

      <div className="tarjeta">
        <h2>Préstamos activos</h2>
        {porPersona.length === 0 && <div className="suave">Sin préstamos activos.</div>}
        <div className="lista">
          {porPersona.map((p) => (
            <button key={p.nombre} className="item" onClick={() => ir('/prestamos?persona=' + idPorNombre.get(p.nombre))}>
              <div className="fila1">
                <span className="titulo">{p.nombre}</span>
                <Dinero valor={p.capital + p.interesRestante} />
              </div>
              <div className="detalles">
                <span>Capital <b><Dinero valor={p.capital} /></b></span>
                <span>Interés restante <b><Dinero valor={p.interesRestante} /></b></span>
                <span>Pago mensual <b><Dinero valor={p.pagoMensual} /></b></span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="tarjeta">
        <h2>Inversores activos</h2>
        {inversores.length === 0 && <div className="suave">Sin inversores activos.</div>}
        <div className="lista">
          {inversores.map((i) => (
            <button key={i.fila.op.id} className="item" onClick={() => ir('/inversores/' + i.fila.op.id)}>
              <div className="fila1">
                <span className="titulo">{i.nombre}</span>
                <span className="suave pequeno">Compromiso {fechaCorta(i.compromiso)}</span>
              </div>
              <div className="detalles">
                <span>Capital <b><Dinero valor={i.capital} divisa="MXN" /></b></span>
                <span>Pago mensual <b><Dinero valor={i.pagoMensual} divisa="MXN" /></b></span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function Historial() {
  const { modelo } = useDatos()
  const meses = useMemo(() => mesesOperando(modelo), [modelo])
  const anios = gananciasPorAnio(meses)
  const [anio, setAnio] = useState(() => partes(modelo.hoy).anio)
  const anual = resumenAnual(meses, anio)
  const pagados = interesPagadoPorPersona(modelo)

  return (
    <>
      <div className="tarjeta">
        <h2>Ganancias históricas</h2>
        <div className="desplazable">
          <table className="tabla">
            <thead>
              <tr><th>Año</th><th className="der">Generado</th><th className="der">Pagado</th><th className="der">Ganancia</th></tr>
            </thead>
            <tbody>
              {anios.filas.map((f) => (
                <tr key={f.anio}>
                  <td>{f.anio}</td>
                  <td className="der"><Dinero valor={f.generado} /></td>
                  <td className="der"><Dinero valor={f.pagado} /></td>
                  <td className="der"><Dinero valor={f.ganancia} /></td>
                </tr>
              ))}
              <tr className="total">
                <td>{anios.totalAnios} años</td>
                <td className="der"><Dinero valor={anios.generado} /></td>
                <td className="der"><Dinero valor={anios.pagado} /></td>
                <td className="der"><Dinero valor={anios.ganancia} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="tarjeta">
        <div className="fila1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Resumen general</h2>
          <select className="compacto" value={anio} onChange={(e) => setAnio(Number(e.target.value))} aria-label="Año">
            {anios.filas.map((f) => <option key={f.anio} value={f.anio}>{f.anio}</option>)}
          </select>
        </div>
        <div className="desplazable">
          <table className="tabla">
            <thead>
              <tr><th>Mes</th><th className="der">Intereses cobrados</th><th className="der">Pagado</th><th className="der">Ganancia</th></tr>
            </thead>
            <tbody>
              {anual.filas.map((x) => (
                <tr key={x.inicio}>
                  <td>{x.etiqueta}</td>
                  <td className="der"><Dinero valor={x.entradas} /></td>
                  <td className="der"><Dinero valor={x.salidas} /></td>
                  <td className="der"><Dinero valor={x.flujo} /></td>
                </tr>
              ))}
              <tr className="total">
                <td>Total meses {anual.totalMeses}</td>
                <td className="der"><Dinero valor={anual.cobrados} /></td>
                <td className="der"><Dinero valor={anual.pagado} /></td>
                <td className="der"><Dinero valor={anual.ganancia} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="tarjeta">
        <h2>Flujo histórico</h2>
        <div className="desplazable">
          <table className="tabla">
            <thead>
              <tr><th>Mes</th><th className="der">Ganancia</th><th className="der">Acumulado</th></tr>
            </thead>
            <tbody>
              {meses.map((x) => (
                <tr key={x.inicio}>
                  <td>{x.etiqueta}</td>
                  <td className="der"><Dinero valor={x.flujo} /></td>
                  <td className="der"><Dinero valor={x.acumulado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tarjeta">
        <h2>Interés total pagado por deudor</h2>
        <div className="desplazable">
          <table className="tabla">
            <thead><tr><th>Nombre</th><th className="der">Interés total</th></tr></thead>
            <tbody>
              {pagados.map((p) => (
                <tr key={p.nombre}><td>{p.nombre}</td><td className="der"><Dinero valor={p.interes} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function Mensajes() {
  const { modelo } = useDatos()
  const deudores = useMemo(() => {
    const ids = new Map<string, string>()
    for (const f of modelo.prestamos) if (esActivo(f)) ids.set(f.op.persona_id, f.nombre.trim())
    return [...ids.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [modelo])
  const [deudor, setDeudor] = useState('')
  const creditos = listaCreditos(modelo)

  return (
    <>
      <Copiable titulo="Recordatorio 5 días" texto={recordatorio5Dias(modelo)} />
      <Copiable titulo="Resumen de cobro" texto={resumenCobro(modelo)} />
      <div className="tarjeta">
        <h2>Estado de cuenta</h2>
        <select value={deudor} onChange={(e) => setDeudor(e.target.value)} aria-label="Deudor">
          <option value="">Elige un deudor activo…</option>
          {deudores.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
      </div>
      {deudor && <Copiable titulo="Mensaje de estado de cuenta" texto={estadoCuenta(modelo, deudor)} />}
      <Copiable titulo="Pago a inversores MXN" texto={pagosInversoresMXN(modelo)} />
      <Copiable titulo="Pago a inversores USDT" texto={pagosInversoresUSDT(modelo)} />
      <Copiable titulo="Préstamos: créditos 1-6" texto={creditos.primeros} />
      {creditos.siguientes && <Copiable titulo="Préstamos: créditos 7-20" texto={creditos.siguientes} />}
      <Copiable titulo="Inversores: créditos 1-7" texto={listaCreditosInversores(modelo)} />
      <Copiable titulo="Cashflow mes actual" texto={textoCashflow(cashflowMesActual(modelo))} />
      <Copiable titulo="Cashflow mes siguiente" texto={textoCashflow(cashflowMesSiguiente(modelo))} />
    </>
  )
}
