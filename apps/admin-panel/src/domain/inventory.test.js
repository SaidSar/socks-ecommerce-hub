import { describe, expect, it } from 'vitest'
import { applyInitial, applyMovement, applySale, available, MSG, release, reserve, sortMovements, stockState, validateMovement } from './inventory'

const row = (over = {}) => ({ sku: 'SKK-007-SUM-M', stock: 10, reserved: 2, ...over })
const AT = '2026-10-18T15:00:00.000Z'

describe('estados de stock', () => {
  it('available = stock − reserved', () => {
    expect(available(row())).toBe(8)
  })
  it('agotado ≤ 0 · pocos ≤ umbral · ok', () => {
    expect(stockState(0, 4)).toBe('agotado')
    expect(stockState(-1, 4)).toBe('agotado')
    expect(stockState(1, 4)).toBe('pocos')
    expect(stockState(4, 4)).toBe('pocos')
    expect(stockState(5, 4)).toBe('ok')
  })
})

describe('movimientos manuales', () => {
  it('Entrada suma y no exige motivo', () => {
    const { row: r, movement, error } = applyMovement(row(), { type: 'Entrada', qty: '6', note: '' }, 'Aiko M.', AT)
    expect(error).toBe('')
    expect(r.stock).toBe(16)
    expect(movement).toMatchObject({ type: 'Entrada', qty: 6, balance: 16, user: 'Aiko M.' })
  })

  it('Merma resta y exige motivo', () => {
    expect(validateMovement(row(), { type: 'Merma', qty: '2', note: '' })).toBe(MSG.note)
    const { row: r, movement } = applyMovement(row(), { type: 'Merma', qty: '2', note: 'Hilo jalado' }, 'Daniel R.', AT)
    expect(r.stock).toBe(8)
    expect(movement).toMatchObject({ qty: -2, balance: 8, note: 'Hilo jalado' })
  })

  it('Merma mayor al stock se rechaza', () => {
    const res = applyMovement(row({ reserved: 0 }), { type: 'Merma', qty: '11', note: 'Mancha' }, 'Daniel R.', AT)
    expect(res.error).toBe(MSG.tooMany(10))
    expect(res.status).toBe(422)
    expect(res.row.stock).toBe(10)
  })

  it('Devolución suma y exige motivo', () => {
    expect(validateMovement(row(), { type: 'Devolución', qty: '1', note: ' ' })).toBe(MSG.note)
    const { row: r, movement } = applyMovement(row(), { type: 'Devolución', qty: '1', note: 'Cambio de talla' }, 'Aiko M.', AT)
    expect(r.stock).toBe(11)
    expect(movement.qty).toBe(1)
  })

  it('Conteo físico fija el stock y registra la diferencia negativa', () => {
    const { row: r, movement } = applyMovement(row(), { type: 'Conteo físico', qty: '7', note: '' }, 'Aiko M.', AT)
    expect(r.stock).toBe(7)
    expect(movement).toMatchObject({ type: 'Conteo físico', qty: -3, balance: 7 })
  })

  it('Conteo físico acepta 0; los demás exigen cantidad mayor a 0', () => {
    expect(validateMovement(row({ reserved: 0 }), { type: 'Conteo físico', qty: '0' })).toBe('')
    expect(validateMovement(row(), { type: 'Conteo físico', qty: '' })).toBe(MSG.count)
    expect(validateMovement(row(), { type: 'Entrada', qty: '0' })).toBe(MSG.qty)
    expect(validateMovement(row(), { type: 'Entrada', qty: '2.5' })).toBe(MSG.qty)
  })
})

describe('R-27: pares apartados', () => {
  // stock 10, apartados 2 → disponibles 8
  it('Merma hasta lo disponible pasa; un par más se rechaza con 409 y dice cuántos están apartados', () => {
    expect(applyMovement(row(), { type: 'Merma', qty: '8', note: 'Mancha' }, 'Daniel R.', AT)).toMatchObject({ error: '', row: { stock: 2, reserved: 2 } })
    const res = applyMovement(row(), { type: 'Merma', qty: '9', note: 'Mancha' }, 'Daniel R.', AT)
    expect(res.error).toBe(MSG.tooManyReserved(8, 2))
    expect(res.error).toContain('2 están apartados')
    expect(res.status).toBe(409)
    expect(res.row.stock).toBe(10)
  })

  it('Conteo físico igual a lo apartado pasa; uno menos se rechaza con 409', () => {
    expect(applyMovement(row(), { type: 'Conteo físico', qty: '2' }, 'Aiko M.', AT)).toMatchObject({ error: '', row: { stock: 2 } })
    const res = applyMovement(row(), { type: 'Conteo físico', qty: '1' }, 'Aiko M.', AT)
    expect(res.error).toBe(MSG.belowReserved(1, 2))
    expect(res.status).toBe(409)
    expect(validateMovement(row({ reserved: 0 }), { type: 'Conteo físico', qty: '0' })).toBe('')
  })

  it('el saldo nunca queda por debajo de lo apartado tras un movimiento válido', () => {
    const { row: r } = applyMovement(row({ stock: 5, reserved: 5 }), { type: 'Conteo físico', qty: '5' }, 'Aiko M.', AT)
    expect(r.stock).toBeGreaterThanOrEqual(r.reserved)
    expect(validateMovement(row({ stock: 5, reserved: 5 }), { type: 'Merma', qty: '1', note: 'x' })).toBe(MSG.tooManyReserved(0, 5))
  })

  it('los mensajes concuerdan en singular', () => {
    expect(MSG.tooManyReserved(1, 1)).toBe('No puede sacar más de 1 par; 1 está apartado para pedidos.')
    expect(MSG.belowReserved(0, 1)).toContain('menor que el par apartado')
  })
})

describe('movimientos automáticos', () => {
  it('Venta baja stock y apartado y escribe el folio', () => {
    const { row: r, movement } = applySale(row(), 2, 'SKK-1050', 'Aiko M.', AT)
    expect(r).toMatchObject({ stock: 8, reserved: 0 })
    expect(movement).toMatchObject({ type: 'Venta', qty: -2, balance: 8, note: 'Pedido SKK-1050' })
  })
  it('el saldo nunca queda negativo', () => {
    const { row: r } = applySale(row({ stock: 1, reserved: 1 }), 3, 'SKK-1', 'x', AT)
    expect(r.stock).toBe(0)
    expect(r.reserved).toBe(0)
  })
  it('apartar y liberar', () => {
    expect(reserve(row(), 3).reserved).toBe(5)
    expect(release(row(), 3).reserved).toBe(0)
  })
  it('Inventario inicial fija el stock', () => {
    const { row: r, movement } = applyInitial(row(), 20, 'Aiko M.', AT)
    expect(r.stock).toBe(20)
    expect(movement).toMatchObject({ type: 'Inventario inicial', qty: 10, balance: 20, note: 'Importado desde CSV' })
  })
  it('el kárdex se ordena del más reciente al más antiguo', () => {
    const list = sortMovements([{ date: '2026-10-01' }, { date: '2026-10-10' }, { date: '2026-10-05' }])
    expect(list.map((m) => m.date)).toEqual(['2026-10-10', '2026-10-05', '2026-10-01'])
  })
})
