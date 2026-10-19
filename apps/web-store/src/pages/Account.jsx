import { useEffect, useState } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout'
import AuthTabs from '../components/auth/AuthTabs'
import { useAuth } from '../hooks/useAuth'

const TITLES = {
  login: 'Iniciar sesión',
  register: 'Crear cuenta',
  forgot: 'Restablecer contraseña',
  welcome: 'Bienvenida',
}

const TABS = [
  { view: 'login', label: 'Iniciar sesión', to: '/cuenta' },
  { view: 'register', label: 'Crear cuenta', to: '/cuenta/registro' },
]

const PANEL_ID = 'auth-panel'

/** Solo rutas internas: empiezan con "/" pero no con "//" ni "/\" (evita redirecciones a otro dominio). */
function safeRedirect(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  return value
}

/** Acceso de cuenta (DESIGN_AUTH.md §1). `view`: 'login' | 'register' | 'forgot' | 'welcome'. */
export default function Account({ view }) {
  const { isAuthenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  // Modo de la última autenticación hecha aquí: decide el sello de la bienvenida (歓迎 u お帰).
  const [authMode] = useState('login')
  const redirect = safeRedirect(searchParams.get('redirect'))
  const isTabView = view === 'login' || view === 'register'

  useEffect(() => {
    const previous = document.title
    document.title = `${TITLES[view]} · SOKKO`
    return () => {
      document.title = previous
    }
  }, [view])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])

  // Con sesión, login/registro llevan a la bienvenida (o a ?redirect=). Esta misma guarda hace la
  // navegación tras un envío exitoso, así no compite con un navigate() del formulario.
  if (isAuthenticated && isTabView) {
    return <Navigate to={redirect ?? '/cuenta/bienvenida'} replace state={{ mode: authMode }} />
  }
  if (!isAuthenticated && view === 'welcome') {
    return <Navigate to="/cuenta" replace />
  }

  return (
    <AuthLayout view={view}>
      {view !== 'welcome' &&
        (isTabView ? (
          <AuthTabs tabs={TABS} active={view} panelId={PANEL_ID} search={location.search} />
        ) : (
          <p className="mb-4 text-[11px] tracking-[.32em] text-matcha uppercase">Recuperar acceso</p>
        ))}
      {view !== 'welcome' && (
        <h1
          className={
            view === 'forgot' ? 'mb-6 font-serif text-[clamp(32px,3.6vw,44px)] leading-tight font-light' : 'sr-only'
          }
        >
          {TITLES[view]}
        </h1>
      )}

      <div
        id={PANEL_ID}
        role={isTabView ? 'tabpanel' : undefined}
        aria-labelledby={isTabView ? `tab-${view}` : undefined}
      >
        {/* Formularios: Fase 3. Bienvenida: Fase 4. */}
        <p className="text-ink-soft">{TITLES[view]}</p>
      </div>
    </AuthLayout>
  )
}
