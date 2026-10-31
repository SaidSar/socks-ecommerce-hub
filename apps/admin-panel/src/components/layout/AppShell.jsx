import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { NAV } from '../../config/navigation'
import { roleLabel } from '../../config/roles'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import { useAdminData } from '../../hooks/useAdminData'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

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
  const [toast, setToast] = useState('')
  const { user, logout, can } = useAdminAuth()
  const { summary, api, usesApi } = useAdminData()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setMenu(false)
  }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 3200)
    return () => clearTimeout(t)
  }, [toast])

  // La barra lateral solo muestra las secciones que el rol puede abrir.
  const items = NAV.filter((n) => can(n.perm))
  const sidebar = <Sidebar items={items} toPrepare={summary.toPrepare} onNavigate={() => setMenu(false)} />

  const onLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }
  // Con la API, la semilla se restablece en la BD: este botón solo reinicia el mock.
  const onResetDemo = import.meta.env.DEV && !usesApi
    ? async () => {
        await api.resetDemoData()
        setToast('Datos demo restablecidos.')
      }
    : undefined

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:bg-paper focus:px-3 focus:py-2 focus:rounded-md focus:border focus:border-line"
      >
        Saltar al contenido
      </a>
      <aside className="hidden lg:block bg-sand border-r border-line sticky top-0 h-screen" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {sidebar}
      </aside>
      {menu && <MobileNav onClose={() => setMenu(false)}>{sidebar}</MobileNav>}

      <div className="min-w-0">
        <Topbar
          onOpenMenu={() => setMenu(true)}
          menuOpen={menu}
          lateCount={summary.late}
          user={user}
          roleLabel={roleLabel(user.role)}
          onLogout={onLogout}
          onResetDemo={onResetDemo}
        />
        <main id="main" tabIndex={-1} className="gutter py-6 lg:py-8 max-w-[1600px] outline-none">
          <Outlet />
        </main>
      </div>

      <div role="status" aria-live="polite" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
        {toast && <p className="animate-fade bg-ink text-linen rounded-md px-4 py-2.5 text-[13px] shadow-lg">{toast}</p>}
      </div>
    </div>
  )
}
