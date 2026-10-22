import { useState } from 'react'
import { label, PAYMENT_METHOD_LABELS } from '../../domain/enums'
import { canCancel, pairCount } from '../../domain/orders'
import { formatMXN } from '../../utils/format'
import Button from '../ui/Button'

/** Cancelación con confirmación en línea; libera los pares apartados. */
export default function CancelOrder({ order, showMoney, onCancel }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!canCancel(order)) return null
  const pairs = pairCount(order)

  const doCancel = async () => {
    setBusy(true)
    try {
      await onCancel()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <section className="pt-4 border-t border-line">
      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="text-[13px] text-laca hover:underline min-h-11 lg:min-h-0 inline-flex items-center"
        >
          Cancelar pedido
        </button>
      ) : (
        <div className="rounded-lg bg-crit-bg p-4 animate-fade" role="alert">
          <p className="text-[13px] font-medium text-laca">¿Cancelar {order.id}?</p>
          <p className="text-[12.5px] mt-1">
            Se liberan {pairs} {pairs === 1 ? 'par' : 'pares'} al inventario y se inicia el reembolso
            {showMoney && order.total != null ? ` de ${formatMXN(order.total)}` : ''} por {label(PAYMENT_METHOD_LABELS, order.pay)}.
          </p>
          {error && <p className="text-[12px] text-laca mt-2">{error}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" onClick={doCancel} disabled={busy}>
              {busy ? 'Cancelando…' : 'Sí, cancelar pedido'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirm(false)} disabled={busy}>
              No, conservarlo
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
