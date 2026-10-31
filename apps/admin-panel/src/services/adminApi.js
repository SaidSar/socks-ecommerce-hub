// API del panel (DESIGN_ADMIN.md §6.2). Con USE_API, Catálogo, Configuración y Usuarios van a /api/admin/* (adminCatalogApi.js);
// lo demás sigue simulado: estado en memoria persistido en localStorage y, si el almacenamiento falla, solo en memoria.
// Cada función devuelve copias: los componentes nunca mutan el estado ni ven seed.js.
import { can } from '../config/roles'
import { brandMargins, grossMargin, lineStats, productDto, seasonStatus, skuOf, validateCollection, validateProduct } from '../domain/catalog'
import { buildDashboard } from '../domain/dashboard'
import { LINES, stockUnit } from '../domain/enums'
import { buildTemplate, previewCsv, rowsToCsv } from '../domain/importCsv'
import { applyInitial, applyMovement, applySale, available, matchesStockFilter, release, sortMovements, stockState, STOCK_FILTERS } from '../domain/inventory'
import { advance, cancel, countByFilter, isLate, markPaid, matchesFilter, matchesQuery } from '../domain/orders'
import { computeShipping, formatZone, validateZone } from '../domain/shipping'
import { localDate } from '../domain/season'
import { normalize } from '../utils/format'
import { COLORS } from '../data/catalogSeed'
import { COURIERS, createSeed, DEMO_NOW, SEED_VERSION, SIZES } from '../data/seed'
import { listUsers, shortName } from './adminAuth'
import * as catalogApi from './adminCatalogApi'
import { USE_API } from './api'
import { ApiError } from './apiError'

export const STORAGE_KEY = 'sokko.admin.data.v1'

export { ApiError }

let state = null

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.version === SEED_VERSION) return parsed
    }
  } catch {
    /* almacenamiento bloqueado o JSON dañado: se vuelve a la semilla */
  }
  return { ...createSeed(), clock: { demo: DEMO_NOW.toISOString(), real: Date.now() } }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* sin almacenamiento: solo memoria */
  }
}

const db = () => (state ??= load())
const copy = (x) => structuredClone(x)
const latency = () => new Promise((r) => setTimeout(r, import.meta.env.MODE === 'test' ? 0 : 200 + Math.random() * 300))

/** "Ahora" de referencia para atrasos y dashboard. TODO(api): usar fecha del servidor. */
const refNow = () => DEMO_NOW
/** Sello de tiempo de los cambios: el reloj demo avanza a ritmo real desde DEMO_NOW. */
const stamp = () => {
  const { clock } = db()
  return new Date(new Date(clock.demo).getTime() + Math.max(0, Date.now() - clock.real)).toISOString()
}

const by = (user) => shortName(user?.name ?? 'Sistema')

// El servidor manda el nombre y color del tono junto con cada SKU (tonos Kyoto y colores de las demás líneas).
const colorOf = (apiCode) => COLORS.find((c) => c.apiCode === apiCode)
const withTone = (x) => ({ ...x, toneName: colorOf(x.tone)?.name ?? x.tone, toneHex: colorOf(x.tone)?.hex ?? '#ccc' })

// Sin `money.view` el servidor no manda importes (Operaciones).
function redactOrder(order, role) {
  const items = order.items.map(withTone)
  if (can(role, 'money.view')) return { ...order, items }
  const { subtotal: _s, total: _t, ...rest } = order
  return { ...rest, items: items.map(({ price: _p, ...it }) => it) }
}

const findOrder = (id) => {
  const o = db().orders.find((x) => x.id === id)
  if (!o) throw new ApiError('No encontramos ese pedido.', 404)
  return o
}
const findRow = (sku) => {
  const r = db().inventory.find((x) => x.sku === sku)
  if (!r) throw new ApiError('El SKU no existe en el catálogo.', 404)
  return r
}
const replaceOrder = (o) => (db().orders = db().orders.map((x) => (x.id === o.id ? o : x)))
const replaceRow = (r) => (db().inventory = db().inventory.map((x) => (x.sku === r.sku ? r : x)))

