import { formatMXN, formatWeekday } from '../../utils/format'
import Card from '../ui/Card'
import Icon from '../ui/Icon'

function Delta({ value }) {
  if (value == null) return null
  const up = value >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${up ? 'text-matcha' : 'text-laca'}`}>
      <Icon name={up ? 'up' : 'down'} className="w-3.5 h-3.5" />
      <span className="sr-only">{up ? 'Sube' : 'Baja'} </span>
      {up ? '+' : '−'}
      {Math.abs(value).toFixed(1)} %
    </span>
  )
}

/**
 * Fila de KPIs. Sin `showMoney` (Operaciones) solo quedan Pedidos y % con envío gratis.
 * "Hoy" se compara con el mismo día de la semana anterior; 7d/30d con el periodo previo.
 */
export default function KpiRow({ kpis, showMoney, freeShippingThreshold }) {
  const hoy = kpis.range === 'hoy'
  const vsSales = hoy
    ? `vs. ${formatMXN(kpis.sales?.prev ?? 0)} el ${formatWeekday(kpis.compareDate)} pasado`
    : `vs. ${formatMXN(kpis.sales?.prev ?? 0)} periodo anterior`

  const cards = [
    showMoney && { k: hoy ? 'Ventas de hoy' : 'Ventas netas', v: formatMXN(kpis.sales.value), d: kpis.sales.delta, note: vsSales },
    { k: 'Pedidos', v: kpis.orders.value, d: kpis.orders.delta, note: 'pagados, sin cancelados' },
    showMoney && { k: 'Ticket promedio', v: formatMXN(kpis.ticket.value), d: kpis.ticket.delta, note: 'por pedido' },
    { k: 'Con envío gratis', v: `${kpis.freePct.value.toFixed(0)} %`, d: kpis.freePct.delta, note: `alcanzaron ${formatMXN(freeShippingThreshold)} o más` },
  ].filter(Boolean)

  return (
    <div className={`grid gap-3 grid-cols-1 min-[480px]:grid-cols-2 ${cards.length === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-2'}`}>
      {cards.map((c) => (
        <Card key={c.k} className="px-5 py-4">
          <h2 className="text-[12.5px] text-ink-soft font-normal">{c.k}</h2>
          <p className="text-[28px] font-semibold tnum leading-tight mt-1">{c.v}</p>
          <p className="text-[12px] mt-1 flex items-center gap-x-1.5 flex-wrap">
            <Delta value={c.d} />
            <span className="text-ink-soft">{c.note}</span>
          </p>
        </Card>
      ))}
    </div>
  )
}
