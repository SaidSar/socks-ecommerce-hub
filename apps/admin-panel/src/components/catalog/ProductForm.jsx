import { useId, useState } from 'react'
import { MSG, skuOf, validateProduct } from '../../domain/catalog'
import { dayMonth, label, LINE_SHORT_LABELS, LINES, SIZE_SYSTEM_LABELS, UNIT_LABELS, unitText } from '../../domain/enums'
import { formatMXN } from '../../utils/format'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import SidePanel, { SidePanelHeader } from '../ui/SidePanel'
import { Segmented } from '../ui/Tabs'
import { Banner, LineTag, Swatch, TABLE, TD, TH } from './CatalogUi'

const FIELD = 'h-10 max-lg:h-11 w-full rounded-md border bg-paper px-3 text-[13.5px] outline-none focus:border-ai disabled:bg-linen disabled:text-ink-soft'
const LINE_OPTIONS = LINES.map((key) => ({ key, label: label(LINE_SHORT_LABELS, key) }))
const pct = (n) => `${Math.round(n * 100)} %`

/** Formulario a partir del DTO (o vacío para un producto nuevo de Especiales). */
function initialForm(product) {
  if (!product) return { slug: null, line: 'especiales', name: '', brand: 'sin-marca', type: 'calcetas', collection: null, unitsPerPack: '1', price: '199', unitCost: '', colors: ['ROJ'], barcodes: {} }
  return {
    slug: product.slug,
    rowVersion: product.rowVersion,
    line: product.line,
    name: product.name,
    nameJp: product.nameJp ?? '',
    material: product.material ?? '',
    brand: product.brand.slug,
    type: product.type.code,
    collection: product.collection?.slug ?? null,
    unitsPerPack: String(product.unitsPerPack),
    price: String(product.price),
    unitCost: product.unitCost == null ? '' : String(product.unitCost),
    colors: product.colors.map((c) => c.code),
    barcodes: Object.fromEntries(product.variants.filter((v) => v.barcode).map((v) => [v.sku, v.barcode])),
  }
}

/** Al cambiar de línea se ajustan marca, colección y colores (§4.3). */
function withLine(form, line, colors) {
  const kyoto = new Set(colors.filter((c) => c.isSokkoTone).map((c) => c.code))
  const kept = form.colors.filter((c) => (line === 'sokko') === kyoto.has(c))
  return {
    ...form,
    line,
    brand: line === 'sokko' ? 'sokko' : form.brand === 'sokko' ? 'sin-marca' : form.brand,
    collection: line === 'especiales' ? form.collection : null,
    colors: kept.length ? kept : [line === 'sokko' ? 'SUM' : 'NEG'],
  }
}

