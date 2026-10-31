import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import EmptyState, { Loading } from '../components/ui/EmptyState'
import SearchField from '../components/ui/SearchField'
import StatusChip from '../components/ui/StatusChip'
import Tabs from '../components/ui/Tabs'
import { CARRIER_LABELS, label } from '../domain/enums'
import { isLate } from '../domain/orders'
import { useAdminData, useAdminQuery } from '../hooks/useAdminData'
import { formatDate, formatTime } from '../utils/format'

const FILTERS = [
  { key: 'enviado', label: 'Con paquetería' },
  { key: 'en_ruta', label: 'En ruta local' },
  { key: 'entregado', label: 'Entregados' },
  { key: 'late', label: 'Atrasados en bodega' },
]
const FILTER_KEYS = FILTERS.map((f) => f.key)
const OUT = ['enviado', 'en_ruta']

/** Envíos: guías de paquetería, rutas de entrega local y lo que sigue atrasado en bodega. Mismos datos que Pedidos; el detalle se abre allá. */
export default function Shipments() {
  const { api } = useAdminData()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const f = params.get('f')
  const filter = FILTER_KEYS.includes(f) ? f : 'enviado'
  const { data, error } = useAdminQuery(() => api.getOrders({ filter, q }), [filter, q])

  const setFilter = (k) => {
    const next = new URLSearchParams(params)
    next.set('f', k)
    setParams(next, { replace: true })
  }
  const tabs = FILTERS.map((t) => ({ ...t, count: data?.counts[t.key], alert: t.key === 'late' }))

  return (
    <>
      <PageHeader title="Envíos" sub="Guías de paquetería, rutas de entrega local y atrasos" />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative overflow-x-auto -mx-1 px-1 py-1 flex-1 min-w-0">
          <Tabs options={tabs} value={filter} onChange={setFilter} label="Filtrar envíos" />
        </div>
        <SearchField id="ship-q" value={q} onChange={setQ} placeholder="Folio, cliente, correo o SKU" label="Buscar envíos por folio, cliente, correo o SKU" />
      </div>

      {error && <EmptyState icon="alert" title="No pudimos cargar los envíos." />}
      {!data && !error && <Loading label="Cargando envíos…" />}
      {data && (
        <Card className="min-w-0 overflow-hidden animate-fade">
          <div className="relative overflow-x-auto">
            <table className="w-full text-[13px] min-w-[720px]">
              <caption className="sr-only">Envíos</caption>
              <thead className="bg-linen text-ink-soft text-[12px]">
                <tr className="text-left">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Folio
                  </th>
                  <th scope="col" className="py-2.5 font-medium">
                    Cliente
                  </th>
                  <th scope="col" className="py-2.5 font-medium">
                    Quién lo lleva
                  </th>
                  <th scope="col" className="py-2.5 font-medium">
                    {filter === 'late' ? 'Compra' : 'Salió'}
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.orders.map((o) => {
                  const step = o.history.find((h) => OUT.includes(h.status))
                  const at = filter === 'late' ? o.created : step?.at
                  return (
                    <tr key={o.id} className="hover:bg-linen">
                      <td className="px-5 py-3">
                        <Link to={`/pedidos/${o.id}`} className="font-medium tnum hover:underline">
                          {o.id}
                        </Link>
                      </td>
                      <td className="py-3">
                        <span className="block">{o.customer.name}</span>
                        <span className="block text-[11.5px] text-ink-soft">
                          {o.customer.city} · CP {o.customer.postalCode}
                        </span>
                      </td>
                      <td className="py-3">
                        {o.tracking ? (
                          <>
                            <span className="block">{label(CARRIER_LABELS, o.carrier)}</span>
                            <span className="block text-[11.5px] text-ink-soft tnum select-all">Guía {o.tracking}</span>
                          </>
                        ) : (
                          o.courier || <span className="text-ink-soft">{o.delivery === 'local' ? 'Entrega local, sin repartidor' : 'Paquetería, sin guía'}</span>
                        )}
                      </td>
                      <td className="py-3 text-ink-soft whitespace-nowrap">{at ? `${formatDate(at)} · ${formatTime(at)}` : '—'}</td>
                      <td className="px-5 py-3">
                        <StatusChip status={o.status} late={isLate(o, data.now)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!data.orders.length && <p className="px-5 py-14 text-center text-ink-soft">No hay envíos con este filtro.</p>}
          </div>
        </Card>
      )}
    </>
  )
}
