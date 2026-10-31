import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import CheckoutLayout, { EYEBROW, TotalsRow } from '../components/checkout/CheckoutLayout'
import { deliveryLabel, formatReference } from '../domain/checkout'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../hooks/useAuth'
import { getOrder, simulateOxxoPayment } from '../services/orderService'
import { formatMXN } from '../utils/currency'
import { formatDateTime } from '../utils/orderDates'

const PRIMARY = 'inline-flex h-[52px] items-center bg-laca px-9 text-[12px] tracking-[.28em] text-linen uppercase transition-colors hover:bg-laca-hover'
const LINK = 'inline-flex min-h-11 items-center font-serif text-[16px] italic underline decoration-ink/25 underline-offset-4 hover:text-ink'

function modeOf(order) {
  if (order.status === 'cancelado') return 'cancelled'
  return order.paymentStatus === 'pendiente' ? 'pending' : 'paid'
}

const COPY = {
  paid: { stamp: '済', eyebrow: 'Pedido confirmado', title: (name) => <>Gracias, <em className="text-laca italic">{name}</em>.</> },
  pending: { stamp: '待', eyebrow: 'Pedido apartado', title: (name) => <>Falta un paso, <em className="text-laca italic">{name}</em>.</> },
  cancelled: { stamp: '消', eyebrow: 'Pedido cancelado', title: () => 'Este pedido venció.' },
}

function OrderSummary({ order }) {
  return (
    <>
      <p className={EYEBROW}>Su pedido</p>
      <h2 className="mt-2 font-serif text-[30px] leading-tight font-normal">{order.folio}</h2>
      <ul className="mt-5 divide-y divide-ink/10 border-y border-ink/10" aria-label="Piezas del pedido">
        {order.items.map((item) => (
          <li key={item.sku} className="flex items-start justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="text-[14.5px] leading-snug">{item.name}</p>
              <p className="mt-0.5 text-[12px] text-ink-soft">
                {item.color} · {item.size === 'U' ? 'Talla única' : `Talla ${item.size}`} · <span className="tnum">× {item.quantity}</span>
              </p>
            </div>
            <p className="tnum shrink-0 font-serif text-[17px]">{formatMXN(item.lineTotal, 2)}</p>
          </li>
        ))}
      </ul>
      <dl className="tnum mt-5 space-y-2 text-[14px]">
        <TotalsRow label="Subtotal">{formatMXN(order.subtotal, 2)}</TotalsRow>
        <TotalsRow label={deliveryLabel(order.deliveryMethod)}>
          {order.shippingCost === 0 ? <span className="text-matcha">Cortesía</span> : formatMXN(order.shippingCost, 2)}
        </TotalsRow>
        <TotalsRow label={`IVA incluido (${Math.round(order.taxRate * 100)} %)`} muted>
          {formatMXN(order.taxIncluded, 2)}
        </TotalsRow>
        <div className="flex items-baseline justify-between border-t border-ink/15 pt-3">
          <dt className="font-serif text-[20px]">Total</dt>
          <dd className="font-serif text-[26px]">
            {formatMXN(order.total, 2)} <span className="text-[13px] text-ink-soft">MXN</span>
          </dd>
        </div>
      </dl>
      <div className="mt-7 space-y-1 text-[13.5px] leading-relaxed text-ink-soft">
        <p className="text-ink">Entregar a</p>
        <p>
          {order.firstName} {order.lastName} · {order.phone}
        </p>
        <p>
          {order.street}, {order.neighborhood}
        </p>
        <p>
          {order.postalCode} {order.city}, {order.state}
        </p>
        {order.references && <p>{order.references}</p>}
        {order.giftWrap && <p className="pt-2">Envuelto en furoshiki de lino.</p>}
      </div>
    </>
  )
}

