import { useId, useState } from 'react'
import { Banner, Pill, TABLE, TD, TH } from '../components/catalog/CatalogUi'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState, { Loading } from '../components/ui/EmptyState'
import { Segmented } from '../components/ui/Tabs'
import { crossesYear, dayOfYear, seasonStatus, validateCollection } from '../domain/catalog'
import { COLLECTION_KIND_LABELS, dayMonth, label, MONTHS, MONTHS_SHORT } from '../domain/enums'
import { effectivePrice, isInSeason, roundMoney } from '../domain/season'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { useAdminData, useAdminQuery } from '../hooks/useAdminData'
import { formatMXN } from '../utils/format'

const YEAR = 365
const KINDS = [
  { key: 'temporada', label: 'Temporada' },
  { key: 'tematica', label: 'Temática' },
]
const pct = (n) => `${Math.round(n * 100)} %`
const windowText = (c) => (c.kind === 'temporada' ? `${dayMonth(c.startMonth, c.startDay)} → ${dayMonth(c.endMonth, c.endDay)}` : '—')

/** Barra anual: 12 meses, la ventana en matcha (dos tramos si cruza de año) y hoy en laca. Decorativa: el texto lo repite. */
function YearBar({ collection, today }) {
  const at = (doy) => `${((doy - 1) / YEAR) * 100}%`
  const span = (a, b) => ({ left: at(a), width: `${((b - a + 1) / YEAR) * 100}%` })
  const segments = []
  if (collection.kind === 'temporada') {
    const s = dayOfYear(collection.startMonth, collection.startDay)
    const e = dayOfYear(collection.endMonth, collection.endDay)
    if (s <= e) segments.push([s, e])
    else segments.push([s, YEAR], [1, e])
  }
  return (
    <div className="flex flex-col gap-1.5" aria-hidden="true">
      <div className="relative h-8 overflow-hidden rounded-sm border border-line bg-linen">
        {segments.map(([a, b]) => (
          <span key={a} className="absolute inset-y-0 bg-matcha/80" style={span(a, b)} />
        ))}
        {MONTHS_SHORT.slice(1).map((m, i) => (
          <span key={m} className="absolute inset-y-0 w-px bg-line" style={{ left: at(dayOfYear(i + 2, 1)) }} />
        ))}
        <span className="absolute inset-y-0 w-0.5 bg-laca" style={{ left: at(dayOfYear(today.month, today.day)) }} />
      </div>
      <div className="relative h-4 text-[10.5px] text-ink-soft">
        {MONTHS_SHORT.map((m, i) =>
          i % 2 === 0 ? (
            <span key={m} className="absolute" style={{ left: at(dayOfYear(i + 1, 1)) }}>
              {m}
            </span>
          ) : null,
        )}
      </div>
    </div>
  )
}

/** Día (1–31) y mes de un extremo de la ventana. */
function DateField({ legend, month, day, onChange }) {
  const cls = 'h-10 max-lg:h-11 rounded-md border border-line bg-paper px-2 text-[13.5px] outline-none focus:border-ai disabled:opacity-55'
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-[12px] font-medium text-ink-soft">{legend}</legend>
      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
        <select aria-label={`${legend}: día`} className={`${cls} tnum`} value={day} onChange={(e) => onChange(month, Number(e.target.value))}>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <select aria-label={`${legend}: mes`} className={cls} value={month} onChange={(e) => onChange(Number(e.target.value), day)}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  )
}

