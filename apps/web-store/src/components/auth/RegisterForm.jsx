import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SIZES } from '../../data/catalog.mock'
import { useAuth } from '../../hooks/useAuth'
import { useShake } from '../../hooks/useShake'
import { AuthError } from '../../services/authService'
import { MESSAGES, emailError, passwordStrength, reviewCount } from '../../utils/authValidation'
import AuthField, { AuthAlert, AuthCheckbox, AuthSubmit } from './AuthField'
import PasswordField from './PasswordField'
import PasswordStrength from './PasswordStrength'

// Orden de foco ante errores = orden visual del formulario.
const FIELD_ORDER = ['first', 'last', 'email', 'pw', 'pw2', 'terms']
const FIELD_IDS = { first: 'reg-first', last: 'reg-last', email: 'reg-email', pw: 'reg-pw', pw2: 'reg-pw2', terms: 'terms' }

const focusFirstError = (errors) => {
  const first = FIELD_ORDER.find((k) => errors[k])
  if (first) document.getElementById(FIELD_IDS[first])?.focus()
}

/** Crear cuenta (DESIGN_AUTH.md §4.3). Como LoginForm, la navegación posterior la hace la guarda de Account. */
export default function RegisterForm({ onAuthStart, search = '' }) {
  const { register } = useAuth()
  const [f, setF] = useState({ first: '', last: '', email: '', pw: '', pw2: '', size: '', news: true, terms: false })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shaking, shake] = useShake()
  const firstRef = useRef(null)

  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  const set = (key) => (value) => {
    setF((x) => ({ ...x, [key]: value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
  }

  const validate = () => ({
    first: f.first.trim() ? undefined : MESSAGES.firstName,
    last: f.last.trim() ? undefined : MESSAGES.lastName,
    email: emailError(f.email),
    pw: passwordStrength(f.pw).valid ? undefined : MESSAGES.passwordWeak,
    pw2: !f.pw2 ? MESSAGES.confirmEmpty : f.pw2 !== f.pw ? MESSAGES.confirmMismatch : undefined,
    terms: f.terms ? undefined : MESSAGES.terms,
  })

  const fail = (next) => {
    setErrors(next)
    shake()
    focusFirstError(next)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (loading) return
    setFormError('')
    const next = validate()
    if (Object.values(next).some(Boolean)) {
      fail(next)
      return
    }

    setErrors({})
    setLoading(true)
    onAuthStart?.('register')
    try {
      await register({
        firstName: f.first,
        lastName: f.last,
        email: f.email.trim(),
        password: f.pw,
        preferredSize: f.size || null,
        marketingOptIn: f.news,
        acceptedTerms: f.terms,
      })
    } catch (err) {
      setLoading(false)
      if (err instanceof AuthError && err.code === 'EMAIL_TAKEN') fail({ email: MESSAGES.emailTaken })
      else {
        setFormError(MESSAGES.network)
        shake()
      }
    }
  }

  const errorCount = Object.values(errors).filter(Boolean).length

  return (
    <form onSubmit={submit} noValidate className={`flex flex-col gap-7 ${shaking ? 'animate-shake' : ''}`}>
      {formError && <AuthAlert>{formError}</AuthAlert>}
      {!formError && errorCount > 1 && <AuthAlert>{reviewCount(errorCount)}</AuthAlert>}

      <div className="grid gap-7 sm:grid-cols-2">
        <AuthField
          id="reg-first"
          inputRef={firstRef}
          label="Nombre"
          value={f.first}
          onChange={set('first')}
          error={errors.first}
          autoComplete="given-name"
        />
        <AuthField
          id="reg-last"
          label="Apellido"
          value={f.last}
          onChange={set('last')}
          error={errors.last}
          autoComplete="family-name"
        />
      </div>

      <AuthField
        id="reg-email"
        label="Correo electrónico"
        type="email"
        value={f.email}
        onChange={set('email')}
        onBlur={() => f.email && setErrors((x) => ({ ...x, email: emailError(f.email) }))}
        error={errors.email}
        autoComplete="email"
        placeholder="nombre@dominio.com"
        hint="Aquí recibirá la confirmación de sus pedidos."
      />

      <div>
        <PasswordField
          id="reg-pw"
          label="Contraseña"
          value={f.pw}
          onChange={set('pw')}
          error={errors.pw}
          autoComplete="new-password"
        />
        <PasswordStrength password={f.pw} />
      </div>

      <PasswordField
        id="reg-pw2"
        label="Confirmar contraseña"
        value={f.pw2}
        onChange={set('pw2')}
        onBlur={() => f.pw2 && f.pw2 !== f.pw && setErrors((x) => ({ ...x, pw2: MESSAGES.confirmMismatch }))}
        error={errors.pw2}
        autoComplete="new-password"
      />

      <fieldset>
        <legend className="text-[11px] tracking-[.24em] text-ink-soft uppercase">
          Su talla habitual <span className="tracking-normal normal-case">(opcional)</span>
        </legend>
        <p id="reg-size-hint" className="mt-1 text-[12px] text-ink-soft">
          La preseleccionaremos en cada pieza del atelier.
        </p>
        <div
          className="mt-3 grid grid-cols-3 border border-ink/15"
          role="radiogroup"
          aria-label="Talla habitual"
          aria-describedby="reg-size-hint"
        >
          {SIZES.map(({ code, label: cm }, i) => {
            const selected = f.size === code
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => set('size')(selected ? '' : code)}
                className={`flex h-14 flex-col items-center justify-center leading-none transition-colors ${
                  i ? 'border-l border-ink/15' : ''
                } ${selected ? 'bg-ink text-linen' : 'hover:bg-sand'}`}
              >
                <span className="text-[13px] tracking-[.14em]">{code}</span>
                <span className={`tnum mt-1.5 text-[11px] ${selected ? 'text-linen/75' : 'text-ink-soft'}`}>{cm}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-col">
        <AuthCheckbox id="news" checked={f.news} onChange={set('news')}>
          Quiero enterarme de las ediciones limitadas antes de su lanzamiento.{' '}
          <span className="text-ink-soft">Un correo al mes, como máximo.</span>
        </AuthCheckbox>
        <AuthCheckbox id="terms" checked={f.terms} onChange={set('terms')} error={errors.terms}>
          {/* TODO(design): enlaces a rutas legales cuando existan. */}
          Acepto los{' '}
          <a href="#terminos" className="underline decoration-ink/30 underline-offset-2">
            términos y condiciones
          </a>{' '}
          y el{' '}
          <a href="#privacidad" className="underline decoration-ink/30 underline-offset-2">
            aviso de privacidad
          </a>
          .
        </AuthCheckbox>
      </div>

      <AuthSubmit loading={loading} loadingText="Creando su cuenta…">
        Crear mi cuenta
      </AuthSubmit>

      <p className="text-center text-[13.5px] text-ink-soft">
        ¿Ya tiene cuenta?{' '}
        <Link to={{ pathname: '/cuenta', search }} className="inline-flex min-h-11 items-center text-ink underline decoration-laca underline-offset-4">
          Iniciar sesión
        </Link>
      </p>
    </form>
  )
}
