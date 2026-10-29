import { describe, expect, it } from 'vitest'
import { computeKpis, computeQueue, limitedEditions, pctChange, sizeShare } from './dashboard'

const day = (v, orders, free, prev, prevOrders, prevFree, date = '2026-10-01') => ({ date, v, orders, free, prev, prevOrders, prevFree })

describe('computeKpis', () => {
  const daily = Array.from({ length: 30 }, (_, i) => day(1000 + i * 10, 2, 1, 900, 2, 1, `2026-09-${String(i + 1).padStart(2, '0')}`))

  it('"hoy" compara contra el mismo día de la semana anterior', () => {
    const k = computeKpis(daily, 'hoy')
    expect(k.sales.value).toBe(1290)
    expect(k.sales.prev).toBe(daily[22].v)
    expect(k.compareDate).toBe(daily[22].date)
  })

  it('7d suma los últimos 7 días contra el periodo previo', () => {
    const k = computeKpis(daily, '7d')
    expect(k.sales.value).toBe(daily.slice(-7).reduce((a, d) => a + d.v, 0))
    expect(k.sales.prev).toBe(900 * 7)
    expect(k.orders.value).toBe(14)
    expect(k.ticket.value).toBeCloseTo(k.sales.value / 14)
    expect(k.freePct.value).toBe(50)
  })

  it('variación porcentual con signo', () => {
    expect(pctChange(110, 100)).toBeCloseTo(10)
    expect(pctChange(90, 100)).toBeCloseTo(-10)
    expect(pctChange(5, 0)).toBeNull()
  })
})

describe('cola, tallas y ediciones', () => {
  const now = new Date(2026, 9, 18, 9, 30)
  const orders = [
    { status: 'por_preparar', created: new Date(2026, 9, 15).toISOString(), items: [{ size: 'M', qty: 2, name: 'A' }] },
    { status: 'preparando', created: new Date(2026, 9, 18, 8).toISOString(), items: [{ size: 'S', qty: 1, name: 'B' }] },
    { status: 'en_ruta', created: new Date(2026, 9, 17).toISOString(), items: [{ size: 'L', qty: 1, name: 'A' }] },
    { status: 'cancelado', created: new Date(2026, 9, 17).toISOString(), items: [{ size: 'L', qty: 5, name: 'C' }] },
  ]

  it('cuenta la cola de trabajo', () => {
    expect(computeQueue(orders, now)).toEqual({ por_preparar: 1, preparando: 1, late: 1, en_ruta: 1 })
  })

  it('porcentaje por talla suma 100 y excluye cancelados', () => {
    const rows = sizeShare(orders, now, [
      { code: 'S', label: '22–24 cm' },
      { code: 'M', label: '25–27 cm' },
      { code: 'L', label: '28–30 cm' },
    ])
    expect(rows.map((r) => r.v)).toEqual([25, 50, 25])
  })

  it('ediciones limitadas alertan bajo el 20 %', () => {
    const [e] = limitedEditions([{ id: 7, name: 'Tabi', edition: 120 }], [{ pieceId: 7, stock: 10 }, { pieceId: 7, stock: 13 }])
    expect(e).toMatchObject({ left: 23, low: true })
  })
})
