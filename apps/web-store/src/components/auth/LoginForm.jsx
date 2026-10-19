import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useShake } from '../../hooks/useShake'
import { AuthError, DEMO_ACCOUNT } from '../../services/authService'
import { MESSAGES, emailError } from '../../utils/authValidation'
import AuthField, { AuthAlert, AuthCheckbox, AuthSubmit } from './AuthField'
import PasswordField from './PasswordField'

/**
 * Iniciar sesión (DESIGN_AUTH.md §4.2). Tras el éxito no navega: la guarda de Account lleva a la
 * bienvenida o a ?redirect=. `onAuthStart('login')` le avisa el modo antes de la petición.
 */
export default function LoginForm({ onAuthStart, search = '' }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shaking, shake] = useShake()
  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  const fail = (target) => {
    shake()
    target.current?.focus()
  }

  const submit = async (e) => {
    e.preventDefault()
    if (loading) return
    setFormError('')
    const next = { email: emailError(email), password: password ? undefined : MESSAGES.passwordEmpty }
    setErrors(next)
    if (next.email || next.password) {
      fail(next.email ? emailRef : passwordRef)
      return
    }

    setLoading(true)
    onAuthStart?.('login')
    try {
      await login({ email: email.trim(), password, remember })
    } catch (err) {
      setLoading(false)
      // Mismo mensaje para correo o contraseña: no revela cuál falló.
      setFormError(err instanceof AuthError ? MESSAGES.invalidCredentials : MESSAGES.network)
      fail(passwordRef)
    }
  }

  return (
    <form onSubmit={submit} noValidate className={`flex flex-col gap-7 ${shaking ? 'animate-shake' : ''}`}>
      {formError && <AuthAlert>{formError}</AuthAlert>}

      <AuthField
        id="login-email"
        inputRef={emailRef}
        label="Correo electrónico"
        type="email"
        value={email}
        onChange={(v) => {
          setEmail(v)
          setErrors((x) => ({ ...x, email: undefined }))
        }}
        onBlur={() => email && setErrors((x) => ({ ...x, email: emailError(email) }))}
        error={errors.email}
        autoComplete="email"
        placeholder="nombre@dominio.com"
      />

      <div>
        <PasswordField
          id="login-pw"
          inputRef={passwordRef}
          label="Contraseña"
          value={password}
          onChange={(v) => {
            setPassword(v)
            setErrors((x) => ({ ...x, password: undefined }))
          }}
          error={errors.password}
          autoComplete="current-password"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4">
          <AuthCheckbox id="remember" checked={remember} onChange={setRemember}>
            Mantener la sesión
          </AuthCheckbox>
          <Link
            to="/cuenta/recuperar"
            className="inline-flex min-h-11 shrink-0 items-center font-serif text-[16px] text-ink-soft italic underline decoration-ink/25 underline-offset-4 hover:text-ink"
          >
            ¿Olvidó su contraseña?
          </Link>
        </div>
      </div>

      <AuthSubmit loading={loading} loadingText="Verificando…">
        Iniciar sesión
      </AuthSubmit>

      <p className="text-center text-[13.5px] text-ink-soft">
        ¿Primera visita al atelier?{' '}
        <Link
          to={{ pathname: '/cuenta/registro', search }}
          className="text-ink underline decoration-laca underline-offset-4"
        >
          Crear una cuenta
        </Link>
      </p>

      {import.meta.env.DEV && (
        <p className="border-t border-ink/10 pt-5 text-center text-[12px] text-ink-soft">
          Demo · correo <span className="text-ink select-all">{DEMO_ACCOUNT.email}</span> · contraseña{' '}
          <span className="text-ink select-all">{DEMO_ACCOUNT.password}</span>
        </p>
      )}
    </form>
  )
}
