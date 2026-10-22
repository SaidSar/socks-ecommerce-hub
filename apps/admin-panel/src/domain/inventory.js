// Reglas de inventario y kárdex (DESIGN_ADMIN.md §5.3, R-27 de DESIGN_DB.md §3.6). Funciones puras.

// Códigos de API de los movimientos (DESIGN_DB.md §1.6); las etiquetas viven en enums.js.
// Movimientos que el usuario registra a mano desde el panel de stock.
export const MANUAL_MOVEMENTS = ['entrada', 'merma', 'devolucion', 'conteo_fisico']
// Movimientos automáticos.
export const SALE = 'venta'
export const INITIAL = 'inventario_inicial'
// Movimientos que siempre apuntan a un pedido (CK_InventoryMovements_OrderRequired, DESIGN_DB.md §3.7).
export const FOLIO_MOVEMENTS = [SALE, 'devolucion']
export const FOLIO_RE = /^SKK-\d{4,}$/

const pairs = (n) => (n === 1 ? '1 par' : `${n} pares`)
const reservedPairs = (n) => (n === 1 ? 'el par apartado' : `los ${n} pares apartados`)

export const MSG = {
  qty: 'Escriba una cantidad mayor a 0.',
  count: 'Escriba cuántos pares contó (0 o más).',
  tooMany: (n) => `No puede sacar más de ${n} pares.`,
  tooManyReserved: (n, reserved) => `No puede sacar más de ${pairs(n)}; ${reserved === 1 ? '1 está apartado' : `${reserved} están apartados`} para pedidos.`,
  belowReserved: (n, reserved) => `El conteo (${n}) es menor que ${reservedPairs(reserved)}. Cancele o surta esos pedidos antes de ajustar.`,
  note: 'Escriba el motivo para la bitácora.',
  folio: 'Escriba el folio del pedido, por ejemplo SKK-1042.',
  folioUnknown: (folio) => `No encontramos el pedido ${folio}. Revise el folio.`,
}

export const available = (row) => row.stock - row.reserved

/**
 * Error de un movimiento: `status` 409 si choca con pares apartados (R-27), 422 si el dato es inválido;
 * `field` dice qué campo del formulario lo causó.
 */
const fail = (message, status = 422, field = 'qty') => ({ message, status, field })
const OK = { message: '', status: 0, field: '' }

/** agotado (≤ 0) · pocos (≤ umbral) · ok */
export function stockState(avail, fewThreshold) {
  if (avail <= 0) return 'agotado'
  if (avail <= fewThreshold) return 'pocos'
  return 'ok'
}

export const needsNote = (type) => type === 'merma' || type === 'devolucion'
export const needsFolio = (type) => FOLIO_MOVEMENTS.includes(type)
export const normalizeFolio = (folio) => String(folio ?? '').trim().toUpperCase()

/**
 * Valida un movimiento manual y devuelve `{ message, status, field }` (`message` vacío si es válido).
 * R-27: la Merma no puede tocar pares apartados y el Conteo físico no puede quedar por debajo de ellos.
 * La Devolución exige el folio de su pedido; `orderExists(folio)` (lo da el servidor) comprueba que exista.
 */
export function checkMovement(row, { type, qty, note, folio }, { orderExists } = {}) {
  if (!MANUAL_MOVEMENTS.includes(type)) return fail('Tipo de movimiento no válido.')
  const raw = String(qty ?? '').trim()
  const n = /^\d+$/.test(raw) ? Number(raw) : NaN
  if (type === 'conteo_fisico') {
    if (!Number.isInteger(n) || n < 0) return fail(MSG.count)
    if (n < row.reserved) return fail(MSG.belowReserved(n, row.reserved), 409)
  } else if (!Number.isInteger(n) || n <= 0) {
    return fail(MSG.qty)
  }
  if (type === 'merma' && n > available(row)) {
    return row.reserved > 0 ? fail(MSG.tooManyReserved(available(row), row.reserved), 409) : fail(MSG.tooMany(row.stock))
  }
  if (needsNote(type) && !String(note ?? '').trim()) return fail(MSG.note, 422, 'note')
  if (needsFolio(type)) {
    const code = normalizeFolio(folio)
    if (!FOLIO_RE.test(code)) return fail(MSG.folio, 422, 'folio')
    if (orderExists && !orderExists(code)) return fail(MSG.folioUnknown(code), 422, 'folio')
  }
  return OK
}

/** Valida un movimiento manual. `qty` llega como texto o número. Devuelve '' o el mensaje. */
export const validateMovement = (row, movement, opts) => checkMovement(row, movement, opts).message

/** Cambio firmado que produce el movimiento sobre el stock actual. */
export function movementDelta(row, type, n) {
  switch (type) {
    case 'entrada':
    case 'devolucion':
      return n
    case 'merma':
      return -n
    case 'conteo_fisico':
      return n - row.stock
    default:
      return 0
  }
}

/**
 * Aplica un movimiento manual. Devuelve `{ row, movement, error, status, field }`.
 * movement: { sku, type, qty (delta firmado), balance, date, user, note, order (folio o null) }
 */
export function applyMovement(row, { type, qty, note, folio }, user, date, opts) {
  const check = checkMovement(row, { type, qty, note, folio }, opts)
  if (check.message) return { row, movement: null, error: check.message, status: check.status, field: check.field }
  const n = Number(String(qty).trim())
  const delta = movementDelta(row, type, n)
  const stock = Math.max(0, row.stock + delta)
  const cleanNote = String(note ?? '').trim()
  return {
    row: { ...row, stock },
    movement: {
      sku: row.sku,
      type,
      qty: stock - row.stock,
      balance: stock,
      date,
      user,
      note: cleanNote || (type === 'conteo_fisico' ? 'Ajuste tras conteo' : '—'),
      order: needsFolio(type) ? normalizeFolio(folio) : null,
    },
    error: '',
  }
}

/** Venta al enviar o salir a ruta: baja stock y apartado; el saldo nunca queda negativo. */
export function applySale(row, qty, folio, user, date) {
  const stock = Math.max(0, row.stock - qty)
  return {
    row: { ...row, stock, reserved: Math.max(0, row.reserved - qty) },
    movement: { sku: row.sku, type: SALE, qty: stock - row.stock, balance: stock, date, user, note: `Pedido ${folio}`, order: folio },
  }
}

/** Aparta pares de un pedido pagado. */
export const reserve = (row, qty) => ({ ...row, reserved: row.reserved + qty })

/** Libera pares apartados (cancelación). */
export const release = (row, qty) => ({ ...row, reserved: Math.max(0, row.reserved - qty) })

/** Fija el stock desde la importación inicial. */
export function applyInitial(row, stock, user, date, note = 'Importado desde CSV') {
  return {
    row: { ...row, stock },
    movement: { sku: row.sku, type: INITIAL, qty: stock - row.stock, balance: stock, date, user, note, order: null },
  }
}

/** Kárdex del más reciente al más antiguo. */
export function sortMovements(movements) {
  return [...movements].sort((a, b) => new Date(b.date) - new Date(a.date))
}

export function matchesStockFilter(row, filter, few) {
  const st = stockState(available(row), few)
  if (!filter || filter === 'todos') return true
  if (filter === 'alertas') return st !== 'ok'
  return st === filter
}

export const STOCK_FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'alertas', label: 'Alertas' },
  { key: 'agotado', label: 'Agotados' },
  { key: 'pocos', label: 'Pocos' },
  { key: 'ok', label: 'En stock' },
]
