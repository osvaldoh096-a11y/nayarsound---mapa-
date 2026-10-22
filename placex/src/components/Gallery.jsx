import { useRef, useState } from 'react'
import PhotoPlaceholder from './PhotoPlaceholder.jsx'

const PLACEHOLDER_COUNT = 3

export default function Gallery({ images, name }) {
  const trackRef = useRef(null)
  const [active, setActive] = useState(0)
  const slides = images.length ? images : Array(PLACEHOLDER_COUNT).fill(null)

  const onScroll = () => {
    const el = trackRef.current
    if (!el) return
    setActive(Math.round(el.scrollLeft / el.clientWidth))
  }

  const goTo = (i) => {
    const el = trackRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="gallery">
      <div className="gallery-track" ref={trackRef} onScroll={onScroll} aria-label={`Fotos de ${name}`}>
        {slides.map((src, i) => (
          <div className="gallery-slide" key={i}>
            {src ? (
              <img src={src} alt={`${name} — foto ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
            ) : (
              <PhotoPlaceholder index={i} total={slides.length} />
            )}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="gallery-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`gallery-dot${i === active ? ' is-active' : ''}`}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === active}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
