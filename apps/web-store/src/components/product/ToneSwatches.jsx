import { TONES } from '../../data/catalog.mock'

const DOT = { sm: 'h-5 w-5', md: 'h-6 w-6' }

/**
 * Selector de tono (DESIGN.md §6.3). Cada swatch tiene un área táctil de 44 × 44 px;
 * el margen negativo del grupo mantiene el círculo alineado con el texto vecino.
 */
export default function ToneSwatches({ tones, value, onChange, size = 'md', label }) {
  return (
    <div className="-mx-2.5 flex items-center" role="radiogroup" aria-label={label}>
      {tones.map((key) => {
        const tone = TONES[key]
        const selected = value === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={tone.name}
            title={tone.name}
            onClick={() => onChange(key)}
            className="group flex h-11 w-11 items-center justify-center"
          >
            <span
              aria-hidden="true"
              className={`${DOT[size]} swatch-tex rounded-full transition ${
                selected
                  ? 'ring-1 ring-ink ring-offset-[3px] ring-offset-linen'
                  : 'ring-1 ring-ink/15 group-hover:ring-ink/40'
              }`}
              style={{ backgroundColor: tone.hex }}
            />
          </button>
        )
      })}
    </div>
  )
}
