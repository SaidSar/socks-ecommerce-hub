import { Banner, Pill, TABLE, TD, TH } from '../components/catalog/CatalogUi'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import EmptyState, { Loading } from '../components/ui/EmptyState'
import { label, SIZE_SYSTEM_LABELS, UNIT_LABELS } from '../domain/enums'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { useAdminData, useAdminQuery } from '../hooks/useAdminData'

/** Tipos y tallas (DESIGN_CATALOG_UI.md §4.6). Solo lectura en v1. */
export default function ProductTypes() {
  const { can } = useAdminAuth()
  const { api } = useAdminData()
  const { data, error } = useAdminQuery(() => api.getCatalog(), [])

  return (
    <div className="max-w-[980px]">
      <PageHeader title="Tipos y tallas" sub="El tipo define qué tallas ofrece un producto y si se cuenta por par o por pieza." />

      <div className="space-y-5">
        {!can('types.edit') && <Banner>Solo el Dueño puede editar tipos.</Banner>}
        {error && <EmptyState icon="alert" title="No pudimos cargar los tipos." />}
        {!data && !error && <Loading label="Cargando tipos…" />}
        {data && (
          <>
            <Card className="overflow-x-auto">
              <table className={`${TABLE} min-w-[620px]`}>
                <thead>
                  <tr>
                    <th className={TH}>Tipo</th>
                    <th className={TH}>Sistema de tallas</th>
                    <th className={TH}>Tallas</th>
                    <th className={TH}>Se cuenta por</th>
                    <th className={`${TH} text-right`}>Productos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.types.map((t) => (
                    <tr key={t.code} className="last:[&>td]:border-b-0">
                      <td className={`${TD} font-medium`}>{t.name}</td>
                      <td className={TD}>{label(SIZE_SYSTEM_LABELS, t.sizeSystem)}</td>
                      <td className={`${TD} text-ink-soft`}>{t.sizes.map((s) => `${s.code} (${s.label})`).join(' · ')}</td>
                      <td className={TD}>
                        <Pill tone={t.unit === 'par' ? 'info' : 'mute'}>{label(UNIT_LABELS, t.unit)}</Pill>
                      </td>
                      <td className={`${TD} tnum text-right`}>{t.products}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(data.sizes).map(([system, sizes]) => (
                <Card key={system} className="flex flex-col gap-2 p-4">
                  <span className="text-[12px] text-ink-soft">Sistema</span>
                  <h2 className="font-medium">{label(SIZE_SYSTEM_LABELS, system)}</h2>
                  <ul className="flex flex-col gap-1 text-[13px]">
                    {sizes.map((s) => (
                      <li key={s.code} className="flex justify-between gap-2">
                        <span className="font-medium">{s.code}</span>
                        <span className="text-ink-soft">{s.label}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </>
        )}
        <p className="text-[12px] text-ink-soft">Las medidas de calcetas de marca y de guantes están pendientes de confirmar con el cliente (P-13).</p>
      </div>
    </div>
  )
}
