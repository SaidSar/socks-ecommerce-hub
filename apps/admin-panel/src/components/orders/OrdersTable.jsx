import { Link } from 'react-router-dom'
import { isLate, pairCount } from '../../domain/orders'
import { formatDate, formatMXN, formatTime } from '../../utils/format'
import Card from '../ui/Card'
import StatusChip from '../ui/StatusChip'

const cityShort = (city) => city.split(',')[0]

/** Tabla de pedidos. La columna Total solo aparece con `showMoney` (Dueño). */
export default function OrdersTable({ orders, total, openId, showMoney, now, hrefFor, onOpen }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="relative overflow-x-auto">
        <table className={`w-full text-[13px] ${showMoney ? 'min-w-[860px]' : 'min-w-[780px]'}`}>
          <caption className="sr-only">Pedidos</caption>
          <thead className="bg-linen text-ink-soft text-[12px]">
            <tr className="text-left">
              <th scope="col" className="px-5 py-2.5 font-medium">
                Folio
              </th>
              <th scope="col" className="py-2.5 font-medium">
                Fecha
              </th>
              <th scope="col" className="py-2.5 font-medium">
                Cliente
              </th>
              <th scope="col" className="py-2.5 font-medium">
                Pares
              </th>
              <th scope="col" className="py-2.5 font-medium">
                Entrega
              </th>
              <th scope="col" className="py-2.5 font-medium">
                Pago
              </th>
              <th scope="col" className="py-2.5 font-medium">
                Estado
              </th>
              <th scope="col" className={`py-2.5 font-medium text-right ${showMoney ? '' : 'pr-5'}`}>
                Envío
              </th>
              {showMoney && (
                <th scope="col" className="px-5 py-2.5 font-medium text-right">
                  Total
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr
                key={o.id}
                onClick={() => onOpen(o.id)}
                aria-current={openId === o.id ? 'true' : undefined}
                className={`cursor-pointer transition-colors ${openId === o.id ? 'bg-info-bg/60' : 'hover:bg-linen'}`}
              >
                <td className="px-5 py-3">
                  <Link to={hrefFor(o.id)} data-order={o.id} className="font-medium tnum hover:underline" onClick={(e) => e.stopPropagation()}>
                    {o.id}
                  </Link>
                </td>
                <td className="py-3 text-ink-soft whitespace-nowrap">
                  {formatDate(o.created)} · {formatTime(o.created)}
                </td>
                <td className="py-3">
                  <span className="block">{o.customer.name}</span>
                  <span className="block text-[11.5px] text-ink-soft">{o.customer.city}</span>
                </td>
                <td className="py-3 tnum">{pairCount(o)}</td>
                <td className="py-3 whitespace-nowrap">
                  {o.delivery === 'local' ? (
                    <span className="inline-flex items-center gap-1 rounded bg-sand px-1.5 py-0.5 text-[12px]">Local · {cityShort(o.customer.city)}</span>
                  ) : (
                    o.carrier || 'Paquetería'
                  )}
                </td>
                <td className="py-3 whitespace-nowrap">{o.pay}</td>
                <td className="py-3">
                  <StatusChip status={o.status} late={isLate(o, now)} />
                </td>
                <td className={`py-3 text-right tnum text-ink-soft ${showMoney ? '' : 'pr-5'}`}>{o.shipping ? formatMXN(o.shipping) : 'Gratis'}</td>
                {showMoney && <td className="px-5 py-3 text-right tnum font-medium">{formatMXN(o.total)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && <p className="px-5 py-14 text-center text-ink-soft">No hay pedidos con este filtro. Pruebe con “Todos” o borre la búsqueda.</p>}
      </div>
      <p className="px-5 py-3 text-[12px] text-ink-soft border-t border-line tnum">
        {orders.length} de {total} pedidos · datos de ejemplo
      </p>
    </Card>
  )
}