// ---------------------------------------------------------------- Resumen (sidebar y campana)

/** TODO(api): GET /api/admin/orders/summary */
export async function getSummary() {
  await latency()
  const { orders } = db()
  return { toPrepare: orders.filter((o) => o.status === 'por_preparar').length, late: orders.filter((o) => isLate(o, refNow())).length }
}

// ---------------------------------------------------------------- Dashboard

/** TODO(api): GET /api/admin/dashboard?range=hoy|7d|30d */
export async function getDashboard(range = 'hoy', role) {
  await latency()
  const { daily, orders, inventory, pieces, settings } = db()
  const data = buildDashboard({ daily, orders, inventory, pieces, sizes: SIZES, few: settings.fewUnitsThreshold, range, now: refNow() })
  data.recent = data.recent.map((o) => redactOrder(o, role))
  data.alerts = data.alerts.map(withTone)
  data.now = refNow().toISOString()
  data.freeShippingThreshold = settings.freeShippingThreshold
  if (!can(role, 'money.view')) {
    data.kpis.sales = null
    data.kpis.ticket = null
    data.daily = null
  }
  return copy(data)
}

// ---------------------------------------------------------------- Pedidos

/** TODO(api): GET /api/admin/orders?status=&q= */
export async function getOrders({ filter = 'todos', q = '' } = {}, role) {
  await latency()
  const now = refNow()
  const all = [...db().orders].sort((a, b) => new Date(b.created) - new Date(a.created))
  const list = all.filter((o) => matchesFilter(o, filter, now) && matchesQuery(o, q))
  return copy({ orders: list.map((o) => redactOrder(o, role)), counts: countByFilter(all, now), total: all.length, now: now.toISOString() })
}

/** TODO(api): GET /api/admin/orders/{folio} */
export async function getOrder(id, role) {
  await latency()
  return copy(redactOrder(findOrder(id), role))
}

/**
 * Avanza el pedido al siguiente estado. Al pasar a enviado/en_ruta descuenta stock y apartado
 * y escribe "Venta · Pedido {folio}" en el kárdex de cada SKU.
 * TODO(api): POST /api/admin/orders/{folio}/transitions
 */
export async function advanceOrder(id, payload, user) {
  await latency()
  const current = findOrder(id)
  const at = stamp()
  const { order, error } = advance(current, payload, by(user), at)
  if (error) throw new ApiError(error)
  if (order.status === 'enviado' || order.status === 'en_ruta') {
    order.items.forEach((it) => {
      const res = applySale(findRow(it.sku), it.qty, order.id, by(user), at)
      replaceRow(res.row)
      db().movements.push(res.movement)
    })
  }
  replaceOrder(order)
  save()
  return copy(redactOrder(order, user?.role))
}

/**
 * Marca como pagado un pedido con pago pendiente (OXXO Pay). Solo el Dueño.
 * TODO(api): POST /api/admin/orders/{folio}/payment. En producción el pago lo confirma el webhook de la pasarela
 * (OXXO Pay avisa al servidor cuando el cliente paga), no una persona; este botón queda solo como respaldo manual.
 */
export async function markOrderPaid(id, user) {
  await latency()
  if (!can(user?.role, 'payments.confirm')) throw new ApiError('Solo el Dueño puede confirmar pagos.', 403)
  const { order, error } = markPaid(findOrder(id), by(user), stamp())
  if (error) throw new ApiError(error, 409)
  replaceOrder(order)
  save()
  return copy(redactOrder(order, user?.role))
}

