import { useState } from 'react'

/**
 * Fotos de la ficha: la grande y, si hay más de una, miniaturas para cambiarla. Solo se usa cuando el producto
 * tiene fotos; sin ellas la ficha sigue con la ilustración (`ProductArt`).
 */
export default function ProductGallery({ product, children }) {
  const [current, setCurrent] = useState(0)
  const images = product.images
  const shown = images[Math.min(current, images.length - 1)]
  const altOf = (image, i) => image.alt || (images.length > 1 ? `${product.name}, foto ${i + 1} de ${images.length}` : product.name)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="relative aspect-[4/5] max-w-full overflow-hidden bg-sand">
        <img src={shown.url} alt={altOf(shown, images.indexOf(shown))} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        {children}
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto" aria-label="Fotos del producto">
          {images.map((image, i) => (
            <li key={image.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setCurrent(i)}
                aria-pressed={image === shown}
                aria-label={`Ver foto ${i + 1} de ${images.length}`}
                className={`block h-20 w-16 overflow-hidden border transition-colors ${image === shown ? 'border-ink' : 'border-transparent hover:border-ink/30'}`}
              >
                <img src={image.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
