import { SIZES } from '../../data/catalog.mock'

/** Selector de talla S / M / L con medida en cm (DESIGN.md §6.4). Default 'M' lo fija quien lo usa. */
export default function SizeSelector({ value, onChange, label = 'Talla' }) {
  return (
    <div className="flex items-center gap-5 text-[12px]" role="radiogroup" aria-label={label}>
      {SIZES.map(({ code, label: cm }) => {
        const selected = value === code
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(code)}
            className="flex min-h-11 items-end"
          >
            <span
              className={`border-b pb-1 transition-colors ${
                selected ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              <span className="tracking-[.14em]">{code}</span> <span className="tnum text-ink-soft">{cm}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