/** Cancela y libera los pares apartados. TODO(api): POST /api/admin/orders/{folio}/cancel */
export async function cancelOrder(id, user) {
  await latency()
  const { order, error } = cancel(findOrder(id), by(user), stamp())
  if (error) throw new ApiError(error)
  order.items.forEach((it) => replaceRow(release(findRow(it.sku), it.qty)))
  replaceOrder(order)
  save()
  return copy(redactOrder(order, user?.role))
}

/** TODO(api): PUT /api/admin/orders/{folio}/note */
export async function saveOrderNote(id, note, user) {
  await latency()
  const order = { ...findOrder(id), note: String(note ?? '').trim() }
  replaceOrder(order)
  save()
  return copy(redactOrder(order, user?.role))
}

// ---------------------------------------------------------------- Inventario

const decorate = (r, few, pieces) => {
  const avail = available(r)
  return withTone({ ...r, available: avail, state: stockState(avail, few), edition: pieces.find((p) => p.id === r.pieceId)?.edition ?? null })
}

/** TODO(api): GET /api/admin/inventory?state=&q= */
export async function getInventory({ filter = 'todos', q = '' } = {}) {
  await latency()
  const { inventory, settings, pieces } = db()
  const few = settings.fewUnitsThreshold
  const rows = inventory.map((r) => decorate(r, few, pieces))
  const term = normalize(q)
  const list = rows.filter((r) => matchesStockFilter(r, filter, few) && (!term || normalize(`${r.sku} ${r.piece} ${colorOf(r.tone)?.name ?? r.tone}`).includes(term)))
  const counts = Object.fromEntries(STOCK_FILTERS.map((f) => [f.key, rows.filter((r) => matchesStockFilter(r, f.key, few)).length]))
  const totals = {
    units: rows.reduce((a, r) => a + r.stock, 0),
    reserved: rows.reduce((a, r) => a + r.reserved, 0),
    out: counts.agotado,
    few: counts.pocos,
  }
  return copy({ rows: list, counts, totals, few, total: rows.length })
}

/** Una fila con su estado. */
export async function getStockRow(sku) {
  await latency()
  const { settings, pieces } = db()
  return copy(decorate(findRow(sku), settings.fewUnitsThreshold, pieces))
}

/** Kárdex del más reciente al más antiguo. TODO(api): GET /api/admin/inventory/{sku}/movements */
export async function getMovements(sku) {
  await latency()
  findRow(sku)
  return copy(sortMovements(db().movements.filter((m) => m.sku === sku)))
}

/** TODO(api): POST /api/admin/inventory/{sku}/movements */
export async function adjustStock(sku, { type, qty, note, folio }, user) {
  await latency()
  const orderExists = (code) => db().orders.some((o) => o.id === code)
  const res = applyMovement(findRow(sku), { type, qty, note, folio }, by(user), stamp(), { orderExists })
  // 409 si choca con pares apartados (R-27), 422 si el dato es inválido; nunca 500.
  if (res.error) {
    const err = new ApiError(res.error, res.status)
    err.field = res.field
    throw err
  }
  replaceRow(res.row)
  db().movements.push(res.movement)
  save()
  return copy({ row: res.row, movement: res.movement })
}

/** TODO(api): POST /api/admin/inventory/import/preview */
export async function previewImport(csvText, role) {
  await latency()
  return copy(previewCsv(csvText, db().inventory, db().catalog, { canSeeCosts: can(role, 'costs.view') }))
}

/**
 * Aplica solo filas válidas como "Inventario inicial · Importado desde CSV", y los datos de catálogo de las
 * columnas opcionales (marca, colección, unidades por paquete, costo solo del Dueño y código de barras).
 * El servidor vuelve a validar: lo que llega del navegador no se da por bueno.
 * TODO(api): POST /api/admin/inventory/import
 */
export async function applyImport(rows, user) {
  await latency()
  const { inventory, catalog } = db()
  const { valid } = previewCsv(rowsToCsv(rows), inventory, catalog, { canSeeCosts: can(user?.role, 'costs.view') })
  const at = stamp()
  valid.forEach((r) => {
    const res = applyInitial(findRow(r.sku), r.stock, by(user), at)
    replaceRow(res.row)
    db().movements.push(res.movement)
    applyCatalogChanges(r.sku, r.changes)
  })
  save()
  return { applied: valid.length }
}

