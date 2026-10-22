import { store } from '../config/store.js'
import { assetUrl } from '../lib.js'

export default function Footer() {
  return (
    <footer className="site-footer">
      <img src={assetUrl('brand/placex-x.webp')} alt="" aria-hidden="true" className="footer-x" width="40" height="40" />
      <p className="footer-tagline">{store.tagline}</p>
      <p>Pedidos por WhatsApp · {store.deliveryNote}</p>
      <p className="fine-print">{store.ageNotice}</p>
    </footer>
  )
}
