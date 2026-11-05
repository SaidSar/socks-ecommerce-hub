import { useCallback, useId, useState } from 'react'
import { TABLE, TD, TH } from '../components/catalog/CatalogUi'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'
import SearchField from '../components/ui/SearchField'
import SidePanel, { SidePanelHeader } from '../components/ui/SidePanel'
import { SkeletonRows } from '../components/ui/Skeleton'
import StatusChip from '../components/ui/StatusChip'
import Tabs from '../components/ui/Tabs'
import {
  COUPON_FILTERS,
  COUPON_STATUS,
  COUPON_TYPES,
  couponForm,
  couponStatus,
  filterCoupons,
  generateCode,
  normalizeCode,
  previewText,
  usesLabel,
  validateCoupon,
  validityLabel,
  valueLabel,
} from '../domain/coupons'
import { useAdminData, useAdminQuery } from '../hooks/useAdminData'
import { useToast } from '../hooks/useToast'
import { formatMXN } from '../utils/format'

const INPUT = 'mt-1 h-10 max-lg:h-11 w-full min-w-0 rounded-md border bg-paper px-3 text-[14px] outline-none focus:border-ai'

/** Campo con etiqueta, ayuda y error ligado por aria-describedby. */
function Field({ label, error, hint, children }) {
  const id = useId()
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-[12.5px] text-ink-soft">
        {label}
      </label>
      {children({ id, invalid: Boolean(error), describedBy: error ? `${id}-err` : hint ? `${id}-hint` : undefined, cls: `${INPUT} ${error ? 'border-laca' : 'border-line'}` })}
      {error ? (
        <p id={`${id}-err`} className="mt-1 text-[12px] text-laca">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-[12px] text-ink-soft">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

/** Alta y edición en panel lateral, con validación en vivo y la vista previa en texto. */
function CouponEditor({ coupon, today, onClose, onSaved }) {
  const { api } = useAdminData()
  const toast = useToast()
  const [form, setForm] = useState(() => couponForm(coupon))
  const [touched, setTouched] = useState({})
  const [serverErrors, setServerErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const live = validateCoupon(form)
  // En vivo: un campo muestra su error en cuanto se tocó (o tras intentar guardar).
  const errors = Object.fromEntries(Object.keys({ ...live, ...serverErrors }).filter((k) => touched[k] || serverErrors[k]).map((k) => [k, serverErrors[k] ?? live[k]]))
  const preview = previewText(form, today)

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setTouched((t) => ({ ...t, [key]: true }))
    setServerErrors((e) => ({ ...e, [key]: undefined }))
    setFormError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    const all = Object.fromEntries(Object.keys(form).map((k) => [k, true]))
    setTouched(all)
    if (Object.keys(live).length) {
      setFormError(Object.keys(live).length > 1 ? `Hay ${Object.keys(live).length} campos por revisar.` : 'Revise el campo marcado.')
      return
    }
    setSaving(true)
    try {
      const saved = await api.saveCoupon(form)
      toast.success(coupon ? `Se guardó ${saved.code}` : `Se creó el cupón ${saved.code}`, { key: `coupon-${saved.id}` })
      onSaved(saved)
    } catch (err) {
      setSaving(false)
      if (err.errors) setServerErrors(err.errors)
      setFormError(err.message || 'No pudimos guardar el cupón. Intente de nuevo.')
    }
  }

  return (
    <SidePanel label={coupon ? `Editar ${coupon.code}` : 'Nuevo cupón'} onClose={onClose} modal width="sm:w-[480px]">
      <SidePanelHeader onClose={onClose} closeLabel="Cerrar sin guardar">
        <p className="text-[12px] text-ink-soft">{coupon ? 'Editar cupón' : 'Nuevo cupón'}</p>
        <h2 className="text-[17px] font-semibold truncate mt-0.5 tnum">{normalizeCode(form.code) || 'Sin código'}</h2>
      </SidePanelHeader>
      <form onSubmit={submit} noValidate className="p-5 space-y-5 animate-fade">
        {formError && (
          <p role="alert" className="rounded-md bg-crit-bg px-3 py-2.5 text-[13px] text-laca">
            {formError}
          </p>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <Field label="Código" error={errors.code} hint={form.locked ? 'Ya se usó en pedidos: el código no cambia.' : 'Mayúsculas, números y guiones (3 a 30).'}>
            {({ id, invalid, describedBy, cls }) => (
              <input
                id={id}
                value={form.code}
                onChange={(e) => set('code')(normalizeCode(e.target.value))}
                readOnly={form.locked}
                maxLength={30}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={`${cls} tnum uppercase tracking-[.06em] read-only:bg-linen`}
              />
            )}
          </Field>
          {!form.locked && (
            <Button variant="outline" className="mb-[22px]" onClick={() => set('code')(generateCode())}>
              Generar código
            </Button>
          )}
        </div>

        <fieldset>
          <legend className="text-[12.5px] text-ink-soft">Tipo de descuento</legend>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {COUPON_TYPES.map((t) => (
              <label
                key={t.key}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-2 text-center text-[13px] ${form.type === t.key ? 'border-ink bg-linen font-medium' : 'border-line'}`}
              >
                <input type="radio" name="coupon-type" value={t.key} checked={form.type === t.key} onChange={() => set('type')(t.key)} className="sr-only" />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>

        {form.type !== 'free_shipping' && (
          <Field label={form.type === 'percent' ? 'Porcentaje (1 a 90)' : 'Monto en pesos'} error={errors.value}>
            {({ id, invalid, describedBy, cls }) => (
              <input
                id={id}
                inputMode="decimal"
                value={form.value}
                onChange={(e) => set('value')(e.target.value.replace(/[^\d.]/g, ''))}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={`${cls} tnum`}
              />
            )}
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Compra mínima (opcional)" error={errors.minSubtotal} hint="Mercancía antes del descuento.">
            {({ id, invalid, describedBy, cls }) => (
              <input id={id} inputMode="decimal" value={form.minSubtotal} onChange={(e) => set('minSubtotal')(e.target.value.replace(/[^\d.]/g, ''))} aria-invalid={invalid} aria-describedby={describedBy} className={`${cls} tnum`} />
            )}
          </Field>
          <Field label="Usos en total (opcional)" error={errors.maxRedemptions} hint="Vacío = sin límite.">
            {({ id, invalid, describedBy, cls }) => (
              <input id={id} inputMode="numeric" value={form.maxRedemptions} onChange={(e) => set('maxRedemptions')(e.target.value.replace(/\D/g, ''))} aria-invalid={invalid} aria-describedby={describedBy} className={`${cls} tnum`} />
            )}
          </Field>
          <Field label="Válido desde (opcional)" error={errors.startsOn}>
            {({ id, invalid, describedBy, cls }) => (
              <input id={id} type="date" value={form.startsOn} onChange={(e) => set('startsOn')(e.target.value)} aria-invalid={invalid} aria-describedby={describedBy} className={`${cls} tnum`} />
            )}
          </Field>
          <Field label="Válido hasta (opcional)" error={errors.endsOn} hint="Incluye todo ese día (hora de Los Mochis).">
            {({ id, invalid, describedBy, cls }) => (
              <input id={id} type="date" value={form.endsOn} onChange={(e) => set('endsOn')(e.target.value)} aria-invalid={invalid} aria-describedby={describedBy} className={`${cls} tnum`} />
            )}
          </Field>
        </div>

        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input type="checkbox" checked={form.onePerCustomer} onChange={(e) => set('onePerCustomer')(e.target.checked)} className="mt-1 h-4 w-4 accent-ai" />
          <span className="text-[13.5px]">
            Una vez por cliente
            <span className="block text-[12px] text-ink-soft">Se revisa por correo, con cuenta o como invitado.</span>
          </span>
        </label>

        <Field label="Nota interna (opcional)" hint="Solo la ve el equipo; la tienda nunca la muestra.">
          {({ id, describedBy, cls }) => (
            <input id={id} value={form.description} maxLength={200} onChange={(e) => set('description')(e.target.value)} aria-describedby={describedBy} className={`${cls} border-line`} />
          )}
        </Field>

        <div className="rounded-md bg-linen px-3 py-3 text-[13px]" aria-live="polite">
          <p className="text-[11.5px] uppercase tracking-[.12em] text-ink-soft">Así lo verá el cliente</p>
          <p className="mt-1">{preview || 'Elija el tipo y el valor del descuento.'}</p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" disabled={saving} aria-busy={saving || undefined}>
            {saving ? 'Guardando…' : coupon ? 'Guardar cambios' : 'Crear cupón'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </SidePanel>
  )
}

/** Acciones de una fila: editar, activar/desactivar y borrar (solo sin usos). */
function RowActions({ coupon, busy, onEdit, onToggle, onDelete }) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => onEdit(coupon)}>
        Editar<span className="sr-only"> {coupon.code}</span>
      </Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => onToggle(coupon, !coupon.isActive)}>
        {coupon.isActive ? 'Desactivar' : 'Activar'}
        <span className="sr-only"> {coupon.code}</span>
      </Button>
      {coupon.canDelete && (
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onDelete(coupon)} className="text-laca">
          Borrar<span className="sr-only"> {coupon.code}</span>
        </Button>
      )}
    </div>
  )
}

/** Promociones (solo el Dueño): cupones de descuento para el checkout de la tienda. */
export default function Promotions() {
  const { api } = useAdminData()
  const toast = useToast()
  const [status, setStatus] = useState('todos')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const { data, error, loading, retry } = useAdminQuery(() => api.getCoupons(), [])
  const today = api.today()
  const all = data ?? []
  const list = filterCoupons(all, { status, q }, today)
  const counts = Object.fromEntries(COUPON_FILTERS.map((f) => [f.key, f.key === 'todos' ? all.length : all.filter((c) => couponStatus(c, today) === f.key).length]))

  const toggle = useCallback(
    async function apply(coupon, active) {
      setBusy(true)
      try {
        const updated = await api.setCouponActive(coupon.id, active)
        toast.success(active ? `${updated.code} está activo` : `${updated.code} quedó inactivo`, {
          key: `coupon-${coupon.id}`,
          action: { label: 'Deshacer', onClick: () => apply(updated, !active) },
        })
      } catch (err) {
        toast.error(err.message || 'No pudimos guardar el cambio. Intente de nuevo.', { key: `coupon-${coupon.id}` })
      } finally {
        setBusy(false)
      }
    },
    [api, toast],
  )

  const remove = async () => {
    const coupon = confirming
    setBusy(true)
    try {
      await api.deleteCoupon(coupon.id)
      toast.success(`Se borró ${coupon.code}`, { key: `coupon-${coupon.id}` })
      setConfirming(null)
    } catch (err) {
      toast.error(err.message || 'No pudimos borrar el cupón.', { key: `coupon-${coupon.id}` })
    } finally {
      setBusy(false)
    }
  }

  const statusOf = (c) => couponStatus(c, today)
  const tabs = COUPON_FILTERS.map((f) => ({ ...f, count: counts[f.key], alert: false }))

  return (
    <>
      <PageHeader title="Promociones" sub="Cupones de descuento para el checkout de la tienda">
        <Button onClick={() => setEditing('new')}>
          <Icon name="plus" className="w-4 h-4" />
          Nuevo cupón
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative overflow-x-auto -mx-1 px-1 py-1 flex-1 min-w-0">
          <Tabs options={tabs} value={status} onChange={setStatus} label="Filtrar cupones por estado" />
        </div>
        <SearchField id="coupons-q" value={q} onChange={setQ} placeholder="Código o nota" label="Buscar cupones por código o nota" />
      </div>

      {error && (
        <Card>
          <ErrorState title="No pudimos cargar los cupones." error={error} onRetry={retry} />
        </Card>
      )}
      {!data && !error && (
        <Card>
          <SkeletonRows label="Cargando cupones…" rows={4} />
        </Card>
      )}

      {data && (
        <Card className={`min-w-0 overflow-hidden animate-fade ${loading ? 'opacity-70' : ''}`} aria-busy={loading}>
          {!list.length ? (
            <EmptyState icon="tag" title={all.length ? 'Ningún cupón coincide' : 'Aún no hay cupones'}>
              {all.length ? 'Pruebe con otro estado o con parte del código.' : 'Cree el primero con “Nuevo cupón”; el cliente lo escribe en el resumen del checkout.'}
            </EmptyState>
          ) : (
            <>
              {/* Escritorio: tabla. */}
              <div className="max-md:hidden overflow-x-auto">
                <table className={TABLE}>
                  <caption className="sr-only">Cupones de descuento</caption>
                  <thead>
                    <tr>
                      <th className={TH}>Código</th>
                      <th className={TH}>Descuento</th>
                      <th className={TH}>Vigencia</th>
                      <th className={`${TH} text-right`}>Usos</th>
                      <th className={`${TH} text-right`}>Descuento otorgado</th>
                      <th className={TH}>Estado</th>
                      <th className={TH}>
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((c) => (
                      <tr key={c.id} data-coupon={c.code}>
                        <td className={TD}>
                          <span className="font-medium tnum tracking-[.04em]">{c.code}</span>
                          {c.description && <span className="block text-[12px] text-ink-soft truncate max-w-[220px]">{c.description}</span>}
                        </td>
                        <td className={TD}>
                          {valueLabel(c)}
                          {c.minSubtotal ? <span className="block text-[12px] text-ink-soft">desde {formatMXN(c.minSubtotal)}</span> : null}
                        </td>
                        <td className={`${TD} whitespace-nowrap`}>{validityLabel(c, today)}</td>
                        <td className={`${TD} text-right tnum`}>
                          {usesLabel(c)}
                          {c.onePerCustomer && <span className="block text-[11.5px] text-ink-soft">1 por cliente</span>}
                        </td>
                        <td className={`${TD} text-right tnum`}>
                          {formatMXN(c.discountGiven, 2)}
                          <span className="block text-[11.5px] text-ink-soft">ventas {formatMXN(c.sales, 2)}</span>
                        </td>
                        <td className={TD}>
                          <StatusChip meta={COUPON_STATUS[statusOf(c)]} />
                        </td>
                        <td className={TD}>
                          <RowActions coupon={c} busy={busy} onEdit={setEditing} onToggle={toggle} onDelete={setConfirming} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Celular (390 px): tarjetas, sin desplazamiento horizontal. */}
              <ul className="md:hidden divide-y divide-line">
                {list.map((c) => (
                  <li key={c.id} data-coupon={c.code} className="px-4 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium tnum tracking-[.04em] break-all">{c.code}</p>
                        <p className="text-[12.5px] text-ink-soft">
                          {valueLabel(c)}
                          {c.minSubtotal ? ` desde ${formatMXN(c.minSubtotal)}` : ''} · {validityLabel(c, today)}
                        </p>
                      </div>
                      <StatusChip meta={COUPON_STATUS[statusOf(c)]} />
                    </div>
                    <p className="text-[12.5px] tnum">
                      Usos {usesLabel(c)} · Otorgado {formatMXN(c.discountGiven, 2)}
                    </p>
                    <RowActions coupon={c} busy={busy} onEdit={setEditing} onToggle={toggle} onDelete={setConfirming} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {editing && (
        <CouponEditor
          key={editing === 'new' ? 'new' : editing.id}
          coupon={editing === 'new' ? null : editing}
          today={today}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}

      {confirming && (
        <Modal title={`¿Borrar ${confirming.code}?`} sub="No tiene usos. Esta acción no se puede deshacer." onClose={() => setConfirming(null)} size="max-w-md" role="alertdialog">
          <p className="text-[13.5px]">Si solo quiere pausarlo, desactívelo: así conserva su configuración.</p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={remove}>
              Borrar cupón
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