/** Cambios de catálogo de una fila del CSV ya validada. Unidades por paquete cambia la unidad de conteo de sus SKU. */
function applyCatalogChanges(sku, { barcode, ...fields } = {}) {
  const { catalog, inventory } = db()
  const product = catalog.products.find((p) => productSkus(p).includes(sku))
  if (!product || (!barcode && !Object.keys(fields).length)) return
  Object.assign(product, fields)
  if (barcode) product.barcodes = { ...product.barcodes, [sku]: barcode }
  if ('unitsPerPack' in fields) {
    const skus = productSkus(product)
    inventory.filter((r) => skus.includes(r.sku)).forEach((r) => (r.unit = stockUnit(product.type, product.unitsPerPack)))
  }
}

const productSkus = (p) => {
  const { catalog } = db()
  const type = catalog.types.find((t) => t.code === p.type)
  return p.colors.flatMap((c) => catalog.sizes[type.sizeSystem].map((s) => skuOf(p.line, p.pieceNumber, c, s.code)))
}

/** CSV con los SKU actuales, su stock y los datos del catálogo (unit_cost solo para el Dueño). */
export async function getTemplateCsv(role) {
  await latency()
  const { inventory, catalog } = db()
  const owner = can(role, 'costs.view')
  const bySku = new Map(catalog.products.flatMap((p) => productSkus(p).map((sku) => [sku, p])))
  return buildTemplate(
    inventory,
    (t) => colorOf(t)?.name ?? t,
    (r) => {
      const p = bySku.get(r.sku)
      if (!p) return ['', '', '', '', '', '', '']
      return [p.line, p.brand, p.type, p.collection ?? '', p.unitsPerPack ?? 1, owner ? (p.unitCost ?? '') : '', p.barcodes?.[r.sku] ?? '']
    },
  )
}

// ---------------------------------------------------------------- Catálogo (DESIGN_CATALOG_UI.md §4)

const catalogToday = () => localDate(refNow())

function forbidden(user, permission, message) {
  if (!can(user?.role, permission)) throw new ApiError(message, 403)
}

function invalid(errors) {
  const err = new ApiError('Revisa los campos marcados.', 422)
  err.errors = errors
  return err
}

/** DTO de cada producto para el rol: unitCost y margin solo con `costs.view` (§2.2). */
function catalogProducts(role) {
  const { catalog, inventory } = db()
  const today = catalogToday()
  const canSeeCosts = can(role, 'costs.view')
  return catalog.products.map((p) => {
    const type = catalog.types.find((t) => t.code === p.type)
    return productDto(p, {
      brand: catalog.brands.find((b) => b.slug === p.brand),
      type,
      collection: catalog.collections.find((c) => c.slug === p.collection),
      colors: catalog.colors,
      sizes: catalog.sizes[type.sizeSystem],
      inventory,
      today,
      canSeeCosts,
    })
  })
}

/** Todo el catálogo para las pantallas de Productos, Marcas, Colecciones y Tipos. GET /api/admin/catalog */
export async function getCatalog(role) {
  if (USE_API) return catalogApi.getCatalog()
  await latency()
  const { catalog } = db()
  const today = catalogToday()
  const products = catalogProducts(role)
  return copy({
    today,
    products,
    brands: catalog.brands.map((b) => {
      const ps = products.filter((p) => p.brand.slug === b.slug)
      return { ...b, products: ps.length, lines: LINES.filter((l) => ps.some((p) => p.line === l)) }
    }),
    collections: catalog.collections.map((c) => ({
      ...c,
      status: seasonStatus(c, today),
      products: products.filter((p) => p.collection?.slug === c.slug).map(({ slug, name, price, offSeasonPrice }) => ({ slug, name, price, offSeasonPrice })),
    })),
    types: catalog.types.map((t) => ({ ...t, sizes: catalog.sizes[t.sizeSystem], products: products.filter((p) => p.type.code === t.code).length })),
    sizes: catalog.sizes,
    colors: catalog.colors,
  })
}

