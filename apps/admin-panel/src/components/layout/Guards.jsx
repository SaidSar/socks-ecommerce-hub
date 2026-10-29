import { Navigate, useLocation } from 'react-router-dom'
import { navByKey } from '../../config/navigation'
import { AdminDataProvider } from '../../context/AdminDataContext'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import Forbidden from '../../pages/Forbidden'
import AppShell from './AppShell'

/** Todas las rutas salvo /login requieren sesión; sin ella redirige a /login?redirect=<ruta>. */
export function ProtectedLayout() {
  const { user } = useAdminAuth()
  const { pathname, search } = useLocation()
  if (!user) {
    const target = pathname + search
    return <Navigate to={target === '/' ? '/login' : `/login?redirect=${encodeURIComponent(target)}`} replace />
  }
  return (
    <AdminDataProvider user={user}>
      <AppShell />
    </AdminDataProvider>
  )
}

/** Muestra Forbidden si el rol no tiene el permiso de la sección. */
export function RequirePermission({ section, children }) {
  const { can } = useAdminAuth()
  const nav = navByKey(section)
  if (!can(nav.perm)) return <Forbidden title={nav.label} />
  return children
}
