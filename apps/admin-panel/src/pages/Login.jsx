import { useId, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import logoHorizontal from '../assets/brand/sokko-logo-horizontal.svg'
import Icon from '../components/ui/Icon'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { DEMO_ACCOUNTS } from '../services/adminAuth'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Solo rutas internas: evita redirecciones abiertas (?redirect=https://…). */
function safeRedirect(raw) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/login')) return '/'
  return raw
}

function validate(email, password) {
  const errors = {}
  const e = email.trim()
  if (!e) errors.email = 'Escriba su correo.'
  else if (!EMAIL_RE.test(e)) errors.email = 'Revise el formato del correo.'
  if (!password) errors.password = 'Escriba su contraseña.'
  return errors
}

/** Acceso al panel: sin registro público ni recuperación automática (DESIGN_ADMIN.md §4). */
export default function Login() {
  const { user, login } = useAdminAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = safeRedirect(params.get('redirect'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)
  const ids = { email: useId(), password: useId(), emailErr: useId(), passwordErr: useId(), formErr: useId() }

  if (user) return <Navigate to={redirect} replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    if (busy) return
    const errs = validate(email, password)
    setErrors(errs)
    setFormError('')
    if (errs.email) return emailRef.current?.focus()
    if (errs.password) return passwordRef.current?.focus()
    setBusy(true)
    try {
      await login(email, password)
      navigate(redirect, { replace: true })
    } catch {
      setFormError('El correo o la contraseña no coinciden.')
      setBusy(false)
      passwordRef.current?.select()
    }
  }

  const fillDemo = (acc) => {
    setEmail(acc.email)
    setPassword(acc.password)
    setErrors({})
    setFormError('')
  }

  const fieldCls = (err) =>
    `mt-1 h-11 w-full rounded-md border bg-paper px-3 text-[14px] outline-none focus:border-ai ${err ? 'border-laca' : 'border-line'}`

  return (
    <main className="min-h-screen bg-linen gutter py-10 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="bg-paper border border-line rounded-lg px-6 py-8 sm:px-8">
          {/* Archivo oficial sin modificar (docs/brand/README.md). */}
          <img src={logoHorizontal} alt="SOKKO" className="h-10 w-auto max-w-none mx-auto select-none" draggable="false" />
          <h1 className="font-serif text-[32px] leading-tight text-center mt-5">Panel SOKKO</h1>
          <p className="text-[13px] text-ink-soft text-center mt-1">Acceso para el equipo interno</p>

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4" aria-busy={busy} aria-describedby={formError ? ids.formErr : undefined}>
            <div>
              <label htmlFor={ids.email} className="text-[12.5px] text-ink-soft">
                Correo
              </label>
              <input
                ref={emailRef}
                id={ids.email}
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setErrors((x) => ({ ...x, email: '' }))
                  setFormError('')
                }}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? ids.emailErr : undefined}
                className={fieldCls(errors.email)}
              />
              {errors.email && (
                <p id={ids.emailErr} className="text-[12.5px] text-laca mt-1">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={ids.password} className="text-[12.5px] text-ink-soft">
                Contraseña
              </label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id={ids.password}
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setErrors((x) => ({ ...x, password: '' }))
                    setFormError('')
                  }}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? ids.passwordErr : undefined}
                  className={`${fieldCls(errors.password)} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={show}
                  className="absolute right-0 top-1 w-11 h-11 rounded-md flex items-center justify-center text-ink-soft hover:text-ink"
                >
                  <Icon name={show ? 'eyeOff' : 'eye'} />
                </button>
              </div>
              {errors.password && (
                <p id={ids.passwordErr} className="text-[12.5px] text-laca mt-1">
                  {errors.password}
                </p>
              )}
            </div>

            {formError && (
              <p id={ids.formErr} role="alert" className="rounded-md bg-crit-bg text-laca text-[13px] px-3 py-2.5 flex items-start gap-2">
                <Icon name="alert" className="w-4 h-4 mt-0.5" />
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-md bg-laca hover:bg-laca-hover text-white text-[14px] font-medium transition-colors disabled:opacity-60"
            >
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="text-[12.5px] text-ink-soft text-center mt-5">¿Olvidó su contraseña? Pídale al Dueño que la restablezca.</p>
        </div>

        {import.meta.env.DEV && (
          <section aria-labelledby="demo-title" className="mt-4 rounded-lg border border-dashed border-line bg-sand/60 px-4 py-3">
            <h2 id="demo-title" className="text-[12px] uppercase tracking-[.12em] text-ink-soft">
              Cuentas demo · solo desarrollo
            </h2>
            <ul className="mt-2 space-y-1">
              {DEMO_ACCOUNTS.map((acc) => (
                <li key={acc.email}>
                  <button
                    type="button"
                    onClick={() => fillDemo(acc)}
                    className="w-full min-h-11 text-left rounded-md px-2 py-1.5 hover:bg-sand-2/70 text-[12.5px] flex flex-wrap items-baseline gap-x-2"
                  >
                    <span className="font-medium">{acc.role}</span>
                    <span>{acc.name}</span>
                    <span className="text-ink-soft tnum">
                      {acc.email} · {acc.password}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}
