import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import HBars from '../components/charts/HBars'
import SalesChart from '../components/charts/SalesChart'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import CardHead from '../components/ui/CardHead'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import { Skeleton, SkeletonRegion } from '../components/ui/Skeleton'
import { Segmented } from '../components/ui/Tabs'
import { saveBlob } from '../domain/csv'
import { DELIVERY_LABELS, LINE_LABELS, PAYMENT_METHOD_LABELS, label } from '../domain/enums'
import { formatDelta, PERIODS, periodFromParams, periodKeyOf, periodLabel, periodRange, validatePeriod } from '../domain/reports'
import { useAdminData, useAdminQuery } from '../hooks/useAdminData'
import { useToast } from '../hooks/useToast'
import { formatInt, formatMXN } from '../utils/format'

const TONE = { good: 'text-matcha', bad: 'text-laca', neutral: 'text-ink-soft' }

/** Variación con flecha, signo y texto: no depende solo del color. */
function Delta({ value, inverse }) {
  const d = formatDelta(value, { inverse })
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${TONE[d.tone]}`}>
      {d.dir === 'up' || d.dir === 'down' ? <Icon name={d.dir} className="w-3.5 h-3.5" /> : null}
      {d.sr && <span className="sr-only">{d.sr} </span>}
      {d.text}
    </span>
  )
}

function Kpi({ title, value, delta, inverse, note }) {
  return (
    <Card className="px-4 sm:px-5 py-4 min-w-0">
      <h2 className="text-[12.5px] text-ink-soft font-normal">{title}</h2>
      <p className="text-[21px] sm:text-[26px] font-semibold tnum leading-tight mt-1 break-words">{value}</p>
      <p className="text-[12px] mt-1 flex items-center gap-x-1.5 flex-wrap">
        <Delta value={delta} inverse={inverse} />
        {note && <span className="text-ink-soft">{note}</span>}
      </p>
    </Card>
  )
}

const FIELD = 'h-10 max-lg:h-11 rounded-md border bg-paper px-3 text-[13.5px] outline-none focus:border-ai'

/** Dos fechas y "Aplicar"; mismas reglas que la API (máximo 366 días). */
function CustomRange({ from, to, onApply }) {
  const [draft, setDraft] = useState({ from, to })
  const [errors, setErrors] = useState({})
  const submit = (e) => {
    e.preventDefault()
    const found = validatePeriod(draft.from, draft.to)
    setErrors(found)
    if (!Object.keys(found).length) onApply(draft)
  }
  const field = (key, text) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`report-${key}`} className="text-[12px] text-ink-soft">
        {text}
      </label>
      <input
        id={`report-${key}`}
        type="date"
        value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        aria-invalid={errors[key] ? 'true' : undefined}
        aria-describedby={errors[key] ? `report-${key}-error` : undefined}
        className={`${FIELD} ${errors[key] ? 'border-laca' : 'border-line'}`}
      />
      {errors[key] && (
        <p id={`report-${key}-error`} className="text-[12px] text-laca">
          {errors[key]}
        </p>
      )}
    </div>
  )
  return (
    <form onSubmit={submit} className="flex flex-wrap items-start gap-3 mb-5" noValidate>
      {field('from', 'Desde')}
      {field('to', 'Hasta')}
      <Button type="submit" variant="dark" size="md" className="mt-5">
        Aplicar
      </Button>
    </form>
  )
}

function ReportSkeleton() {
  return (
    <SkeletonRegion label="Cargando reporte…" className="space-y-5">
      <div className="grid gap-3 grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="px-5 py-4 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-20" />
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="h-56 w-full" />
      </Card>
    </SkeletonRegion>
  )
}

/** Reportes de ventas (solo el Dueño): KPIs contra el periodo anterior, ventas por día, por línea y por pago, top 10 y CSV para el contador. */
export default function Reports() {
  const { api } = useAdminData()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [downloading, setDownloading] = useState(false)
  const today = api.today()
  const period = periodFromParams(params, today)
  const urlKey = periodKeyOf(period.from, period.to, today)
  const [custom, setCustom] = useState(urlKey === 'custom')
  const selected = custom ? 'custom' : urlKey
  const { data, error, loading, retry } = useAdminQuery(() => api.getSalesReport(period), [period.from, period.to])

  // El periodo vive en la URL: se puede compartir y sobrevive a recargar.
  const setPeriod = ({ from, to }) => setParams(new URLSearchParams({ from, to }), { replace: true })
  const onPreset = (key) => {
    if (key === 'custom') return setCustom(true)
    setCustom(false)
    setPeriod(periodRange(key, today))
  }

  const download = async () => {
    setDownloading(true)
    try {
      const { blob, fileName } = await api.downloadSalesCsv(period)
      saveBlob(blob, fileName)
      toast.success(`Se descargó ${fileName}`, { key: 'sales-csv' })
    } catch (err) {
      toast.error(err.message || 'No pudimos generar el archivo. Intente de nuevo.', { key: 'sales-csv' })
    } finally {
      setDownloading(false)
    }
  }

  const k = data?.kpis
  const prevText = data ? `vs. ${periodLabel(data.prevFrom, data.prevTo)}` : ''
  const hasSales = Boolean(k?.orders.value)

  return (
    <>
      <PageHeader title="Reportes" sub={`Ventas de ${periodLabel(period.from, period.to)} · hora de Los Mochis, MXN con IVA`}>
        <Button onClick={download} disabled={downloading}>
          <Icon name="download" className="w-4 h-4" />
          {downloading ? 'Generando…' : 'Descargar CSV para contabilidad'}
        </Button>
      </PageHeader>

      <div className="overflow-x-auto -mx-1 px-1 py-1 mb-4">
        <Segmented options={PERIODS} value={selected} onChange={onPreset} label="Periodo del reporte" />
      </div>
      {selected === 'custom' && <CustomRange key={`${period.from}_${period.to}`} from={period.from} to={period.to} onApply={setPeriod} />}

      {error && (
        <Card>
          <ErrorState title="No pudimos cargar el reporte." error={error} onRetry={retry} />
        </Card>
      )}
      {!data && !error && <ReportSkeleton />}

      {data && (
        <div className={`space-y-5 animate-fade ${loading ? 'opacity-70' : ''}`} aria-busy={loading}>
          <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
            <Kpi title="Ventas" value={formatMXN(k.sales.value)} delta={k.sales.delta} note={`${prevText}: ${formatMXN(k.sales.prev)}`} />
            <Kpi title="Pedidos pagados" value={formatInt(k.orders.value)} delta={k.orders.delta} note="sin cancelados" />
            <Kpi title="Ticket promedio" value={formatMXN(k.ticket.value, 2)} delta={k.ticket.delta} note="por pedido" />
            <Kpi title="Pares vendidos" value={formatInt(k.units.value)} delta={k.units.delta} note="unidades, incluye piezas" />
            <Kpi title="IVA incluido" value={formatMXN(k.taxIncluded.value, 2)} delta={k.taxIncluded.delta} note="16 % dentro de las ventas" />
            <Kpi title="Envíos cobrados" value={formatMXN(k.shipping.value, 2)} delta={k.shipping.delta} note="lo que pagaron los clientes" />
            {k.discounts && <Kpi title="Descuentos" value={formatMXN(k.discounts.value, 2)} delta={k.discounts.delta} inverse note="cupones; las ventas ya van netas" />}
            <Kpi title="Pedidos cancelados" value={formatInt(k.cancelled.value)} delta={k.cancelled.delta} inverse note="no cuentan como venta" />
          </div>

          <Card className="min-w-0" aria-labelledby="report-daily">
            <CardHead
              id="report-daily"
              title="Ventas por día"
              sub={`${periodLabel(data.from, data.to)} contra ${periodLabel(data.prevFrom, data.prevTo)}`}
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
              <SalesChart data={data.daily} label={`Ventas por día de ${periodLabel(data.from, data.to)} comparadas con el periodo anterior.`} />
            </div>
          </Card>

          {!hasSales ? (
            <Card>
              <EmptyState icon="money" title="Sin ventas pagadas en este periodo">
                Elija otro periodo. Los OXXO pendientes y los cancelados no cuentan como venta.
              </EmptyState>
            </Card>
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-3">
                <Card aria-labelledby="report-lines">
                  <CardHead id="report-lines" title="Por línea" sub="Importe de los productos, sin envío" />
                  <div className="px-5 pb-5">
                    <HBars rows={data.lines.map((l) => ({ k: label(LINE_LABELS, l.line), v: l.revenue }))} valueFmt={(v) => formatMXN(v)} label="Ventas por línea" />
                  </div>
                </Card>
                <Card aria-labelledby="report-payments">
                  <CardHead id="report-payments" title="Por método de pago" sub="Ventas con envío" />
                  <div className="px-5 pb-5">
                  <HBars
                    rows={data.payments.map((p) => ({ k: `${label(PAYMENT_METHOD_LABELS, p.method)} · ${formatInt(p.orders)}`, v: p.sales }))}
                    valueFmt={(v) => formatMXN(v)}
                    label="Ventas por método de pago"
                  />
                  </div>
                </Card>
                <Card aria-labelledby="report-deliveries">
                  <CardHead id="report-deliveries" title="Por método de entrega" sub="Ventas con envío" />
                  <div className="px-5 pb-5">
                  <HBars
                    rows={data.deliveries.map((d) => ({ k: `${label(DELIVERY_LABELS, d.method)} · ${formatInt(d.orders)}`, v: d.sales }))}
                    valueFmt={(v) => formatMXN(v)}
                    label="Ventas por método de entrega"
                  />
                  </div>
                </Card>
              </div>

              <Card className="min-w-0 overflow-hidden" aria-labelledby="report-top">
                <CardHead id="report-top" title="Top 10 productos" sub="Por pares vendidos en el periodo" />
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] min-w-[480px]">
                    <caption className="sr-only">Los 10 productos más vendidos del periodo</caption>
                    <thead className="bg-linen text-ink-soft text-[12px]">
                      <tr className="text-left">
                        <th scope="col" className="px-5 py-2.5 font-medium w-10">#</th>
                        <th scope="col" className="py-2.5 font-medium">Producto</th>
                        <th scope="col" className="py-2.5 font-medium">Línea</th>
                        <th scope="col" className="py-2.5 font-medium text-right">Pares</th>
                        <th scope="col" className="px-5 py-2.5 font-medium text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {data.top.map((p, i) => (
                        <tr key={p.productId}>
                          <td className="px-5 py-3 text-ink-soft tnum">{i + 1}</td>
                          <td className="py-3 font-medium">{p.name}</td>
                          <td className="py-3 text-ink-soft">{label(LINE_LABELS, p.line)}</td>
                          <td className="py-3 text-right tnum">{formatInt(p.units)}</td>
                          <td className="px-5 py-3 text-right tnum">{formatMXN(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}
    </>
  )
}
