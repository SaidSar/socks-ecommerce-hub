// Checkout y pedidos (DESIGN_CHECKOUT.md §6–§7). Con USE_API habla con apps/api-service; sin ella simula lo mismo con el catálogo.
import { DEFAULT_CONFIG } from '../config/commerce'
import { quoteShippingLocal, taxIncluded } from '../domain/checkout'
import { API_URL, USE_API } from './api'
import { authFetch, getSession } from './authService'
import { getProductSync } from './catalogService'

const ORDERS_KEY = 'sokko.orders.v1'
const GUEST_KEY = 'sokko.guest-orders.v1'
const OXXO_HOURS = 72
const MOCK_LATENCY_MS = 400

export class OrderError extends Error {
  /** @param {'OUT_OF_STOCK' | 'PRICE_CHANGED' | 'DECLINED' | 'ORDER_CHANGED' | 'SESSION_EXPIRED' | 'RATE_LIMITED' | 'NETWORK'} code */
  constructor(code, details = {}) {
    super(code)
    this.name = 'OrderError'
    this.code = code
    Object.assign(this, details)
  }
}

const latency = () => new Promise((resolve) => setTimeout(resolve, import.meta.env.MODE === 'test' ? 0 : MOCK_LATENCY_MS))

function readStorage(storage, key) {
  try {
    const raw = window[storage].getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeStorage(storage, key, value) {
  try {
    window[storage].setItem(key, JSON.stringify(value))
  } catch {
    /* almacenamiento no disponible: se trabaja en memoria */
  }
}

// --- Correo del invitado: se guarda en la pestaña para consultar su pedido; nunca va en la URL ---

const memoryGuests = {}

function rememberGuestOrder(folio, email) {
  memoryGuests[folio] = email
  writeStorage('sessionStorage', GUEST_KEY, { ...readStorage('sessionStorage', GUEST_KEY), [folio]: email })
}

const guestEmail = (folio) => memoryGuests[folio] ?? readStorage('sessionStorage', GUEST_KEY)?.[folio] ?? null

// --- API ---

const isJson = (response) => response.headers.get('content-type')?.includes('json')

async function apiError(response) {
  const body = isJson(response) ? await response.json() : {}
  if (response.status === 401) return new OrderError('SESSION_EXPIRED')
  if (response.status === 402) return new OrderError('DECLINED', { declineCode: body.declineCode })
  if (response.status === 409 && body.code === 'out_of_stock') return new OrderError('OUT_OF_STOCK', { lines: body.lines })
  if (response.status === 409 && body.code === 'price_changed') return new OrderError('PRICE_CHANGED', { total: body.total })
  if (response.status === 422) return new OrderError('ORDER_CHANGED')
  if (response.status === 429) return new OrderError('RATE_LIMITED')
  return new OrderError('NETWORK')
}

async function send(path, options) {
  try {
    return await authFetch(path, options)
  } catch {
    throw new OrderError('NETWORK')
  }
}

const orderHeaders = (folio) => {
  const email = guestEmail(folio)
  return email ? { 'X-Customer-Email': email } : {}
}

// --- Mock ---

let memoryOrders = null

function loadOrders() {
  return readStorage('localStorage', ORDERS_KEY) ?? memoryOrders ?? []
}

function saveOrders(orders) {
  memoryOrders = orders
  writeStorage('localStorage', ORDERS_KEY, orders)
}

/** Solo para pruebas: vacía los pedidos simulados. */
export function __resetMockOrders() {
  memoryOrders = null
  try {
    window.localStorage.removeItem(ORDERS_KEY)
  } catch {
    /* sin almacenamiento */
  }
}

/** Mismo vencimiento que el servidor (P-03): al leer, un OXXO sin pagar de más de 72 h queda cancelado. */
function withExpiry(order, now = new Date()) {
  const open = order.paymentMethod === 'oxxo_pay' && order.paymentStatus === 'pendiente' && order.status !== 'cancelado'
  if (!open) return { ...order, oxxoExpiresAt: null }
  return new Date(order.oxxoExpiresAt) <= now ? { ...order, status: 'cancelado', oxxoExpiresAt: null } : order
}

const reservedInMock = (sku) =>
  loadOrders()
    .map((o) => withExpiry(o))
    .filter((o) => o.status !== 'cancelado')
    .flatMap((o) => o.items)
    .filter((i) => i.sku === sku)
    .reduce((sum, i) => sum + i.quantity, 0)

const oxxoReference = () => `93${Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('')}`

function placeMockOrder(payload) {
  const lines = payload.items.map((item) => {
    const product = getProductSync(item.slug)
    const variant = product?.variants.find((v) => v.sku === item.sku)
    return { item, product, variant, available: variant ? variant.stock - reservedInMock(item.sku) : 0 }
  })

  const shortages = lines.filter((l) => l.available < l.item.quantity)
  if (shortages.length) {
    throw new OrderError('OUT_OF_STOCK', {
      lines: shortages.map((l) => ({ sku: l.item.sku, requested: l.item.quantity, available: Math.max(0, l.available) })),
    })
  }

  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.item.quantity, 0)
  const { method, cost } = quoteShippingLocal(payload.postalCode, subtotal, DEFAULT_CONFIG)
  const total = subtotal + cost
  if (payload.expectedTotal != null && payload.expectedTotal !== total) throw new OrderError('PRICE_CHANGED', { total })
  if (payload.paymentMethod === 'tarjeta' && payload.paymentToken !== 'tok_fake_approved') {
    throw new OrderError('DECLINED', { declineCode: payload.paymentToken === 'tok_fake_insufficient_funds' ? 'insufficient_funds' : 'declined' })
  }

  const now = new Date()
  const isCard = payload.paymentMethod === 'tarjeta'
  const orders = loadOrders()
  const order = {
    folio: `SKK-${1001 + orders.length}`,
    status: 'por_preparar',
    paymentMethod: payload.paymentMethod,
    paymentStatus: isCard ? 'pagado' : 'pendiente',
    paymentReference: isCard ? `fake_ch_${crypto.randomUUID()}` : oxxoReference(),
    oxxoExpiresAt: isCard ? null : new Date(now.getTime() + OXXO_HOURS * 3600e3).toISOString(),
    paidAt: isCard ? now.toISOString() : null,
    deliveryMethod: method,
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email.trim().toLowerCase(),
    phone: payload.phone,
    street: payload.street,
    neighborhood: payload.neighborhood,
    city: payload.city,
    state: payload.state,
    postalCode: payload.postalCode,
    references: payload.references || null,
    giftWrap: payload.giftWrap,
    subtotal,
    shippingCost: cost,
    total,
    taxRate: DEFAULT_CONFIG.ivaRate,
    taxIncluded: taxIncluded(total, DEFAULT_CONFIG.ivaRate),
    createdAt: now.toISOString(),
    items: lines.map(({ item, product, variant }) => ({
      sku: variant.sku,
      name: product.name,
      color: product.colors.find((c) => c.code === variant.color)?.name ?? variant.color,
      size: variant.size,
      quantity: item.quantity,
      unitPrice: product.price,
      lineTotal: product.price * item.quantity,
    })),
    timeline: [{ status: isCard ? 'pagado' : 'por_preparar', at: now.toISOString() }],
    ownerEmail: getSession()?.email ?? null,
  }
  saveOrders([...orders, order])
  return order
}

const canReadMock = (order) => {
  const session = getSession()
  return order.ownerEmail ? order.ownerEmail === session?.email : guestEmail(order.folio) === order.email
}

// --- API pública ---

/** Cotiza el envío por CP (R-14). @returns {Promise<{ method: 'local' | 'paqueteria', cost: number }>} */
export async function quoteShipping(postalCode, subtotal) {
  if (USE_API) {
    const response = await fetch(`${API_URL}/api/shipping/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postalCode, subtotal }),
    })
    if (!response.ok) throw new Error(`API respondió ${response.status}`)
    return response.json()
  }
  await latency()
  return quoteShippingLocal(postalCode, subtotal, DEFAULT_CONFIG)
}

/**
 * Crea el pedido. `payload.items` lleva `{ sku, quantity, slug }`; a la API solo viajan el SKU y la cantidad.
 * @throws {OrderError}
 */
export async function placeOrder(payload, idempotencyKey) {
  let order
  if (USE_API) {
    const response = await send('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ ...payload, items: payload.items.map(({ sku, quantity }) => ({ sku, quantity })) }),
    })
    if (!response.ok) throw await apiError(response)
    order = await response.json()
  } else {
    await latency()
    order = placeMockOrder(payload)
  }
  rememberGuestOrder(order.folio, order.email)
  return order
}

/** Pedido por folio, o null si no existe o no es de quien consulta. */
export async function getOrder(folio) {
  if (USE_API) {
    const response = await send(`/api/orders/${encodeURIComponent(folio)}`, { headers: orderHeaders(folio) })
    if (response.status === 404) return null
    if (!response.ok) throw await apiError(response)
    return response.json()
  }
  await latency()
  const order = loadOrders().find((o) => o.folio === folio)
  return order && canReadMock(order) ? withExpiry(order) : null
}

/** Pedidos de la sesión, del más reciente al más antiguo. */
export async function listMyOrders() {
  if (USE_API) {
    const response = await send('/api/orders/mine')
    if (!response.ok) throw await apiError(response)
    return response.json()
  }
  await latency()
  const email = getSession()?.email
  return loadOrders()
    .filter((o) => email && o.ownerEmail === email)
    .map((o) => withExpiry(o))
    .reverse()
}

/** Solo en desarrollo: simula el pago en tienda de una referencia OXXO. */
export async function simulateOxxoPayment(folio) {
  if (USE_API) {
    const response = await send(`/api/orders/${encodeURIComponent(folio)}/oxxo/simulate-payment`, { method: 'POST', headers: orderHeaders(folio) })
    if (!response.ok) throw await apiError(response)
    return response.json()
  }
  await latency()
  const now = new Date().toISOString()
  const orders = loadOrders().map((o) =>
    o.folio === folio && o.paymentStatus === 'pendiente'
      ? { ...o, paymentStatus: 'pagado', paidAt: now, oxxoExpiresAt: null, timeline: [...o.timeline, { status: 'pagado', at: now }] }
      : o,
  )
  saveOrders(orders)
  return orders.find((o) => o.folio === folio)
}
