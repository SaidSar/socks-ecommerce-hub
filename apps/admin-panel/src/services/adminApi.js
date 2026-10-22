// API simulada del panel (DESIGN_ADMIN.md §6.2). Única capa que conocerá /api/admin/*.
// Estado en memoria persistido en localStorage; si el almacenamiento falla, se trabaja solo en memoria.
// Cada función devuelve copias: los componentes nunca mutan el estado ni ven seed.js.
import { can } from '../config/roles'
import { buildDashboard } from '../domain/dashboard'
import { buildTemplate, previewCsv } from '../domain/importCsv'
import { applyInitial, applyMovement, applySale, available, matchesStockFilter, release, sortMovements, stockState, STOCK_FILTERS } from '../domain/inventory'
import { advance, cancel, countByFilter, isLate, markPaid, matchesFilter, matchesQuery } from '../domain/orders'
import { computeShipping, formatZone, validateZone } from '../domain/shipping'
import { normalize } from '../utils/format'
import { COURIERS, createSeed, DEMO_NOW, SEED_VERSION, SIZES, TONES } from '../data/seed'
import { listUsers, shortName } from './adminAuth'

export const STORAGE_KEY = 'sokko.admin.data.v1'

export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

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

// El servidor manda el nombre y color del tono junto con cada SKU.
const withTone = (x) => ({ ...x, toneName: TONES[x.tone]?.name ?? x.tone, toneHex: TONES[x.tone]?.hex ?? '#ccc' })

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
  const list = rows.filter((r) => matchesStockFilter(r, filter, few) && (!term || normalize(`${r.sku} ${r.piece} ${TONES[r.tone].name}`).includes(term)))
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
export async function previewImport(csvText) {
  await latency()
  return copy(previewCsv(csvText, db().inventory))
}

/**
 * Aplica solo filas válidas como "Inventario inicial · Importado desde CSV".
 * El servidor vuelve a validar: lo que llega del navegador no se da por bueno.
 * TODO(api): POST /api/admin/inventory/import
 */
export async function applyImport(rows, user) {
  await latency()
  const csv = ['SKU,Pieza,Tono,Talla,Stock', ...rows.map((r) => [r.sku, '', '', '', r.stock].join(','))].join('\n')
  const { valid } = previewCsv(csv, db().inventory)
  const at = stamp()
  valid.forEach((r) => {
    const res = applyInitial(findRow(r.sku), r.stock, by(user), at)
    replaceRow(res.row)
    db().movements.push(res.movement)
  })
  save()
  return { applied: valid.length }
}

/** CSV con los SKU actuales y su stock. */
export async function getTemplateCsv() {
  await latency()
  return buildTemplate(db().inventory, (t) => TONES[t]?.name ?? t)
}

// ---------------------------------------------------------------- Configuración

/** TODO(api): GET /api/admin/settings */
export async function getSettings() {
  await latency()
  return copy(db().settings)
}

/** Valida en el servidor; devuelve { errors } por campo si algo falla. TODO(api): PUT /api/admin/settings */
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

/** TODO(api): GET /api/admin/users · POST /api/admin/users/invitations */
export async function getInternalUsers() {
  await latency()
  return listUsers()
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
