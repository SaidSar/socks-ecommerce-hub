import { EYEBROW, TotalsRow } from '../checkout/CheckoutLayout'
import { deliveryLabel, orderStatusLabel } from '../../domain/checkout'
import { formatMXN } from '../../utils/currency'
import { formatDate } from '../../utils/orderDates'
import ShipmentCard from './ShipmentCard'
import Timeline from './Timeline'

/** Detalle de un pedido: el mismo para Mis pedidos (con sesión) y para el rastreo de invitado. El folio es un h2. */
export default function OrderDetail({ order }) {
  return (
    <article aria-labelledby={`pedido-${order.folio}`} className="animate-fade">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-ink/10 pb-5">
        <div>
          <p className={EYEBROW}>Pedido</p>
          <h2 id={`pedido-${order.folio}`} className="tnum mt-1 font-serif text-[clamp(28px,3.4vw,38px)] leading-none font-normal">
            {order.folio}
          </h2>
        </div>
        <div className="text-right text-[13.5px]">
          <p className={order.status === 'cancelado' ? 'text-laca' : 'text-ink'}>{orderStatusLabel(order)}</p>
          <p className="mt-0.5 text-ink-soft">Comprado el {formatDate(order.createdAt)}</p>
        </div>
      </header>

      <div className="grid gap-10 pt-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14">
        <div className="flex flex-col gap-8">
          <ShipmentCard order={order} />
          <section aria-labelledby="historial-t">
            <h3 id="historial-t" className={`${EYEBROW} mb-5`}>
              Seguimiento
            </h3>
            <Timeline steps={order.timeline} />
          </section>
        </div>

        <div>
          <h3 className={EYEBROW}>Piezas</h3>
          <ul className="mt-3 divide-y divide-ink/10 border-y border-ink/10" aria-label="Piezas del pedido">
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
            {order.discountAmount > 0 && (
              <div className="flex justify-between gap-4 text-matcha">
                <dt>Descuento{order.couponCode ? ` (${order.couponCode})` : ''}</dt>
                <dd>−{formatMXN(order.discountAmount, 2)}</dd>
              </div>
            )}
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

          <div className="mt-8 space-y-1 text-[13.5px] leading-relaxed text-ink-soft">
            <h3 className={`${EYEBROW} mb-2`}>Entregar a</h3>
            <p className="text-ink">
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
        </div>
      </div>
    </article>
  )
}
