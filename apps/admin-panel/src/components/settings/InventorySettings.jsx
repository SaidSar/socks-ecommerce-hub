import Card from '../ui/Card'
import CardHead from '../ui/CardHead'
import MoneyField from './MoneyField'

export default function InventorySettings({ value, onChange, error }) {
  return (
    <Card aria-labelledby="invcfg-title">
      <CardHead id="invcfg-title" title="Inventario" />
      <div className="px-5 pb-5 max-w-xs">
        <MoneyField label="Alerta de pocos pares" value={value} onChange={onChange} suffix="pares" error={error} />
        <p className="text-[12px] text-ink-soft mt-1">Con esta cantidad o menos, la tienda muestra “Pocos ejemplares” y el panel lo alerta.</p>
      </div>
    </Card>
  )
}
