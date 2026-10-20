import { useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { NAV } from '../../config/navigation'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

// TODO(api): el usuario llega de la sesión (Fase 3).
const PLACEHOLDER_USER = { name: 'Aiko Morales', email: 'hola@sokko.mx' }

function MobileNav({ onClose, children }) {
  const panelRef = useRef(null)
  useLockBodyScroll(true)
  useFocusTrap(panelRef, { onEscape: onClose })
  return (
    <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menú del panel" id="mobile-nav">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="animate-slide absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-sand border-r border-line"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {children}
      </div>
    </div>
  )
}

/** Estructura del panel: barra lateral fija (lg+) o panel (móvil), barra superior y área de trabajo. */
export default function AppShell() {
  const [menu, setMenu] = useState(false)
  const { pathname } = useLocation()
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setMenu(false)
  }

  const sidebar = <Sidebar items={NAV} onNavigate={() => setMenu(false)} />

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden lg:block bg-sand border-r border-line sticky top-0 h-screen" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {sidebar}
      </aside>
      {menu && <MobileNav onClose={() => setMenu(false)}>{sidebar}</MobileNav>}

      <div className="min-w-0">
        <Topbar onOpenMenu={() => setMenu(true)} menuOpen={menu} user={PLACEHOLDER_USER} roleLabel="Dueño" onLogout={() => {}} />
        <main id="main" className="gutter py-6 lg:py-8 max-w-[1600px]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
