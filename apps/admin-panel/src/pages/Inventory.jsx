import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ImportCsvModal from '../components/inventory/ImportCsvModal'
import InventoryTable from '../components/inventory/InventoryTable'
import StockPanel from '../components/inventory/StockPanel'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState, { Loading } from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import SearchField from '../components/ui/SearchField'
import Tabs from '../components/ui/Tabs'
import { STOCK_FILTERS } from '../domain/inventory'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { useAdminData, useAdminQuery } from '../hooks/useAdminData'
import { formatInt } from '../utils/format'

const FILTER_KEYS = STOCK_FILTERS.map((f) => f.key)

/** Inventario (DESIGN_ADMIN.md §7): tarjetas, filtros (?f=alertas), tabla, panel de stock e importación CSV. */
export default function Inventory() {
  const { api } = useAdminData()
  const { can } = useAdminAuth()
  const [params, setParams] = useSearchParams()
  const f = params.get('f')
  const filter = FILTER_KEYS.includes(f) ? f : 'todos'
  const [q, setQ] = useState('')
  const [sku, setSku] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const { data, error } = useAdminQuery(() => api.getInventory({ filter, q }), [filter, q])

  const setFilter = (k) => {
    const next = new URLSearchParams(params)
    if (k === 'todos') next.delete('f')
    else next.set('f', k)
    setParams(next, { replace: true })
  }

  const closePanel = useCallback(() => setSku(null), [])
  const returnFocus = useCallback(() => document.querySelector(`[data-sku="${sku}"]`), [sku])

  const tabs = STOCK_FILTERS.map((t) => ({ ...t, count: data?.counts[t.key] }))
  const cards = data && [
    ['Unidades en almacén', formatInt(data.totals.units)],
    ['Unidades apartadas', formatInt(data.totals.reserved)],
    ['SKU agotados', data.totals.out, data.totals.out > 0],
    ['SKU con pocas unidades', data.totals.few],
  ]

  return (
    <>
      <PageHeader title="Inventario" sub="Stock por SKU y bitácora de movimientos">
        {can('inventory.import') && (
          <Button variant="dark" onClick={() => setImportOpen(true)}>
            <Icon name="plus" className="w-4 h-4" />
            Importar desde CSV
          </Button>
        )}
      </PageHeader>

      {error && <EmptyState icon="alert" title="No pudimos cargar el inventario." />}
      {!data && !error && <Loading label="Cargando inventario…" />}

      {data && (
        <div className="space-y-4 animate-fade">
          <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
            {cards.map(([k, v, alert]) => (
              <Card key={k} className="px-5 py-4">
                <h2 className="text-[12.5px] text-ink-soft font-normal">{k}</h2>
                <p className={`text-[24px] font-semibold tnum mt-1 ${alert ? 'text-laca' : ''}`}>{v}</p>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Tabs options={tabs} value={filter} onChange={setFilter} label="Filtrar inventario" wrap />
            <SearchField id="inv-q" value={q} onChange={setQ} placeholder="SKU, pieza o tono" label="Buscar por SKU, pieza o tono" className="sm:ml-auto" />
          </div>

          <div className={`grid gap-5 ${sku ? '2xl:grid-cols-[minmax(0,1fr)_420px]' : ''}`}>
            <InventoryTable rows={data.rows} selected={sku} canAdjust={can('inventory.adjust')} few={data.few} onSelect={setSku} />
            {sku && <StockPanel key={sku} sku={sku} canAdjust={can('inventory.adjust')} onClose={closePanel} returnFocus={returnFocus} />}
          </div>
        </div>
      )}

      {importOpen && <ImportCsvModal onClose={() => setImportOpen(false)} />}
    </>
  )
}
