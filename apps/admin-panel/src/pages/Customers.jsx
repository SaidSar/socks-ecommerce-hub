import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import SearchField from '../components/ui/SearchField'
import SidePanel, { SidePanelHeader } from '../components/ui/SidePanel'
import { Skeleton, SkeletonRegion, SkeletonRows } from '../components/ui/Skeleton'
import StatusChip from '../components/ui/StatusChip'
import Tabs from '../components/ui/Tabs'
import { saveBlob } from '../domain/csv'
import { CUSTOMER_SORTS, CUSTOMER_TYPES, KIND_LABELS } from '../domain/customers'
import { PAYMENT_STATUS_LABELS, label } from '../domain/enums'
import { useAdminData, useAdminQuery } from '../hooks/useAdminData'
import { useToast } from '../hooks/useToast'
import { formatDate, formatInt, formatMXN } from '../utils/format'

const TYPE_KEYS = CUSTOMER_TYPES.map((t) => t.key)
const SORT_KEYS = CUSTOMER_SORTS.map((s) => s.key)

const dateOrDash = (d) => (d ? formatDate(d) : '—')
const fullDate = (d) => new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mazatlan' }).replace('.', '')
const keyOf = (c) => (c.id != null ? `u-${c.id}` : `g-${c.email}`)

function KindChip({ kind }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap ${kind === 'cuenta' ? 'bg-info-bg text-info-ink' : 'bg-sand text-ink-soft'}`}>
      {KIND_LABELS[kind]}
    </span>
  )
}

function OptIn({ value }) {
  return value ? (
    <span className="inline-flex items-center gap-1 text-matcha">
      <Icon name="check" className="w-4 h-4" />
      Sí
    </span>
  ) : (
    <span className="text-ink-soft">No</span>
  )
}

function Fact({ term, children }) {
  return (
    <div>
      <dt className="text-[12px] text-ink-soft">{term}</dt>
      <dd className="text-[13.5px] mt-0.5">{children}</dd>
    </div>
  )
}

/** Detalle del cliente: datos, pedidos (con enlace a cada uno), favoritos y última dirección de entrega. */
function CustomerDetail({ selected, onClose, returnFocus }) {
  const { api } = useAdminData()
  const { data, error, retry } = useAdminQuery(() => api.getCustomer(selected.id != null ? { id: selected.id } : { email: selected.email }), [keyOf(selected)])
  const c = data?.customer ?? selected

  return (
    <SidePanel label={`Cliente ${c.name}`} onClose={onClose} returnFocus={returnFocus}>
      <SidePanelHeader onClose={onClose} closeLabel="Cerrar detalle del cliente">
        <h2 className="text-[17px] font-semibold truncate">{c.name}</h2>
        <p className="text-[12.5px] text-ink-soft mt-0.5 break-all">{c.email}</p>
        <div className="mt-2">
          <KindChip kind={c.kind} />
        </div>
      </SidePanelHeader>

      {error && <ErrorState title="No pudimos cargar este cliente." error={error} onRetry={retry} />}
      {!data && !error && (
        <SkeletonRegion label="Cargando cliente…" className="p-5 space-y-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </SkeletonRegion>
      )}
      {data && (
        <div className="p-5 space-y-6 animate-fade">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Fact term="Pedidos">{formatInt(c.orders)}</Fact>
            <Fact term="Total gastado">{formatMXN(c.spent, 2)}</Fact>
            <Fact term="Última compra">{c.lastOrderAt ? fullDate(c.lastOrderAt) : 'Aún sin compras'}</Fact>
            <Fact term="Cliente desde">{fullDate(c.customerSince)}</Fact>
            <Fact term="Talla preferida">{c.preferredSize ?? '—'}</Fact>
            <Fact term="Acepta novedades">
              <OptIn value={c.marketingOptIn} />
            </Fact>
            {data.favorites != null && <Fact term="Favoritos">{formatInt(data.favorites)}</Fact>}
            {data.phone && (
              <Fact term="Teléfono">
                <a href={`tel:${data.phone}`} className="hover:underline tnum">
                  {data.phone}
                </a>
              </Fact>
            )}
          </dl>

          <section aria-labelledby="customer-address">
            <h3 id="customer-address" className="text-[13px] font-semibold">
              Última dirección de entrega
            </h3>
            {data.lastAddress ? (
              <address className="not-italic text-[13px] text-ink-soft mt-1 leading-relaxed">
                {data.lastAddress.street}, {data.lastAddress.neighborhood}
                <br />
                {data.lastAddress.city}, {data.lastAddress.state} · CP {data.lastAddress.postalCode}
                {data.lastAddress.references && (
                  <>
                    <br />
                    {data.lastAddress.references}
                  </>
                )}
              </address>
            ) : (
              <p className="text-[13px] text-ink-soft mt-1">Todavía no tiene pedidos con dirección.</p>
            )}
          </section>

          <section aria-labelledby="customer-orders">
            <h3 id="customer-orders" className="text-[13px] font-semibold">
              Pedidos ({data.orders.length})
            </h3>
            {data.orders.length ? (
              <ul className="mt-2 divide-y divide-line border border-line rounded-md">
                {data.orders.map((o) => (
                  <li key={o.folio}>
                    <Link to={`/pedidos/${o.folio}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-3 hover:bg-linen min-h-11">
                      <span className="font-medium tnum">{o.folio}</span>
                      <span className="text-[12px] text-ink-soft">{fullDate(o.createdAt)}</span>
                      <span className="ml-auto tnum text-[13px]">{formatMXN(o.total)}</span>
                      <span className="basis-full flex flex-wrap items-center gap-2">
                        <StatusChip status={o.status} />
                        {o.paymentStatus !== 'pagado' && <span className="text-[12px] text-ink-soft">{label(PAYMENT_STATUS_LABELS, o.paymentStatus)}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-soft mt-1">Creó su cuenta pero todavía no compra.</p>
            )}
          </section>
        </div>
      )}
    </SidePanel>
  )
}