/** Resumen por línea y temporadas para el Dashboard (§4.2). Los importes y el margen solo para el Dueño. */
export async function getCatalogSummary(role) {
  await latency()
  const { catalog, settings } = db()
  const today = catalogToday()
  const products = catalogProducts(role)
  const owner = can(role, 'costs.view')
  const lines = lineStats(products, LINES)
  return copy({
    lines: owner ? lines : lines.map(({ line, units }) => ({ line, units })),
    grossMargin: owner ? grossMargin(products) : null,
    brands: owner ? brandMargins(products) : null,
    unitsSold: products.reduce((a, p) => a + p.sold, 0),
    fewUnits: products.filter((p) => p.stock <= settings.fewUnitsThreshold).map(({ slug, name, stock }) => ({ slug, name, stock })),
    seasons: catalog.collections
      .filter((c) => c.kind === 'temporada')
      .map((c) => ({
        ...c,
        status: seasonStatus(c, today),
        stock: products.filter((p) => p.collection?.slug === c.slug).reduce((a, p) => a + p.stock, 0),
      })),
  })
}

const slugify = (s) =>
  normalize(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Alta o edición de producto (§4.3). 403 sin `catalog.edit`; 422 con `errors` por campo (R-30, R-31, R-32, código de barras).
 * Las variantes nuevas (color × talla) entran al inventario con stock 0: el stock se ajusta en Inventario.
 * POST/PUT /api/admin/products
 */
export async function saveProduct(form, user) {
  if (USE_API) return catalogApi.saveProduct(form)
  await latency()
  forbidden(user, 'catalog.edit', 'Solo el Dueño puede editar productos.')
  const { catalog, inventory } = db()
  const existing = catalog.products.find((p) => p.slug === form.slug)
  const type = catalog.types.find((t) => t.code === form.type)
  const line = existing?.line ?? form.line
  const pieceNumber = existing?.pieceNumber ?? Math.max(0, ...catalog.products.filter((p) => p.line === line).map((p) => p.pieceNumber)) + 1
  const sizes = catalog.sizes[type.sizeSystem]
  const skus = form.colors.flatMap((c) => sizes.map((s) => skuOf(line, pieceNumber, c, s.code)))
  const barcodes = Object.fromEntries(Object.entries(form.barcodes ?? {}).filter(([sku, code]) => skus.includes(sku) && String(code ?? '').trim()))
  const barcodeOwners = {}
  catalog.products
    .filter((p) => p.slug !== existing?.slug)
    .forEach((p) => Object.entries(p.barcodes ?? {}).forEach(([sku, code]) => (barcodeOwners[code] = sku)))
  const errors = validateProduct({ ...form, line, barcodes }, { brands: catalog.brands, colors: catalog.colors, barcodeOwners })
  if (Object.keys(errors).length) throw invalid(errors)

  const keepCost = !can(user?.role, 'costs.view')
  const product = {
    ...(existing ?? { slug: slugify(form.name), art: 'crew', note: '', sold: 0, stock: 0 }),
    line,
    pieceNumber,
    name: form.name.trim(),
    brand: form.brand,
    type: form.type,
    collection: line === 'especiales' || form.collection ? form.collection || null : null,
    unitsPerPack: Math.max(1, Number(form.unitsPerPack) || 1),
    price: Number(form.price),
    unitCost: keepCost ? (existing?.unitCost ?? null) : form.unitCost === '' || form.unitCost == null ? null : Number(form.unitCost),
    colors: [...form.colors],
    barcodes,
  }
  if (!existing && catalog.products.some((p) => p.slug === product.slug)) product.slug = `${product.slug}-${pieceNumber}`
  catalog.products = existing ? catalog.products.map((p) => (p.slug === existing.slug ? product : p)) : [...catalog.products, product]
  const unit = stockUnit(product.type, product.unitsPerPack)
  form.colors.forEach((c) =>
    sizes.forEach((s) => {
      const sku = skuOf(line, pieceNumber, c, s.code)
      const row = inventory.find((r) => r.sku === sku)
      const tone = catalog.colors.find((x) => x.code === c).apiCode
      if (row) Object.assign(row, { piece: product.name, unit })
      else inventory.push({ sku, pieceId: product.slug, piece: product.name, tone, size: s.code, stock: 0, reserved: 0, line, unit })
    }),
  )
  save()
  return copy(catalogProducts(user?.role).find((p) => p.slug === product.slug))
}

/** Nueva marca (§4.4): sin duplicados, sin distinguir mayúsculas. POST /api/admin/brands */
export async function addBrand(name, user) {
  if (USE_API) return catalogApi.addBrand(name)
  await latency()
  forbidden(user, 'brands.edit', 'Solo el Dueño puede crear marcas.')
  const clean = String(name ?? '').trim()
  const { catalog } = db()
  if (!clean) throw invalid({ name: 'Escribe el nombre de la marca.' })
  if (catalog.brands.some((b) => normalize(b.name) === normalize(clean))) throw invalid({ name: `Ya existe la marca ${clean}.` })
  const brand = { slug: slugify(clean), name: clean, isOwnBrand: false, showInFilters: true }
  catalog.brands = [...catalog.brands, brand]
  save()
  return copy(brand)
}

/** Mostrar u ocultar una marca en el filtro de la tienda. La marca propia siempre es visible. PUT /api/admin/brands/{slug} */
export async function setBrandVisibility(slug, showInFilters, user, rowVersion) {
  if (USE_API) return catalogApi.setBrandVisibility(slug, showInFilters, rowVersion)
  await latency()
  forbidden(user, 'brands.edit', 'Solo el Dueño puede editar marcas.')
  const { catalog } = db()
  const brand = catalog.brands.find((b) => b.slug === slug)
  if (!brand) throw new ApiError('No encontramos esa marca.', 404)
  if (brand.isOwnBrand) throw new ApiError('La marca propia siempre es visible.', 409)
  brand.showInFilters = Boolean(showInFilters)
  save()
  return copy(brand)
}

/** Guarda tipo, ventana anual y descuento de una colección (§4.5). PUT /api/admin/collections/{slug} */
export async function saveCollection(form, user) {
  if (USE_API) return catalogApi.saveCollection(form)
  await latency()
  forbidden(user, 'collections.edit', 'Solo el Dueño puede editar colecciones.')
  const errors = validateCollection(form)
  if (Object.keys(errors).length) throw invalid(errors)
  const { catalog } = db()
  const current = catalog.collections.find((c) => c.slug === form.slug)
  if (!current) throw new ApiError('No encontramos esa colección.', 404)
  const next =
    form.kind === 'temporada'
      ? { ...current, kind: 'temporada', startMonth: form.startMonth, startDay: form.startDay, endMonth: form.endMonth, endDay: form.endDay, offSeasonDiscountPct: form.offSeasonDiscountPct }
      : { slug: current.slug, name: current.name, kind: 'tematica', offSeasonDiscountPct: current.offSeasonDiscountPct }
  catalog.collections = catalog.collections.map((c) => (c.slug === current.slug ? next : c))
  save()
  return copy(next)
}

/** Tipos y tallas: solo lectura en v1 (§4.6). La edición responderá 403 a Operaciones. TODO(api): PUT /api/admin/product-types/{code} */
export async function saveProductType(_code, _form, user) {
  await latency()
  forbidden(user, 'types.edit', 'Solo el Dueño puede editar tipos.')
  throw new ApiError('La edición de tipos llega en una versión posterior.', 501)
}

// ---------------------------------------------------------------- Configuración

/** GET /api/admin/settings */
export async function getSettings() {
  if (USE_API) return catalogApi.getSettings()
  await latency()
  return copy(db().settings)
}

/** Respuesta inmediata por campo; con la API, el servidor vuelve a validar (PUT /api/admin/settings). */
export function validateSettings(s) {
  const errors = {}
  const money = ['freeShippingThreshold', 'parcelShippingCost', 'localShippingCost']
  money.forEach((k) => {
    if (!Number.isInteger(s[k]) || s[k] < 0) errors[k] = 'Escriba un monto entero de 0 o más.'
  })
  if (!errors.freeShippingThreshold && s.freeShippingThreshold === 0) errors.freeShippingThreshold = 'El umbral debe ser mayor a 0.'
  if (!Number.isInteger(s.fewUnitsThreshold) || s.fewUnitsThreshold <= 0) errors.fewUnitsThreshold = 'El umbral debe ser mayor a 0.'
  if (!s.localZones?.length) errors.localZones = 'Agregue al menos un código postal a la zona local.'
  else if (s.localZones.some((z) => validateZone(z.value))) errors.localZones = 'Hay códigos postales con formato inválido.'
  return errors
}

export async function saveSettings(settings) {
  if (USE_API) return catalogApi.saveSettings(settings)
  await latency()
  const errors = validateSettings(settings)
  if (Object.keys(errors).length) {
    const err = new ApiError('Revise los campos marcados.')
    err.errors = errors
    throw err
  }
  db().settings = {
    freeShippingThreshold: settings.freeShippingThreshold,
    parcelShippingCost: settings.parcelShippingCost,
    localShippingCost: settings.localShippingCost,
    localFreeShipping: Boolean(settings.localFreeShipping),
    fewUnitsThreshold: settings.fewUnitsThreshold,
    // El IVA no se edita en el panel; se conserva el vigente.
    ivaRate: db().settings.ivaRate,
    localZones: settings.localZones.map((z) => ({ value: formatZone(z.value), label: String(z.label ?? '').trim() })),
  }
  save()
  return copy(db().settings)
}

/** Cotiza con la configuración guardada (lo mismo que hará la tienda con GET /api/config). */
export async function quoteShipping({ subtotal, postalCode }) {
  await latency()
  return computeShipping({ subtotal, postalCode }, db().settings)
}

/** GET /api/admin/users */
export async function getInternalUsers() {
  if (USE_API) return catalogApi.getInternalUsers()
  await latency()
  return [...listUsers(), ...(db().invitedUsers ?? [])]
}

/** Invita a un miembro del equipo. POST /api/admin/users/invitations */
export async function inviteUser(invitation, user) {
  if (USE_API) return catalogApi.inviteUser(invitation)
  await latency()
  forbidden(user, 'settings.manage', 'Solo el Dueño invita al equipo.')
  const email = String(invitation.email ?? '').trim().toLowerCase()
  const invited = db().invitedUsers ?? []
  if ([...listUsers(), ...invited].some((u) => u.email === email)) throw invalid({ email: 'Este correo ya tiene una cuenta.' })
  const created = { id: `u-${email}`, name: `${invitation.firstName} ${invitation.lastName}`, email, role: invitation.role }
  db().invitedUsers = [...invited, created]
  save()
  return copy(created)
}

/** Repartidores para la entrega local. TODO(api): GET /api/admin/users?role=operaciones */
export async function getCouriers() {
  await latency()
  return [...COURIERS]
}

/** Solo DEV: vuelve a la semilla. */
export async function resetDemoData() {
  await latency()
  state = { ...createSeed(), clock: { demo: DEMO_NOW.toISOString(), real: Date.now() } }
  save()
}

/** Solo para pruebas: olvida el estado en memoria. */
export function __resetForTests() {
  state = null
}
