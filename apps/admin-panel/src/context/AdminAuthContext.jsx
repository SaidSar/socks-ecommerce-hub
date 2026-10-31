import { useCallback, useEffect, useMemo, useState } from 'react'
import * as adminAuth from '../services/adminAuth'
import { AdminAuthContext } from './admin-auth-context'

/** Sesión del panel. El rol viene de la sesión, nunca de un selector (DESIGN_ADMIN.md §3, §10). */
export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(() => adminAuth.readSession())

  // La sesión guardada se hidrata al instante; aquí se confirma contra la API (un 401 la cierra).
  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener(adminAuth.SESSION_EXPIRED_EVENT, onExpired)
    adminAuth.verifySession().then((next) => setUser(next))
    return () => window.removeEventListener(adminAuth.SESSION_EXPIRED_EVENT, onExpired)
  }, [])

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
