import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { CUENTA_ACCESO, supabase } from './supabase'
import { ProveedorDatos } from './datos'
import { useRuta } from './ui'
import { Inicio } from './paginas/Inicio'
import { Ficha, Operaciones } from './paginas/Operaciones'
import { Pagos } from './paginas/Pagos'
import { Personas } from './paginas/Personas'
import { AjustesPagina, Mas, Papelera, RespaldoPagina } from './paginas/Mas'

export function App() {
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const salir = async () => {
    await supabase.auth.signOut()
    // Recargar descarta de la memoria todos los datos mostrados.
    window.location.replace(window.location.pathname)
  }

  if (sesion === undefined) return null
  if (!sesion) return <Acceso />
  return (
    <ProveedorDatos>
      <Contenido onSalir={() => void salir()} />
    </ProveedorDatos>
  )
}

function Acceso() {
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [entrando, setEntrando] = useState(false)
  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setEntrando(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: CUENTA_ACCESO, password: clave })
    setEntrando(false)
    if (err) setError(err.status === 400 ? 'Contraseña incorrecta.' : 'No se pudo entrar. Intenta de nuevo.')
    setClave('')
  }
  return (
    <div className="acceso">
      <form onSubmit={(e) => void entrar(e)}>
        <h1>Acceso</h1>
        <div className="campo">
          <label htmlFor="clave">Contraseña</label>
          <input id="clave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} autoFocus />
        </div>
        {error && <div className="error-caja">{error}</div>}
        <button className="boton primario bloque" type="submit" disabled={entrando || clave === ''}>{entrando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  )
}

const SECCIONES = [
  { ruta: 'inicio', etiqueta: 'Inicio', ico: '◧' },
  { ruta: 'prestamos', etiqueta: 'Préstamos', ico: '↗' },
  { ruta: 'inversores', etiqueta: 'Inversores', ico: '↙' },
  { ruta: 'pagos', etiqueta: 'Pagos', ico: '✓' },
  { ruta: 'mas', etiqueta: 'Más', ico: '☰' },
]
const DE_MAS = ['mas', 'personas', 'papelera', 'respaldo', 'ajustes']

function Contenido({ onSalir }: { onSalir: () => void }) {
  const { partes } = useRuta()
  const [seccion = 'inicio', id] = partes

  let pagina
  switch (seccion) {
    case 'prestamos':
      pagina = id ? <Ficha key={id} tipo="prestamo" id={id} /> : <Operaciones key="p" tipo="prestamo" />
      break
    case 'inversores':
      pagina = id ? <Ficha key={id} tipo="inversion" id={id} /> : <Operaciones key="i" tipo="inversion" />
      break
    case 'pagos':
      pagina = <Pagos />
      break
    case 'personas':
      pagina = <Personas />
      break
    case 'papelera':
      pagina = <Papelera />
      break
    case 'respaldo':
      pagina = <RespaldoPagina />
      break
    case 'ajustes':
      pagina = <AjustesPagina />
      break
    case 'mas':
      pagina = <Mas onSalir={onSalir} />
      break
    default:
      pagina = <Inicio />
  }
  const activa = DE_MAS.includes(seccion) ? 'mas' : seccion

  return (
    <>
      <main className="app">{pagina}</main>
      <nav className="nav" aria-label="Secciones">
        {SECCIONES.map((s) => (
          <a key={s.ruta} href={'#/' + s.ruta} className={activa === s.ruta ? 'activo' : ''} aria-current={activa === s.ruta ? 'page' : undefined}>
            <span className="ico" aria-hidden="true">{s.ico}</span>
            {s.etiqueta}
          </a>
        ))}
      </nav>
    </>
  )
}
