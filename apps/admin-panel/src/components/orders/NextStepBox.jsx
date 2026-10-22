import { useId, useState } from 'react'
import { CARRIER_LABELS, label } from '../../domain/enums'
import { CARRIERS, isPaymentPending, nextLabel, nextStatus, PAYMENT_PENDING_ERROR, validateAdvance } from '../../domain/orders'
import Button from '../ui/Button'
import Icon from '../ui/Icon'

/**
 * Siguiente paso del pedido (DESIGN_ADMIN.md §5.1): paquetería + guía para enviar, repartidor para salir a ruta.
 * `onAdvance(payload)` llama a la API; los errores de validación se muestran junto al campo.
 */
export default function NextStepBox({ order, couriers, onAdvance }) {
  const [carrier, setCarrier] = useState(order.carrier || CARRIERS[0])
  const [courier, setCourier] = useState(order.courier || couriers[0] || '')
  const [tracking, setTracking] = useState(order.tracking || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [packing, setPacking] = useState(false)
  const ids = { courier: useId(), carrier: useId(), tracking: useId(), err: useId(), pay: useId() }

  if (!nextStatus(order)) return null
  const isLocal = order.delivery === 'local'
  const needsShipping = order.status === 'preparando'
  const trackingError = needsShipping && !isLocal && error
  // Sin pago confirmado el pedido no avanza (CK_Orders_PaymentBeforeFulfillment); solo se puede cancelar.
  const unpaid = isPaymentPending(order)

  const advance = async () => {
    const payload = isLocal ? { courier } : { carrier, tracking }
    const err = validateAdvance(order, payload)
    if (err) {
      setError(err)
      if (!isLocal) document.getElementById(ids.tracking)?.focus()
      return
    }
    setBusy(true)
    setError('')
    try {
      await onAdvance(payload)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg bg-linen border border-line p-4 space-y-3">
      <h3 className="text-[12.5px] text-ink-soft font-normal">Siguiente paso</h3>

      {needsShipping && isLocal && (
        <div>
          <label htmlFor={ids.courier} className="text-[12px] text-ink-soft">
            Repartidor
          </label>
          <select
            id={ids.courier}
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
            className="mt-1 h-10 max-lg:h-11 w-full rounded-md border border-line bg-paper px-2 text-[13px]"
          >
            {couriers.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      )}

      {needsShipping && !isLocal && (
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <label htmlFor={ids.carrier} className="sr-only">
            Paquetería
          </label>
          <select
            id={ids.carrier}
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="h-10 max-lg:h-11 rounded-md border border-line bg-paper px-2 text-[13px]"
          >
            {CARRIERS.map((c) => (
              <option key={c} value={c}>
                {label(CARRIER_LABELS, c)}
              </option>
            ))}
          </select>
          <div>
            <label htmlFor={ids.tracking} className="sr-only">
              Número de guía
            </label>
            <input
              id={ids.tracking}
              inputMode="numeric"
              autoComplete="off"
              value={tracking}
              onChange={(e) => {
                setTracking(e.target.value)
                setError('')
              }}
              placeholder="Número de guía"
              aria-invalid={Boolean(trackingError)}
              aria-describedby={trackingError ? ids.err : undefined}
              className={`h-10 max-lg:h-11 w-full rounded-md border bg-paper px-3 text-[13px] tnum outline-none focus:border-ai placeholder:text-ink-soft ${trackingError ? 'border-laca' : 'border-line'}`}
            />
          </div>
        </div>
      )}

      {error && (
        <p id={ids.err} className="text-[12px] text-laca" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={advance} disabled={busy || unpaid} aria-busy={busy} aria-describedby={unpaid ? ids.pay : undefined}>
          <Icon name="check" className="w-4 h-4" />
          {busy ? 'Guardando…' : nextLabel(order)}
        </Button>
        {order.status === 'por_preparar' && (
          // TODO(api): PDF de la lista de empaque (GET /api/admin/orders/{folio}/packing-list).
          <Button variant="outline" onClick={() => setPacking(true)} aria-describedby={packing ? `${ids.err}-pack` : undefined}>
            <Icon name="box" className="w-4 h-4" />
            Lista de empaque
          </Button>
        )}
      </div>
      {packing && (
        <p id={`${ids.err}-pack`} role="status" className="text-[12px] text-ink-soft">
          Disponible al conectar la API.
        </p>
      )}

      {unpaid && (
        <p id={ids.pay} className="text-[12px] text-warn-ink flex items-start gap-1.5">
          <Icon name="alert" className="w-4 h-4 shrink-0" />
          {PAYMENT_PENDING_ERROR}
        </p>
      )}
    </div>
  )
}
