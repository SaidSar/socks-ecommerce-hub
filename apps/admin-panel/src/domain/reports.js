// Reportes de ventas (sección Reportes, solo el Dueño). Periodos en fechas locales de Los Mochis (America/Mazatlan), como la API.
import { localDate, parseDate } from './season'

export const MAX_DAYS = 366

export const PERIODS = [
  { key: 'mes', label: 'Este mes' },
  { key: 'mes_anterior', label: 'Mes anterior' },
  { key: '30d', label: 'Últimos 30 días' },
  { key: 'anio', label: 'Este año' },
  { key: 'custom', label: 'Personalizado' },
]

const pad = (n) => String(n).padStart(2, '0')

/** `{ year, month, day }` → "AAAA-MM-DD". */
export const isoOf = ({ year, month, day }) => `${year}-${pad(month)}-${pad(day)}`

// Aritmética de calendario en UTC: sin horas de por medio no hay saltos por zona horaria.
const toUtc = (text) => {
  const d = parseDate(text)
  return d ? Date.UTC(d.year, d.month - 1, d.day) : NaN
}
const fromUtc = (ms) => {
  const d = new Date(ms)
  return isoOf({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() })
}
const DAY = 86400e3

export const addDays = (iso, n) => fromUtc(toUtc(iso) + n * DAY)

/** Días del periodo, inclusivo. */
export const daysBetween = (from, to) => Math.round((toUtc(to) - toUtc(from)) / DAY) + 1

const lastDayOf = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate()

/** Hoy en la tienda, "AAAA-MM-DD". */
export const todayIso = (now = new Date()) => isoOf(localDate(now))

/** Rango `{ from, to }` de un periodo predefinido; `today` en "AAAA-MM-DD". */
export function periodRange(key, today) {
  const t = parseDate(today)
  switch (key) {
    case 'mes':
      return { from: isoOf({ ...t, day: 1 }), to: today }
    case 'mes_anterior': {
      const year = t.month === 1 ? t.year - 1 : t.year
      const month = t.month === 1 ? 12 : t.month - 1
      return { from: isoOf({ year, month, day: 1 }), to: isoOf({ year, month, day: lastDayOf(year, month) }) }
    }
    case '30d':
      return { from: addDays(today, -29), to: today }
    case 'anio':
      return { from: isoOf({ year: t.year, month: 1, day: 1 }), to: today }
    default:
      return null
  }
}

/** ¿Qué periodo predefinido es este rango? 'custom' si ninguno. */
export function periodKeyOf(from, to, today) {
  return PERIODS.find((p) => {
    const r = periodRange(p.key, today)
    return r && r.from === from && r.to === to
  })?.key ?? 'custom'
}

/** Mismas reglas que ReportPeriod.Parse en la API. Devuelve `{ from?, to? }` con el mensaje de cada campo. */
export function validatePeriod(from, to) {
  const errors = {}
  if (!from) errors.from = 'Elija la fecha de inicio.'
  else if (!parseDate(from)) errors.from = 'Escriba la fecha como AAAA-MM-DD.'
  if (!to) errors.to = 'Elija la fecha final.'
  else if (!parseDate(to)) errors.to = 'Escriba la fecha como AAAA-MM-DD.'
  if (Object.keys(errors).length) return errors
  if (to < from) errors.to = 'La fecha final es anterior a la de inicio.'
  else if (daysBetween(from, to) > MAX_DAYS) errors.to = `El periodo puede ser de ${MAX_DAYS} días como máximo.`
  return errors
}

/** El periodo de la URL si es válido; si no, este mes. */
export function periodFromParams(params, today) {
  const from = params.get('from')
  const to = params.get('to')
  if (from && to && !Object.keys(validatePeriod(from, to)).length) return { from, to }
  return periodRange('mes', today)
}

/** Periodo anterior de la misma duración (para el mock; la API lo manda hecho). */
export function previousPeriod(from, to) {
  const days = daysBetween(from, to)
  return { from: addDays(from, -days), to: addDays(from, -1) }
}

const isWholeMonth = (from, to) => {
  const f = parseDate(from)
  return f.day === 1 && to === isoOf({ ...f, day: lastDayOf(f.year, f.month) })
}

/** Mismo nombre que la API: `sokko-ventas-2026-11.csv` si es un mes completo; si no, con las dos fechas. */
export const salesCsvName = (from, to) => (isWholeMonth(from, to) ? `sokko-ventas-${from.slice(0, 7)}.csv` : `sokko-ventas-${from}_a_${to}.csv`)

/**
 * Variación contra el periodo anterior para mostrarla con flecha y texto, no solo color.
 * `inverse`: subir es malo (cancelados). `null` si no hay base para comparar.
 */
export function formatDelta(value, { inverse = false } = {}) {
  if (value == null || !Number.isFinite(value)) return { text: 'sin comparación', dir: 'none', tone: 'neutral', sr: '' }
  const rounded = Math.round(Math.abs(value) * 10) / 10
  if (rounded === 0) return { text: '0.0 %', dir: 'flat', tone: 'neutral', sr: 'Sin cambio' }
  const up = value > 0
  const good = inverse ? !up : up
  return {
    text: `${up ? '+' : '−'}${rounded.toFixed(1)} %`,
    dir: up ? 'up' : 'down',
    tone: good ? 'good' : 'bad',
    sr: up ? 'Sube' : 'Baja',
  }
}