/** Editor de la colección seleccionada (§4.5). Se monta de nuevo (key) al cambiar de colección o al guardar. */
function Editor({ collection, today, canEdit, canSeeMoney, onSave }) {
  const [form, setForm] = useState(collection)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState('')
  const sliderId = useId()
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setServerError('')
  }
  const setKind = (kind) =>
    set(kind === 'temporada' ? { startMonth: 11, startDay: 1, endMonth: 1, endDay: 6, offSeasonDiscountPct: 0.3, ...stripKind(form), kind } : { kind })

  const errors = validateCollection(form)
  const status = seasonStatus(form, today)
  const seasonal = form.kind === 'temporada'
  const checks = seasonal
    ? [
        [form.startMonth, form.startDay],
        [form.endMonth, form.endDay],
        [12, 31],
        [1, 7],
      ]
    : []
  const dirty = JSON.stringify(form) !== JSON.stringify(collection)

  const save = async () => {
    setSaving(true)
    try {
      await onSave(form)
    } catch (ex) {
      setServerError(Object.values(ex.errors ?? {})[0] ?? ex.message)
      setSaving(false)
    }
  }

  return (
    <Card as="section" aria-label={`Editar ${collection.name}`} className="flex min-w-0 flex-col gap-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] text-ink-soft">Editar colección</p>
          <h2 className="text-[18px] font-medium">{collection.name}</h2>
        </div>
        <Pill tone={status.tone}>{status.text}</Pill>
      </div>

      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-ink-soft">Tipo</span>
          <div className={canEdit ? '' : 'opacity-55'}>
            <Segmented options={KINDS} value={form.kind} onChange={setKind} label="Tipo de colección" />
          </div>
        </div>

        {seasonal ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <DateField legend="Inicia" month={form.startMonth} day={form.startDay} onChange={(m, d) => set({ startMonth: m, startDay: d })} />
              <DateField legend="Termina" month={form.endMonth} day={form.endDay} onChange={(m, d) => set({ endMonth: m, endDay: d })} />
            </div>
            {errors.window && (
              <p role="alert" className="-mt-2 text-[12.5px] text-laca">
                {errors.window}
              </p>
            )}
            <YearBar collection={form} today={today} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor={sliderId} className="text-[12px] font-medium text-ink-soft">
                Descuento fuera de temporada
              </label>
              <div className="flex items-center gap-3">
                <input
                  id={sliderId}
                  type="range"
                  min="0"
                  max="60"
                  step="5"
                  value={Math.round(form.offSeasonDiscountPct * 100)}
                  onChange={(e) => set({ offSeasonDiscountPct: Number(e.target.value) / 100 })}
                  className="flex-1 accent-ai"
                />
                <span className="tnum w-12 text-right font-medium">{pct(form.offSeasonDiscountPct)}</span>
              </div>
              {canSeeMoney && (
                <p className="text-[12px] text-ink-soft">
                  Ejemplo: {formatMXN(199)} → {formatMXN(roundMoney(199 * (1 - form.offSeasonDiscountPct)), 2)} en el buscador mientras la temporada no esté
                  activa.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1 rounded-md bg-linen px-3 py-2.5 text-[12.5px]">
              <span className="text-ink-soft">Comprobación de la ventana{crossesYear(form) ? ' (cruza de año)' : ''}</span>
              <span className="tnum flex flex-wrap gap-x-4 gap-y-1">
                {checks.map(([m, d]) => {
                  const ok = isInSeason(form, { month: m, day: d })
                  return (
                    <span key={`${m}-${d}`}>
                      {dayMonth(m, d)}: <b className={ok ? 'text-matcha' : 'font-medium text-ink-soft'}>{ok ? 'en temporada' : 'fuera'}</b>
                    </span>
                  )
                })}
              </span>
            </div>
          </>
        ) : (
          <p className="text-[13px] text-ink-soft">Temática: sin fechas; visibles todo el año, sin descuento automático.</p>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-medium text-ink-soft">Productos en la colección · {collection.products.length}</span>
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {collection.products.map((p) => {
            const price = canSeeMoney ? effectivePrice(p.price, form, today) : null
            return (
              <li key={p.slug} className="flex justify-between gap-3 px-3 py-2 text-[13px]">
                <span className="truncate">{p.name}</span>
                {price && (
                  <span className="tnum shrink-0 text-ink-soft">
                    {formatMXN(p.price)}
                    {price.offSeason && <span className="text-ocre-ink"> → {formatMXN(price.price, 2)}</span>}
                  </span>
                )}
              </li>
            )
          })}
          {!collection.products.length && <li className="px-3 py-2 text-[13px] text-ink-soft">Sin productos. Asígnalos desde Productos.</li>}
        </ul>
      </div>

      {serverError && (
        <p role="alert" className="text-[12.5px] text-laca">
          {serverError}
        </p>
      )}
      {canEdit && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={!dirty || saving} onClick={() => setForm(collection)}>
            Descartar
          </Button>
          <Button disabled={!dirty || saving || Object.keys(errors).length > 0} onClick={save}>
            Guardar colección
          </Button>
        </div>
      )}
    </Card>
  )
}

/** El editor se reinicia al cambiar de colección y cuando llegan los datos guardados. */
const editorKey = (c) => [c.slug, c.kind, c.startMonth, c.startDay, c.endMonth, c.endDay, c.offSeasonDiscountPct].join(':')

/** Al volver a Temporada conserva las fechas que ya tuviera la colección. */
function stripKind({ kind: _kind, ...rest }) {
  return Object.fromEntries(Object.entries(rest).filter(([, v]) => v != null))
}

/** Colecciones (DESIGN_CATALOG_UI.md §4.5): tabla y editor con ventana anual. Editar es solo del Dueño. */
export default function Collections() {
  const { can } = useAdminAuth()
  const { api } = useAdminData()
  const { data, error } = useAdminQuery(() => api.getCatalog(), [])
  const [selected, setSelected] = useState('navidad')
  const [status, setStatus] = useState('')
  const canEdit = can('collections.edit')
  const canSeeMoney = can('money.view')
  const current = data?.collections.find((c) => c.slug === selected) ?? data?.collections[0]

  const save = async (form) => {
    await api.saveCollection(form)
    setStatus(`Colección ${form.name} guardada.`)
  }

  return (
    <div>
      <PageHeader title="Colecciones" sub="Temporadas que se repiten cada año y colecciones temáticas de Especiales." />
      <div className="space-y-5">
        {!canEdit && <Banner>Solo el Dueño puede editar colecciones, fechas y descuentos.</Banner>}
        <p role="status" className="text-[13px] text-matcha empty:hidden">
          {status}
        </p>
        {error && <EmptyState icon="alert" title="No pudimos cargar las colecciones." />}
        {!data && !error && <Loading label="Cargando colecciones…" />}
        {data && (
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
            <Card className="overflow-x-auto">
              <table className={`${TABLE} min-w-[600px]`}>
                <thead>
                  <tr>
                    <th className={TH}>Colección</th>
                    <th className={TH}>Tipo</th>
                    <th className={TH}>Ventana anual</th>
                    <th className={TH}>Hoy</th>
                    <th className={`${TH} text-right`}>Desc. fuera</th>
                    <th className={`${TH} text-right`}>Productos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.collections.map((c) => {
                    const active = c.slug === current.slug
                    return (
                      <tr
                        key={c.slug}
                        tabIndex={0}
                        aria-selected={active}
                        onClick={() => setSelected(c.slug)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelected(c.slug)
                          }
                        }}
                        className={`cursor-pointer outline-none last:[&>td]:border-b-0 focus-visible:bg-sand ${active ? 'bg-linen' : 'hover:bg-sand/60'}`}
                      >
                        <td className={`${TD} font-medium`}>{c.name}</td>
                        <td className={`${TD} text-ink-soft`}>{label(COLLECTION_KIND_LABELS, c.kind)}</td>
                        <td className={`${TD} tnum whitespace-nowrap`}>{windowText(c)}</td>
                        <td className={TD}>
                          <Pill tone={c.status.tone}>{c.status.text}</Pill>
                        </td>
                        <td className={`${TD} tnum text-right`}>{c.kind === 'temporada' ? pct(c.offSeasonDiscountPct) : '—'}</td>
                        <td className={`${TD} tnum text-right`}>{c.products.length}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
            <Editor canSeeMoney={canSeeMoney} key={editorKey(current)} collection={current} today={data.today} canEdit={canEdit} onSave={save} />
          </div>
        )}
      </div>
    </div>
  )
}
