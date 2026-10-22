import { useEffect, useState } from 'react'
import { products } from './config/products.js'
import { store } from './config/store.js'
import { whatsappConfigured } from './lib.js'
import Header from './components/Header.jsx'
import Catalog from './components/Catalog.jsx'
import ProductPage from './components/ProductPage.jsx'
import Footer from './components/Footer.jsx'
import { PromoStrip, usePromo } from './components/Promo.jsx'

function parseRoute() {
  const match = window.location.hash.match(/^#\/producto\/([^/?#]+)/)
  return match ? { view: 'product', id: decodeURIComponent(match[1]) } : { view: 'catalog' }
}

export default function App() {
  const [route, setRoute] = useState(parseRoute)
  const promo = usePromo()

  useEffect(() => {
    const onChange = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const product = route.view === 'product' ? products.find((p) => p.id === route.id) : null

  useEffect(() => {
    if (product) {
      window.scrollTo(0, 0)
      document.title = `${product.name} — ${store.name}`
    } else {
      document.title = `${store.name} — Lencería & Seducción`
    }
  }, [product])

  return (
    <>
      {import.meta.env.DEV && !whatsappConfigured() && (
        <div className="dev-warning" role="note">
          Pendiente: configura tu número de WhatsApp en <code>src/config/store.js</code>
        </div>
      )}
      <PromoStrip promo={promo} />
      <Header compact={route.view === 'product'} />
      <main>
        {route.view === 'product' && product ? (
          <ProductPage key={product.id} product={product} />
        ) : route.view === 'product' ? (
          <div className="not-found">
            <p>No encontramos este producto.</p>
            <a className="btn-outline" href="#/">Ver catálogo</a>
          </div>
        ) : (
          <Catalog products={products} promo={promo} />
        )}
      </main>
      <Footer />
    </>
  )
}