/** "1 – 30 nov 2026" o "15 oct – 4 nov 2026". */
export function periodLabel(from, to) {
  const f = parseDate(from)
  const t = parseDate(to)
  const fmt = (d, withYear) =>
    new Date(Date.UTC(d.year, d.month - 1, d.day)).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' }).replace('.', '')
  if (from === to) return fmt(f, true)
  if (f.year === t.year && f.month === t.month) return `${f.day} – ${fmt(t, true)}`
  return `${fmt(f, f.year !== t.year)} – ${fmt(t, true)}`
}

// ---------------------------------------------------------------- Mock: mismo cálculo que ReportService en la API

const IVA = 0.16
const round2 = (n) => Math.round(n * 100) / 100
/** IVA incluido en un total con IVA, como la columna calculada de la BD. */
export const taxIncluded = (total) => round2(total - total / (1 + IVA))
const pct = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : null)
const stat = (value, prev) => ({ value, prev, delta: pct(value, prev) })
const isSale = (o) => o.status !== 'cancelado' && o.paymentStatus === 'pagado'
const noonUtc = (iso) => `${iso}T19:00:00.000Z`

/**
 * Reporte de ventas sobre pedidos del mock: `{ created, status, paymentStatus, total, shipping, pay, delivery, items }`.
 * Mismas definiciones que el Dashboard: venta = pagado y sin cancelar, en el día local del pedido.
 */
export function buildSalesReport(orders, from, to) {
  const prev = previousPeriod(from, to)
  const dayOf = (o) => todayIso(new Date(o.created))
  const inRange = (o, p) => dayOf(o) >= p.from && dayOf(o) <= p.to
  const sales = orders.filter(isSale)
  const cur = sales.filter((o) => inRange(o, { from, to }))
  const before = sales.filter((o) => inRange(o, prev))
  const sum = (list, f) => round2(list.reduce((a, o) => a + f(o), 0))
  const units = (list) => list.reduce((a, o) => a + o.items.reduce((b, i) => b + i.qty, 0), 0)
  const ticket = (list) => (list.length ? round2(sum(list, (o) => o.total) / list.length) : 0)
  const cancelled = (p) => orders.filter((o) => o.status === 'cancelado' && inRange(o, p)).length

  const days = daysBetween(from, to)
  const byDay = (iso) => sales.filter((o) => dayOf(o) === iso)
  const daily = Array.from({ length: days }, (_, i) => {
    const d = byDay(addDays(from, i))
    const p = byDay(addDays(prev.from, i))
    return { date: noonUtc(addDays(from, i)), v: sum(d, (o) => o.total), orders: d.length, prev: sum(p, (o) => o.total), prevOrders: p.length }
  })

  const items = cur.flatMap((o) => o.items)
  const lineOf = (i) => i.line ?? 'sokko'
  const lines = ['sokko', 'marcas', 'especiales', 'accesorios'].map((line) => {
    const sold = items.filter((i) => lineOf(i) === line)
    return { line, units: sold.reduce((a, i) => a + i.qty, 0), revenue: round2(sold.reduce((a, i) => a + i.qty * i.price, 0)) }
  })
  const products = new Map()
  for (const i of items) {
    const p = products.get(i.pieceId) ?? { productId: i.pieceId, name: i.name, line: lineOf(i), units: 0, revenue: 0 }
    p.units += i.qty
    p.revenue = round2(p.revenue + i.qty * i.price)
    products.set(i.pieceId, p)
  }
  const top = [...products.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue || a.name.localeCompare(b.name, 'es-MX')).slice(0, 10)
  const payments = ['tarjeta', 'oxxo_pay'].map((method) => {
    const list = cur.filter((o) => o.pay === method)
    return { method, orders: list.length, sales: sum(list, (o) => o.total) }
  })
  const deliveries = ['local', 'paqueteria'].map((method) => {
    const list = cur.filter((o) => o.delivery === method)
    return { method, orders: list.length, sales: sum(list, (o) => o.total), shipping: sum(list, (o) => o.shipping) }
  })

  return {
    from,
    to,
    prevFrom: prev.from,
    prevTo: prev.to,
    kpis: {
      sales: stat(sum(cur, (o) => o.total), sum(before, (o) => o.total)),
      orders: stat(cur.length, before.length),
      ticket: stat(ticket(cur), ticket(before)),
      taxIncluded: stat(sum(cur, (o) => taxIncluded(o.total)), sum(before, (o) => taxIncluded(o.total))),
      shipping: stat(sum(cur, (o) => o.shipping), sum(before, (o) => o.shipping)),
      // Descuentos de cupón. Las ventas ya son el total cobrado (neto de descuento).
      discounts: stat(sum(cur, (o) => o.discountAmount ?? 0), sum(before, (o) => o.discountAmount ?? 0)),
      cancelled: stat(cancelled({ from, to }), cancelled(prev)),
      units: stat(units(cur), units(before)),
    },
    daily,
    lines,
    top,
    payments,
    deliveries,
  }
}
