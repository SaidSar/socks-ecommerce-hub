// Reglas de inventario y kárdex (DESIGN_ADMIN.md §5.3). Funciones puras.

// Movimientos que el usuario registra a mano desde el panel de stock.
export const MANUAL_MOVEMENTS = ['Entrada', 'Merma', 'Devolución', 'Conteo físico']
// Movimientos automáticos.
export const SALE = 'Venta'
export const INITIAL = 'Inventario inicial'

export const MSG = {
  qty: 'Escriba una cantidad mayor a 0.',
  count: 'Escriba cuántos pares contó (0 o más).',
  tooMany: (n) => `No puede sacar más de ${n} pares.`,
  note: 'Escriba el motivo para la bitácora.',
}

export const available = (row) => row.stock - row.reserved

/** agotado (≤ 0) · pocos (≤ umbral) · ok */
export function stockState(avail, fewThreshold) {
  if (avail <= 0) return 'agotado'
  if (avail <= fewThreshold) return 'pocos'
  return 'ok'
}

export const needsNote = (type) => type === 'Merma' || type === 'Devolución'

/** Valida un movimiento manual. `qty` llega como texto o número. Devuelve '' o el mensaje. */
export function validateMovement(row, { type, qty, note }) {
  if (!MANUAL_MOVEMENTS.includes(type)) return 'Tipo de movimiento no válido.'
  const raw = String(qty ?? '').trim()
  const n = /^\d+$/.test(raw) ? Number(raw) : NaN
  if (type === 'Conteo físico') {
    if (!Number.isInteger(n) || n < 0) return MSG.count
  } else if (!Number.isInteger(n) || n <= 0) {
    return MSG.qty
  }
  if (type === 'Merma' && n > row.stock) return MSG.tooMany(row.stock)
  if (needsNote(type) && !String(note ?? '').trim()) return MSG.note
  return ''
}

/** Cambio firmado que produce el movimiento sobre el stock actual. */
export function movementDelta(row, type, n) {
  switch (type) {
    case 'Entrada':
    case 'Devolución':
      return n
    case 'Merma':
      return -n
    case 'Conteo físico':
      return n - row.stock
    default:
      return 0
  }
}

/**
 * Aplica un movimiento manual. Devuelve `{ row, movement, error }`.
 * movement: { sku, type, qty (delta firmado), balance, date, user, note }
 */
export function applyMovement(row, { type, qty, note }, user, date) {
  const error = validateMovement(row, { type, qty, note })
  if (error) return { row, movement: null, error }
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
      note: cleanNote || (type === 'Conteo físico' ? 'Ajuste tras conteo' : '—'),
    },
    error: '',
  }
}

/** Venta al enviar o salir a ruta: baja stock y apartado; el saldo nunca queda negativo. */
export function applySale(row, qty, folio, user, date) {
  const stock = Math.max(0, row.stock - qty)
  return {
    row: { ...row, stock, reserved: Math.max(0, row.reserved - qty) },
    movement: { sku: row.sku, type: SALE, qty: stock - row.stock, balance: stock, date, user, note: `Pedido ${folio}` },
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
    movement: { sku: row.sku, type: INITIAL, qty: stock - row.stock, balance: stock, date, user, note },
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
