import { useContext } from 'react'
import { AdminAuthContext } from '../context/admin-auth-context'
import { can } from '../config/roles'

/** Sesión actual: { user, login, logout, can(permission) }. */
export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth debe usarse dentro de <AdminAuthProvider>')
  return { ...ctx, can: (permission) => can(ctx.user?.role, permission) }
}
