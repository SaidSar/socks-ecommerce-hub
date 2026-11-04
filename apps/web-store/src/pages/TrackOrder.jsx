import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import OrderDetail from '../components/account/OrderDetail'
import AuthField, { AuthSubmit } from '../components/auth/AuthField'
import PageIntro from '../components/info/PageIntro'
import { TRACK_MESSAGES } from '../domain/account'
import { normalizeFolio } from '../domain/tracking'
import { useAuth } from '../hooks/useAuth'
import { usePageMeta } from '../hooks/usePageMeta'
import { useToast } from '../hooks/useToast'
import { OrderError, trackOrder } from '../services/orderService'
import { emailError } from '../utils/authValidation'

/** Rastrear pedido (/rastreo): el invitado escribe folio y correo y ve el mismo detalle que Mis pedidos. */
export default function TrackOrder() {
  const { isAuthenticated } = useAuth()
  const [f, setF] = useState({ folio: '', email: '' })
  const [errors, setErrors] = useState({})
  const [state, setState] = useState({ status: 'idle', order: null, message: '' })
  const resultRef = useRef(null)
  const toast = useToast()
  usePageMeta('Rastrear pedido', 'Consulte el estado y la guía de su pedido de SOKKO con su folio y su correo.')

  const set = (key) => (value) => {
    setF((x) => ({ ...x, [key]: value }))
    setErrors((x) => ({ ...x, [key]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (state.status === 'loading') return
    const folio = normalizeFolio(f.folio)
    const next = { folio: folio ? undefined : TRACK_MESSAGES.folio, email: emailError(f.email) }
    if (next.folio || next.email) {
      setErrors(next)
      document.getElementById(next.folio ? 'track-folio' : 'track-email')?.focus()
      return
    }
    setState({ status: 'loading', order: null, message: '' })
    try {
      const order = await trackOrder(folio, f.email)
      setState(order ? { status: 'found', order, message: '' } : { status: 'missing', order: null, message: TRACK_MESSAGES.notFound })
      if (order) toast.success(TRACK_MESSAGES.found(order.folio), { key: 'track' })
    } catch (err) {
      const message = err instanceof OrderError && err.code === 'RATE_LIMITED' ? TRACK_MESSAGES.rateLimited : TRACK_MESSAGES.network
      setState({ status: 'error', order: null, message })
    }
    requestAnimationFrame(() => resultRef.current?.focus())
  }

  return (
    <main className="gutter mx-auto max-w-7xl pt-12 pb-20 md:pt-16">
      <PageIntro eyebrow="Ayuda" jp="追跡" title="Rastrear pedido">
        <p>Escriba el folio (SKK-####) que le enviamos por correo y el correo con el que compró.</p>
        {isAuthenticated ? (
          <p className="mt-2">
            Sus pedidos con cuenta están en{' '}
            <Link to="/cuenta/pedidos" className="underline decoration-ink/25 underline-offset-4 hover:text-laca">
              Mis pedidos
            </Link>
            .
          </p>
        ) : (
          <p className="mt-2">
            ¿Compró con cuenta?{' '}
            <Link to="/cuenta?redirect=/cuenta/pedidos" className="underline decoration-ink/25 underline-offset-4 hover:text-laca">
              Inicie sesión
            </Link>{' '}
            para ver sus pedidos.
          </p>
        )}
      </PageIntro>

      <form onSubmit={submit} noValidate aria-label="Rastrear pedido" className="mt-10 grid max-w-3xl items-end gap-7 sm:grid-cols-[1fr_1.4fr_auto]">
        <AuthField id="track-folio" label="Folio" value={f.folio} onChange={set('folio')} error={errors.folio} placeholder="SKK-1050" autoComplete="off" />
        <AuthField
          id="track-email"
          label="Correo electrónico"
          type="email"
          value={f.email}
          onChange={set('email')}
          error={errors.email}
          placeholder="nombre@dominio.com"
          autoComplete="email"
        />
        <div className="sm:w-48">
          <AuthSubmit loading={state.status === 'loading'} loadingText="Buscando…">
            Rastrear
          </AuthSubmit>
        </div>
      </form>

      {/* Tras buscar, el foco pasa aquí: se lee el aviso o el folio encontrado sin anunciar todo el detalle. */}
      <div ref={resultRef} tabIndex={-1} aria-label="Resultado de la búsqueda" className="mt-14 outline-none">
        {/* El hallazgo lo anuncia el aviso flotante; aquí solo la búsqueda en curso. */}
        <p role="status" className="sr-only">
          {state.status === 'loading' && 'Buscando su pedido…'}
        </p>
        {(state.status === 'missing' || state.status === 'error') && (
          <p role="alert" className="max-w-2xl border-l-2 border-laca bg-sand/70 px-4 py-3 text-[14px]">
            {state.message}
          </p>
        )}
        {state.status === 'found' && <OrderDetail order={state.order} />}
      </div>
    </main>
  )
}
