import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCart } from '../../hooks/useCart'
import { scrollToId } from '../../utils/scroll'
import Logo from '../brand/Logo'
import { BagIcon, MenuIcon, SearchIcon } from '../brand/Icons'
import AccountMenu from './AccountMenu'

const NAV_LINKS = [
  { label: 'El Origen', id: 'origen' },
  { label: 'Colección Tabi', id: 'atelier' },
  { label: 'Tejidos Botánicos', id: 'materia' },
  { label: 'Filosofía', id: 'filosofia' },
]

const SEARCH_PLACEHOLDER = '¿Qué pieza busca su paso?'

export default function Navbar({ query, onQueryChange }) {
  const { count, open: openCart } = useCart()
  const { user, logout } = useAuth()
  const [searching, setSearching] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef(null)
  const menuButtonRef = useRef(null)

  const showSearch = searching || query.length > 0

  // Cierra el menú móvil con Esc y devuelve el foco a su botón.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const toggleSearch = () => {
    const next = !searching
    setSearching(next)
    // El input sigue montado (solo cambia su ancho), así que se enfoca en el mismo evento.
    if (next) requestAnimationFrame(() => inputRef.current?.focus())
  }

  const goTo = (id) => {
    setMenuOpen(false)
    scrollToId(id)
  }

  return (
    <header className="gutter sticky top-[env(safe-area-inset-top,0px)] z-40">
      <div className="mx-auto mt-3 flex h-[68px] max-w-7xl items-center gap-1.5 border border-ink/10 bg-linen/85 px-2 backdrop-blur sm:gap-4 sm:px-3 md:gap-6 md:px-8">
        <button
          ref={menuButtonRef}
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center lg:hidden"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          aria-controls="menu-movil"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <MenuIcon className="h-6 w-6" />
        </button>

        <Logo />

        <nav className="ml-6 hidden items-center gap-9 text-[12.5px] tracking-[.12em] uppercase lg:flex" aria-label="Principal">
          {NAV_LINKS.map(({ label, id }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault()
                goTo(id)
              }}
              className="group relative py-2 text-ink-soft transition-colors hover:text-ink"
            >
              {label}
              <span
                aria-hidden="true"
                className="absolute right-0 -bottom-0.5 left-0 h-px origin-left scale-x-0 bg-laca transition-transform duration-500 group-hover:scale-x-100"
              />
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center sm:gap-2 md:gap-4">
          <div className="hidden items-center gap-1 md:flex">
            <button
              type="button"
              aria-label={showSearch ? 'Ocultar búsqueda' : 'Buscar'}
              aria-expanded={showSearch}
              aria-controls="busqueda"
              onClick={toggleSearch}
              className="flex h-11 w-11 items-center justify-center text-ink-soft hover:text-ink"
            >
              <SearchIcon className="h-5 w-5" />
            </button>
            <input
              ref={inputRef}
              id="busqueda"
              type="search"
              aria-label="Buscar pieza"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={SEARCH_PLACEHOLDER}
              tabIndex={showSearch ? 0 : -1}
              className={`border-b border-ink/20 bg-transparent font-serif text-[16px] italic outline-none transition-all duration-500 placeholder:text-ink-soft focus-visible:border-laca ${
                showSearch ? 'w-56 opacity-100' : 'w-0 opacity-0'
              }`}
            />
          </div>

          <AccountMenu />

          <button
            type="button"
            onClick={openCart}
            aria-label={`Bolsa, ${count} ${count === 1 ? 'pieza' : 'piezas'}`}
            className="relative flex min-h-11 items-center gap-2 px-1 text-ink transition-colors hover:text-laca"
          >
            <BagIcon className="h-[22px] w-[22px]" />
            <span key={count} className="tnum animate-fade font-serif text-[17px]" aria-hidden="true">
              ({count})
            </span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          id="menu-movil"
          className="animate-fade mx-auto flex max-w-7xl flex-col gap-1 border border-t-0 border-ink/10 bg-linen px-5 py-4 lg:hidden"
        >
          <label htmlFor="busqueda-m" className="sr-only">
            Buscar pieza
          </label>
          <input
            id="busqueda-m"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={SEARCH_PLACEHOLDER}
            className="mb-2 border-b border-ink/20 bg-transparent py-1 font-serif text-[17px] italic outline-none placeholder:text-ink-soft focus-visible:border-laca md:hidden"
          />
          <nav aria-label="Principal móvil" className="flex flex-col">
            {NAV_LINKS.map(({ label, id }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault()
                  goTo(id)
                }}
                className="flex min-h-11 items-center font-serif text-[20px]"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-2 border-t border-ink/10 pt-2">
            {user ? (
              <p className="flex min-h-11 flex-wrap items-center gap-x-2 font-serif text-[20px]">
                Hola, {user.firstName} ·
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    logout()
                  }}
                  className="min-h-11 italic underline decoration-ink/25 underline-offset-4"
                >
                  Cerrar sesión
                </button>
              </p>
            ) : (
              <Link to="/cuenta" className="flex min-h-11 items-center font-serif text-[20px]">
                Iniciar sesión
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
