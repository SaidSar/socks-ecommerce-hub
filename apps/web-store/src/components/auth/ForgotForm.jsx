import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useShake } from '../../hooks/useShake'
import { MESSAGES, emailError } from '../../utils/authValidation'
import AuthField, { AuthSubmit } from './AuthField'

/**
 * Restablecer contraseña (DESIGN_AUTH.md §4.4). La confirmación es idéntica exista o no la cuenta.
 */
export default function ForgotForm() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [shaking, shake] = useShake()
  const inputRef = useRef(null)
  const statusRef = useRef(null)

  useEffect(() => {
    if (sent) statusRef.current?.focus()
    else inputRef.current?.focus()
  }, [sent])

  const submit = async (e) => {
    e.preventDefault()
    if (loading) return
    const message = emailError(email)
    if (message) {
      setError(message)
      shake()
      inputRef.current?.focus()
      return
    }
    setLoading(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch {
      // Un fallo de red o el límite de intentos no se confunden con la confirmación.
      setError(MESSAGES.network)
      shake()
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="animate-fade" role="status">
        <p className="font-jp text-[44px] leading-none text-ink/20" aria-hidden="true">
          便
        </p>
        <h2 ref={statusRef} tabIndex={-1} className="mt-4 font-serif text-[28px] leading-tight outline-none">
          Revise su correo
        </h2>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
          Si <span className="text-ink">{email.trim()}</span> tiene una cuenta, le enviamos un enlace para crear una
          contraseña nueva. El enlace dura 30 minutos.
        </p>
        <p className="mt-3 text-[13px] text-ink-soft">
          ¿No llegó? Revise la carpeta de correo no deseado o espere un minuto antes de pedir otro.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-6">
          <Link
            to="/cuenta"
            className="inline-flex h-12 items-center border border-ink px-8 text-[12px] tracking-[.26em] uppercase transition-colors hover:bg-ink hover:text-linen"
          >
            Volver a iniciar sesión
          </Link>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="min-h-11 font-serif text-[16px] text-ink-soft italic underline decoration-ink/25 underline-offset-4 hover:text-ink"
          >
            Usar otro correo
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className={`animate-fade flex flex-col gap-7 ${shaking ? 'animate-shake' : ''}`}>
      <p className="-mt-2 text-[14.5px] leading-relaxed text-ink-soft">
        Escriba el correo de su cuenta y le enviaremos un enlace para crear una contraseña nueva.
      </p>
      <AuthField
        id="forgot-email"
        inputRef={inputRef}
        label="Correo electrónico"
        type="email"
        value={email}
        onChange={(v) => {
          setEmail(v)
          setError('')
        }}
        onBlur={() => email && setError(emailError(email) ?? '')}
        error={error}
        autoComplete="email"
        placeholder="nombre@dominio.com"
      />
      <AuthSubmit loading={loading} loadingText="Enviando…">
        Enviar enlace
      </AuthSubmit>
      <Link
        to="/cuenta"
        className="inline-flex min-h-11 items-center self-center font-serif text-[16px] text-ink-soft italic hover:text-ink"
      >
        ← Volver a iniciar sesión
      </Link>
    </form>
  )
}
