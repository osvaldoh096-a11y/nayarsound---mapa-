import { useState, type ChangeEvent } from 'react'
import { useDatos } from '../datos'
import { supabase } from '../supabase'
import { serieDeISO } from '../calc/fechas'
import { fechaCorta } from '../calc/formato'
import { armarRespaldo, cifrar, descargar, descifrar, exportarCSV, fechaArchivo, type Respaldo } from '../respaldo'
import { Dinero, useConfirmar } from '../ui'

export function Mas({ onSalir }: { onSalir: () => void }) {
  return (
    <>
      <div className="cabecera"><h1>Más</h1></div>
      <div className="tarjeta menu">
        <a href="#/personas"><span>Personas</span><span className="suave">›</span></a>
        <a href="#/papelera"><span>Papelera</span><span className="suave">›</span></a>
        <a href="#/respaldo"><span>Respaldo y exportación</span><span className="suave">›</span></a>
        <a href="#/ajustes"><span>Ajustes</span><span className="suave">›</span></a>
      </div>
      <button className="boton bloque" onClick={onSalir}>Cerrar sesión</button>
    </>
  )
}

export function Papelera() {
  const { datos, restaurar, borrarDefinitivo, avisar } = useDatos()
  const [confirmacion, confirmar] = useConfirmar()
  const nombre = new Map(datos.personas.map((p) => [p.id, p.nombre]))
  const opPorId = new Map(datos.operaciones.map((o) => [o.id, o]))
  const personas = datos.personas.filter((p) => p.eliminado)
  const operaciones = datos.operaciones.filter((o) => o.eliminado)
  const pagos = datos.pagos.filter((p) => p.eliminado)

  const definitivo = async (tabla: 'personas' | 'operaciones' | 'pagos', id: string, descripcion: string) => {
    const ok = await confirmar({
      titulo: 'Eliminar definitivamente',
      texto: `${descripcion} se borrará para siempre${tabla === 'operaciones' ? ', junto con todos sus pagos' : ''}. Esta acción no se puede deshacer.`,
      boton: 'Eliminar para siempre',
      peligro: true,
      palabra: 'ELIMINAR',
    })
    if (!ok) return
    try {
      await borrarDefinitivo(tabla, id)
      avisar('Eliminado definitivamente')
    } catch (e) {
      avisar((e as Error).message)
    }
  }
  const recuperar = async (tabla: 'personas' | 'operaciones' | 'pagos', id: string) => {
    await restaurar(tabla, id)
    avisar('Recuperado')
  }
  const Botones = ({ tabla, id, descripcion }: { tabla: 'personas' | 'operaciones' | 'pagos'; id: string; descripcion: string }) => (
    <div className="acciones" style={{ marginTop: 8 }}>
      <button className="boton primario" onClick={() => void recuperar(tabla, id)}>Recuperar</button>
      <button className="boton peligro" onClick={() => void definitivo(tabla, id, descripcion)}>Eliminar para siempre</button>
    </div>
  )

  return (
    <>
      <div className="cabecera"><h1>Papelera</h1></div>
      {personas.length + operaciones.length + pagos.length === 0 && <div className="vacio">La papelera está vacía.</div>}
      {operaciones.length > 0 && <h3 className="suave">Operaciones</h3>}
      <div className="lista">
        {operaciones.map((o) => (
          <div key={o.id} className="item">
            <div className="fila1">
              <span className="titulo">{o.tipo === 'prestamo' ? 'Préstamo' : 'Inversión'} OP {o.op} · {nombre.get(o.persona_id)}</span>
              <Dinero valor={o.cantidad} divisa={o.divisa} />
            </div>
            <Botones tabla="operaciones" id={o.id} descripcion={`La OP ${o.op}`} />
          </div>
        ))}
      </div>
      {pagos.length > 0 && <h3 className="suave">Pagos</h3>}
      <div className="lista">
        {pagos.map((p) => {
          const o = p.operacion_id ? opPorId.get(p.operacion_id) : undefined
          return (
            <div key={p.id} className="item">
              <div className="fila1">
                <span className="titulo">{o ? `OP ${o.op} · ${nombre.get(o.persona_id)}` : 'Sin OP'} · {fechaCorta(serieDeISO(p.fecha))}</span>
                <Dinero valor={p.cantidad} divisa={o?.divisa} />
              </div>
              <Botones tabla="pagos" id={p.id} descripcion="El pago" />
            </div>
          )
        })}
      </div>
      {personas.length > 0 && <h3 className="suave">Personas</h3>}
      <div className="lista">
        {personas.map((p) => (
          <div key={p.id} className="item">
            <div className="titulo">{p.nombre}</div>
            <Botones tabla="personas" id={p.id} descripcion={p.nombre} />
          </div>
        ))}
      </div>
      {confirmacion}
    </>
  )
}

