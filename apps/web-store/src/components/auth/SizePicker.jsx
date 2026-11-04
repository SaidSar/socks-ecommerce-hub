import { SIZES } from '../../data/catalog.mock'

/** Talla habitual S / M / L (opcional): un segundo clic en la elegida la quita. Lo usan el registro y Mi perfil. */
export default function SizePicker({ id, value, onChange, hint = 'La preseleccionaremos en cada pieza del atelier.' }) {
  return (
    <fieldset>
      <legend className="text-[11px] tracking-[.24em] text-ink-soft uppercase">
        Su talla habitual <span className="tracking-normal normal-case">(opcional)</span>
      </legend>
      <p id={`${id}-hint`} className="mt-1 text-[12px] text-ink-soft">
        {hint}
      </p>
      <div className="mt-3 grid grid-cols-3 border border-ink/15" role="radiogroup" aria-label="Talla habitual" aria-describedby={`${id}-hint`}>
        {SIZES.map(({ code, label: cm }, i) => {
          const selected = value === code
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(selected ? '' : code)}
              className={`flex h-14 flex-col items-center justify-center leading-none transition-colors ${i ? 'border-l border-ink/15' : ''} ${
                selected ? 'bg-ink text-linen' : 'hover:bg-sand'
              }`}
            >
              <span className="text-[13px] tracking-[.14em]">{code}</span>
              <span className={`tnum mt-1.5 text-[11px] ${selected ? 'text-linen/75' : 'text-ink-soft'}`}>{cm}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
