import { formatPrice } from '../../utils/currency'
import ProductArt from '../product/ProductArt'

const STEP =
  'flex h-11 w-11 items-center justify-center disabled:cursor-not-allowed [&>span]:transition-colors hover:[&>span]:border-ink disabled:[&>span]:opacity-30'

/** Línea de la bolsa (DESIGN.md §6.10, DESIGN_CATALOG_UI.md §3.8): precio efectivo, de lista y unidad de venta. */
export default function CartLine({ item, onSetQty, onRemove }) {
  const atMax = item.qty >= item.max
  const isSokko = item.line === 'sokko'
  const discounted = item.price < item.listPrice

  return (
    <li className="grid grid-cols-[84px_1fr] gap-5 py-6">
      <div className={`flex h-[100px] w-[84px] items-center justify-center border border-ink/10 ${isSokko ? 'bg-sand' : 'bg-shelf'}`}>
        <ProductArt product={{ art: item.art, name: item.name, colors: [item.color] }} className="h-[80%] w-[80%]" />
      </div>
      <div className="min-w-0">
        <div className="flex justify-between gap-3">
          <p className={isSokko ? 'font-serif text-[20px] leading-tight' : 'text-[15px] leading-snug font-normal'}>{item.name}</p>
          <p className="tnum shrink-0 text-right">
            <span className={`block font-serif text-[17px] ${discounted ? 'text-ocre-ink' : ''}`}>{formatPrice(item.price * item.qty)}</span>
            {discounted && (
              <s className="block text-[12px] text-ink-soft">
                <span className="sr-only">Precio anterior </span>
                {formatPrice(item.listPrice * item.qty)}
              </s>
            )}
          </p>
        </div>
        <p className="mt-1 text-[12px] text-ink-soft">
          {item.color.name} · {item.sizeLabel} · {item.unit}
        </p>
        <div className="mt-1 flex items-center justify-between">
          <div className="-ml-2.5 flex items-center text-[14px]">
            <button
              type="button"
              aria-label={`Una unidad menos de ${item.name}`}
              onClick={() => onSetQty(item.key, item.qty - 1)}
              className={STEP}
            >
              <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full border border-ink/25 leading-none">
                −
              </span>
            </button>
            <span className="tnum w-5 text-center font-serif text-[18px]" aria-live="polite">
              <span className="sr-only">Cantidad: </span>
              {item.qty}
            </span>
            <button
              type="button"
              aria-label={`Una unidad más de ${item.name}`}
              disabled={atMax}
              onClick={() => onSetQty(item.key, item.qty + 1)}
              className={STEP}
            >
              <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full border border-ink/25 leading-none">
                +
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => onRemove(item.key)}
            aria-label={`Retirar ${item.name}`}
            className="min-h-11 text-[11px] tracking-[.18em] text-ink-soft uppercase hover:text-laca"
          >
            Retirar
          </button>
        </div>
        {atMax && <p className="text-[11px] text-laca">Son todas las unidades disponibles.</p>}
      </div>
    </li>
  )
}
