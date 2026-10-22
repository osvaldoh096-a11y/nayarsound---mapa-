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

function Countdown({ remaining, compact }) {
  const { days, hours, minutes, seconds } = remaining
  const units = [
    ...(days > 0 ? [[days, 'd']] : []),
    [hours, 'h'],
    [minutes, 'm'],
    [seconds, 's'],
  ]
  return (
    <span className={`countdown${compact ? ' is-compact' : ''}`} data-testid="countdown" role="timer">
      {units.map(([value, unit]) => (
        <span className="countdown-unit" key={unit}>
          <strong>{unit === 'd' ? value : pad(value)}</strong>
          <small>{unit}</small>
        </span>
      ))}
    </span>
  )
}

function priceHeadline() {
  const price = uniformPrice(products)
  return price !== null ? `Todos los conjuntos a ${formatPrice(price).replace(` ${store.currency}`, '')}` : null
}

// Franja superior delgada, visible en todas las páginas.
export function PromoStrip({ promo }) {
  const headline = priceHeadline()
  return (
    <div className="promo-strip" data-testid="promo-strip">
      <span className="promo-strip-text">
        {headline && <strong>{headline}</strong>}
        {store.shippingNote && <span className="promo-strip-sep">{store.shippingNote}</span>}
      </span>
      {promo.active ? (
        <span className="promo-strip-timer">
          <span className="promo-strip-label" data-testid="promo-label">{promo.label}</span>
          <Countdown remaining={promo.remaining} compact />
        </span>
      ) : (
        <span className="promo-strip-label" data-testid="promo-fallback">{store.promo.fallbackLabel}</span>
      )}
    </div>
  )
}

// Bloque de presentación del catálogo.
export function PromoHero({ promo }) {
  const headline = priceHeadline()
  return (
    <section className="promo-hero" aria-label="Promoción">
      <p className="promo-kicker">{promo.active ? promo.label : store.promo.fallbackLabel}</p>
      {headline && <h2 className="promo-title">{headline}</h2>}
      <ul className="promo-points">
        {store.shippingNote && <li>{store.shippingNote}</li>}
        {store.paymentSummary && <li>{store.paymentSummary}</li>}
      </ul>
      {promo.active && (
        <div className="promo-timer">
          <span className="promo-timer-label">Termina en</span>
          <Countdown remaining={promo.remaining} />
        </div>
      )}
    </section>
  )
}
