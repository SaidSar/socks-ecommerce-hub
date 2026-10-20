import { Link, useNavigate } from 'react-router-dom'
import { isLate, pairCount } from '../../domain/orders'
import { formatDate, formatMXN, formatTime } from '../../utils/format'
import Card from '../ui/Card'
import CardHead from '../ui/CardHead'
import StatusChip from '../ui/StatusChip'

/** Últimos 5 pedidos; el folio abre el detalle. Operaciones ve pares en lugar del total. */
export default function RecentOrders({ orders, showMoney, now }) {
  const navigate = useNavigate()
  return (
    <Card className="min-w-0" aria-labelledby="recent-title">
      <CardHead
        id="recent-title"
        title="Últimos pedidos"
        right={
          <Link to="/pedidos" className="inline-flex items-center h-8 max-lg:h-11 px-3 rounded-md hover:bg-sand text-[12.5px] font-medium">
            Ver pedidos
          </Link>
        }
      />
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full text-[13px] min-w-[620px]">
          <caption className="sr-only">Últimos 5 pedidos</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Folio</th>
              <th scope="col">Cliente</th>
              <th scope="col">Fecha</th>
              <th scope="col">Estado</th>
              <th scope="col">{showMoney ? 'Total' : 'Pares'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-linen cursor-pointer" onClick={() => navigate(`/pedidos/${o.id}`)}>
                <td className="px-5 py-3">
                  <Link to={`/pedidos/${o.id}`} className="font-medium tnum hover:underline" onClick={(e) => e.stopPropagation()}>
                    {o.id}
                  </Link>
                </td>
                <td className="py-3">{o.customer.name}</td>
                <td className="py-3 text-ink-soft whitespace-nowrap">
                  {formatDate(o.created)}, {formatTime(o.created)}
                </td>
                <td className="py-3">
                  <StatusChip status={o.status} late={isLate(o, now)} />
                </td>
                <td className="px-5 py-3 text-right tnum">{showMoney ? formatMXN(o.total) : `${pairCount(o)} pares`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
