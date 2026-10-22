export default function PhotoPlaceholder({ index, total }) {
  return (
    <div className="photo-placeholder" role="img" aria-label="Foto provisional">
      <img src="/brand/placex-x.webp" alt="" className="photo-placeholder-x" aria-hidden="true" />
      <span className="photo-placeholder-label">Foto provisional</span>
      {total > 1 && (
        <span className="photo-placeholder-count">
          {index + 1} / {total}
        </span>
      )}
    </div>
  )
}
