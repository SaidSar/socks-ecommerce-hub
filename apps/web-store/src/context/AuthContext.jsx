import { useCallback, useEffect, useMemo, useState } from 'react'
import * as authService from '../services/authService'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  // getSession() es síncrono: la sesión se hidrata en el primer render y las guardas de ruta no parpadean.
  const [user, setUser] = useState(() => authService.getSession())
  const [status, setStatus] = useState('idle') // 'idle' | 'loading'

  // Sincroniza la sesión entre pestañas (solo la guardada en localStorage).
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === authService.SESSION_KEY) setUser(authService.getSession())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Envuelve una llamada al servicio con el estado de carga; los AuthError se propagan al formulario.
  const run = useCallback(async (fn) => {
    setStatus('loading')
    try {
      return await fn()
    } finally {
      setStatus('idle')
    }
  }, [])

  const login = useCallback(
    (credentials) =>
      run(async () => {
        const { user: next } = await authService.login(credentials)
        setUser(next)
        return next
      }),
    [run],
  )

  const register = useCallback(
    (data) =>
      run(async () => {
        const { user: next } = await authService.register(data)
        setUser(next)
        return next
      }),
    [run],
  )

  const requestPasswordReset = useCallback((email) => run(() => authService.requestPasswordReset(email)), [run])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const value = useMemo(() => {
    const initials = user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() : ''
    return {
      user,
      status,
      isAuthenticated: Boolean(user),
      initials,
      login,
      register,
      logout,
      requestPasswordReset,
    }
  }, [user, status, login, register, logout, requestPasswordReset])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
