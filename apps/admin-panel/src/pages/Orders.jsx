import { useCallback, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader'
import OrderDetail from '../components/orders/OrderDetail'
import OrdersTable from '../components/orders/OrdersTable'
import EmptyState, { Loading } from '../components/ui/EmptyState'
import SearchField from '../components/ui/SearchField'
import Tabs from '../components/ui/Tabs'
import { ORDER_FILTERS } from '../domain/orders'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { useAdminData, useAdminQuery } from '../hooks/useAdminData'

const FILTER_KEYS = ORDER_FILTERS.map((f) => f.key)

/** Pedidos (DESIGN_ADMIN.md §7): filtro y búsqueda en la URL (?f=late&q=…), detalle en /pedidos/:folio. */
export default function Orders() {
  const { folio } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { api } = useAdminData()
  const { can } = useAdminAuth()
  const showMoney = can('money.view')

  const f = params.get('f')
  const filter = FILTER_KEYS.includes(f) ? f : 'todos'
  const q = params.get('q') ?? ''

  // El campo refleja la URL (también cuando llega desde el buscador global).
  const [text, setText] = useState(q)
  const [lastQ, setLastQ] = useState(q)
  if (q !== lastQ) {
    setLastQ(q)
    setText(q)
  }

  const { data, error } = useAdminQuery(() => api.getOrders({ filter, q }), [filter, q])

  const search = params.toString()
  const hrefFor = (id) => `/pedidos/${id}${search ? `?${search}` : ''}`

  const update = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
  }

  const onClose = useCallback(() => navigate(`/pedidos${search ? `?${search}` : ''}`), [navigate, search])
  // Devuelve el foco a la fila; si el pedido salió del filtro (p. ej. ya se envió), a la pestaña activa.
  const returnFocus = useCallback(
    () => (folio && document.querySelector(`[data-order="${folio}"]`)) || document.querySelector('[role="tab"][aria-selected="true"]'),
    [folio],
  )

  const tabs = ORDER_FILTERS.map((t) => ({ ...t, count: data?.counts[t.key], alert: t.key === 'late' }))

  return (
    <>
      <PageHeader title="Pedidos" sub="Surta, envíe y dé seguimiento: paquetería y entrega local" />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative overflow-x-auto -mx-1 px-1 py-1 flex-1 min-w-0">
          <Tabs options={tabs} value={filter} onChange={(k) => update({ f: k === 'todos' ? '' : k })} label="Filtrar pedidos" />
        </div>
        <SearchField
          id="order-q"
          value={text}
          onChange={(v) => {
            setText(v)
            setLastQ(v.trim())
            update({ q: v.trim() })
          }}
          placeholder="Folio, cliente, correo o SKU"
          label="Buscar pedidos por folio, cliente, correo o SKU"
        />
      </div>

      {error && <EmptyState icon="alert" title="No pudimos cargar los pedidos." />}
      {!data && !error && <Loading label="Cargando pedidos…" />}
      {data && (
        <div className={`grid gap-5 animate-fade ${folio ? '2xl:grid-cols-[minmax(0,1fr)_440px]' : ''}`}>
          <OrdersTable
            orders={data.orders}
            total={data.total}
            openId={folio}
            showMoney={showMoney}
            now={data.now}
            hrefFor={hrefFor}
            onOpen={(id) => navigate(hrefFor(id))}
          />
          {folio && <OrderDetail key={folio} folio={folio} showMoney={showMoney} now={data.now} onClose={onClose} returnFocus={returnFocus} />}
        </div>
      )}
    </>
  )
}
