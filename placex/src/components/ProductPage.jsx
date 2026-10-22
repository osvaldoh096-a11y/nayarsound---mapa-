import { useRef, useState } from 'react'
import { store } from '../config/store.js'
import { buildOrderMessage, formatPrice, pricingText, savingsOf, whatsappLink } from '../lib.js'
import Gallery from './Gallery.jsx'

export default function ProductPage({ product }) {
  const availableSizes = product.sizes.filter((s) => s.available)
  // Con una sola talla disponible se preselecciona.
  const [size, setSize] = useState(availableSizes.length === 1 ? availableSizes[0].label : '')
  const [quantity, setQuantity] = useState(1)
  const [sizeError, setSizeError] = useState(false)
  const sizesRef = useRef(null)

  const total = product.price * quantity
  const soldOut = availableSizes.length === 0

  const changeQuantity = (delta) =>
    setQuantity((q) => Math.min(store.maxQuantity, Math.max(1, q + delta)))

  const selectSize = (label) => {
    setSize(label)
    setSizeError(false)
  }

  const order = () => {
    if (!size) {
      setSizeError(true)
      sizesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      sizesRef.current?.querySelector('button:not(:disabled)')?.focus({ preventScroll: true })
      return
    }
    const url = whatsappLink(buildOrderMessage(product, size, quantity))
    // Navegación directa: funciona mejor que window.open en los navegadores
    // internos de Facebook e Instagram, de donde llegan las visitas de anuncios.
    window.location.href = url
  }

  return (
    <article className="product-page">
      <nav className="back-nav">
        <a href="#/" className="back-link">
          <span aria-hidden="true">←</span> Catálogo
        </a>
      </nav>

      <div className="product-layout">
        <div className="product-media">
          <Gallery images={product.images} name={product.name} />
          {product.provisional && <span className="badge badge-media">Producto provisional</span>}
        </div>

        <div className="product-info">
          <p className="product-code">{product.code}</p>
          <h1 className="product-title">{product.name}</h1>
          <p className="product-price">
            {savingsOf(product) > 0 && (
              <del className="price-before" data-testid="unit-before">
                {formatPrice(product.compareAtPrice)}
              </del>
            )}
            <span data-testid="unit-price">{formatPrice(product.price)}</span>
            {savingsOf(product) > 0 && (
              <span className="badge-discount is-inline">{pricingText(store.pricing.badge, product)}</span>
            )}
            {store.shippingNote && <span className="price-note">{store.shippingNote}</span>}
          </p>
          {savingsOf(product) > 0 && (
            <p className="price-urgency" data-testid="savings">
              {pricingText(store.pricing.savings, product)}
            </p>
          )}

          <p className="product-description">{product.description}</p>
          {product.color && (
            <p className="product-color">
              <span className="field-label">Color</span> {product.color}
            </p>
          )}
          {product.material && (
            <p className="product-color">
              <span className="field-label">Material</span> {product.material}
            </p>
          )}

          <fieldset
            className={`field sizes${sizeError ? ' has-error' : ''}`}
            ref={sizesRef}
            aria-describedby={sizeError ? 'size-error' : undefined}
          >
            <legend className="field-label">
              Talla {size && <span className="field-value">· {size}</span>}
            </legend>
            <div className="size-options" role="radiogroup" aria-label="Talla">
              {product.sizes.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  role="radio"
                  aria-checked={size === s.label}
                  className={`size-option${size === s.label ? ' is-selected' : ''}`}
                  disabled={!s.available}
                  onClick={() => selectSize(s.label)}
                >
                  {s.label}
                  {!s.available && <span className="sr-only"> (no disponible)</span>}
                </button>
              ))}
            </div>
            {product.sizeNote && <p className="size-note">{product.sizeNote}</p>}
            {sizeError && (
              <p className="field-error" id="size-error" role="alert">
                Selecciona una talla para continuar.
              </p>
            )}
          </fieldset>

          <div className="field">
            <span className="field-label" id="qty-label">Cantidad</span>
            <div className="qty" role="group" aria-labelledby="qty-label">
              <button type="button" onClick={() => changeQuantity(-1)} disabled={quantity <= 1} aria-label="Quitar uno">
                −
              </button>
              <output aria-live="polite" data-testid="quantity">{quantity}</output>
              <button
                type="button"
                onClick={() => changeQuantity(1)}
                disabled={quantity >= store.maxQuantity}
                aria-label="Agregar uno"
              >
                +
              </button>
            </div>
          </div>

          <div className="order-box">
            <div className="order-total">
              <span>Total</span>
              <strong data-testid="total">{formatPrice(total)}</strong>
            </div>
            {savingsOf(product) > 0 && (
              <p className="order-savings" data-testid="order-savings">
                Ahorras {formatPrice(savingsOf(product) * quantity)}
              </p>
            )}
            <button type="button" className="btn-whatsapp" onClick={order} disabled={soldOut}>
              <WhatsAppIcon />
              {soldOut ? 'Sin tallas disponibles' : 'Pedir por WhatsApp'}
            </button>
            {store.paymentMethods.length > 0 && (
              <div className="payment-methods" data-testid="payment-methods">
                <span className="payment-title">Formas de pago</span>
                <ul>
                  {store.paymentMethods.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="fine-print">
              Se abrirá WhatsApp con tu pedido escrito para que lo envíes. Tu pedido queda confirmado cuando te
              respondamos con disponibilidad, entrega y datos para pagar. {store.deliveryNote}.
            </p>
          </div>

          {product.details?.length > 0 && (
            <section className="detail-section">
              <h2 className="detail-title">Detalles</h2>
              <ul className="includes">
                {product.details.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {product.includes?.length > 0 && (
            <section className="detail-section">
              <h2 className="detail-title">Incluye</h2>
              <ul className="includes">
                {product.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {product.note && <p className="product-note">{product.note}</p>}
            </section>
          )}

          <a href="#/" className="btn-outline back-bottom">
            Ver todo el catálogo
          </a>
        </div>
      </div>

      {/* Barra fija en celular: total y botón siempre a la mano */}
      <div className="sticky-order">
        <div className="sticky-total">
          <span>{size ? `Talla ${size} · ${quantity} pza` : 'Elige tu talla'}</span>
          <strong>{formatPrice(total)}</strong>
        </div>
        <button type="button" className="btn-whatsapp" onClick={order} disabled={soldOut}>
          <WhatsAppIcon />
          Pedir
        </button>
      </div>
    </article>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.2 8.2 0 0 1 8.23 8.24c0 4.54-3.7 8.23-8.22 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06a6.74 6.74 0 0 1-3.37-2.94c-.25-.44.25-.41.73-1.36.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42h-.48a.92.92 0 0 0-.67.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.57.13.16 1.75 2.67 4.23 3.74 1.58.68 2.2.74 2.99.62.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.22-.17-.47-.29Z"
      />
    </svg>
  )
}
