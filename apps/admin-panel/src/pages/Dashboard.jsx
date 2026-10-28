import { useState } from 'react'
import SalesChart from '../components/charts/SalesChart'
import CatalogCards from '../components/dashboard/CatalogCards'
import InventoryAlerts from '../components/dashboard/InventoryAlerts'
import KpiRow from '../components/dashboard/KpiRow'
import LimitedEditions from '../components/dashboard/LimitedEditions'
import RecentOrders from '../components/dashboard/RecentOrders'
import SizeShare from '../components/dashboard/SizeShare'
import TopPieces from '../components/dashboard/TopPieces'
import WorkQueue from '../components/dashboard/WorkQueue'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import CardHead from '../components/ui/CardHead'
import EmptyState, { Loading } from '../components/ui/EmptyState'
import { Segmented } from '../components/ui/Tabs'
import { RANGES } from '../domain/dashboard'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { useAdminData, useAdminQuery } from '../hooks/useAdminData'
import { formatLongDate } from '../utils/format'

const greeting = (d) => {
  const h = new Date(d).getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
}

/** Dashboard (DESIGN_ADMIN.md §5.5 y DESIGN_CATALOG_UI.md §4.2): abre en "Hoy" con Ventas primero, la cola de trabajo y el catálogo por línea. */
export default function Dashboard() {
  const { user, can } = useAdminAuth()
  const { api, summary } = useAdminData()
  const [range, setRange] = useState('hoy')
  const { data, error } = useAdminQuery(() => api.getDashboard(range), [range])
  const { data: catalog } = useAdminQuery(() => api.getCatalogSummary(), [])
  const showMoney = can('money.view')
  const firstName = user.name.split(' ')[0]

  return (
    <>
      <PageHeader
        title={data ? `${greeting(data.now)}, ${firstName}` : `Hola, ${firstName}`}
        sub={data ? `${formatLongDate(data.now)} · datos de ejemplo` : ''}
      >
        <Segmented options={RANGES} value={range} onChange={setRange} label="Periodo" />
      </PageHeader>

      {error && <EmptyState icon="alert" title="No pudimos cargar el dashboard." />}
      {!data && !error && <Loading label="Cargando dashboard…" />}

      {data && (
        <div className="space-y-5 animate-fade">
          <KpiRow kpis={data.kpis} showMoney={showMoney} catalog={catalog} queue={summary} few={data.few} />
          <WorkQueue queue={data.queue} />
          {catalog && <CatalogCards summary={catalog} owner={can('costs.view')} few={data.few} />}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {showMoney && data.daily ? (
              <Card className="min-w-0" aria-labelledby="sales-title">
                <CardHead
                  id="sales-title"
                  title="Ventas por día"
                  sub="Últimos 30 días, MXN con IVA"
                  right={
                    <div className="flex items-center gap-4 text-[12px] text-ink-soft shrink-0" aria-hidden="true">
                      <span className="flex items-center gap-1.5">
                        <span className="w-4 h-[2px] bg-ai" />
                        Este periodo
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-4 border-t-2 border-dashed border-ocre" />
                        Periodo anterior
                      </span>
                    </div>
                  }
                />
                <div className="px-3 pb-3">
                  <SalesChart data={data.daily} />
                </div>
              </Card>
            ) : (
              <Card className="min-w-0">
                <EmptyState icon="money" title="Las ventas en pesos solo las ve el Dueño">
                  Su rol de Operaciones ve pedidos, envíos e inventario.
                </EmptyState>
              </Card>
            )}
            <InventoryAlerts alerts={data.alerts} few={data.few} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <TopPieces rows={data.top} />
            <SizeShare rows={data.sizes} />
            <LimitedEditions editions={data.editions} />
          </div>

          <RecentOrders orders={data.recent} showMoney={showMoney} now={data.now} />
        </div>
      )}
    </>
  )
}
