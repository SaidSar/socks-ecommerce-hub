import { useEffect, useState } from 'react'
import { EYEBROW } from '../checkout/CheckoutLayout'
import { carrierLabel, trackingUrl } from '../../domain/tracking'
import { formatDateTime } from '../../utils/orderDates'

const COPY_RESET_MS = 2500
const LINK = 'inline-flex min-h-11 items-center gap-2 font-serif text-[16px] italic underline decoration-ink/25 underline-offset-4 hover:text-laca'

/** Número de guía con botón para copiarlo; el resultado se anuncia en una región aria-live. */
function TrackingNumber({ value }) {
  const [copy, setCopy] = useState('idle') // 'idle' | 'copied' | 'failed'

  useEffect(() => {
    if (copy === 'idle') return
    const timer = setTimeout(() => setCopy('idle'), COPY_RESET_MS)
    return () => clearTimeout(timer)
  }, [copy])

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopy('copied')
    } catch {
      setCopy('failed')
    }
  }

  return (
    <div>
      <dt className="text-[11.5px] text-ink-soft">Número de guía</dt>
      <dd className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="tnum font-serif text-[clamp(22px,4vw,28px)] leading-tight select-all">{value}</span>
        <button
          type="button"
          onClick={onCopy}
          className="min-h-11 border border-ink/30 px-4 text-[11px] tracking-[.2em] uppercase transition-colors hover:border-ink hover:bg-ink hover:text-linen"
        >
          Copiar<span className="sr-only"> número de guía</span>
        </button>
        <span role="status" aria-live="polite" className="text-[12.5px] text-matcha">
          {copy === 'copied' && 'Guía copiada.'}
          {copy === 'failed' && <span className="text-laca">No se pudo copiar; selecciónela a mano.</span>}
        </span>
      </dd>
    </div>
  )
}

/** Tarjeta "Envío" del detalle: paquetería con guía, repartidor local o aviso de que aún no sale. */
export default function ShipmentCard({ order }) {
  const { shipment, deliveryMethod } = order
  if (!shipment && order.status === 'cancelado') return null
  const isLocal = deliveryMethod === 'local'
  const url = shipment && !isLocal ? trackingUrl(shipment.carrier, shipment.trackingNumber) : null

  return (
    <section aria-labelledby="envio-t" className="border border-ink/10 bg-sand/50 p-5 md:p-6">
      <h3 id="envio-t" className={EYEBROW}>
        Envío
      </h3>

      {!shipment && (
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
          {isLocal
            ? 'Entrega local en Los Mochis. Le avisaremos por correo cuando su pedido salga a ruta.'
            : 'Le enviaremos la guía por correo cuando su pedido salga del atelier.'}
        </p>
      )}

      {shipment && isLocal && (
        <>
          <dl className="mt-4">
            <dt className="text-[11.5px] text-ink-soft">Repartidor</dt>
            <dd className="mt-1 font-serif text-[22px] leading-tight">{shipment.courierName}</dd>
          </dl>
          <p className="mt-3 text-[14px] text-ink-soft">Entrega local en Los Mochis.</p>
        </>
      )}

      {shipment && !isLocal && (
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="text-[11.5px] text-ink-soft">Paquetería</dt>
            <dd className="mt-1 text-[15px]">{carrierLabel(shipment.carrier)}</dd>
          </div>
          {shipment.trackingNumber && <TrackingNumber value={shipment.trackingNumber} />}
        </dl>
      )}

      {shipment && (
        <p className="tnum mt-4 text-[12.5px] text-ink-soft">
          {shipment.deliveredAt ? `Entregado el ${formatDateTime(shipment.deliveredAt)}.` : `Salió el ${formatDateTime(shipment.shippedAt)}.`}
        </p>
      )}

      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className={`mt-3 ${LINK}`}>
          Rastrear en la paquetería
          <span aria-hidden="true">↗</span>
          <span className="sr-only"> (se abre en una pestaña nueva)</span>
        </a>
      )}
    </section>
  )
}
