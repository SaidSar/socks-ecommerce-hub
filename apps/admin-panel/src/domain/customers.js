// Clientes del panel (solo el Dueño). Mismas reglas que CustomerAdminService en la API; el modo mock las usa sobre sus pedidos.
import { normalize } from '../utils/format'
import { toCsv } from './csv'

export const PAGE_SIZE = 25

export const CUSTOMER_TYPES = [
  { key: 'todos', label: 'Todos' },
  { key: 'cuenta', label: 'Con cuenta' },
  { key: 'invitados', label: 'Invitados' },
]

export const CUSTOMER_SORTS = [
  { key: 'ultima_compra', label: 'Última compra' },
  { key: 'total', label: 'Total gastado' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'alta', label: 'Cliente desde' },
]

export const KIND_LABELS = { cuenta: 'Con cuenta', invitado: 'Invitado' }

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase()
const counts = (o) => o.status !== 'cancelado'
const isSale = (o) => o.status !== 'cancelado' && o.paymentStatus === 'pagado'

/**
 * Filas de clientes a partir de los pedidos. `accounts`: [{ id, name, email, preferredSize, marketingOptIn, createdAt }].
 * Los pedidos con `customer.userId` son de una cuenta; los demás se agrupan por correo normalizado como invitados.
 */
export function buildCustomers(orders, accounts) {
  const byUser = new Map(accounts.map((a) => [a.id, []]))
  const guests = new Map()
  for (const o of orders) {
    if (o.customer.userId != null && byUser.has(o.customer.userId)) byUser.get(o.customer.userId).push(o)
    else {
      const key = normalizeEmail(o.customer.email)
      guests.set(key, [...(guests.get(key) ?? []), o])
    }
  }
  const stats = (list) => {
    const counted = list.filter(counts)
    return {
      orders: counted.length,
      spent: list.filter(isSale).reduce((a, o) => a + o.total, 0),
      lastOrderAt: counted.length ? counted.map((o) => o.created).sort().at(-1) : null,
    }
  }
  const rows = accounts.map((a) => ({
    id: a.id,
    kind: 'cuenta',
    name: a.name,
    email: a.email,
    ...stats(byUser.get(a.id)),
    preferredSize: a.preferredSize ?? null,
    marketingOptIn: Boolean(a.marketingOptIn),
    customerSince: a.createdAt,
  }))
  for (const [email, list] of guests) {
    const latest = [...list].sort((x, y) => (x.created < y.created ? 1 : -1))[0]
    rows.push({
      id: null,
      kind: 'invitado',
      name: latest.customer.name,
      email,
      ...stats(list),
      preferredSize: null,
      marketingOptIn: false,
      customerSince: list.map((o) => o.created).sort()[0],
    })
  }
  return rows
}

const ofType = (row, type) => (type === 'cuenta' ? row.kind === 'cuenta' : type === 'invitados' ? row.kind === 'invitado' : true)

const SORTERS = {
  total: (a, b) => b.spent - a.spent,
  pedidos: (a, b) => b.orders - a.orders,
  alta: (a, b) => (b.customerSince > a.customerSince ? 1 : b.customerSince < a.customerSince ? -1 : 0),
  ultima_compra: (a, b) => ((b.lastOrderAt ?? '') > (a.lastOrderAt ?? '') ? 1 : (b.lastOrderAt ?? '') < (a.lastOrderAt ?? '') ? -1 : 0),
}

/** Búsqueda por nombre o correo (sin acentos ni mayúsculas), tipo, orden y página. */
export function queryCustomers(rows, { type = 'todos', q = '', sort = 'ultima_compra', page = 1 } = {}) {
  const term = normalize(q)
  const found = rows.filter((r) => !term || normalize(r.name).includes(term) || r.email.includes(term))
  const countsByType = Object.fromEntries(CUSTOMER_TYPES.map((t) => [t.key, found.filter((r) => ofType(r, t.key)).length]))
  const sorter = SORTERS[sort] ?? SORTERS.ultima_compra
  const list = found.filter((r) => ofType(r, type)).sort((a, b) => sorter(a, b) || a.name.localeCompare(b.name, 'es-MX'))
  const current = Math.max(1, page)
  return { all: list, customers: list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), counts: countsByType, total: list.length, page: current, pageSize: PAGE_SIZE }
}

const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Mazatlan' }) : null)

/** Mismas columnas que /api/admin/customers/export.csv. */
export const customersCsv = (rows) =>
  toCsv(
    ['Nombre', 'Correo', 'Tipo', 'Pedidos', 'Total gastado', 'Última compra', 'Talla preferida', 'Acepta novedades', 'Cliente desde'],
    rows.map((r) => [r.name, r.email, KIND_LABELS[r.kind], r.orders, r.spent, day(r.lastOrderAt), r.preferredSize, r.marketingOptIn, day(r.customerSince)]),
    [4],
  )

/** Mismas columnas que /api/admin/customers/marketing.csv. */
export const marketingCsv = (rows) =>
  toCsv(
    ['Nombre', 'Correo', 'Talla preferida', 'Cliente desde'],
    rows.filter((r) => r.marketingOptIn).map((r) => [r.name, r.email, r.preferredSize, day(r.customerSince)]),
  )

export const customersCsvName = (today) => `sokko-clientes-${today}.csv`
export const marketingCsvName = (today) => `sokko-contactos-novedades-${today}.csv`
