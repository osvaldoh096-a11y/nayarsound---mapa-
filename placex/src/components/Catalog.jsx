import { useEffect } from 'react'
import { store } from '../config/store.js'
import { assetUrl, formatPrice, pricingText, savingsOf } from '../lib.js'
import PhotoPlaceholder from './PhotoPlaceholder.jsx'
import { PromoHero } from './Promo.jsx'

const SCROLL_KEY = 'placex-catalog-scroll'

export default function Catalog({ products, promo }) {
  const goToCatalog = () =>
    document.getElementById('catalog-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  useEffect(() => {
    try {
      const y = Number(sessionStorage.getItem(SCROLL_KEY))
      if (y) window.scrollTo(0, y)
      sessionStorage.removeItem(SCROLL_KEY)
    } catch {}
  }, [])

  const rememberScroll = () => {
    try {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
    } catch {}
  }

  return (
      <section className="catalog" aria-labelledby="catalog-title">
        <PromoHero promo={promo} onCta={goToCatalog} />
        <div className="catalog-head">
          <h1 id="catalog-title" className="section-title">Colección</h1>
          {store.shippingNote && <p className="catalog-note">{store.shippingNote}</p>}
        </div>
        <ul className="product-grid">
          {products.slice(0, 5).map((product, i) => {
            const cover = product.images.find((item) => typeof item === 'string' || (item?.src && item.fit !== 'contain'))
          return (
            <li key={product.id} style={{ '--i': i }}>
              <a href={`#/producto/${product.id}`} className="product-card" onClick={rememberScroll}>
                <div className="product-card-media">
                  {cover ? (
                    <img
                      src={assetUrl(cover.src || cover)}
                      alt={product.name}
                      loading={i < 2 ? 'eager' : 'lazy'}
                      decoding="async"
                    />
                  ) : (
                    <PhotoPlaceholder index={0} total={1} />
                  )}
                  {product.provisional && <span className="badge">Provisional</span>}
                  {savingsOf(product) > 0 && (
                    <span className="badge-discount">{pricingText(store.pricing.badge, product)}</span>
                  )}
                </div>
                <div className="product-card-body">
                  <h2 className="product-card-name">{product.name}</h2>
                  <p className="product-card-price">
                    {savingsOf(product) > 0 && (
                      <del className="price-before" data-testid="card-before">
                        {formatPrice(product.compareAtPrice).replace(` ${store.currency}`, '')}
                      </del>
                    )}
                    <span data-testid="card-price">{formatPrice(product.price)}</span>
                  </p>
                  <span className="product-card-cta">Ver detalles</span>
                </div>
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