/** Clientes (solo el Dueño): con cuenta e invitados, búsqueda, orden, detalle y exportes CSV. */
export default function Customers() {
  const { api } = useAdminData()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(null)
  const type = TYPE_KEYS.includes(params.get('tipo')) ? params.get('tipo') : 'todos'
  const sort = SORT_KEYS.includes(params.get('orden')) ? params.get('orden') : 'ultima_compra'
  const page = Math.max(1, Number(params.get('pagina')) || 1)
  const { data, error, loading, retry } = useAdminQuery(() => api.getCustomers({ type, q, sort, page }), [type, q, sort, page])

  const update = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
  }
  const onSearch = (value) => {
    setQ(value)
    if (page !== 1) update({ pagina: null })
  }

  const onClose = useCallback(() => setSelected(null), [])
  const returnFocus = useCallback(() => (selected && document.querySelector(`[data-customer="${CSS.escape(keyOf(selected))}"]`)) || null, [selected])

  const download = async (kind) => {
    setBusy(kind)
    try {
      const { blob, fileName } = kind === 'lista' ? await api.exportCustomers({ type, q, sort }) : await api.exportMarketing()
      saveBlob(blob, fileName)
      toast.success(`Se descargó ${fileName}`, { key: 'customers-export' })
    } catch (err) {
      toast.error(err.message || 'No pudimos generar el archivo. Intente de nuevo.', { key: 'customers-export' })
    } finally {
      setBusy(null)
    }
  }

  const tabs = CUSTOMER_TYPES.map((t) => ({ ...t, count: data?.counts[t.key] }))
  const rows = data?.customers ?? []
  const first = data ? (data.page - 1) * data.pageSize + 1 : 0
  const last = data ? first + rows.length - 1 : 0
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <>
      <PageHeader title="Clientes" sub="Con cuenta e invitados: compras, talla preferida y consentimiento de novedades">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => download('lista')} disabled={busy != null || !data?.total}>
            <Icon name="download" className="w-4 h-4" />
            {busy === 'lista' ? 'Generando…' : 'Exportar CSV'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => download('novedades')} disabled={busy != null}>
            <Icon name="mail" className="w-4 h-4" />
            {busy === 'novedades' ? 'Generando…' : 'Exportar contactos con novedades'}
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative overflow-x-auto -mx-1 px-1 py-1 w-full lg:w-auto lg:flex-1 min-w-0">
          <Tabs options={tabs} value={type} onChange={(k) => update({ tipo: k === 'todos' ? null : k, pagina: null })} label="Tipo de cliente" />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-ink-soft whitespace-nowrap">
          Ordenar por
          <select
            value={sort}
            onChange={(e) => update({ orden: e.target.value === 'ultima_compra' ? null : e.target.value, pagina: null })}
            className="h-9 max-lg:h-11 rounded-md border border-line bg-paper px-2 text-[13px] text-ink outline-none focus:border-ai"
          >
            {CUSTOMER_SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <SearchField id="customers-q" value={q} onChange={onSearch} placeholder="Nombre o correo" label="Buscar clientes por nombre o correo" />
      </div>

      {error && (
        <Card>
          <ErrorState title="No pudimos cargar los clientes." error={error} onRetry={retry} />
        </Card>
      )}
      {!data && !error && (
        <Card>
          <SkeletonRows label="Cargando clientes…" />
        </Card>
      )}

      {data && (
        <div className={`grid gap-5 animate-fade ${selected ? '2xl:grid-cols-[minmax(0,1fr)_440px]' : ''}`}>
          <Card className={`min-w-0 overflow-hidden ${loading ? 'opacity-70' : ''}`} aria-busy={loading}>
            {!rows.length ? (
              <EmptyState icon="users" title={q ? `Nadie coincide con “${q}”` : 'Todavía no hay clientes de este tipo'}>
                {q ? 'Revise la ortografía o busque por correo.' : 'Aparecen aquí al crear una cuenta o al comprar como invitados.'}
              </EmptyState>
            ) : (
              <>
                {/* Celular: tarjetas. */}
                <ul className="md:hidden divide-y divide-line">
                  {rows.map((c) => (
                    <li key={keyOf(c)}>
                      <button
                        type="button"
                        data-customer={keyOf(c)}
                        onClick={() => setSelected(c)}
                        aria-current={selected && keyOf(selected) === keyOf(c) ? 'true' : undefined}
                        className="w-full text-left px-4 py-3 hover:bg-linen flex flex-col gap-1"
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-medium truncate">{c.name}</span>
                          <span className="ml-auto tnum text-[13px]">{formatMXN(c.spent)}</span>
                        </span>
                        <span className="text-[12px] text-ink-soft truncate">{c.email}</span>
                        <span className="flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
                          <KindChip kind={c.kind} />
                          {c.orders} {c.orders === 1 ? 'pedido' : 'pedidos'} · última {dateOrDash(c.lastOrderAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Tableta y escritorio: tabla. */}
                <div className="hidden md:block relative overflow-x-auto">
                  <table className="w-full text-[13px] min-w-[860px]">
                    <caption className="sr-only">Clientes. Seleccione un nombre para ver su detalle.</caption>
                    <thead className="bg-linen text-ink-soft text-[12px]">
                      <tr className="text-left">
                        <th scope="col" className="px-5 py-2.5 font-medium">Cliente</th>
                        <th scope="col" className="py-2.5 font-medium">Tipo</th>
                        <th scope="col" className="py-2.5 font-medium text-right">Pedidos</th>
                        <th scope="col" className="py-2.5 pl-4 font-medium text-right">Total gastado</th>
                        <th scope="col" className="py-2.5 pl-4 font-medium">Última compra</th>
                        <th scope="col" className="py-2.5 font-medium">Talla</th>
                        <th scope="col" className="py-2.5 font-medium">Novedades</th>
                        <th scope="col" className="px-5 py-2.5 font-medium">Cliente desde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rows.map((c) => {
                        const active = selected && keyOf(selected) === keyOf(c)
                        return (
                          <tr key={keyOf(c)} onClick={() => setSelected(c)} className={`cursor-pointer ${active ? 'bg-linen' : 'hover:bg-linen'}`}>
                            <td className="px-5 py-3">
                              <button
                                type="button"
                                data-customer={keyOf(c)}
                                aria-current={active ? 'true' : undefined}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelected(c)
                                }}
                                className="font-medium hover:underline text-left"
                              >
                                {c.name}
                              </button>
                              <span className="block text-[11.5px] text-ink-soft">{c.email}</span>
                            </td>
                            <td className="py-3">
                              <KindChip kind={c.kind} />
                            </td>
                            <td className="py-3 text-right tnum">{formatInt(c.orders)}</td>
                            <td className="py-3 pl-4 text-right tnum">{formatMXN(c.spent)}</td>
                            <td className="py-3 pl-4 text-ink-soft whitespace-nowrap">{dateOrDash(c.lastOrderAt)}</td>
                            <td className="py-3">{c.preferredSize ?? <span className="text-ink-soft">—</span>}</td>
                            <td className="py-3">
                              <OptIn value={c.marketingOptIn} />
                            </td>
                            <td className="px-5 py-3 text-ink-soft whitespace-nowrap">{fullDate(c.customerSince)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <nav aria-label="Páginas de clientes" className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-line text-[12.5px] text-ink-soft">
                  <span className="tnum">
                    {first}–{last} de {formatInt(data.total)}
                  </span>
                  <span className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => update({ pagina: page - 1 > 1 ? String(page - 1) : null })}>
                      <Icon name="left" className="w-4 h-4" />
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => update({ pagina: String(page + 1) })}>
                      Siguiente
                      <Icon name="right" className="w-4 h-4" />
                    </Button>
                  </span>
                </nav>
              </>
            )}
          </Card>
          {selected && <CustomerDetail key={keyOf(selected)} selected={selected} onClose={onClose} returnFocus={returnFocus} />}
        </div>
      )}
    </>
  )
}
