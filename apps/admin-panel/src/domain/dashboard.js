// Cálculos del dashboard (DESIGN_ADMIN.md §5.5). Funciones puras sobre los datos del servicio.
import { available } from './inventory'
import { isLate } from './orders'

export const RANGES = [
  { key: 'hoy', label: 'Hoy', days: 1 },
  { key: '7d', label: '7 días', days: 7 },
  { key: '30d', label: '30 días', days: 30 },
]

const sum = (list, k) => list.reduce((a, d) => a + d[k], 0)

/** Variación porcentual; null si no hay base para comparar. */
export function pctChange(cur, prev) {
  if (!prev) return null
  return ((cur - prev) / prev) * 100
}

/**
 * KPIs del periodo. `daily`: 30 días, del más antiguo al más reciente, con
 * { date, v, orders, free, prev, prevOrders, prevFree } (prev* = mismo día del periodo anterior).
 * "Hoy" se compara contra el mismo día de la semana anterior; 7d/30d contra el periodo previo.
 */
export function computeKpis(daily, range) {
  const days = RANGES.find((r) => r.key === range)?.days ?? 1
  const cur = daily.slice(-days)
  const sales = sum(cur, 'v')
  const orders = sum(cur, 'orders')
  const free = sum(cur, 'free')
  let prev
  if (range === 'hoy') {
    const ref = daily[daily.length - 8]
    prev = { sales: ref.v, orders: ref.orders, free: ref.free, date: ref.date }
  } else {
    prev = { sales: sum(cur, 'prev'), orders: sum(cur, 'prevOrders'), free: sum(cur, 'prevFree'), date: null }
  }
  const ticket = orders ? sales / orders : 0
  const prevTicket = prev.orders ? prev.sales / prev.orders : 0
  const freePct = orders ? (free / orders) * 100 : 0
  const prevFreePct = prev.orders ? (prev.free / prev.orders) * 100 : 0
  return {
    range,
    sales: { value: sales, prev: prev.sales, delta: pctChange(sales, prev.sales) },
    orders: { value: orders, prev: prev.orders, delta: pctChange(orders, prev.orders) },
    ticket: { value: ticket, prev: prevTicket, delta: pctChange(ticket, prevTicket) },
    freePct: { value: freePct, prev: prevFreePct, delta: pctChange(freePct, prevFreePct) },
    compareDate: prev.date,
  }
}

/** Cola de trabajo: lo que necesita atención hoy. */
export function computeQueue(orders, now) {
  return {
    por_preparar: orders.filter((o) => o.status === 'por_preparar').length,
    preparando: orders.filter((o) => o.status === 'preparando').length,
    late: orders.filter((o) => isLate(o, now)).length,
    en_ruta: orders.filter((o) => o.status === 'en_ruta').length,
  }
}

const within = (o, now, days) => (new Date(now) - new Date(o.created)) / 864e5 < days

/** Piezas más vendidas en pares (últimos 30 días, sin cancelados). */
export function topPieces(orders, now, limit = 5) {
  const m = new Map()
  orders
    .filter((o) => o.status !== 'cancelado' && within(o, now, 30))
    .forEach((o) => o.items.forEach((it) => m.set(it.name, (m.get(it.name) ?? 0) + it.qty)))
  return [...m.entries()]
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v || a.k.localeCompare(b.k))
    .slice(0, limit)
}

/** Porcentaje de pares vendidos por talla. `sizes`: [{ code, label }]. Suma 100 tras redondeo. */
export function sizeShare(orders, now, sizes) {
  const m = Object.fromEntries(sizes.map((s) => [s.code, 0]))
  orders
    .filter((o) => o.status !== 'cancelado' && within(o, now, 30))
    .forEach((o) => o.items.forEach((it) => (m[it.size] = (m[it.size] ?? 0) + it.qty)))
  const total = Object.values(m).reduce((a, b) => a + b, 0) || 1
  const rows = sizes.map((s) => ({ k: `${s.code} · ${s.label}`, code: s.code, v: Math.round((m[s.code] / total) * 100) }))
  const drift = 100 - rows.reduce((a, r) => a + r.v, 0)
  if (drift && total > 1) rows.reduce((max, r) => (r.v > max.v ? r : max), rows[0]).v += drift
  return rows
}

/** Pares restantes de cada edición limitada; alerta con menos del 20 % del tiraje. */
export function limitedEditions(pieces, inventory) {
  return pieces
    .filter((p) => p.edition)
    .map((p) => {
      const left = inventory.filter((r) => r.pieceId === p.id).reduce((a, r) => a + r.stock, 0)
      const ratio = left / p.edition
      return { id: p.id, name: p.name, edition: p.edition, left, ratio, low: ratio < 0.2 }
    })
}

/** SKU con disponible ≤ umbral, de menor a mayor disponible. */
export function inventoryAlerts(inventory, few) {
  return inventory
    .map((r) => ({ ...r, available: available(r) }))
    .filter((r) => r.available <= few)
    .sort((a, b) => a.available - b.available || a.sku.localeCompare(b.sku))
}

export function recentOrders(orders, limit = 5) {
  return [...orders].sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, limit)
}

/** Todo el dashboard en una llamada (equivale a GET /api/admin/dashboard?range=…). */
export function buildDashboard({ daily, orders, inventory, pieces, sizes, few, range, now }) {
  return {
    kpis: computeKpis(daily, range),
    queue: computeQueue(orders, now),
    alerts: inventoryAlerts(inventory, few),
    top: topPieces(orders, now),
    sizes: sizeShare(orders, now, sizes),
    editions: limitedEditions(pieces, inventory),
    recent: recentOrders(orders),
    daily,
    few,
  }
}
