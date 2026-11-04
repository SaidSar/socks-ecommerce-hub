import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AuthField, { AuthAlert, AuthSubmit } from '../components/auth/AuthField'
import PageIntro from '../components/info/PageIntro'
import { BUSINESS_HOURS, STORE_EMAIL } from '../content/legal'
import { CONTACT_MESSAGES, CONTACT_SUBJECTS, EMPTY_CONTACT, MESSAGE_MAX, validateContact } from '../domain/contact'
import { usePageMeta } from '../hooks/usePageMeta'
import { ContactError, sendContactMessage } from '../services/contactService'
import { reviewCount } from '../utils/authValidation'

const LABEL = 'block text-[11px] tracking-[.24em] text-ink-soft uppercase'
const LINE_INPUT =
  'w-full rounded-none border-0 border-b border-ink/25 bg-transparent pt-2.5 pb-[9px] text-[16px] font-normal text-ink outline-none transition-colors focus:border-ink aria-invalid:border-laca'

function FieldError({ id, children }) {
  if (!children) return null
  return (
    <p id={id} className="animate-fade mt-1.5 text-[12.5px] text-laca">
      {children}
    </p>
  )
}

/** Confirmación tras el envío: sello rotado 届. */
function Sent({ onAgain }) {
  return (
    <div role="status" className="flex flex-col items-start gap-6 py-6">
      <span
        aria-hidden="true"
        lang="ja"
        className="animate-stamp flex h-20 w-20 items-center justify-center border-2 border-laca font-jp text-[38px] leading-none text-laca"
      >
        届
      </span>
      <div>
        <h2 className="font-serif text-[34px] leading-tight font-light">Mensaje recibido</h2>
        <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-ink-soft">
          Gracias por escribirnos. Le responderemos a su correo en un día hábil.
        </p>
      </div>
      <button type="button" onClick={onAgain} className="min-h-11 text-[13px] underline decoration-ink/25 underline-offset-4 hover:text-laca">
        Enviar otro mensaje
      </button>
    </div>
  )
}

export function ContactForm() {
  const [values, setValues] = useState(EMPTY_CONTACT)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | sending | sent
  const [alert, setAlert] = useState(null)
  const formRef = useRef(null)

  const set = (field) => (value) => {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const focusFirstInvalid = () => setTimeout(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus(), 0)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (status === 'sending') return
    const found = validateContact(values)
    setErrors(found)
    const count = Object.keys(found).length
    if (count > 0) {
      setAlert(count > 1 ? reviewCount(count) : null)
      focusFirstInvalid()
      return
    }
    setAlert(null)
    setStatus('sending')
    try {
      await sendContactMessage(values)
      setStatus('sent')
      setValues(EMPTY_CONTACT)
    } catch (error) {
      setStatus('idle')
      if (error instanceof ContactError && error.code === 'VALIDATION' && Object.keys(error.fieldErrors).length > 0) {
        setErrors(error.fieldErrors)
        focusFirstInvalid()
      } else {
        setAlert(error instanceof ContactError && error.code === 'RATE_LIMITED' ? CONTACT_MESSAGES.rateLimited : CONTACT_MESSAGES.network)
      }
    }
  }

  if (status === 'sent') return <Sent onAgain={() => setStatus('idle')} />

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} aria-label="Formulario de contacto" className="space-y-7">
      {alert && <AuthAlert>{alert}</AuthAlert>}

      <AuthField id="contact-name" label="Nombre" value={values.name} onChange={set('name')} error={errors.name} autoComplete="name" />
      <AuthField id="contact-email" label="Correo electrónico" type="email" value={values.email} onChange={set('email')} error={errors.email} autoComplete="email" />

      <div>
        <label htmlFor="contact-subject" className={LABEL}>
          Asunto
        </label>
        <select
          id="contact-subject"
          value={values.subject}
          onChange={(e) => set('subject')(e.target.value)}
          aria-invalid={errors.subject ? 'true' : 'false'}
          aria-describedby={errors.subject ? 'contact-subject-err' : undefined}
          className={`${LINE_INPUT} appearance-none`}
        >
          <option value="">Elija un asunto</option>
          {CONTACT_SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <FieldError id="contact-subject-err">{errors.subject}</FieldError>
      </div>

      <div>
        <label htmlFor="contact-message" className={LABEL}>
          Mensaje
        </label>
        <textarea
          id="contact-message"
          rows={5}
          maxLength={MESSAGE_MAX}
          value={values.message}
          onChange={(e) => set('message')(e.target.value)}
          aria-invalid={errors.message ? 'true' : 'false'}
          aria-describedby={errors.message ? 'contact-message-err' : undefined}
          className={`${LINE_INPUT} resize-y`}
        />
        <FieldError id="contact-message-err">{errors.message}</FieldError>
      </div>

      {/* Honeypot: invisible para personas; si un bot lo llena, la API descarta el mensaje. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Sitio web</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => set('website')(e.target.value)} />
      </div>

      <AuthSubmit loading={status === 'sending'} loadingText="Enviando…">
        Enviar mensaje
      </AuthSubmit>
      <p className="text-[12px] leading-relaxed text-ink-soft">
        Usamos sus datos solo para responderle, como explica nuestro{' '}
        <Link to="/privacidad" className="underline decoration-ink/25 underline-offset-4 hover:text-laca">
          aviso de privacidad
        </Link>
        .
      </p>
    </form>
  )
}

/** Contacto: datos de atención y formulario (mockup aprobado). */
export default function Contact() {
  usePageMeta('Contacto', `Escriba a SOKKO: ${STORE_EMAIL}, ${BUSINESS_HOURS.toLowerCase()}, o use el formulario de contacto.`)

  return (
    <main className="gutter mx-auto max-w-7xl py-14 md:py-20">
      <PageIntro eyebrow="Contacto" jp="お問い合わせ" title="Hablemos">
        <p>Una duda sobre tallas, un pedido o una colaboración: escríbanos y le responde una persona del taller.</p>
      </PageIntro>

      <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
        <div className="flex flex-col gap-10">
          <dl className="divide-y divide-ink/10 border-y border-ink/10">
            <div className="grid gap-1 py-5 sm:grid-cols-[140px_1fr]">
              <dt className={LABEL}>Correo</dt>
              <dd className="font-serif text-[20px] select-all">{STORE_EMAIL}</dd>
            </div>
            <div className="grid gap-1 py-5 sm:grid-cols-[140px_1fr]">
              <dt className={LABEL}>Horario</dt>
              <dd className="text-[15px] text-ink-soft">{BUSINESS_HOURS}</dd>
            </div>
            <div className="grid gap-1 py-5 sm:grid-cols-[140px_1fr]">
              <dt className={LABEL}>Atelier</dt>
              <dd className="text-[15px] text-ink-soft">Los Mochis, Sinaloa · solo con cita</dd>
            </div>
          </dl>

          <aside className="border border-ink/10 bg-sand p-7">
            <h2 className="font-serif text-[24px] leading-tight font-light">¿Pregunta por un pedido?</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              En Mis pedidos ve el estado, la guía y la referencia OXXO de cada compra hecha con su cuenta.
            </p>
            <Link to="/cuenta/pedidos" className="mt-5 inline-flex min-h-11 items-center text-[12px] tracking-[.24em] uppercase underline decoration-ink/25 underline-offset-[6px] hover:text-laca">
              Ir a Mis pedidos
            </Link>
          </aside>
        </div>

        <div className="relative border border-ink/10 bg-white/55 p-6 md:p-10">
          <ContactForm />
        </div>
      </div>
    </main>
  )
}
