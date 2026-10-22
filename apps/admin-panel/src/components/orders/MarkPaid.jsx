import { useState } from 'react'
import { label, PAYMENT_METHOD_LABELS } from '../../domain/enums'
import { isPaymentPending } from '../../domain/orders'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import Button from '../ui/Button'
import Icon from '../ui/Icon'

/**
 * "Marcar como pagado" con confirmación en línea (solo Dueño). Registra el pago ahora y desbloquea el avance.
 * TODO(api): en producción lo confirma el webhook de la pasarela; este botón es el respaldo manual.
 */
export default function MarkPaid({ order, onMarkPaid }) {
  const { can } = useAdminAuth()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!can('payments.confirm') || !isPaymentPending(order) || order.status === 'cancelado') return null

  const doMark = async () => {
    setBusy(true)
    setError('')
    try {
      await onMarkPaid()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return !confirm ? (
    <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
      <Icon name="check" className="w-4 h-4" />
      Marcar como pagado
    </Button>
  ) : (
    <div className="rounded-lg bg-ok-bg p-4 animate-fade" role="alert">
      <p className="text-[13px] font-medium">¿Confirmar el pago de {order.id}?</p>
      <p className="text-[12.5px] mt-1">
        Se registra el pago por {label(PAYMENT_METHOD_LABELS, order.pay)} con la fecha de ahora y el pedido podrá pasar a preparación. Hágalo solo
        si ya vio la confirmación de OXXO.
      </p>
      {error && <p className="text-[12px] text-laca mt-2">{error}</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" variant="dark" onClick={doMark} disabled={busy}>
          {busy ? 'Guardando…' : 'Sí, marcar como pagado'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setConfirm(false)} disabled={busy}>
          No, todavía no
        </Button>
      </div>
    </div>
  )
}
