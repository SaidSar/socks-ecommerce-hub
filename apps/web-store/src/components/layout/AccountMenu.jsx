import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { UserIcon } from '../brand/Icons'

const MENU_ID = 'menu-cuenta'

/**
 * Acceso a cuenta del Navbar (DESIGN_AUTH.md §3). Sin sesión: enlace a /cuenta. Con sesión: iniciales
 * y menú desplegable (role="menu") que cierra con Esc, clic fuera o al elegir; ↑/↓, Inicio y Fin
 * recorren los menuitem.
 */
export default function AccountMenu() {
  const { user, isAuthenticated, initials, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const triggerRef = useRef(null)
  const itemsRef = useRef([])
  const focusTriggerNext = useRef(false)

  const close = (restoreFocus) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  // Al abrir, el foco va al primer elemento del menú.
  useEffect(() => {
    if (open) itemsRef.current[0]?.focus()
  }, [open])

  // Clic fuera cierra sin robar el foco.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Tras cerrar sesión desde el menú, el foco pasa al enlace "Entrar" que reemplaza al botón.
  useEffect(() => {
    if (!isAuthenticated && focusTriggerNext.current) {
      focusTriggerNext.current = false
      triggerRef.current?.focus()
    }
  }, [isAuthenticated])

  const onMenuKeyDown = (e) => {
    const items = itemsRef.current.filter(Boolean)
    const current = items.indexOf(document.activeElement)
    const last = items.length - 1
    const next = { ArrowDown: current + 1, ArrowUp: current - 1, Home: 0, End: last }[e.key]
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
    } else if (e.key === 'Tab') {
      setOpen(false)
    } else if (next !== undefined) {
      e.preventDefault()
      items[(next + items.length) % items.length]?.focus()
    }
  }

  const signOut = async () => {
    focusTriggerNext.current = true
    setOpen(false)
    await logout()
  }

  if (!isAuthenticated) {
    return (
      <Link
        ref={triggerRef}
        to="/cuenta"
        aria-label="Iniciar sesión o crear cuenta"
        className="flex min-h-11 min-w-11 items-center justify-center gap-2 text-ink transition-colors hover:text-laca"
      >
        <UserIcon className="h-[22px] w-[22px]" />
        <span className="hidden text-[13px] tracking-[.12em] text-ink-soft uppercase md:inline" aria-hidden="true">
          Entrar
        </span>
      </Link>
    )
  }

  const itemClass = 'flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-[14px] outline-none'

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Cuenta de ${user.firstName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? MENU_ID : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="flex min-h-11 min-w-11 items-center justify-center"
      >
        <span className="relative flex h-[30px] w-[30px] items-center justify-center rounded-full border border-ink/20 bg-sand font-serif text-[13px] leading-none">
          {initials}
          <span aria-hidden="true" className="absolute -top-px -right-px h-1.5 w-1.5 rounded-full bg-laca" />
        </span>
      </button>

      {open && (
        <div className="animate-fade absolute top-full right-0 z-50 mt-3 w-64 border border-ink/10 bg-linen py-2">
          <div className="border-b border-ink/10 px-4 pt-2 pb-3">
            <p className="font-serif text-[18px] leading-tight">Hola, {user.firstName}</p>
            <p className="mt-0.5 truncate text-[12px] text-ink-soft">{user.email}</p>
          </div>
          <ul id={MENU_ID} role="menu" aria-label="Su cuenta" onKeyDown={onMenuKeyDown} className="pt-1">
            <li role="none">
              <Link
                ref={(el) => (itemsRef.current[0] = el)}
                role="menuitem"
                to="/cuenta/bienvenida"
                tabIndex={-1}
                onClick={() => setOpen(false)}
                className={`${itemClass} hover:bg-sand focus-visible:bg-sand`}
              >
                Mi carnet
              </Link>
            </li>
            <li role="none">
              <Link
                ref={(el) => (itemsRef.current[1] = el)}
                role="menuitem"
                to="/cuenta/pedidos"
                tabIndex={-1}
                onClick={() => setOpen(false)}
                className={`${itemClass} hover:bg-sand focus-visible:bg-sand`}
              >
                Mis pedidos
              </Link>
            </li>
            <li role="separator" className="mx-4 my-1 border-t border-ink/10" />
            <li role="none">
              <button
                ref={(el) => (itemsRef.current[2] = el)}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={signOut}
                className={`${itemClass} hover:bg-sand focus-visible:bg-sand`}
              >
                Cerrar sesión
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
