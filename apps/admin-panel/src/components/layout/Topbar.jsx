import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import isotipo from '../../assets/brand/sokko-isotipo.svg'
import Icon from '../ui/Icon'
import UserMenu from './UserMenu'

/** Barra superior: menú (móvil), isotipo (móvil), buscador global, campana de atrasados y menú de usuario. */
export default function Topbar({ onOpenMenu, menuOpen, lateCount = 0, user, roleLabel, onLogout, onResetDemo }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const onSearch = (e) => {
    e.preventDefault()
    const term = q.trim()
    navigate(term ? `/pedidos?q=${encodeURIComponent(term)}` : '/pedidos')
  }

  return (
    <header className="sticky z-30 bg-linen/95 backdrop-blur border-b border-line" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="gutter h-16 flex items-center gap-3">
        <button
          type="button"
          className="lg:hidden w-11 h-11 -ml-2 rounded-md hover:bg-sand flex items-center justify-center"
          onClick={onOpenMenu}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
        >
          <Icon name="menu" />
        </button>
        <img src={isotipo} alt="SOKKO" className="lg:hidden h-8 w-auto max-w-none select-none" draggable="false" />
        <form role="search" onSubmit={onSearch} className="hidden md:block">
          <label className="flex items-center gap-2 h-9 px-3 rounded-md border border-line bg-paper w-72 focus-within:border-ai">
            <Icon name="search" className="w-4 h-4 text-ink-soft" />
            <span className="sr-only">Buscar pedido, SKU o cliente</span>
            <input
              id="global-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar pedido, SKU o cliente"
              className="bg-transparent outline-none w-full text-[13px] placeholder:text-ink-soft"
            />
          </label>
        </form>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate('/pedidos?f=late')}
            className="relative w-10 h-10 max-lg:w-11 max-lg:h-11 rounded-md hover:bg-sand flex items-center justify-center"
            aria-label={lateCount === 1 ? '1 pedido atrasado' : `${lateCount} pedidos atrasados`}
          >
            <Icon name="bell" />
            {lateCount > 0 && (
              <span
                className="absolute top-1.5 right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-laca text-white text-[10.5px] font-semibold flex items-center justify-center tnum"
                aria-hidden="true"
              >
                {lateCount}
              </span>
            )}
          </button>
          {user && <UserMenu user={user} roleLabel={roleLabel} onLogout={onLogout} onResetDemo={onResetDemo} />}
        </div>
      </div>
    </header>
  )
}
