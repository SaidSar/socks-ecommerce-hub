import { Link, NavLink, useLocation, useMatch } from 'react-router-dom'
import { label, LINE_LABELS, LINES } from '../../config/enums'
import { useActiveLineValue } from '../../hooks/useActiveLine'
import { useCart } from '../../hooks/useCart'
import { useWishlist } from '../../hooks/useWishlist'
import Logo from '../brand/Logo'
import { BagIcon, HeartIcon, SearchIcon } from '../brand/Icons'
import AccountMenu from './AccountMenu'

// Subrayado laca en el ítem activo, guiado por aria-current="page".
const CURRENT_LINE =
  'aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-0 aria-[current=page]:after:bottom-0.5 aria-[current=page]:after:h-0.5 aria-[current=page]:after:bg-laca'
const NAV_ITEM = `relative flex items-center gap-2 py-2.5 text-[13px] tracking-[.12em] whitespace-nowrap text-ink-soft uppercase transition-colors hover:text-ink aria-[current=page]:text-ink ${CURRENT_LINE}`

/** Activa en /linea/:line y en la ficha de un producto de esa línea. */
function LineLink({ line, compact = false }) {
  const isSokko = line === 'sokko'
  const onLine = useMatch(`/linea/${line}`)
  const productLine = useActiveLineValue()
  const active = Boolean(onLine) || productLine === line
  return (
    <Link to={`/linea/${line}`} aria-current={active ? 'page' : undefined} className={`${NAV_ITEM} ${compact ? 'text-[12px]' : ''}`}>
      {isSokko && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-laca" />}
      {label(LINE_LABELS, line)}
      {isSokko && !compact && (
        <span lang="ja" className="font-jp text-[12px] tracking-normal normal-case">
          日本
        </span>
      )}
    </Link>
  )
}

/**
 * Encabezado de la tienda (DESIGN_CATALOG_UI.md §3.2): las cuatro líneas, SOKKO primero.
 * Hasta 1023 px las líneas van en una segunda fila deslizable, sin hamburguesa: a 768 px no caben junto al logo,
 * la búsqueda, favoritos, la cuenta y la bolsa.
 */
export default function Header() {
  const { count, open: openCart } = useCart()
  const { count: favorites } = useWishlist()
  const { pathname } = useLocation()
  // "Cuenta" activa en Mis pedidos, Mi perfil, el detalle y Mi carnet; Favoritos se marca solo.
  const inAccount = pathname.startsWith('/cuenta/') && !pathname.startsWith('/cuenta/favoritos')

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-40 border-b border-ink/10 bg-linen/95 backdrop-blur">
      <div className="gutter mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-2 sm:gap-4">
        <Link to="/" aria-label="SOKKO, inicio" className="inline-flex shrink-0 items-center">
          <Logo variant="horizontal" className="h-9 lg:h-11" />
        </Link>

        <nav aria-label="Líneas" className="hidden items-center gap-8 lg:flex">
          {LINES.map((line) => (
            <LineLink key={line} line={line} />
          ))}
        </nav>

        <div className="flex shrink-0 items-center sm:gap-2">
          <NavLink
            to="/buscar"
            aria-label="Buscar"
            className="flex h-11 w-11 items-center justify-center text-ink-soft hover:text-ink aria-[current=page]:text-ink"
          >
            <SearchIcon className="h-[21px] w-[21px]" />
          </NavLink>
          <NavLink
            to="/cuenta/favoritos"
            aria-label={`Favoritos, ${favorites} ${favorites === 1 ? 'pieza' : 'piezas'}`}
            className={`relative flex min-h-11 min-w-11 items-center justify-center gap-1.5 text-ink-soft transition-colors hover:text-laca aria-[current=page]:text-ink ${CURRENT_LINE}`}
          >
            <HeartIcon className="h-[21px] w-[21px]" />
            {/* Con las cuatro líneas a lo ancho, la palabra solo cabe desde xl. */}
            <span aria-hidden="true" className="hidden text-[13px] tracking-[.12em] uppercase xl:inline">
              Favoritos
            </span>
            <span key={favorites} aria-hidden="true" className="tnum animate-fade font-serif text-[16px]">
              ({favorites})
            </span>
          </NavLink>
          <AccountMenu current={inAccount} />
          <button
            type="button"
            onClick={openCart}
            aria-label={`Bolsa, ${count} ${count === 1 ? 'artículo' : 'artículos'}`}
            className="relative flex min-h-11 items-center gap-1.5 text-ink transition-colors hover:text-laca sm:gap-2 sm:px-1"
          >
            <BagIcon className="h-[22px] w-[22px]" />
            <span key={count} className="tnum animate-fade font-serif text-[17px]" aria-hidden="true">
              ({count})
            </span>
          </button>
        </div>
      </div>

      <nav aria-label="Líneas" className="gutter flex gap-6 overflow-x-auto border-t border-ink/10 [scrollbar-width:none] lg:hidden">
        {LINES.map((line) => (
          <LineLink key={line} line={line} compact />
        ))}
      </nav>
    </header>
  )
}
