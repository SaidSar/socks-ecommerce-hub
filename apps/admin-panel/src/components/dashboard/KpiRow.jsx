import { formatInt, formatMXN, formatWeekday } from '../../utils/format'
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
 * Fila de KPIs (DESIGN_CATALOG_UI.md §4.2). Dueño: Ventas, Pedidos, Ticket y Margen bruto con costo registrado.
 * Operaciones: Unidades vendidas, Pedidos, Por preparar y Pocas unidades.
 * "Hoy" se compara con el mismo día de la semana anterior; 7d/30d con el periodo previo.
 */
export default function KpiRow({ kpis, showMoney, catalog, queue, few }) {
  const hoy = kpis.range === 'hoy'
  const vsSales = hoy
    ? `vs. ${formatMXN(kpis.sales?.prev ?? 0)} el ${formatWeekday(kpis.compareDate)} pasado`
    : `vs. ${formatMXN(kpis.sales?.prev ?? 0)} periodo anterior`

  const orders = { k: 'Pedidos', v: kpis.orders.value, d: kpis.orders.delta, note: 'pagados, sin cancelados' }
  const cards = showMoney
    ? [
        { k: hoy ? 'Ventas de hoy' : 'Ventas netas', v: formatMXN(kpis.sales.value), d: kpis.sales.delta, note: vsSales },
        orders,
        { k: 'Ticket promedio', v: formatMXN(kpis.ticket.value), d: kpis.ticket.delta, note: 'por pedido' },
        { k: 'Margen bruto', v: catalog?.grossMargin == null ? '—' : `${Math.round(catalog.grossMargin * 100)} %`, note: 'con costo registrado' },
      ]
    : [
        { k: 'Unidades vendidas', v: catalog ? formatInt(catalog.unitsSold) : '—', note: 'en el periodo, sin cancelados' },
        orders,
        { k: 'Por preparar', v: queue.toPrepare, note: queue.late ? `${queue.late} ${queue.late === 1 ? 'atrasado' : 'atrasados'}` : 'sin atrasos' },
        { k: 'Pocas unidades', v: catalog ? catalog.fewUnits.length : '—', note: `${few} o menos en stock` },
      ]

  return (
    <div className="grid gap-3 grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4">
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
