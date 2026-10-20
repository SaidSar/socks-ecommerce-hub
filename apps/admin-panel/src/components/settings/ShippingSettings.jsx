import { computeShipping, parseZone } from '../../domain/shipping'
import { formatMXN } from '../../utils/format'
import Card from '../ui/Card'
import CardHead from '../ui/CardHead'
import MoneyField from './MoneyField'

const toNum = (v) => (v === '' ? 0 : Number(v))

/** Tarifas de envío. El texto de ejemplo sale de computeShipping con los valores del formulario. */
export default function ShippingSettings({ draft, set, errors }) {
  const settings = {
    freeShippingThreshold: toNum(draft.freeShippingThreshold),
    parcelShippingCost: toNum(draft.parcelShippingCost),
    localShippingCost: toNum(draft.localShippingCost),
    localFreeShipping: draft.localFreeShipping,
    localZones: draft.localZones,
  }
  const below = Math.max(0, settings.freeShippingThreshold - 1)
  const firstZone = parseZone(draft.localZones[0]?.value)
  const localCp = firstZone ? String(firstZone.from).padStart(5, '0') : null
  const local = localCp ? computeShipping({ subtotal: below, postalCode: localCp }, settings) : { cost: settings.localShippingCost }
  const national = computeShipping({ subtotal: below, postalCode: '06700' }, settings)

  return (
    <Card aria-labelledby="ship-title">
      <CardHead id="ship-title" title="Envíos" sub="Se aplican en el carrito y el checkout de la tienda" />
      <div className="px-5 pb-5 grid sm:grid-cols-3 gap-4">
        <MoneyField label="Envío gratis desde" value={draft.freeShippingThreshold} onChange={set('freeShippingThreshold')} error={errors.freeShippingThreshold} />
        <MoneyField label="Paquetería nacional" value={draft.parcelShippingCost} onChange={set('parcelShippingCost')} error={errors.parcelShippingCost} />
        <MoneyField label="Entrega local" value={draft.localShippingCost} onChange={set('localShippingCost')} error={errors.localShippingCost} />
        <label htmlFor="cfg-localfree" className="sm:col-span-3 flex items-start gap-3 text-[13px] min-h-11 lg:min-h-0">
          <input
            id="cfg-localfree"
            type="checkbox"
            checked={draft.localFreeShipping}
            onChange={(e) => set('localFreeShipping')(e.target.checked)}
            className="mt-0.5 w-4 h-4 max-lg:w-5 max-lg:h-5 accent-ai shrink-0"
          />
          <span>
            La entrega local también es gratis desde {formatMXN(settings.freeShippingThreshold)}
            <span className="block text-[12px] text-ink-soft">
              Abajo del umbral, el cliente local paga {formatMXN(local.cost)}; el resto del país, {formatMXN(national.cost)}.
            </span>
          </span>
        </label>
      </div>
    </Card>
  )
}