/** Campo con etiqueta, ayuda y error accesibles (aria-invalid + aria-describedby). */
function Field({ id, label: text, error, hint, children }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-ink-soft">
        {text}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy, className: `${FIELD} ${error ? 'border-laca' : 'border-line'}` })}
      {error ? (
        <p id={`${id}-error`} className="text-[12.5px] text-laca">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12px] text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Formulario lateral de producto (DESIGN_CATALOG_UI.md §4.3): 560 px, pantalla completa en móvil.
 * Valida al intentar guardar con las mismas reglas que el servicio (R-30, R-31, R-32, código de barras único).
 */
export default function ProductForm({ product, catalog, canEdit, canSeeCosts, onSave, onClose, returnFocus }) {
  const [form, setForm] = useState(() => initialForm(product))
  const [tried, setTried] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const uid = useId()
  const id = (k) => `${uid}-${k}`
  const isNew = !product

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setServerErrors({})
  }
  const type = catalog.types.find((t) => t.code === form.type)
  const sizes = catalog.sizes[type.sizeSystem]
  const collection = catalog.collections.find((c) => c.slug === form.collection)
  const pieceNumber = product?.pieceNumber ?? Math.max(0, ...catalog.products.filter((p) => p.line === form.line).map((p) => p.pieceNumber)) + 1
  const colorChoices = catalog.colors.filter((c) => (form.line === 'sokko') === Boolean(c.isSokkoTone))
  const stockBySku = Object.fromEntries((product?.variants ?? []).map((v) => [v.sku, v.stock]))
  const variants = form.colors.flatMap((code) =>
    sizes.map((s) => ({ sku: skuOf(form.line, pieceNumber, code, s.code), color: catalog.colors.find((c) => c.code === code), size: s })),
  )

  // Códigos de barras de los demás productos → SKU que ya los usa (UNIQUE filtrado).
  const barcodeOwners = {}
  catalog.products
    .filter((p) => p.slug !== form.slug)
    .forEach((p) => p.variants.forEach((v) => v.barcode && (barcodeOwners[v.barcode] = v.sku)))
  const payload = {
    ...form,
    price: form.price === '' ? null : Number(form.price),
    unitCost: form.unitCost === '' ? null : Number(form.unitCost),
    unitsPerPack: Math.max(1, Number(form.unitsPerPack) || 1),
    barcodes: Object.fromEntries(variants.map((v) => [v.sku, form.barcodes[v.sku] ?? ''])),
  }
  const errors = tried ? { ...validateProduct(payload, { brands: catalog.brands, colors: catalog.colors, barcodeOwners }), ...serverErrors } : {}
  const hasErrors = Object.keys(errors).length > 0
  const price = Number(form.price) || 0
  const cost = form.unitCost === '' ? null : Number(form.unitCost)
  const margin = cost != null && price > 0 ? (price - cost) / price : null

  const save = async () => {
    setTried(true)
    if (Object.keys(validateProduct(payload, { brands: catalog.brands, colors: catalog.colors, barcodeOwners })).length) return
    setSaving(true)
    try {
      await onSave(payload)
    } catch (ex) {
      setServerErrors(ex.errors ?? { form: ex.message })
      setSaving(false)
    }
  }

  const title = isNew ? 'Nuevo producto' : `Editar ${product.name}`
  return (
    <SidePanel label={title} onClose={onClose} returnFocus={returnFocus} width="sm:w-[560px]" modal>
      <div className="flex min-h-full flex-col">
        <SidePanelHeader onClose={onClose}>
          <p className="text-[12px] text-ink-soft">{isNew ? 'Nuevo producto' : canEdit ? 'Editar producto' : 'Producto'}</p>
          <p className="truncate font-medium">{form.name || 'Sin nombre'}</p>
        </SidePanelHeader>

        <div className="flex flex-1 flex-col gap-6 px-5 py-5">
          {!canEdit && <Banner>Operaciones puede consultar el producto. Para editarlo se necesita el rol Dueño.</Banner>}
          <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-ink-soft">Línea</span>
              {isNew ? (
                <div className="max-w-full overflow-x-auto">
                  <Segmented options={LINE_OPTIONS} value={form.line} onChange={(line) => set(withLine(form, line, catalog.colors))} label="Línea" />
                </div>
              ) : (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                  <LineTag line={form.line} />
                  <span className="text-[12px] text-ink-soft">La línea forma parte del SKU; no cambia al editar.</span>
                </p>
              )}
            </div>

            <Field id={id('name')} label="Nombre" error={errors.name}>
              {(p) => <input {...p} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej. Calceta Copo Navideño" />}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              {form.line === 'sokko' && (
                <Field id={id('nameJp')} label="Nombre en japonés *" error={errors.nameJp}>
                  {(p) => <input {...p} lang="ja" value={form.nameJp ?? ''} onChange={(e) => set({ nameJp: e.target.value })} placeholder="Ej. 折紙・夜" />}
                </Field>
              )}
              <Field id={id('material')} label="Material" error={errors.material}>
                {(p) => <input {...p} value={form.material ?? ''} onChange={(e) => set({ material: e.target.value })} placeholder="Ej. Algodón peinado" />}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={id('brand')} label="Marca" error={errors.brand}>
                {(p) => (
                  <select {...p} value={form.brand} onChange={(e) => set({ brand: e.target.value })}>
                    {catalog.brands.map((b) => (
                      <option key={b.slug} value={b.slug}>
                        {b.name}
                        {b.isOwnBrand ? ' (propia)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field
                id={id('type')}
                label="Tipo"
                hint={`Tallas: ${label(SIZE_SYSTEM_LABELS, type.sizeSystem)} (${sizes.map((s) => s.code).join(' / ')}) · se cuenta por ${label(UNIT_LABELS, type.unit).toLowerCase()}`}
              >
                {(p) => (
                  <select {...p} value={form.type} onChange={(e) => set({ type: e.target.value })}>
                    {catalog.types.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id={id('collection')}
                label={`Colección${form.line === 'especiales' ? ' *' : ''}`}
                error={errors.collection}
                hint={
                  collection?.kind === 'temporada'
                    ? `Fuera de ${dayMonth(collection.startMonth, collection.startDay)} → ${dayMonth(collection.endMonth, collection.endDay)} se oculta y se vende con ${pct(collection.offSeasonDiscountPct)} de descuento.`
                    : null
                }
              >
                {(p) => (
                  <select {...p} value={form.collection ?? ''} onChange={(e) => set({ collection: e.target.value || null })}>
                    <option value="">Sin colección</option>
                    {catalog.collections.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name} · {c.kind === 'temporada' ? `${dayMonth(c.startMonth, c.startDay)} → ${dayMonth(c.endMonth, c.endDay)}` : 'temática'}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field
                id={id('pack')}
                label="Unidades por paquete"
                hint={
                  Number(form.unitsPerPack) > 1
                    ? `Se vende como "${unitText(type.unit, Number(form.unitsPerPack))}" y cuenta como 1 unidad de stock.`
                    : `Se vende por ${label(UNIT_LABELS, type.unit).toLowerCase()}.`
                }
              >
                {(p) => (
                  <input {...p} className={`${p.className} tnum`} type="number" min="1" max="12" inputMode="numeric" value={form.unitsPerPack} onChange={(e) => set({ unitsPerPack: e.target.value })} />
                )}
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field id={id('price')} label="Precio (IVA incluido)" error={errors.price}>
                {(p) => <input {...p} className={`${p.className} tnum`} type="number" min="0" step="0.01" inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value })} />}
              </Field>
              {canSeeCosts ? (
                <Field
                  id={id('cost')}
                  label="Costo de compra"
                  error={errors.unitCost}
                  hint={margin == null ? 'Sin costo no se calcula margen.' : `Margen: ${formatMXN(price - cost, 2)} por unidad (${pct(margin)})`}
                >
                  {(p) => (
                    <input
                      {...p}
                      className={`${p.className} tnum`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="Sin registrar"
                      value={form.unitCost}
                      onChange={(e) => set({ unitCost: e.target.value })}
                    />
                  )}
                </Field>
              ) : (
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-ink-soft">Costo de compra</span>
                  <p className={`${FIELD} flex items-center gap-2 border-line bg-linen text-ink-soft`}>
                    <Icon name="lock" className="h-4 w-4" />
                    Solo Dueño
                  </p>
                </div>
              )}
            </div>

            <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={errors.colors ? id('colors-error') : undefined}>
              <legend className="mb-2 text-[12px] font-medium text-ink-soft">{form.line === 'sokko' ? 'Tonos Kyoto' : 'Colores o diseños'}</legend>
              <div className="flex flex-wrap gap-2">
                {colorChoices.map((c) => {
                  const on = form.colors.includes(c.code)
                  return (
                    <button
                      key={c.code}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ colors: on ? form.colors.filter((x) => x !== c.code) : [...form.colors, c.code] })}
                      className={`flex h-8 max-lg:h-11 items-center gap-1.5 rounded-full border pr-2.5 pl-1.5 text-[12.5px] disabled:opacity-55 ${on ? 'border-ink bg-linen' : 'border-line'}`}
                    >
                      <Swatch color={c} />
                      {c.name}
                    </button>
                  )
                })}
              </div>
              {errors.colors && (
                <p id={id('colors-error')} className="text-[12.5px] text-laca">
                  {errors.colors}
                </p>
              )}
            </fieldset>

            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12px] font-medium text-ink-soft">Variantes · {variants.length}</span>
                <span className="text-[12px] text-ink-soft">El SKU se genera solo</span>
              </div>
              <div className="overflow-x-auto rounded-md border border-line">
                <table className={`${TABLE} min-w-[480px]`}>
                  <thead>
                    <tr>
                      <th className={TH}>SKU</th>
                      <th className={TH}>Color</th>
                      <th className={TH}>Talla</th>
                      <th className={TH}>Código de barras</th>
                      <th className={`${TH} text-right`}>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => {
                      const err = errors[`barcode:${v.sku}`]
                      return (
                        <tr key={v.sku} className="last:[&>td]:border-b-0">
                          <td className={`${TD} font-mono text-[12px] whitespace-nowrap`}>{v.sku}</td>
                          <td className={TD}>
                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                              <Swatch color={v.color} />
                              {v.color.name}
                            </span>
                          </td>
                          <td className={`${TD} whitespace-nowrap`}>
                            {v.size.code} <span className="text-[12px] text-ink-soft">{v.size.label}</span>
                          </td>
                          <td className={`${TD} min-w-[150px]`}>
                            <input
                              aria-label={`Código de barras ${v.sku}`}
                              aria-invalid={Boolean(err)}
                              aria-describedby={err ? id(`bc-${v.sku}`) : undefined}
                              className={`h-8 max-lg:h-11 w-full rounded-md border bg-paper px-2 font-mono text-[12px] outline-none focus:border-ai disabled:bg-linen ${err ? 'border-laca' : 'border-line'}`}
                              placeholder={form.line === 'marcas' ? 'UPC del proveedor' : 'Opcional'}
                              inputMode="numeric"
                              value={form.barcodes[v.sku] ?? ''}
                              onChange={(e) => set({ barcodes: { ...form.barcodes, [v.sku]: e.target.value.trim() } })}
                            />
                            {err && (
                              <p id={id(`bc-${v.sku}`)} className="mt-1 text-[12px] text-laca">
                                {err}
                              </p>
                            )}
                          </td>
                          <td className={`${TD} tnum text-right text-ink-soft`}>{stockBySku[v.sku] ?? 0}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[12px] text-ink-soft">El stock se ajusta en Inventario; aquí solo se consulta.</p>
            </div>
          </fieldset>
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper px-5 py-3">
          <span className="text-[12.5px] text-ink-soft" role="status">
            {hasErrors ? <span className="text-laca">{errors.form ?? MSG.review}</span> : canEdit ? 'Los cambios se aplican en la tienda al guardar.' : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              {canEdit ? 'Cancelar' : 'Cerrar'}
            </Button>
            {canEdit && (
              <Button onClick={save} disabled={saving}>
                Guardar producto
              </Button>
            )}
          </div>
        </div>
      </div>
    </SidePanel>
  )
}
