import { useEffect, useState, type ReactNode } from 'react'
import { dinero } from './calc/formato'

// Navegación por hash (#/prestamos/<id>?persona=<id>).
export function useRuta(): { partes: string[]; params: URLSearchParams } {
  const leer = () => window.location.hash.replace(/^#\/?/, '')
  const [hash, setHash] = useState(leer)
  useEffect(() => {
    const cambio = () => {
      setHash(leer())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', cambio)
    return () => window.removeEventListener('hashchange', cambio)
  }, [])
  const [ruta, consulta = ''] = hash.split('?')
  return { partes: ruta.split('/').filter(Boolean), params: new URLSearchParams(consulta) }
}

export const ir = (ruta: string) => {
  window.location.hash = ruta
}

export function Dinero({ valor, divisa }: { valor: number | null | undefined; divisa?: string }) {
  return (
    <span className={'num' + (valor !== null && valor !== undefined && valor < -0.004 ? ' neg' : '')}>
      {dinero(valor)}
      {divisa && <span className="divisa">{divisa}</span>}
    </span>
  )
}

export function Kpi({ titulo, children, nota }: { titulo: string; children: ReactNode; nota?: string }) {
  return (
    <div className="kpi">
      <div className="titulo">{titulo}</div>
      <div className="valor">{children}</div>
      {nota && <div className="nota">{nota}</div>}
    </div>
  )
}

export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="dato">
      <div className="etiqueta">{etiqueta}</div>
      <div className="valor">{children}</div>
    </div>
  )
}

export function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', tecla)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = ''
    }
  }, [onCerrar])
  return (
    <div className="velo" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="encabezado">
          <h2>{titulo}</h2>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export interface PeticionConfirmacion {
  titulo: string
  texto: ReactNode
  boton: string
  peligro?: boolean
  palabra?: string // si se indica, hay que escribirla para confirmar
}

export function Confirmar({ peticion, onRespuesta }: { peticion: PeticionConfirmacion; onRespuesta: (ok: boolean) => void }) {
  const [escrito, setEscrito] = useState('')
  const listo = !peticion.palabra || escrito.trim().toUpperCase() === peticion.palabra
  return (
    <Modal titulo={peticion.titulo} onCerrar={() => onRespuesta(false)}>
      <div style={{ marginBottom: 14 }}>{peticion.texto}</div>
      {peticion.palabra && (
        <div className="campo">
          <label htmlFor="confirmar-palabra">Escribe {peticion.palabra} para confirmar</label>
          <input id="confirmar-palabra" type="text" autoComplete="off" value={escrito} onChange={(e) => setEscrito(e.target.value)} />
        </div>
      )}
      <div className="acciones">
        <button className="boton" onClick={() => onRespuesta(false)}>Cancelar</button>
        <button
          className={'boton ' + (peticion.peligro ? 'peligro lleno' : 'primario')}
          disabled={!listo}
          onClick={() => onRespuesta(true)}
        >
          {peticion.boton}
        </button>
      </div>
    </Modal>
  )
}

// Hook para pedir confirmación antes de una acción destructiva.
export function useConfirmar(): [ReactNode, (p: PeticionConfirmacion) => Promise<boolean>] {
  const [estado, setEstado] = useState<{ p: PeticionConfirmacion; resolver: (ok: boolean) => void } | null>(null)
  const pedir = (p: PeticionConfirmacion) => new Promise<boolean>((resolver) => setEstado({ p, resolver }))
  const nodo = estado ? (
    <Confirmar
      peticion={estado.p}
      onRespuesta={(ok) => {
        estado.resolver(ok)
        setEstado(null)
      }}
    />
  ) : null
  return [nodo, pedir]
}

export function Chips<T extends string>({ opciones, valor, onCambio }: { opciones: [T, string][]; valor: T; onCambio: (v: T) => void }) {
  return (
    <div className="chips" role="group">
      {opciones.map(([v, etiqueta]) => (
        <button key={v} type="button" className={'chip' + (v === valor ? ' activo' : '')} aria-pressed={v === valor} onClick={() => onCambio(v)}>
          {etiqueta}
        </button>
      ))}
    </div>
  )
}

export function Copiable({ titulo, texto }: { titulo: string; texto: string }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1600)
    } catch {
      setCopiado(false)
    }
  }
  return (
    <div className="tarjeta">
      <h2>{titulo}</h2>
      {texto ? (
        <>
          <pre className="mensaje">{texto}</pre>
          <button className="boton primario bloque" onClick={() => void copiar()}>{copiado ? 'Copiado ✓' : 'Copiar'}</button>
        </>
      ) : (
        <div className="suave pequeno">Sin contenido por ahora.</div>
      )}
    </div>
  )
}

export function Insignia({ estado }: { estado: string }) {
  return <span className={'insignia ' + (estado === 'ACTIVO' ? 'activo' : 'liquidado')}>{estado}</span>
}
