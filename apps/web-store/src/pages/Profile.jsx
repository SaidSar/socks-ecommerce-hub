import { useState } from 'react'
import { Link } from 'react-router-dom'
import AccountLayout from '../components/account/AccountLayout'
import AuthField, { AuthCheckbox, AuthSubmit } from '../components/auth/AuthField'
import PasswordField from '../components/auth/PasswordField'
import PasswordStrength from '../components/auth/PasswordStrength'
import SizePicker from '../components/auth/SizePicker'
import { PROFILE_MESSAGES } from '../domain/account'
import { useAuth } from '../hooks/useAuth'
import { AuthError } from '../services/authService'
import { MESSAGES, passwordStrength } from '../utils/authValidation'

const SECTION = 'border-t border-ink/10 pt-8'
const H2 = 'font-serif text-[26px] leading-tight font-light'

const focusFirst = (errors, ids) => {
  const first = Object.keys(ids).find((k) => errors[k])
  if (first) document.getElementById(ids[first])?.focus()
}

/** Resultado del envío en una región aria-live: "Guardando…", éxito o error. Siempre montada para que se anuncie. */
function FormStatus({ state, message }) {
  return (
    <p role="status" aria-live="polite" className={`min-h-5 text-[13.5px] ${state === 'error' ? 'text-laca' : 'text-matcha'}`}>
      {state === 'saving' && <span className="text-ink-soft">Guardando…</span>}
      {(state === 'saved' || state === 'error') && message}
    </p>
  )
}

const PROFILE_IDS = { first: 'profile-first', last: 'profile-last' }

