// Reglas de pedidos (DESIGN_ADMIN.md §5.1). Funciones puras: no tocan inventario ni almacenamiento.
import { normalize } from '../utils/format'

export const STATUS = {
  pagado: { label: 'Pagado', dot: '#23211E' },
  por_preparar: { label: 'Por preparar', dot: '#B07A3C' },
  preparando: { label: 'Preparando', dot: '#2F5E9E' },
  enviado: { label: 'Enviado', dot: '#5A6654' },
  en_ruta: { label: 'En ruta local', dot: '#5A6654' },
  entregado: { label: 'Entregado', dot: '#8A8279' },
  cancelado: { label: 'Cancelado', dot: '#B9B1A6' },
}

export const CARRIERS = ['Estafeta', 'DHL Express']
export const PAYMENT_METHODS = ['Tarjeta', 'OXXO Pay']
// Estado del pago (columna API de DESIGN_DB.md §1.6). Tarjeta nace pagado; OXXO Pay, pendiente.
export const PAYMENT_STATUSES = ['pendiente', 'pagado', 'reembolsado']
export const PAYMENT_PENDING_ERROR = 'El pago en OXXO sigue pendiente. El pedido se prepara cuando llegue la confirmación.'
export const LATE_HOURS = 48
export const TRACKING_RE = /^\d{10,}$/
export const TRACKING_ERROR = 'Escriba el número de guía (solo dígitos, mínimo 10).'
export const COURIER_ERROR = 'Elija quién lleva el pedido.'

// Filtros de la vista Pedidos, en el orden de las pestañas del mockup.
export const ORDER_FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'por_preparar', label: 'Por preparar' },
  { key: 'preparando', label: 'Preparando' },
  { key: 'late', label: 'Atrasados' },
  { key: 'oxxo', label: 'OXXO pendiente' },
  { key: 'en_ruta', label: 'En ruta local' },
  { key: 'enviado', label: 'Enviados' },
  { key: 'entregado', label: 'Entregados' },
  { key: 'cancelado', label: 'Cancelados' },
]

const isLocal = (order) => order.delivery === 'local'

/** Estado siguiente según el método de entrega, o null si el pedido ya no avanza. */
export function nextStatus(order) {
  switch (order.status) {
    case 'por_preparar':
      return 'preparando'
    case 'preparando':
      return isLocal(order) ? 'en_ruta' : 'enviado'
    case 'enviado':
    case 'en_ruta':
      return 'entregado'
    default:
      return null
  }
}

/** Texto del botón de la siguiente acción. */
export function nextLabel(order) {
  switch (order.status) {
    case 'por_preparar':
      return 'Empezar a preparar'
    case 'preparando':
      return isLocal(order) ? 'Salir a ruta' : 'Marcar como enviado'
    case 'enviado':
    case 'en_ruta':
      return 'Confirmar entrega'
    default:
      return null
  }
}

export const canCancel = (order) => order.status === 'por_preparar' || order.status === 'preparando'

/** Atrasado: sigue en bodega (por preparar o preparando) más de 48 h después de la compra. */
export function isLate(order, now) {
  if (order.status !== 'por_preparar' && order.status !== 'preparando') return false
  return (new Date(now) - new Date(order.created)) / 3600e3 > LATE_HOURS
}

export const isPaymentPending = (order) => order.paymentStatus === 'pendiente'

/** Pestaña "OXXO pendiente": PaymentMethod = OxxoPay AND PaymentStatus = Pendiente (DESIGN_DB.md §3.8). */
export const isOxxoPending = (order) => order.pay === 'OXXO Pay' && isPaymentPending(order) && order.status === 'por_preparar'

export const pairCount = (order) => order.items.reduce((a, it) => a + it.qty, 0)

export function validateTracking(tracking) {
  return TRACKING_RE.test(String(tracking ?? '').trim()) ? '' : TRACKING_ERROR
}

/** Valida lo que pide el paso siguiente. Devuelve '' si se puede avanzar o el mensaje de error. */
export function validateAdvance(order, payload = {}) {
  if (!nextStatus(order)) return 'Este pedido ya no tiene un siguiente paso.'
  // CK_Orders_PaymentBeforeFulfillment: sin pago solo se puede estar por preparar o cancelado.
  if (isPaymentPending(order)) return PAYMENT_PENDING_ERROR
  if (order.status === 'preparando') {
    if (isLocal(order)) return payload.courier ? '' : COURIER_ERROR
    if (!CARRIERS.includes(payload.carrier)) return 'Elija la paquetería.'
    return validateTracking(payload.tracking)
  }
  return ''
}

/**
 * Aplica la transición al siguiente estado. Devuelve `{ order, error }`: si hay error, `order` es el original.
 * Cada transición agrega `{ status, at, by }` al historial.
 */
export function advance(order, payload, by, at) {
  const error = validateAdvance(order, payload)
  if (error) return { order, error }
  const status = nextStatus(order)
  const patch = { status }
  if (order.status === 'preparando') {
    if (isLocal(order)) patch.courier = payload.courier
    else {
      patch.carrier = payload.carrier
      patch.tracking = String(payload.tracking).trim()
    }
  }
  return { order: { ...order, ...patch, history: [...order.history, { status, at, by }] }, error: '' }
}

/** Cancela si el estado lo permite. */
export function cancel(order, by, at) {
  if (!canCancel(order)) return { order, error: 'Solo se cancelan pedidos por preparar o en preparación.' }
  return { order: { ...order, status: 'cancelado', history: [...order.history, { status: 'cancelado', at, by }] }, error: '' }
}

/** ¿El pedido entra en el filtro de pestaña? */
export function matchesFilter(order, filter, now) {
  if (!filter || filter === 'todos') return true
  if (filter === 'late') return isLate(order, now)
  if (filter === 'oxxo') return isOxxoPending(order)
  return order.status === filter
}

/** Búsqueda por folio, cliente, correo o SKU, sin distinguir mayúsculas ni acentos. */
export function matchesQuery(order, q) {
  const term = normalize(q)
  if (!term) return true
  const hay = normalize([order.id, order.customer.name, order.customer.email, ...order.items.map((it) => it.sku)].join(' '))
  return hay.includes(term)
}

export function countByFilter(orders, now) {
  return Object.fromEntries(ORDER_FILTERS.map((f) => [f.key, orders.filter((o) => matchesFilter(o, f.key, now)).length]))
}
