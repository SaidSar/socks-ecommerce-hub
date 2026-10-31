import { Link } from 'react-router-dom'
import { orderStatusLabel } from '../../domain/checkout'
import { useAsync } from '../../hooks/useAsync'
import { listMyOrders } from '../../services/orderService'
import { formatMXN } from '../../utils/currency'
import { formatDate } from '../../utils/orderDates'

const BACK = 'inline-flex h-[52px] items-center bg-laca px-9 text-[12px] tracking-[.28em] text-linen uppercase transition-colors hover:bg-laca-hover'

/** Mis pedidos (DESIGN_CHECKOUT.md §5). */
export default function MyOrders() {
  const { status, data: orders, retry } = useAsync(listMyOrders, 'mine')

  if (status === 'error') {
    return (
      <div role="alert">
        <p className="font-serif text-[22px]">No pudimos cargar sus pedidos.</p>
        <button type="button" onClick={retry} className="mt-5 min-h-11 border border-ink px-6 text-[12px] tracking-[.2em] uppercase">
          Reintentar
        </button>
      </div>
    )
  }

  if (status === 'loading' || !orders) {
    return (
      <div aria-busy="true" className="h-40 animate-pulse bg-sand">
        <span className="sr-only">Cargando sus pedidos…</span>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="animate-fade">
        <span aria-hidden="true" className="font-jp text-[56px] text-ink/15">
          空
        </span>
        <p className="mt-2 font-serif text-[24px]">Aún no tiene pedidos</p>
        <p className="mt-1 text-[14px] text-ink-soft">Cuando compre, los verá aquí.</p>
        <Link to="/" className={`mt-8 ${BACK}`}>
          Volver al atelier
        </Link>
      </div>
    )
  }

  return (
    <ul className="animate-fade divide-y divide-ink/10 border-y border-ink/10">
      {orders.map((order) => {
        const pieces = order.items.reduce((sum, i) => sum + i.quantity, 0)
        return (
          <li key={order.folio} className="py-5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="tnum font-serif text-[22px] leading-none">{order.folio}</p>
              <p className="tnum font-serif text-[20px]">{formatMXN(order.total, 2)}</p>
            </div>
            <p className="mt-2 text-[13px] text-ink-soft">
              {formatDate(order.createdAt)} · {pieces} {pieces === 1 ? 'pieza' : 'piezas'}
            </p>
            <div className="mt-1 flex items-center justify-between gap-4">
              <p className="text-[13.5px]">{orderStatusLabel(order)}</p>
              <Link to={`/checkout/confirmacion/${order.folio}`} className="inline-flex min-h-11 items-center text-[13px] underline decoration-ink/25 underline-offset-4">
                Ver detalle
                <span className="sr-only"> de {order.folio}</span>
              </Link>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
