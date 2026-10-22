import { useEffect, useRef, useState } from 'react'
import PhotoPlaceholder from './PhotoPlaceholder.jsx'
import { assetUrl } from '../lib.js'

const PLACEHOLDER_COUNT = 3

// Cada elemento es una ruta de foto ('/products/foto.webp') o un video
// ({ video: '/products/video.mp4', webm: '/products/video.webm', poster: '/products/portada.webp' }).
// `webm` es opcional; si existe se ofrece primero.
export default function Gallery({ images, name }) {
  const trackRef = useRef(null)
  const videoRefs = useRef({})
  const [active, setActive] = useState(0)
  const slides = images.length ? images : Array(PLACEHOLDER_COUNT).fill(null)

  // El video solo se descarga y reproduce cuando su foto está a la vista.
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([i, el]) => {
      if (!el) return
      if (Number(i) === active) el.play().catch(() => {})
      else el.pause()
    })
  }, [active])

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
        {slides.map((item, i) => (
          <div className={`gallery-slide${item?.video ? ' is-video' : ''}`} key={i}>
            {item?.video ? (
              <video
                ref={(el) => (videoRefs.current[i] = el)}
                poster={item.poster ? assetUrl(item.poster) : undefined}
                muted
                loop
                playsInline
                preload="none"
                aria-label={`${name} — video`}
              >
                {item.webm && <source src={assetUrl(item.webm)} type="video/webm" />}
                <source src={assetUrl(item.video)} type="video/mp4" />
              </video>
            ) : item ? (
              <img src={assetUrl(item)} alt={`${name} — foto ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
            ) : (
              <PhotoPlaceholder index={i} total={slides.length} />
            )}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="gallery-dots">
          {slides.map((item, i) => (
            <button
              key={i}
              type="button"
              className={`gallery-dot${i === active ? ' is-active' : ''}`}
              aria-label={item?.video ? 'Ver video' : `Ver foto ${i + 1}`}
              aria-current={i === active}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
