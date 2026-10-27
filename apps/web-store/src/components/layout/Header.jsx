import { Link, NavLink } from 'react-router-dom'
import { label, LINE_LABELS, LINES } from '../../config/enums'
import { useCart } from '../../hooks/useCart'
import Logo from '../brand/Logo'
import { BagIcon, SearchIcon } from '../brand/Icons'
import AccountMenu from './AccountMenu'

// Subrayado de 1 px en el ítem activo (aria-current="page", que NavLink pone solo).
const NAV_ITEM =
  'relative flex items-center gap-2 py-2.5 text-[13px] tracking-[.12em] whitespace-nowrap text-ink-soft uppercase transition-colors hover:text-ink aria-[current=page]:text-ink aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-0 aria-[current=page]:after:bottom-0.5 aria-[current=page]:after:h-px aria-[current=page]:after:bg-ink'

function LineLink({ line, compact = false }) {
  const isSokko = line === 'sokko'
  return (
    <NavLink to={`/linea/${line}`} className={`${NAV_ITEM} ${compact ? 'text-[12px]' : ''}`}>
      {isSokko && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-laca" />}
      {label(LINE_LABELS, line)}
      {isSokko && !compact && (
        <span lang="ja" className="font-jp text-[12px] tracking-normal normal-case">
          日本
        </span>
      )}
    </NavLink>
  )
}

/**
 * Encabezado de la tienda (DESIGN_CATALOG_UI.md §3.2): las cuatro líneas, SOKKO primero.
 * En móvil las líneas van en una segunda fila deslizable, sin hamburguesa.
 */
export default function Header() {
  const { count, open: openCart } = useCart()

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-40 border-b border-ink/10 bg-linen/95 backdrop-blur">
      <div className="gutter mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4">
        <Link to="/" aria-label="SOKKO, inicio" className="inline-flex shrink-0 items-center">
          <Logo variant="horizontal" className="h-9 md:h-11" />
        </Link>

        <nav aria-label="Líneas" className="hidden items-center gap-8 md:flex">
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
          <AccountMenu />
          <button
            type="button"
            onClick={openCart}
            aria-label={`Bolsa, ${count} ${count === 1 ? 'artículo' : 'artículos'}`}
            className="relative flex min-h-11 items-center gap-2 px-1 text-ink transition-colors hover:text-laca"
          >
            <BagIcon className="h-[22px] w-[22px]" />
            <span key={count} className="tnum animate-fade font-serif text-[17px]" aria-hidden="true">
              ({count})
            </span>
          </button>
        </div>
      </div>

      <nav aria-label="Líneas" className="gutter flex gap-6 overflow-x-auto border-t border-ink/10 [scrollbar-width:none] md:hidden">
        {LINES.map((line) => (
          <LineLink key={line} line={line} compact />
        ))}
      </nav>
    </header>
  )
}
