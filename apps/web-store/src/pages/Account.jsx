import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout'
import AuthTabs from '../components/auth/AuthTabs'
import ForgotForm from '../components/auth/ForgotForm'
import LoginForm from '../components/auth/LoginForm'
import MyOrders from '../components/auth/MyOrders'
import RegisterForm from '../components/auth/RegisterForm'
import ResetForm from '../components/auth/ResetForm'
import Welcome from '../components/auth/Welcome'
import { useAuth } from '../hooks/useAuth'

const TITLES = {
  login: 'Iniciar sesión',
  register: 'Crear cuenta',
  forgot: 'Restablecer contraseña',
  reset: 'Crear contraseña nueva',
  welcome: 'Bienvenida',
  orders: 'Mis pedidos',
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

/** Acceso de cuenta (DESIGN_AUTH.md §1). `view`: 'login' | 'register' | 'forgot' | 'reset' | 'welcome' | 'orders'. */
export default function Account({ view }) {
  const { isAuthenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  // Modo de la última autenticación hecha aquí: decide el sello de la bienvenida (歓迎 u お帰).
  const [authMode, setAuthMode] = useState('login')
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
  if (!isAuthenticated && view === 'orders') {
    return <Navigate to="/cuenta?redirect=/cuenta/pedidos" replace />
  }

  return (
    <AuthLayout view={view}>
      {view !== 'welcome' &&
        (isTabView ? (
          <AuthTabs tabs={TABS} active={view} panelId={PANEL_ID} search={location.search} />
        ) : (
          <p className="mb-4 text-[11px] tracking-[.32em] text-matcha uppercase">{view === 'orders' ? 'Su cuenta' : 'Recuperar acceso'}</p>
        ))}
      {view !== 'welcome' && (
        <h1
          className={
            view === 'forgot' || view === 'reset' || view === 'orders' ? 'mb-6 font-serif text-[clamp(32px,3.6vw,44px)] leading-tight font-light' : 'sr-only'
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
        {view === 'login' && <LoginForm onAuthStart={setAuthMode} search={location.search} />}
        {view === 'register' && <RegisterForm onAuthStart={setAuthMode} search={location.search} />}
        {view === 'forgot' && <ForgotForm />}
        {view === 'reset' && <ResetForm />}
        {view === 'orders' && <MyOrders />}
        {view === 'welcome' && <Welcome mode={location.state?.mode} />}
      </div>

      {isTabView && (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-x-4 border-t border-ink/10 pt-6">
          <p className="text-[13px] text-ink-soft">¿Prefiere no crear cuenta ahora?</p>
          {/* TODO(design): llevar al checkout como invitado cuando exista; hoy vuelve a la tienda. */}
          <Link
            to="/"
            className="inline-flex min-h-11 shrink-0 items-center font-serif text-[16px] italic underline decoration-ink/25 underline-offset-4"
          >
            Comprar como invitado
          </Link>
        </div>
      )}
    </AuthLayout>
  )
}
