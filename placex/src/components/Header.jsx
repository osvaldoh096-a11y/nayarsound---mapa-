import { store } from '../config/store.js'
import { assetUrl } from '../lib.js'

export default function Header({ compact }) {
  return (
    <header className={`site-header${compact ? ' is-compact' : ''}`}>
      <a href="#/" className="brand" aria-label={`${store.name} — inicio`}>
        <img
          src={assetUrl('brand/placex-wordmark.webp')}
          alt={store.name}
          width="720"
          height="158"
          className="brand-logo"
        />
      </a>
      {!compact && (
        <p className="brand-tagline">
          <span className="rule" aria-hidden="true" />
          Lencería &amp; Seducción
          <span className="rule" aria-hidden="true" />
        </p>
      )}
    </header>
  )
}