export function RespaldoPagina() {
  const { datos, modelo, recargar, avisar } = useDatos()
  const [confirmacion, confirmar] = useConfirmar()
  const [clave1, setClave1] = useState('')
  const [clave2, setClave2] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [archivo, setArchivo] = useState<string | null>(null)
  const [claveArchivo, setClaveArchivo] = useState('')
  const [leido, setLeido] = useState<Respaldo | null>(null)
  const [error, setError] = useState('')

  const exportarCifrado = async () => {
    setError('')
    if (clave1.length < 8) return setError('Usa una contraseña de al menos 8 caracteres para el respaldo.')
    if (clave1 !== clave2) return setError('Las contraseñas no coinciden.')
    setOcupado(true)
    try {
      descargar(`respaldo-${fechaArchivo()}.panel`, await cifrar(armarRespaldo(datos), clave1), 'application/octet-stream')
      avisar('Respaldo descargado')
      setClave1('')
      setClave2('')
    } finally {
      setOcupado(false)
    }
  }

  const elegirArchivo = async (e: ChangeEvent<HTMLInputElement>) => {
    setLeido(null)
    setError('')
    const f = e.target.files?.[0]
    setArchivo(f ? await f.text() : null)
  }

  const leer = async () => {
    if (!archivo) return
    setError('')
    setOcupado(true)
    try {
      setLeido(await descifrar(archivo, claveArchivo))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const restaurarRespaldo = async () => {
    if (!leido) return
    const ok = await confirmar({
      titulo: 'Restaurar respaldo',
      texto: (
        <>
          Se reemplazarán <b>todos</b> los registros actuales por los del respaldo del {new Date(leido.creado).toLocaleString('es-MX')}.
          Antes se descargará automáticamente un respaldo de lo que hay ahora, cifrado con la misma contraseña.
        </>
      ),
      boton: 'Restaurar',
      peligro: true,
      palabra: 'RESTAURAR',
    })
    if (!ok) return
    setOcupado(true)
    setError('')
    try {
      descargar(`respaldo-antes-de-restaurar-${fechaArchivo()}.panel`, await cifrar(armarRespaldo(datos), claveArchivo), 'application/octet-stream')
      const { data, error: err } = await supabase.rpc('restaurar_respaldo', { datos: leido })
      if (err) throw new Error(err.message)
      await recargar()
      const r = data as { personas: number; operaciones: number; pagos: number }
      avisar(`Restaurado: ${r.operaciones} operaciones y ${r.pagos} pagos`)
      setLeido(null)
      setArchivo(null)
      setClaveArchivo('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <div className="cabecera"><h1>Respaldo</h1></div>
      {error && <div className="error-caja">{error}</div>}

      <div className="tarjeta">
        <h2>Descargar respaldo cifrado</h2>
        <p className="suave pequeno" style={{ marginTop: 0 }}>
          Incluye todo (también la papelera). El archivo solo se puede abrir con la contraseña que elijas aquí; guárdala en un lugar seguro.
        </p>
        <div className="campo">
          <label htmlFor="r-c1">Contraseña del respaldo</label>
          <input id="r-c1" type="password" autoComplete="new-password" value={clave1} onChange={(e) => setClave1(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="r-c2">Repite la contraseña</label>
          <input id="r-c2" type="password" autoComplete="new-password" value={clave2} onChange={(e) => setClave2(e.target.value)} />
        </div>
        <button className="boton primario bloque" disabled={ocupado} onClick={() => void exportarCifrado()}>Descargar respaldo</button>
      </div>

      <div className="tarjeta">
        <h2>Exportar a hojas de cálculo</h2>
        <p className="suave pequeno" style={{ marginTop: 0 }}>Archivo .zip con CSV (préstamos, inversores, pagos y personas) con las columnas calculadas al día de hoy. Este archivo no va cifrado.</p>
        <button className="boton bloque" onClick={() => descargar(`exportacion-${fechaArchivo()}.zip`, exportarCSV(modelo, datos) as BlobPart, 'application/zip')}>
          Exportar CSV
        </button>
      </div>

      <div className="tarjeta">
        <h2>Restaurar un respaldo</h2>
        <div className="campo">
          <label htmlFor="r-archivo">Archivo .panel</label>
          <input id="r-archivo" type="file" accept=".panel,application/octet-stream,application/json" onChange={(e) => void elegirArchivo(e)} />
        </div>
        <div className="campo">
          <label htmlFor="r-clave">Contraseña del respaldo</label>
          <input id="r-clave" type="password" autoComplete="off" value={claveArchivo} onChange={(e) => setClaveArchivo(e.target.value)} />
        </div>
        <button className="boton bloque" disabled={!archivo || ocupado} onClick={() => void leer()}>Abrir respaldo</button>
        {leido && (
          <div style={{ marginTop: 12 }}>
            <div className="aviso-caja">
              Respaldo del {new Date(leido.creado).toLocaleString('es-MX')}: {leido.personas.length} personas, {leido.operaciones.length} operaciones y {leido.pagos.length} pagos.
            </div>
            <button className="boton peligro lleno bloque" disabled={ocupado} onClick={() => void restaurarRespaldo()}>Restaurar este respaldo</button>
          </div>
        )}
      </div>
      {confirmacion}
    </>
  )
}

export function AjustesPagina() {
  const { datos, guardarAjustes, avisar } = useDatos()
  const [tc, setTc] = useState(String(datos.ajustes.tipo_cambio))
  const [zona, setZona] = useState(datos.ajustes.zona_horaria)
  const [error, setError] = useState('')
  const guardar = async () => {
    const n = Number(tc)
    if (!Number.isFinite(n) || n <= 0) return setError('El tipo de cambio debe ser un número mayor a 0.')
    try {
      await guardarAjustes({ tipo_cambio: n, zona_horaria: zona })
      avisar('Ajustes guardados')
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const zonas = [
    ['America/Los_Angeles', 'Los Ángeles (la del Sheets)'],
    ['America/Mazatlan', 'Mazatlán / Nayarit'],
    ['America/Bahia_Banderas', 'Bahía de Banderas'],
    ['America/Mexico_City', 'Ciudad de México'],
  ]
  return (
    <>
      <div className="cabecera"><h1>Ajustes</h1></div>
      <div className="tarjeta">
        <div className="campo">
          <label htmlFor="a-tc">Tipo de cambio USDT → MXN</label>
          <input id="a-tc" type="text" inputMode="decimal" value={tc} onChange={(e) => setTc(e.target.value)} />
          <span className="ayuda">Se usa donde el Sheets multiplicaba por 18.</span>
        </div>
        <div className="campo">
          <label htmlFor="a-zona">Zona horaria para «hoy»</label>
          <select id="a-zona" value={zona} onChange={(e) => setZona(e.target.value)}>
            {zonas.map(([v, e]) => <option key={v} value={v}>{e}</option>)}
          </select>
        </div>
        {error && <div className="error-caja">{error}</div>}
        <button className="boton primario bloque" onClick={() => void guardar()}>Guardar</button>
      </div>
    </>
  )
}
