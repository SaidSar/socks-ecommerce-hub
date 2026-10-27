import { PAYMENT_METHOD_LABELS } from '../../config/enums'
import { useConfig } from '../../hooks/useConfig'
import { formatMXN } from '../../utils/currency'

const LABEL = 'mb-1 block text-[11px] font-normal tracking-[.22em] text-sand-2 uppercase'

/** Banda de envío y pago (DESIGN_CATALOG_UI.md §3.3, punto 7). Montos de GET /api/config. */
export default function ShipBand() {
  const { freeShippingThreshold, localShippingCost } = useConfig()
  return (
    <section aria-label="Envío y pago" className="bg-ink text-linen">
      <div className="gutter mx-auto grid max-w-7xl gap-6 py-8 text-[13px] sm:grid-cols-3">
        <p>
          <span className={LABEL}>Envío gratis</span>
          En compras desde {formatMXN(freeShippingThreshold)}, en cualquier línea.
        </p>
        <p>
          <span className={LABEL}>Entrega local</span>
          Los Mochis y ejidos vecinos por {formatMXN(localShippingCost)}.
        </p>
        <p>
          <span className={LABEL}>Pago</span>
          {Object.values(PAYMENT_METHOD_LABELS).join(' u ')}. IVA incluido.
        </p>
      </div>
    </section>
  )
}
