import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Banner, LineTag, Pill, Swatch, TABLE, TD, TH } from '../components/catalog/CatalogUi'
import ProductForm from '../components/catalog/ProductForm'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState, { Loading } from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import SearchField from '../components/ui/SearchField'
import Tabs from '../components/ui/Tabs'
import { LOW_MARGIN } from '../domain/catalog'
import { label, LINE_SHORT_LABELS, LINES, UNIT_LABELS, unitText } from '../domain/enums'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { useAdminData, useAdminQuery } from '../hooks/useAdminData'
import { formatMXN, normalize } from '../utils/format'

const FEW = 4

/** Productos (DESIGN_CATALOG_UI.md §4.3): filtro por línea (?linea=), búsqueda, tabla y formulario lateral. */
export default function Products() {
  const { can } = useAdminAuth()
  const { api } = useAdminData()
  const { data, error } = useAdminQuery(() => api.getCatalog(), [])
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null) // slug, 'nuevo' o null
  const [status, setStatus] = useState('')
  const canEdit = can('catalog.edit')
  const canSeeCosts = can('costs.view')
  const line = LINES.includes(params.get('linea')) ? params.get('linea') : 'todas'

  const setLine = (k) => {
    const next = new URLSearchParams(params)
    if (k === 'todas') next.delete('linea')
    else next.set('linea', k)
    setParams(next, { replace: true })
  }
  const close = useCallback(() => setOpen(null), [])
  const returnFocus = useCallback(() => document.querySelector(open === 'nuevo' ? '[data-new-product]' : `[data-product="${open}"]`), [open])

  const save = async (form) => {
    const saved = await api.saveProduct(form)
    setOpen(null)
    setStatus(`Producto ${saved.name} guardado.`)
  }

  const products = data?.products ?? []
  const term = normalize(q.trim())
  const rows = products.filter((p) => (line === 'todas' || p.line === line) && (!term || normalize(p.name).includes(term)))
  const tabs = [{ key: 'todas', label: 'Todas', count: products.length }, ...LINES.map((k) => ({ key: k, label: label(LINE_SHORT_LABELS, k), count: products.filter((p) => p.line === k).length }))]
  const statusOf = (slug) => data?.collections.find((c) => c.slug === slug)?.status
  const current = open && open !== 'nuevo' ? products.find((p) => p.slug === open) : null

  return (
    <>
      <PageHeader title="Productos" sub="Catálogo de las cuatro líneas. Cada producto tiene variantes por color y talla.">
        {canEdit && (
          <Button data-new-product onClick={() => setOpen('nuevo')}>
            <Icon name="plus" className="h-4 w-4" />
            Nuevo producto
          </Button>
        )}
      </PageHeader>

      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="max-w-full overflow-x-auto">
            <Tabs options={tabs} value={line} onChange={setLine} label="Filtrar por línea" />
          </div>
          <SearchField id="prod-q" value={q} onChange={setQ} placeholder="Buscar producto" className="sm:ml-auto" />
        </div>
        {!canSeeCosts && <Banner>Como Operaciones ves stock y datos del catálogo. El costo y el margen solo los ve el Dueño.</Banner>}
        <p role="status" className="text-[13px] text-matcha empty:hidden">
          {status}
        </p>

        {error && <EmptyState icon="alert" title="No pudimos cargar los productos." />}
        {!data && !error && <Loading label="Cargando productos…" />}
        {data && (
          <Card className="overflow-x-auto">
            <table className={`${TABLE} ${canSeeCosts ? 'min-w-[980px]' : 'min-w-[820px]'}`}>
              <thead>
                <tr>
                  <th className={TH}>Producto</th>
                  <th className={TH}>Línea</th>
                  <th className={TH}>Marca</th>
                  <th className={TH}>Tipo · unidad</th>
                  <th className={TH}>Colección</th>
                  <th className={`${TH} text-right`}>Precio</th>
                  {canSeeCosts && <th className={`${TH} text-right`}>Costo</th>}
                  {canSeeCosts && <th className={`${TH} text-right`}>Margen</th>}
                  <th className={`${TH} text-right`}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const season = p.collection && statusOf(p.collection.slug)
                  return (
                    <tr key={p.slug} onClick={() => setOpen(p.slug)} className="cursor-pointer hover:bg-sand/60 last:[&>td]:border-b-0">
                      <td className={TD}>
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span className="flex -space-x-1">
                            {p.colors.map((c) => (
                              <Swatch key={c.code} color={c} />
                            ))}
                          </span>
                          <button
                            type="button"
                            data-product={p.slug}
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpen(p.slug)
                            }}
                            className="text-left font-medium hover:underline"
                          >
                            {p.name}
                          </button>
                        </span>
                      </td>
                      <td className={TD}>
                        <LineTag line={p.line} />
                      </td>
                      <td className={`${TD} text-ink-soft`}>{p.brand.name}</td>
                      <td className={`${TD} whitespace-nowrap text-ink-soft`}>
                        {p.type.name} · {p.unitsPerPack > 1 ? unitText(p.type.unit, p.unitsPerPack) : label(UNIT_LABELS, p.type.unit).toLowerCase()}
                      </td>
                      <td className={TD}>
                        {p.collection ? (
                          <span className="flex items-center gap-2 whitespace-nowrap">
                            {p.collection.name}
                            {p.collection.kind === 'temporada' && <Pill tone={p.collection.inSeason ? 'ok' : (season?.tone ?? 'mute')}>{p.collection.inSeason ? 'Activa' : 'Fuera'}</Pill>}
                          </span>
                        ) : (
                          <span className="text-ink-soft">—</span>
                        )}
                      </td>
                      <td className={`${TD} tnum text-right whitespace-nowrap`}>
                        {formatMXN(p.price)}
                        {p.offSeasonPrice != null && <span className="block text-[12px] text-ocre-ink">fuera {formatMXN(p.offSeasonPrice, 2)}</span>}
                      </td>
                      {canSeeCosts && <td className={`${TD} tnum text-right`}>{p.unitCost == null ? <Pill tone="warn">Falta</Pill> : formatMXN(p.unitCost)}</td>}
                      {canSeeCosts && (
                        <td className={`${TD} tnum text-right`}>
                          {p.margin == null ? (
                            <span className="text-ink-soft">—</span>
                          ) : (
                            <span className={p.margin < LOW_MARGIN ? 'font-medium text-warn-ink' : ''}>{Math.round(p.margin * 100)} %</span>
                          )}
                        </td>
                      )}
                      <td className={`${TD} tnum text-right`}>{p.stock <= FEW ? <Pill tone="crit">{p.stock}</Pill> : p.stock}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!rows.length && <EmptyState icon="search" title="Sin productos con ese filtro." />}
          </Card>
        )}
        {canSeeCosts && (
          <p className="text-[12px] text-ink-soft">
            Margen = (precio − costo) ÷ precio. Se resalta cuando baja de 30 %. Un producto sin costo no entra en el margen del Dashboard.
          </p>
        )}
      </div>

      {data && open && (open === 'nuevo' || current) && (
        <ProductForm
          key={open}
          product={current}
          catalog={data}
          canEdit={canEdit}
          canSeeCosts={canSeeCosts}
          onSave={save}
          onClose={close}
          returnFocus={returnFocus}
        />
      )}
    </>
  )
}
