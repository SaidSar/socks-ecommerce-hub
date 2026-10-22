import { describe, expect, it } from 'vitest'
import { advance, canCancel, cancel, isLate, matchesFilter, matchesQuery, nextLabel, nextStatus, PAYMENT_PENDING_ERROR, TRACKING_ERROR, validateAdvance, validateTracking } from './orders'

const NOW = new Date(2026, 9, 18, 9, 30)
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600e3).toISOString()

const order = (over = {}) => ({
  id: 'SKK-1050',
  created: hoursAgo(3),
  status: 'por_preparar',
  delivery: 'paqueteria',
  pay: 'Tarjeta',
  paymentStatus: 'pagado',
  customer: { name: 'Mariana López', email: 'mariana.lopez@correo.mx' },
  items: [{ sku: 'SKK-007-SUM-M', qty: 1 }],
  history: [{ status: 'pagado', at: hoursAgo(3), by: 'Tienda en línea' }],
  ...over,
})

describe('transiciones por método de entrega', () => {
  it('paquetería: por_preparar → preparando → enviado → entregado', () => {
    expect(nextStatus(order())).toBe('preparando')
    expect(nextStatus(order({ status: 'preparando' }))).toBe('enviado')
    expect(nextStatus(order({ status: 'enviado' }))).toBe('entregado')
    expect(nextStatus(order({ status: 'entregado' }))).toBeNull()
    expect(nextLabel(order({ status: 'preparando' }))).toBe('Marcar como enviado')
  })

  it('local: por_preparar → preparando → en_ruta → entregado', () => {
    const local = { delivery: 'local' }
    expect(nextStatus(order(local))).toBe('preparando')
    expect(nextStatus(order({ ...local, status: 'preparando' }))).toBe('en_ruta')
    expect(nextStatus(order({ ...local, status: 'en_ruta' }))).toBe('entregado')
    expect(nextLabel(order({ ...local, status: 'preparando' }))).toBe('Salir a ruta')
    expect(nextLabel(order({ ...local, status: 'en_ruta' }))).toBe('Confirmar entrega')
  })

  it('cada transición agrega { status, at, by } al historial', () => {
    const { order: o, error } = advance(order(), {}, 'Aiko M.', NOW.toISOString())
    expect(error).toBe('')
    expect(o.status).toBe('preparando')
    expect(o.history.at(-1)).toEqual({ status: 'preparando', at: NOW.toISOString(), by: 'Aiko M.' })
  })

  it('local exige repartidor para salir a ruta', () => {
    const base = order({ delivery: 'local', status: 'preparando' })
    expect(advance(base, {}, 'Daniel R.', NOW).error).not.toBe('')
    const { order: o } = advance(base, { courier: 'Kevin Armenta' }, 'Daniel R.', NOW)
    expect(o.status).toBe('en_ruta')
    expect(o.courier).toBe('Kevin Armenta')
  })
})

describe('guía de paquetería', () => {
  it('rechaza guía inválida', () => {
    expect(validateTracking('')).toBe(TRACKING_ERROR)
    expect(validateTracking('123456789')).toBe(TRACKING_ERROR)
    expect(validateTracking('12345abc90')).toBe(TRACKING_ERROR)
    const res = advance(order({ status: 'preparando' }), { carrier: 'Estafeta', tracking: '12-34' }, 'Aiko M.', NOW)
    expect(res.error).toBe(TRACKING_ERROR)
    expect(res.order.status).toBe('preparando')
  })

  it('acepta guía válida (solo dígitos, mínimo 10) y guarda paquetería', () => {
    expect(validateTracking('1234567890')).toBe('')
    const { order: o, error } = advance(order({ status: 'preparando' }), { carrier: 'DHL Express', tracking: ' 9876543210123 ' }, 'Aiko M.', NOW)
    expect(error).toBe('')
    expect(o).toMatchObject({ status: 'enviado', carrier: 'DHL Express', tracking: '9876543210123' })
  })

  it('exige una paquetería conocida', () => {
    expect(advance(order({ status: 'preparando' }), { carrier: 'Otra', tracking: '1234567890' }, 'Aiko M.', NOW).error).toBe('Elija la paquetería.')
  })
})

describe('isLate', () => {
  it('a 47 h no está atrasado', () => {
    expect(isLate(order({ created: hoursAgo(47) }), NOW)).toBe(false)
  })
  it('a 49 h sí está atrasado', () => {
    expect(isLate(order({ created: hoursAgo(49) }), NOW)).toBe(true)
    expect(isLate(order({ created: hoursAgo(49), status: 'preparando' }), NOW)).toBe(true)
  })
  it('enviados, entregados o cancelados nunca están atrasados', () => {
    for (const status of ['enviado', 'en_ruta', 'entregado', 'cancelado']) {
      expect(isLate(order({ created: hoursAgo(200), status }), NOW)).toBe(false)
    }
  })
})

describe('cancelación', () => {
  it('solo en por_preparar o preparando', () => {
    expect(canCancel(order())).toBe(true)
    expect(canCancel(order({ status: 'preparando' }))).toBe(true)
    for (const status of ['enviado', 'en_ruta', 'entregado', 'cancelado']) {
      expect(canCancel(order({ status }))).toBe(false)
      expect(cancel(order({ status }), 'Aiko M.', NOW).error).not.toBe('')
    }
  })
  it('registra la cancelación en el historial', () => {
    const { order: o } = cancel(order(), 'Aiko M.', NOW)
    expect(o.status).toBe('cancelado')
    expect(o.history.at(-1).status).toBe('cancelado')
  })
})

describe('filtros y búsqueda', () => {
  it('filtra atrasados y OXXO pendiente', () => {
    expect(matchesFilter(order({ created: hoursAgo(60) }), 'late', NOW)).toBe(true)
    expect(matchesFilter(order({ pay: 'OXXO Pay', paymentStatus: 'pendiente' }), 'oxxo', NOW)).toBe(true)
    expect(matchesFilter(order({ pay: 'OXXO Pay', paymentStatus: 'pagado' }), 'oxxo', NOW)).toBe(false)
    expect(matchesFilter(order({ pay: 'OXXO Pay', status: 'preparando' }), 'oxxo', NOW)).toBe(false)
  })
  it('busca sin distinguir acentos, por folio, correo o SKU', () => {
    expect(matchesQuery(order(), 'lopez')).toBe(true)
    expect(matchesQuery(order(), '1050')).toBe(true)
    expect(matchesQuery(order(), 'skk-007-sum')).toBe(true)
    expect(matchesQuery(order(), 'ramírez')).toBe(false)
  })
})

describe('pago antes de surtir (CK_Orders_PaymentBeforeFulfillment)', () => {
  it('un OXXO sin pagar no avanza, pero sí se puede cancelar', () => {
    const unpaid = order({ pay: 'OXXO Pay', paymentStatus: 'pendiente' })
    expect(validateAdvance(unpaid)).toBe(PAYMENT_PENDING_ERROR)
    expect(advance(unpaid, {}, 'Aiko M.', NOW.toISOString())).toMatchObject({ error: PAYMENT_PENDING_ERROR, order: unpaid })
    expect(cancel(unpaid, 'Aiko M.', NOW.toISOString()).order.status).toBe('cancelado')
  })
  it('pagado avanza normal', () => {
    expect(validateAdvance(order({ pay: 'OXXO Pay', paymentStatus: 'pagado' }))).toBe('')
  })
})
