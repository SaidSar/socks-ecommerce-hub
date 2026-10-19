import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Pestañas Iniciar sesión / Crear cuenta. Cada pestaña es una ruta: cambiar de pestaña usa navigate,
 * así el historial del navegador funciona (DESIGN_AUTH.md §1). Flechas ←/→, Inicio y Fin mueven el foco.
 */
export default function AuthTabs({ tabs, active, panelId, search = '' }) {
  const navigate = useNavigate()
  const refs = useRef([])

  const select = (i) => {
    const tab = tabs[i]
    if (tab.view !== active) navigate({ pathname: tab.to, search })
    refs.current[i]?.focus()
  }

  const onKeyDown = (e) => {
    const current = tabs.findIndex((t) => t.view === active)
    const last = tabs.length - 1
    const next = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: last }[e.key]
    if (next === undefined) return
    e.preventDefault()
    select((next + tabs.length) % tabs.length)
  }

  return (
    <div className="mb-10 grid grid-cols-2 border-b border-ink/15" role="tablist" aria-label="Acceso a su cuenta">
      {tabs.map((tab, i) => {
        const selected = tab.view === active
        return (
          <button
            key={tab.view}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="tab"
            id={`tab-${tab.view}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(i)}
            onKeyDown={onKeyDown}
            className={`relative min-h-11 pb-3.5 text-left font-serif text-[22px] transition-colors ${
              selected ? 'text-ink' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {tab.label}
            <span
              aria-hidden="true"
              className={`absolute -bottom-px left-0 h-[2px] bg-laca transition-all duration-500 ${selected ? 'w-16' : 'w-0'}`}
            />
          </button>
        )
      })}
    </div>
  )
}