function ProfileForm() {
  const { user, updateProfile } = useAuth()
  const [f, setF] = useState({ first: user.firstName, last: user.lastName, size: user.preferredSize ?? '', news: Boolean(user.marketingOptIn) })
  const [errors, setErrors] = useState({})
  const [result, setResult] = useState({ state: 'idle', message: '' })

  const set = (key) => (value) => {
    setF((x) => ({ ...x, [key]: value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
    if (result.state !== 'saving') setResult({ state: 'idle', message: '' })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (result.state === 'saving') return
    const next = { first: f.first.trim() ? undefined : MESSAGES.firstName, last: f.last.trim() ? undefined : MESSAGES.lastName }
    if (Object.values(next).some(Boolean)) {
      setErrors(next)
      focusFirst(next, PROFILE_IDS)
      return
    }
    setResult({ state: 'saving', message: '' })
    try {
      await updateProfile({ firstName: f.first, lastName: f.last, preferredSize: f.size || null, marketingOptIn: f.news })
      setResult({ state: 'saved', message: PROFILE_MESSAGES.saved })
    } catch {
      setResult({ state: 'error', message: MESSAGES.network })
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="datos-t" className="flex flex-col gap-7">
      <h2 id="datos-t" className={H2}>
        Datos personales
      </h2>
      <div className="grid gap-7 sm:grid-cols-2">
        <AuthField id={PROFILE_IDS.first} label="Nombre" value={f.first} onChange={set('first')} error={errors.first} autoComplete="given-name" />
        <AuthField id={PROFILE_IDS.last} label="Apellido" value={f.last} onChange={set('last')} error={errors.last} autoComplete="family-name" />
      </div>

      <div>
        <label htmlFor="profile-email" className="block text-[11px] tracking-[.24em] text-ink-soft uppercase">
          Correo electrónico
        </label>
        <input
          id="profile-email"
          type="email"
          value={user.email}
          readOnly
          aria-describedby="profile-email-hint"
          className="w-full rounded-none border-0 border-b border-dashed border-ink/20 bg-transparent pt-2.5 pb-[9px] text-[16px] text-ink-soft outline-none"
        />
        <p id="profile-email-hint" className="mt-1.5 text-[12px] text-ink-soft">
          Para cambiar su correo,{' '}
          <Link to="/contacto" className="underline decoration-ink/25 underline-offset-2 hover:text-ink">
            escríbanos
          </Link>
          .
        </p>
      </div>

      <SizePicker id="profile-size" value={f.size} onChange={set('size')} />

      <AuthCheckbox id="profile-news" checked={f.news} onChange={set('news')}>
        Quiero enterarme de las ediciones limitadas antes de su lanzamiento. <span className="text-ink-soft">Un correo al mes, como máximo.</span>
      </AuthCheckbox>

      <div className="flex flex-col gap-3">
        <AuthSubmit loading={result.state === 'saving'} loadingText="Guardando…">
          Guardar cambios
        </AuthSubmit>
        <FormStatus {...result} />
      </div>
    </form>
  )
}

const PASSWORD_IDS = { current: 'profile-pw-current', next: 'profile-pw-new', confirm: 'profile-pw-confirm' }
const EMPTY_PASSWORDS = { current: '', next: '', confirm: '' }

function PasswordForm() {
  const { changePassword } = useAuth()
  const [f, setF] = useState(EMPTY_PASSWORDS)
  const [errors, setErrors] = useState({})
  const [result, setResult] = useState({ state: 'idle', message: '' })

  const set = (key) => (value) => {
    setF((x) => ({ ...x, [key]: value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
    if (result.state !== 'saving') setResult({ state: 'idle', message: '' })
  }

  const fail = (next) => {
    setErrors(next)
    focusFirst(next, PASSWORD_IDS)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (result.state === 'saving') return
    const next = {
      current: f.current ? undefined : PROFILE_MESSAGES.currentEmpty,
      next: passwordStrength(f.next).valid ? undefined : MESSAGES.passwordWeak,
      confirm: !f.confirm ? MESSAGES.confirmEmpty : f.confirm !== f.next ? MESSAGES.confirmMismatch : undefined,
    }
    if (Object.values(next).some(Boolean)) {
      fail(next)
      return
    }
    setResult({ state: 'saving', message: '' })
    try {
      await changePassword({ currentPassword: f.current, newPassword: f.next })
      setF(EMPTY_PASSWORDS)
      setResult({ state: 'saved', message: PROFILE_MESSAGES.passwordChanged })
    } catch (err) {
      if (err instanceof AuthError && err.code === 'WRONG_PASSWORD') {
        setResult({ state: 'idle', message: '' })
        fail({ current: PROFILE_MESSAGES.currentWrong })
      } else {
        setResult({ state: 'error', message: MESSAGES.network })
      }
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="clave-t" className="flex flex-col gap-7">
      <h2 id="clave-t" className={H2}>
        Cambiar contraseña
      </h2>
      <PasswordField id={PASSWORD_IDS.current} label="Contraseña actual" value={f.current} onChange={set('current')} error={errors.current} autoComplete="current-password" />
      <div>
        <PasswordField id={PASSWORD_IDS.next} label="Contraseña nueva" value={f.next} onChange={set('next')} error={errors.next} autoComplete="new-password" />
        <PasswordStrength password={f.next} />
      </div>
      <PasswordField
        id={PASSWORD_IDS.confirm}
        label="Confirmar contraseña nueva"
        value={f.confirm}
        onChange={set('confirm')}
        error={errors.confirm}
        autoComplete="new-password"
      />
      <div className="flex flex-col gap-3">
        <AuthSubmit loading={result.state === 'saving'} loadingText="Cambiando…">
          Cambiar contraseña
        </AuthSubmit>
        <FormStatus {...result} />
      </div>
    </form>
  )
}

/** Mi perfil (/cuenta/perfil): datos personales y contraseña. La guarda de sesión va en la ruta. */
export default function Profile() {
  return (
    <AccountLayout title="Mi perfil" description="Sus datos, su talla habitual y su contraseña en SOKKO.">
      <div className="grid max-w-5xl gap-14 lg:grid-cols-2 lg:gap-16">
        <ProfileForm />
        <div className={`${SECTION} lg:border-t-0 lg:pt-0`}>
          <PasswordForm />
        </div>
      </div>
    </AccountLayout>
  )
}
