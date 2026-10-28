import { NavLink } from 'react-router-dom'
import logoHorizontal from '../../assets/brand/sokko-logo-horizontal.svg'
import { STORE_URL } from '../../config/navigation'
import Icon from '../ui/Icon'

/** Barra lateral (sand) con logotipo, secciones permitidas y enlace a la tienda. */
export default function Sidebar({ items, toPrepare = 0, onNavigate }) {
  return (
    <nav aria-label="Secciones del panel" className="flex flex-col h-full">
      <div className="px-5 h-16 flex items-center border-b border-line shrink-0">
        {/* Archivo oficial sin modificar (docs/brand/README.md). */}
        <img src={logoHorizontal} alt="SOKKO" className="h-9 w-auto max-w-none select-none" draggable="false" />
        <span className="ml-auto text-[10.5px] tracking-[.14em] uppercase text-ink-soft bg-paper border border-line rounded px-1.5 py-0.5">
          Admin
        </span>
      </div>
      <ul className="p-3 space-y-0.5 flex-1 overflow-y-auto">
        {items.map((n, i) => (
          <li key={n.key}>
            {/* Título de grupo (Catálogo) antes de su primera sección; al terminar el grupo, una línea. */}
            {n.group && n.group !== items[i - 1]?.group && (
              <p className="px-3 pt-4 pb-1.5 text-[10.5px] tracking-[.16em] uppercase text-ink-soft">
                {n.group}
              </p>
            )}
            {!n.group && items[i - 1]?.group && <hr className="my-2 border-line" />}
            <NavLink
              to={n.to}
              end={n.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                `w-full h-10 max-lg:h-11 px-3 rounded-md flex items-center gap-3 text-[13.5px] transition-colors border ${
                  isActive
                    ? 'bg-paper text-ink font-medium border-line'
                    : 'text-ink-soft hover:text-ink hover:bg-sand-2/60 border-transparent'
                }`
              }
            >
              <Icon name={n.icon} />
              {n.label}
              {n.key === 'pedidos' && toPrepare > 0 && (
                <span className="ml-auto tnum text-[11.5px] rounded-full bg-ocre text-ink px-2 py-0.5 font-medium">
                  {toPrepare}
                  <span className="sr-only"> por preparar</span>
                </span>
              )}
              {!n.ready && <span className="ml-auto text-[10.5px] text-ink-soft">Pronto</span>}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="p-3 border-t border-line shrink-0">
        <a
          href={STORE_URL}
          target="_blank"
          rel="noreferrer"
          className="h-10 max-lg:h-11 px-3 rounded-md flex items-center gap-3 text-[13px] text-ink-soft hover:text-ink hover:bg-sand-2/60"
        >
          <Icon name="ext" />
          Ver tienda<span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      </div>
    </nav>
  )
}
