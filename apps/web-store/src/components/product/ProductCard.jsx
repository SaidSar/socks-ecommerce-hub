import { Link } from 'react-router-dom'
import { label, LINE_LABELS, unitText } from '../../config/enums'
import Price from './Price'
import ProductArt from './ProductArt'

const TAG = 'inline-flex h-[22px] items-center px-2 text-[10.5px] font-medium tracking-[.14em] uppercase'

/** Insignia de temporada: fuera de temporada (ocre-ink) o la colección activa (borde matcha). */
export function SeasonTag({ product, className = '' }) {
  if (product.offSeasonPct) return <span className={`${TAG} bg-ocre-ink text-white ${className}`}>Fuera de temporada · −{product.offSeasonPct} %</span>
  if (product.collection?.kind === 'temporada') return <span className={`${TAG} border border-matcha text-matcha ${className}`}>{product.collection.name}</span>
  return null
}

function eyebrow(product, showLine) {
  if (showLine) return label(LINE_LABELS, product.line)
  return product.brand.showInFilters ? product.brand.name : product.type.name
}

/**
 * Tarjeta de producto (DESIGN_CATALOG_UI.md §3.4). Todo lo que muestra (precio, insignia, pocas unidades)
 * ya viene calculado por el servicio de catálogo.
 */
export default function ProductCard({ product, showLine = false }) {
  const isSokko = product.line === 'sokko'
  return (
    <Link to={`/producto/${product.slug}`} className="group flex min-w-0 flex-col gap-3">
      <div
        className={`relative flex aspect-[4/5] max-w-full items-center justify-center p-6 transition-colors ${
          isSokko ? 'linen-tex bg-sand group-hover:bg-sand-2' : 'bg-shelf group-hover:bg-sand'
        }`}
      >
        <div className="h-[86%] w-[78%] transition-transform duration-300 group-hover:-translate-y-1">
          <ProductArt product={product} />
        </div>
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          <SeasonTag product={product} />
        </div>
        {isSokko && product.nameJp && (
          <span lang="ja" className="absolute right-3 bottom-3 font-jp text-[15px] text-ink-soft">
            {product.nameJp}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        {/* Altura fija: la fila mide lo mismo con o sin "Quedan N". */}
        <div className="flex h-4 items-center justify-between gap-2">
          <span className="truncate text-[11px] font-normal tracking-[.22em] text-ink-soft uppercase">{eyebrow(product, showLine)}</span>
          {product.fewUnits && <span className="shrink-0 text-[10.5px] font-medium tracking-[.14em] text-laca uppercase">Quedan {product.stock}</span>}
        </div>
        <span className={isSokko ? 'font-serif text-[21px] leading-tight' : 'text-[15px] leading-snug font-normal'}>{product.name}</span>
        <span className="flex items-baseline justify-between gap-2">
          <Price product={product} />
          <span className="shrink-0 text-[12px] text-ink-soft">{unitText(product.type.unit, product.unitsPerPack)}</span>
        </span>
      </div>
    </Link>
  )
}
