import { useEffect, useState } from 'react'
import { products } from '../config/products.js'
import { store } from '../config/store.js'
import { fetchClockOffset, formatPrice, formatRemaining, promoEndDateText, promoRunning, promoState, uniformPrice } from '../lib.js'

// La etapa y el contador salen de la fecha fija de la configuración (no de la
// visita), así que no se reinician al recargar ni al cambiar de dispositivo.
// La hora se corrige con la del servidor.
export function usePromo() {
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const pending = promoRunning(now + offset)

  useEffect(() => {
    if (!promoRunning(Date.now() - 60000)) return
    let cancelled = false
    fetchClockOffset().then((value) => !cancelled && setOffset(value))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!pending) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [pending])

  const current = now + offset
  const { stage, endsAt } = promoState(current)
  return { stage, remaining: stage === 'last' ? formatRemaining(endsAt - current) : null }
}

function Countdown({ remaining }) {
  return (
    <span className="countdown" data-testid="countdown" role="timer" aria-live="off">
      {remaining.split(':').map((part, i) => (
        <span key={i} className="countdown-part">
          {i > 0 && <span className="countdown-colon" aria-hidden="true">:</span>}
          <strong className="countdown-digits">{part}</strong>
        </span>
      ))}
    </span>
  )
}

// Sustituye {precio} por el precio común; null si no hay un precio único.
function withPrice(text) {
  if (!text.includes('{precio}')) return text
  const price = uniformPrice(products)
  if (price === null) return null
  return text.replaceAll('{precio}', formatPrice(price).replace(` ${store.currency}`, ''))
}

// Precio tachado común del catálogo (p. ej. "$700"), o null.
function uniformCompareAt() {
  const values = new Set(products.map((p) => (p.compareAtPrice > p.price ? p.compareAtPrice : null)))
  const [value] = values
  return values.size === 1 && value ? formatPrice(value).replace(` ${store.currency}`, '') : null
}

// Copias por mitad de la cinta: suficientes para cubrir pantallas anchas sin huecos.
const MARQUEE_REPEAT = 4

// Barra superior con texto en movimiento continuo.
export function Marquee() {
  const items = store.marquee.map(withPrice).filter(Boolean)
  if (!items.length) return null
  const sequence = Array.from({ length: MARQUEE_REPEAT }, () => items).flat()
  const half = (copy) => (
    <span className="marquee-group" aria-hidden={copy ? 'true' : undefined}>
      {sequence.map((text, i) => (
        <span className="marquee-item" key={i} aria-hidden={i >= items.length ? 'true' : undefined}>
          {text}
          <span className="marquee-sep" aria-hidden="true">✦</span>
        </span>
      ))}
    </span>
  )
  return (
    <div className="marquee" data-testid="marquee">
      <div className="marquee-track">
        {half(false)}
        {half(true)}
      </div>
      <p className="marquee-static">{items.join(' ✦ ')}</p>
    </div>
  )
}

const STAGE_LABEL = { last: 'lastDayLabel', dayBefore: 'dayBeforeLabel', earlier: 'earlierLabel' }

// Portada breve del catálogo.
export function PromoHero({ promo, onCta }) {
  const { title, support, cta } = store.hero
  const { timerLabel, offer } = store.promo
  const offerText = withPrice(offer)
  const before = uniformCompareAt()
  const { stage } = promo
  return (
    <section className={`promo-hero${stage ? ' is-urgent' : ''}`} aria-labelledby="hero-title">
      {stage ? (
        <h2 className="promo-headline" id="hero-title" data-testid="promo-label">
          {store.promo[STAGE_LABEL[stage]]}
        </h2>
      ) : (
        <h2 className="promo-title" id="hero-title">
          {title}
        </h2>
      )}

      {stage === 'last' && (
        <div className="promo-timer">
          <span className="promo-timer-label">{timerLabel}</span>
          <Countdown remaining={promo.remaining} />
        </div>
      )}
      {stage === 'dayBefore' && <p className="promo-ends">Termina mañana a medianoche</p>}
      {stage === 'earlier' && <p className="promo-ends">Termina el {promoEndDateText()} a medianoche</p>}

      {offerText && (
        <p className="promo-offer">
          {before && <del className="promo-before">{before}</del>}
          <span className="promo-offer-text">{offerText}</span>
        </p>
      )}
      {!stage && support && <p className="promo-support">{support}</p>}

      <div className="promo-actions">
        <button type="button" className="btn-hero" onClick={onCta}>
          {cta}
        </button>
      </div>
    </section>
  )
}
