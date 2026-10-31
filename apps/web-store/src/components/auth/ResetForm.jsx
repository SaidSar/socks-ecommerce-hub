import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useShake } from '../../hooks/useShake'
import { AuthError } from '../../services/authService'
import { MESSAGES, passwordStrength } from '../../utils/authValidation'
import { AuthAlert, AuthSubmit } from './AuthField'
import PasswordField from './PasswordField'
import PasswordStrength from './PasswordStrength'

const INVALID_LINK = 'Este enlace ya no es válido. Pida uno nuevo.'
const LINK_CLASS =
  'inline-flex h-12 items-center border border-ink px-8 text-[12px] tracking-[.26em] uppercase transition-colors hover:bg-ink hover:text-linen'

/** Contraseña nueva desde el enlace del correo (/cuenta/restablecer?token=…, DESIGN_AUTH.md §8). */
export default function ResetForm() {
  const { resetPassword } = useAuth()
  const [params] = useSearchParams()
  const token = params.get('token')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(token ? '' : INVALID_LINK)
  const [linkInvalid, setLinkInvalid] = useState(!token)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [shaking, shake] = useShake()
  const statusRef = useRef(null)

  useEffect(() => {
    if (done) statusRef.current?.focus()
  }, [done])

  const submit = async (e) => {
    e.preventDefault()
    if (loading) return
    setFormError('')
    const next = {
      pw: passwordStrength(pw).valid ? undefined : MESSAGES.passwordWeak,
      pw2: !pw2 ? MESSAGES.confirmEmpty : pw2 !== pw ? MESSAGES.confirmMismatch : undefined,
    }
    setErrors(next)
    if (next.pw || next.pw2) {
      shake()
      document.getElementById(next.pw ? 'reset-pw' : 'reset-pw2')?.focus()
      return
    }

    setLoading(true)
    try {
      await resetPassword({ token, newPassword: pw })
      setDone(true)
    } catch (err) {
      const invalid = err instanceof AuthError
      setLinkInvalid(invalid)
      setFormError(invalid ? INVALID_LINK : MESSAGES.network)
      shake()
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="animate-fade" role="status">
        <h2 ref={statusRef} tabIndex={-1} className="font-serif text-[28px] leading-tight outline-none">
          Contraseña actualizada
        </h2>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">Ya puede iniciar sesión con su contraseña nueva.</p>
        <div className="mt-8">
          <Link to="/cuenta" className={LINK_CLASS}>
            Iniciar sesión
          </Link>
        </div>
      </div>
    )
  }

  if (linkInvalid) {
    return (
      <div className="animate-fade flex flex-col gap-7">
        <AuthAlert>{formError}</AuthAlert>
        <div>
          <Link to="/cuenta/recuperar" className={LINK_CLASS}>
            Pedir un enlace nuevo
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className={`animate-fade flex flex-col gap-7 ${shaking ? 'animate-shake' : ''}`}>
      {formError && <AuthAlert>{formError}</AuthAlert>}
      <div className="flex flex-col gap-3">
        <PasswordField
          id="reset-pw"
          label="Contraseña nueva"
          value={pw}
          onChange={(v) => {
            setPw(v)
            setErrors((x) => ({ ...x, pw: undefined }))
          }}
          error={errors.pw}
          autoComplete="new-password"
        />
        <PasswordStrength password={pw} />
      </div>
      <PasswordField
        id="reset-pw2"
        label="Confirmar contraseña"
        value={pw2}
        onChange={(v) => {
          setPw2(v)
          setErrors((x) => ({ ...x, pw2: undefined }))
        }}
        error={errors.pw2}
        autoComplete="new-password"
      />
      <AuthSubmit loading={loading} loadingText="Guardando…">
        Guardar contraseña
      </AuthSubmit>
    </form>
  )
}
