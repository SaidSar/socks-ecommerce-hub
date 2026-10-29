import { useContext } from 'react'
import { AuthContext } from '../context/auth-context'

/**
 * Sesión del usuario (DESIGN_AUTH.md §5.4).
 * @returns {{
 *   user: { id: string, firstName: string, lastName: string, email: string, preferredSize: 'S'|'M'|'L'|null, marketingOptIn: boolean, memberSince: string } | null,
 *   status: 'idle' | 'loading', isAuthenticated: boolean, initials: string,
 *   login: (c: { email: string, password: string, remember: boolean }) => Promise<object>,
 *   register: (d: object) => Promise<object>, logout: () => Promise<void>,
 *   requestPasswordReset: (email: string) => Promise<void>,
 * }}
 */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth() debe usarse dentro de <AuthProvider>. Envuelve la app con AuthProvider en App.jsx.')
  }
  return ctx
}
