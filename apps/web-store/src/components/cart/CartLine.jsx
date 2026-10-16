import { TONES } from '../../data/catalog.mock'
import { formatMXN } from '../../utils/currency'
import KnitTabi from '../product/KnitTabi'

const STEP =
  'flex h-11 w-11 items-center justify-center disabled:cursor-not-allowed [&>span]:transition-colors hover:[&>span]:border-ink disabled:[&>span]:opacity-30'

/** Línea de la bolsa (DESIGN.md §6.10). */
export default function CartLine({ item, onSetQty, onRemove }) {
  const atMax = item.qty >= item.max
  const toneName = TONES[item.tone]?.name ?? item.tone

  return (
    <li className="grid grid-cols-[84px_1fr] gap-5 py-6">
      <div className="flex h-[100px] w-[84px] items-center justify-center border border-ink/10 bg-sand">
        <KnitTabi tone={item.tone} className="h-[80%]" strokeWidth={2.4} />
      </div>
      <div className="min-w-0">
        <div className="flex justify-between gap-3">
          <p className="font-serif text-[20px] leading-tight">{item.name}</p>
          <p className="tnum shrink-0 font-serif text-[17px]">{formatMXN(item.price * item.qty)}</p>
        </div>
        <p className="mt-1 text-[12px] text-ink-soft">
          {toneName} · Talla {item.size}
        </p>
        <div className="mt-1 flex items-center justify-between">
          <div className="-ml-2.5 flex items-center text-[14px]">
            <button
              type="button"
              aria-label={`Una pieza menos de ${item.name}`}
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
              aria-label={`Una pieza más de ${item.name}`}
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
        {atMax && <p className="text-[11px] text-laca">Son todos los ejemplares disponibles.</p>}
      </div>
    </li>
  )
}
