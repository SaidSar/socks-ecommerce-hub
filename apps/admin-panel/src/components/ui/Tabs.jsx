import { useRef } from 'react'

/** Flechas, Inicio y Fin mueven el foco entre opciones (roving tabindex) y seleccionan. */
function useRoving(options, value, onChange) {
  const refs = useRef([])
  const onKeyDown = (e) => {
    const i = options.findIndex((o) => o.key === value)
    let next = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + options.length) % options.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = options.length - 1
    if (next === null) return
    e.preventDefault()
    onChange(options[next].key)
    refs.current[next]?.focus()
  }
  return { refs, onKeyDown }
}

/**
 * Pestañas de filtro con contador (Pedidos, Inventario). `options`: [{ key, label, count, alert }].
 * `alert` resalta el contador en laca cuando es mayor a 0 (Atrasados).
 */
export default function Tabs({ options, value, onChange, label, wrap = false }) {
  const { refs, onKeyDown } = useRoving(options, value, onChange)
  return (
    <div className={`flex gap-1 ${wrap ? 'flex-wrap' : 'min-w-max'}`} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o, i) => {
        const active = value === o.key
        return (
          <button
            key={o.key}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.key)}
            className={`h-9 max-lg:h-11 px-3 rounded-md text-[13px] flex items-center gap-2 whitespace-nowrap transition-colors ${active ? 'bg-ink text-linen' : 'hover:bg-sand text-ink'}`}
          >
            {o.label}
            {o.count != null && (
              <span
                className={`tnum text-[11.5px] rounded px-1.5 ${
                  active ? 'bg-white/15' : o.alert && o.count ? 'bg-crit-bg text-laca' : 'bg-sand text-ink-soft'
                }`}
              >
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Selector segmentado de una opción (periodo del dashboard). */
export function Segmented({ options, value, onChange, label }) {
  const { refs, onKeyDown } = useRoving(options, value, onChange)
  return (
    <div className="inline-flex rounded-md border border-line bg-paper p-0.5" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o, i) => {
        const active = value === o.key
        return (
          <button
            key={o.key}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.key)}
            className={`h-8 max-lg:h-11 px-3 rounded text-[13px] ${active ? 'bg-ink text-linen' : 'hover:bg-sand'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
