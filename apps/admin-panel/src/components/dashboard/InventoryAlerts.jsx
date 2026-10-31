import { Link } from 'react-router-dom'
import Card from '../ui/Card'
import CardHead from '../ui/CardHead'
import StockChip from '../ui/StockChip'

/** SKU con pocas unidades o agotados (los 6 más urgentes). */
export default function InventoryAlerts({ alerts, few }) {
  return (
    <Card className="min-w-0" aria-labelledby="alerts-title">
      <CardHead
        id="alerts-title"
        title="Alertas de inventario"
        sub={`${alerts.length} SKU con ${few} unidades o menos`}
        right={
          <Link to="/inventario?f=alertas" className="inline-flex items-center h-8 max-lg:h-11 px-3 rounded-md hover:bg-sand text-[12.5px] font-medium">
            Ver todo
          </Link>
        }
      />
      {alerts.length ? (
        <ul className="border-t border-line divide-y divide-line">
          {alerts.slice(0, 6).map((a) => (
            <li key={a.sku} className="px-5 py-2.5 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full border border-line shrink-0" style={{ background: a.toneHex }} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] truncate">
                  {a.piece} · {a.toneName.split(' ').at(-1)} · {a.size}
                </span>
                <span className="block text-[11.5px] text-ink-soft tnum">{a.sku}</span>
              </span>
              <span className="text-[13px] tnum font-medium w-6 text-right">
                {a.available}
                <span className="sr-only"> disponibles</span>
              </span>
              <StockChip state={a.available <= 0 ? 'agotado' : 'pocos'} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-8 border-t border-line text-[13px] text-ink-soft">Sin alertas: todos los SKU tienen más de {few} unidades.</p>
      )}
    </Card>
  )
}