/** Confirmación (DESIGN_CHECKOUT.md §4): pagado, referencia OXXO con vencimiento o vencido. */
export default function OrderConfirmation() {
  const { folio } = useParams()
  const { isAuthenticated } = useAuth()
  const { status, data: order, retry } = useAsync(() => getOrder(folio), folio)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState(false)
  const headingRef = useRef(null)
  const ready = status === 'ready' && Boolean(order)

  useEffect(() => {
    if (ready) headingRef.current?.focus()
  }, [ready])

  if (status === 'loading' && !order) {
    return (
      <CheckoutLayout title="Su pedido" aside={null}>
        <div aria-busy="true" className="h-48 animate-pulse bg-sand" />
        <span className="sr-only">Cargando su pedido…</span>
      </CheckoutLayout>
    )
  }

  if (status === 'error') {
    return (
      <CheckoutLayout title="Su pedido" aside={null}>
        <div role="alert" className="py-12">
          <p className="font-serif text-[24px]">No pudimos cargar su pedido.</p>
          <button type="button" onClick={retry} className="mt-5 min-h-11 border border-ink px-6 text-[12px] tracking-[.2em] uppercase">
            Reintentar
          </button>
        </div>
      </CheckoutLayout>
    )
  }

  if (!order) {
    return (
      <CheckoutLayout title="Su pedido" aside={null}>
        <div className="py-12">
          <h1 className="font-serif text-[30px] font-light">No encontramos este pedido.</h1>
          <Link to="/" className={`mt-8 ${PRIMARY}`}>
            Volver al atelier
          </Link>
        </div>
      </CheckoutLayout>
    )
  }

  const mode = modeOf(order)
  const copy = COPY[mode]

  const simulatePayment = async () => {
    setPaying(true)
    setPayError(false)
    try {
      await simulateOxxoPayment(order.folio)
      retry()
    } catch {
      setPayError(true)
    } finally {
      setPaying(false)
    }
  }

  return (
    <CheckoutLayout title={copy.eyebrow} aside={<OrderSummary order={order} />}>
      <div className="relative h-24 w-24" aria-hidden="true">
        <span className="animate-stamp absolute inset-0 flex items-center justify-center border-2 border-laca bg-linen font-jp text-[34px] text-laca">{copy.stamp}</span>
      </div>
      <p className={`mt-8 ${EYEBROW}`}>{copy.eyebrow}</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-3 font-serif text-[clamp(34px,4vw,48px)] leading-[1.05] font-light outline-none">
        {copy.title(order.firstName)}
      </h1>

      <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ink-soft">
        {mode === 'paid' && 'Su pago se registró. Prepararemos su pedido en el atelier.'}
        {mode === 'pending' && `Pague en cualquier OXXO con esta referencia. Sus piezas quedan apartadas hasta el ${formatDateTime(order.oxxoExpiresAt)}.`}
        {mode === 'cancelled' && 'La referencia ya no es válida y las piezas volvieron al atelier.'}
      </p>

      <dl className="mt-8 border-y border-ink/10 py-5">
        <div>
          <dt className="text-[11.5px] text-ink-soft">Folio</dt>
          <dd className="tnum mt-1 font-serif text-[26px] leading-none">{order.folio}</dd>
        </div>
        {mode === 'pending' && (
          <>
            <div className="mt-5">
              <dt className="text-[11.5px] text-ink-soft">Referencia OXXO</dt>
              <dd className="tnum mt-1 font-serif text-[clamp(26px,5vw,36px)] leading-tight select-all">{formatReference(order.paymentReference)}</dd>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[11.5px] text-ink-soft">Total a pagar</dt>
                <dd className="tnum mt-1 font-serif text-[22px]">{formatMXN(order.total, 2)}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] text-ink-soft">Vence</dt>
                <dd className="mt-1 text-[14.5px]">{formatDateTime(order.oxxoExpiresAt)}</dd>
              </div>
            </div>
          </>
        )}
      </dl>
      {mode !== 'cancelled' && <p className="mt-4 text-[13px] text-ink-soft">Guarde su folio para consultar el pedido.</p>}

      {mode === 'pending' && import.meta.env.DEV && (
        <div className="mt-6">
          <button type="button" onClick={simulatePayment} aria-busy={paying ? 'true' : undefined} className="min-h-11 border border-ink px-5 text-[11.5px] tracking-[.2em] uppercase transition-colors hover:bg-ink hover:text-linen">
            Simular pago en OXXO
          </button>
          {payError && <p role="alert" className="mt-2 text-[12.5px] text-laca">No se pudo simular el pago.</p>}
        </div>
      )}

      <div className="mt-9 flex flex-wrap items-center gap-6">
        <Link to="/" className={PRIMARY}>
          Volver al atelier
        </Link>
        {isAuthenticated && (
          <Link to="/cuenta/pedidos" className={LINK}>
            Ver mis pedidos
          </Link>
        )}
      </div>
    </CheckoutLayout>
  )
}
