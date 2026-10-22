import { useEffect, useState } from 'react'
import { products } from '../config/products.js'
import { store } from '../config/store.js'
import { formatPrice, promoEndsAt, promoLabel, splitRemaining, uniformPrice } from '../lib.js'

// La cuenta regresiva depende solo de la fecha configurada (no de la visita),
// así que no se reinicia al recargar ni al cambiar de dispositivo.
export function usePromo() {
  const [now, setNow] = useState(() => Date.now())
  const active = promoEndsAt !== null && now < promoEndsAt

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])

  return active
    ? { active, remaining: splitRemaining(promoEndsAt - now), label: promoLabel(now) }
    : { active: false }
}

const pad = (n) => String(n).padStart(2, '0')

function Countdown({ remaining }) {
  const { days, hours, minutes, seconds } = remaining
  const units = [...(days > 0 ? [[days, 'd']] : []), [hours, 'h'], [minutes, 'm'], [seconds, 's']]
  return (
    <span className="countdown" data-testid="countdown" role="timer">
      {units.map(([value, unit]) => (
        <span className="countdown-unit" key={unit}>
          <strong>{unit === 'd' ? value : pad(value)}</strong>
          <small>{unit}</small>
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

// Portada breve del catálogo.
export function PromoHero({ promo, onCta }) {
  const { title, subtitle, support, cta } = store.hero
  const sub = withPrice(subtitle)
  return (
    <section className="promo-hero" aria-labelledby="hero-title">
      {promo.active ? (
        <p className="promo-kicker" data-testid="promo-label">{promo.label}</p>
      ) : (
        <p className="promo-kicker" data-testid="promo-fallback">{store.promo.fallbackLabel}</p>
      )}
      <h2 className="promo-title" id="hero-title">{title}</h2>
      {sub && <p className="promo-subtitle">{sub}</p>}
      {support && <p className="promo-support">{support}</p>}
      {promo.active && (
        <div className="promo-timer">
          <span className="promo-timer-label">Termina en</span>
          <Countdown remaining={promo.remaining} />
        </div>
      )}
      <div className="promo-actions">
        <button type="button" className="btn-hero" onClick={onCta}>
          {cta}
        </button>
        {store.paymentSummary && <span className="promo-pay">{store.paymentSummary}</span>}
      </div>
    </section>
  )
}
