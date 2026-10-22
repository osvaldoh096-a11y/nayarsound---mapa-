import { useEffect } from 'react'
import { store } from '../config/store.js'
import { assetUrl, formatPrice } from '../lib.js'
import PhotoPlaceholder from './PhotoPlaceholder.jsx'
import { PromoHero } from './Promo.jsx'

const SCROLL_KEY = 'placex-catalog-scroll'

export default function Catalog({ products, promo }) {
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
        <PromoHero promo={promo} />
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
                </div>
                <div className="product-card-body">
                  <h2 className="product-card-name">{product.name}</h2>
                  <p className="product-card-price" data-testid="card-price">{formatPrice(product.price)}</p>
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
