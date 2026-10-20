import { useEffect, useId, useRef, useState } from 'react'
import Icon from '../ui/Icon'

/** Menú de usuario: iniciales, nombre y rol; "Restablecer datos demo" (solo DEV) y "Cerrar sesión". */
export default function UserMenu({ user, roleLabel, onLogout, onResetDemo }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const buttonRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    wrapRef.current?.querySelector('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onMenuKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...wrapRef.current.querySelectorAll('[role="menuitem"]')]
    const i = items.indexOf(document.activeElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next]?.focus()
  }

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="h-10 max-lg:h-11 pl-1.5 pr-2.5 rounded-md hover:bg-sand flex items-center gap-2.5"
      >
        <span className="w-8 h-8 rounded-full bg-ink text-linen text-[12px] font-semibold flex items-center justify-center" aria-hidden="true">
          {initials}
        </span>
        {/* El nombre siempre forma parte del nombre accesible; se ve desde sm. */}
        <span className="sr-only sm:not-sr-only sm:block text-left leading-tight">
          <span className="block text-[13px] font-medium">{user.name}</span>
          <span className="block text-[11.5px] text-ink-soft">{roleLabel}</span>
        </span>
        <span className="sr-only">, menú de usuario</span>
        <Icon name="down" className="w-4 h-4 text-ink-soft" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Menú de usuario"
          onKeyDown={onMenuKey}
          className="animate-fade absolute right-0 mt-1 w-64 bg-paper border border-line rounded-lg shadow-lg py-1.5 z-50"
        >
          <p className="px-3 py-1.5 text-[12px] text-ink-soft truncate">{user.email}</p>
          <div className="border-t border-line my-1" />
          {onResetDemo && (
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 h-10 max-lg:h-11 text-left text-[13px] hover:bg-linen flex items-center gap-2"
              onClick={() => {
                setOpen(false)
                onResetDemo()
              }}
            >
              <Icon name="refresh" className="w-4 h-4 text-ink-soft" />
              Restablecer datos demo
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="w-full px-3 h-10 max-lg:h-11 text-left text-[13px] hover:bg-linen text-laca flex items-center gap-2"
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
          >
            <Icon name="logout" className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
