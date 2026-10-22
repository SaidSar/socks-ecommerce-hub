import { useId, useState } from 'react'
import { CARRIER_LABELS, label, PAYMENT_METHOD_LABELS } from '../../domain/enums'
import { isLate } from '../../domain/orders'
import { useAdminData, useAdminQuery } from '../../hooks/useAdminData'
import { formatDate, formatMXN, formatTime } from '../../utils/format'
import Button from '../ui/Button'
import EmptyState, { Loading } from '../ui/EmptyState'
import Icon from '../ui/Icon'
import SidePanel, { SidePanelHeader } from '../ui/SidePanel'
import StatusChip from '../ui/StatusChip'
import CancelOrder from './CancelOrder'
import NextStepBox from './NextStepBox'
import OrderHistory from './OrderHistory'

function NoteField({ order, onSave }) {
  const [note, setNote] = useState(order.note || '')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const id = useId()
  return (
    <section>
      <label htmlFor={id} className="text-[12px] uppercase tracking-[.12em] text-ink-soft">
        Nota interna
      </label>
      <textarea
        id={id}
        value={note}
        onChange={(e) => {
          setNote(e.target.value)
          setSaved(false)
        }}
        rows="2"
        placeholder="Solo la ve el equipo"
        className="mt-2 w-full rounded-md border border-line bg-paper p-3 text-[13px] outline-none focus:border-ai placeholder:text-ink-soft"
      />
      <div className="flex items-center gap-3 mt-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await onSave(note)
            setBusy(false)
            setSaved(true)
          }}
        >
          Guardar nota
        </Button>
        <span role="status" className="text-[12px] text-matcha">
          {saved ? 'Nota guardada' : ''}
        </span>
      </div>
    </section>
  )
}

function OrderBody({ order, showMoney, now, couriers }) {
  const { api } = useAdminData()
  const isLocal = order.delivery === 'local'
  const shippingText = order.shipping ? formatMXN(order.shipping) : 'gratis'

  return (
    <div className="px-5 py-5 space-y-6">
      {order.status !== 'cancelado' && (
        <NextStepBox
          key={order.status}
          order={order}
          couriers={couriers}
          onAdvance={(payload) => api.advanceOrder(order.id, payload)}
          onMarkPaid={() => api.markOrderPaid(order.id)}
        />
      )}

      <section aria-labelledby="items-title">
        <h3 id="items-title" className="text-[12px] uppercase tracking-[.12em] text-ink-soft mb-2">
          Piezas
        </h3>
        <ul className="divide-y divide-line border-y border-line">
          {order.items.map((it) => (
            <li key={it.sku} className="py-3 flex items-center gap-3">
              <span className="w-9 h-9 rounded-md border border-line shrink-0" style={{ background: it.toneHex }} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{it.name}</span>
                <span className="block text-[12px] text-ink-soft tnum">
                  {it.toneName} · Talla {it.size} · {it.sku}
                </span>
              </span>
              <span className="text-[13px] tnum text-right">
                {it.qty} ×
                {showMoney && it.price != null && (
                  <>
                    <br />
                    <span className="text-ink-soft">{formatMXN(it.price)}</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
        {showMoney && order.total != null && (
          <dl className="mt-3 text-[13px] space-y-1 tnum">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd>{formatMXN(order.subtotal, 2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Envío</dt>
              <dd>{order.shipping ? formatMXN(order.shipping, 2) : 'Gratis'}</dd>
            </div>
            <div className="flex justify-between text-[12px]">
              <dt className="text-ink-soft">IVA incluido (16 %)</dt>
              <dd className="text-ink-soft">{formatMXN(order.total - order.total / 1.16, 2)}</dd>
            </div>
            <div className="flex justify-between pt-1.5 border-t border-line font-semibold text-[14px]">
              <dt>Total · {label(PAYMENT_METHOD_LABELS, order.pay)}</dt>
              <dd>{formatMXN(order.total, 2)}</dd>
            </div>
          </dl>
        )}
        {order.giftWrap && (
          <p className="mt-3 text-[12.5px] flex items-center gap-2 text-matcha">
            <Icon name="check" className="w-4 h-4" />
            Envolver en furoshiki
          </p>
        )}
      </section>

      <section aria-labelledby="customer-title">
        <h3 id="customer-title" className="text-[12px] uppercase tracking-[.12em] text-ink-soft mb-2">
          Cliente y envío
        </h3>
        <p className="text-[13.5px] font-medium">{order.customer.name}</p>
        <p className="text-[13px] text-ink-soft break-all">{order.customer.email}</p>
        <p className="text-[13px] text-ink-soft">
          {order.customer.city} · CP {order.customer.postalCode} · {order.customer.orders} {order.customer.orders === 1 ? 'pedido' : 'pedidos'} en total
        </p>
        <p className="text-[13px] mt-2">{isLocal ? `Entrega local · ${shippingText}` : `Paquetería · ${shippingText}`}</p>
        {order.tracking && (
          <p className="text-[13px] mt-1 tnum">
            {label(CARRIER_LABELS, order.carrier)} · guía <span className="select-all">{order.tracking}</span>
          </p>
        )}
        {order.courier && <p className="text-[13px] mt-1">Repartidor: {order.courier}</p>}
        {!showMoney && order.pay && <p className="text-[13px] mt-1 text-ink-soft">Pago: {label(PAYMENT_METHOD_LABELS, order.pay)}</p>}
      </section>

      <NoteField key={order.id} order={order} onSave={(note) => api.saveOrderNote(order.id, note)} />

      <OrderHistory history={order.history} />

      <CancelOrder key={`${order.id}-${order.status}`} order={order} showMoney={showMoney} onCancel={() => api.cancelOrder(order.id)} />
      {isLate(order, now) && <span className="sr-only">Pedido atrasado</span>}
    </div>
  )
}

/** Detalle del pedido en panel lateral (exactamente como el mockup). */
export default function OrderDetail({ folio, showMoney, now, onClose, returnFocus }) {
  const { api } = useAdminData()
  const { data: order, error } = useAdminQuery(() => api.getOrder(folio), [folio])
  const { data: couriers } = useAdminQuery(() => api.getCouriers(), [])
  const current = order && order.id === folio ? order : null

  return (
    <SidePanel label={`Pedido ${folio}`} onClose={onClose} returnFocus={returnFocus}>
      <SidePanelHeader onClose={onClose} closeLabel="Cerrar detalle">
        {current ? (
          <>
            <p className="text-[12px] text-ink-soft">
              Pedido · {formatDate(current.created)}, {formatTime(current.created)}
            </p>
            <h2 className="text-[20px] font-semibold tnum">{current.id}</h2>
            <div className="mt-1.5">
              <StatusChip status={current.status} late={isLate(current, now)} />
            </div>
          </>
        ) : (
          <h2 className="text-[20px] font-semibold tnum">{folio}</h2>
        )}
      </SidePanelHeader>
      {error && !current && <EmptyState icon="alert" title="No encontramos ese pedido." />}
      {!error && !current && <Loading label="Cargando pedido…" />}
      {current && couriers && <OrderBody order={current} showMoney={showMoney} now={now} couriers={couriers} />}
    </SidePanel>
  )
}
