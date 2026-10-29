import { useCallback, useMemo, useState } from 'react'
import * as adminAuth from '../services/adminAuth'
import { AdminAuthContext } from './admin-auth-context'

/** Sesión del panel. El rol viene de la sesión, nunca de un selector (DESIGN_ADMIN.md §3, §10). */
export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(() => adminAuth.readSession())

  const login = useCallback(async (email, password) => {
    const u = await adminAuth.login(email, password)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(() => {
    adminAuth.logout()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout])
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}
