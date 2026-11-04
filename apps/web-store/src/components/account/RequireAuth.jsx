import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/** Vista con sesión: sin ella lleva a iniciar sesión y, al entrar, de vuelta aquí (?redirect=). */
export default function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth()
  const { pathname } = useLocation()
  if (!isAuthenticated) return <Navigate to={`/cuenta?redirect=${pathname}`} replace />
  return children
}
