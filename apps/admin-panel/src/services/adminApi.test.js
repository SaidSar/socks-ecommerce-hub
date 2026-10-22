import { beforeEach, describe, expect, it } from 'vitest'
import { createSeed, DEMO_NOW, PIECES, skuOf } from '../data/seed'
import { isLate } from '../domain/orders'
import * as api from './adminApi'

const OWNER = { name: 'Aiko Morales', role: 'dueno' }
const OPS = { name: 'Daniel Ruiz', role: 'operaciones' }

beforeEach(() => api.__resetForTests())

describe('seed determinista y coherente', () => {
  const seed = createSeed()

  it('misma semilla, mismos datos', () => {
    expect(createSeed()).toEqual(seed)
  })

  it('6 piezas × tonos × S/M/L con SKU SKK-{id}-{tono}-{talla}', () => {
    const expected = PIECES.reduce((a, p) => a + p.tones.length * 3, 0)
    expect(seed.inventory).toHaveLength(expected)
    expect(seed.inventory.some((r) => r.sku === skuOf(7, 'sumi', 'M'))).toBe(true)
    expect(skuOf(7, 'sumi', 'M')).toBe('SKK-007-SUM-M')
  })

  it('34 pedidos de los últimos 15 días, con atrasados, locales y OXXO', () => {
    expect(seed.orders).toHaveLength(34)
    const oldest = Math.min(...seed.orders.map((o) => new Date(o.created)))
    expect((DEMO_NOW - oldest) / 864e5).toBeLessThanOrEqual(16)
    expect(seed.orders.filter((o) => isLate(o, DEMO_NOW)).length).toBeGreaterThanOrEqual(2)
    expect(seed.orders.some((o) => o.delivery === 'local' && o.status === 'por_preparar')).toBe(true)
    expect(seed.orders.some((o) => o.delivery === 'paqueteria' && o.status === 'por_preparar')).toBe(true)
    expect(seed.orders.some((o) => o.pay === 'oxxo_pay' && o.status === 'por_preparar')).toBe(true)
  })

  it('apartado = pares de pedidos sin enviar', () => {
    seed.inventory.forEach((r) => {
      const reserved = seed.orders
        .filter((o) => o.status === 'por_preparar' || o.status === 'preparando')
        .flatMap((o) => o.items)
        .filter((it) => it.sku === r.sku)
        .reduce((a, it) => a + it.qty, 0)
      expect(r.reserved).toBe(reserved)
      expect(r.stock).toBeGreaterThanOrEqual(r.reserved)
    })
  })

  it('kárdex: empieza con Entrada, saldo nunca negativo y termina en el stock actual', () => {
    seed.inventory.forEach((r) => {
      const moves = seed.movements.filter((m) => m.sku === r.sku)
      expect(moves[0].type).toBe('entrada')
      let bal = 0
      moves.forEach((m) => {
        bal += m.qty
        expect(m.balance).toBe(bal)
        expect(bal).toBeGreaterThanOrEqual(0)
      })
      expect(bal).toBe(r.stock)
    })
  })

  it('OXXO sin pagar solo por preparar o cancelado; el resto pagado (CK_Orders_PaymentBeforeFulfillment)', () => {
    const unpaid = seed.orders.filter((o) => o.paymentStatus === 'pendiente')
    expect(unpaid.length).toBeGreaterThan(0)
    unpaid.forEach((o) => {
      expect(o.pay).toBe('oxxo_pay')
      expect(['por_preparar', 'cancelado']).toContain(o.status)
      expect(o.paidAt).toBeNull()
      expect(o.history.some((h) => h.status === 'pagado')).toBe(false)
    })
    seed.orders.filter((o) => o.paymentStatus === 'reembolsado').forEach((o) => expect(o.status).toBe('cancelado'))
    expect(seed.orders.some((o) => o.pay === 'oxxo_pay' && o.paymentStatus === 'pagado' && o.status !== 'por_preparar')).toBe(true)
  })

  it('el hito "Pagado" lleva la fecha de pago y va antes de los pasos de bodega', () => {
    seed.orders.filter((o) => o.paidAt).forEach((o) => {
      const paid = o.history.find((h) => h.status === 'pagado')
      expect(paid.at).toBe(o.paidAt)
      o.history.filter((h) => h.status !== 'pagado' && h.status !== 'por_preparar').forEach((h) => expect(new Date(h.at) >= new Date(o.paidAt)).toBe(true))
      if (o.pay === 'tarjeta') expect(o.paidAt).toBe(o.created)
      else expect(new Date(o.paidAt) > new Date(o.created)).toBe(true)
    })
  })

  it('ventas y devoluciones del kárdex apuntan a un pedido existente que lleva ese SKU', () => {
    const linked = seed.movements.filter((m) => m.type === 'venta' || m.type === 'devolucion')
    expect(linked.some((m) => m.type === 'devolucion')).toBe(true)
    linked.forEach((m) => {
      const o = seed.orders.find((x) => x.id === m.order)
      expect(o).toBeDefined()
      expect(o.items.some((it) => it.sku === m.sku)).toBe(true)
    })
  })

  it('enums con los códigos de la API (DESIGN_DB.md §1.6)', () => {
    seed.orders.forEach((o) => {
      expect(['local', 'paqueteria']).toContain(o.delivery)
      expect(['tarjeta', 'oxxo_pay']).toContain(o.pay)
      expect(['pendiente', 'pagado', 'reembolsado']).toContain(o.paymentStatus)
      if (o.carrier) expect(['estafeta', 'dhl_express']).toContain(o.carrier)
    })
    const types = new Set(seed.movements.map((m) => m.type))
    types.forEach((t) => expect(['entrada', 'merma', 'devolucion', 'conteo_fisico', 'venta', 'inventario_inicial']).toContain(t))
  })

  it('30 días de ventas con periodo anterior', () => {
    expect(seed.daily).toHaveLength(30)
    expect(seed.daily.every((d) => d.v > 0 && d.prev > 0 && d.orders > 0)).toBe(true)
  })
})

describe('efecto de los pedidos en inventario', () => {
  it('pedido de paquetería: exige guía válida; al enviarlo baja el stock y aparece "Venta" en el kárdex', async () => {
    const { orders } = await api.getOrders({ filter: 'todos' }, 'dueno')
    const o = orders.find((x) => x.delivery === 'paqueteria' && x.status === 'por_preparar' && x.paymentStatus === 'pagado')
    const it = o.items[0]
    const before = (await api.getInventory({ q: it.sku })).rows[0]

    await api.advanceOrder(o.id, {}, OWNER)
    await expect(api.advanceOrder(o.id, { carrier: 'estafeta', tracking: '123' }, OWNER)).rejects.toThrow('Escriba el número de guía')
    const sent = await api.advanceOrder(o.id, { carrier: 'estafeta', tracking: '1234567890' }, OWNER)
    expect(sent.status).toBe('enviado')

    const after = (await api.getInventory({ q: it.sku })).rows[0]
    const qty = o.items.filter((x) => x.sku === it.sku).reduce((a, x) => a + x.qty, 0)
    expect(after.stock).toBe(before.stock - qty)
    expect(after.reserved).toBe(before.reserved - qty)
    const [last] = await api.getMovements(it.sku)
    expect(last).toMatchObject({ type: 'venta', note: `Pedido ${o.id}`, user: 'Aiko M.' })
  })

  it('pedido local: por preparar → preparando → en ruta local → entregado', async () => {
    const { orders } = await api.getOrders({ filter: 'por_preparar' }, 'operaciones')
    const o = orders.find((x) => x.delivery === 'local' && x.pay === 'tarjeta')
    expect((await api.advanceOrder(o.id, {}, OPS)).status).toBe('preparando')
    expect((await api.advanceOrder(o.id, { courier: 'Kevin Armenta' }, OPS)).status).toBe('en_ruta')
    const done = await api.advanceOrder(o.id, {}, OPS)
    expect(done.status).toBe('entregado')
    expect(done.history.map((h) => h.status)).toEqual(['pagado', 'preparando', 'en_ruta', 'entregado'])
  })

  it('cancelar libera lo apartado', async () => {
    const { orders } = await api.getOrders({ filter: 'por_preparar' }, 'dueno')
    const o = orders[0]
    const sku = o.items[0].sku
    const before = (await api.getInventory({ q: sku })).rows[0]
    await api.cancelOrder(o.id, OWNER)
    const after = (await api.getInventory({ q: sku })).rows[0]
    expect(after.reserved).toBeLessThan(before.reserved)
  })

  it('Operaciones no recibe importes', async () => {
    const { orders } = await api.getOrders({}, 'operaciones')
    expect(orders[0].total).toBeUndefined()
    expect(orders[0].items[0].price).toBeUndefined()
    const dash = await api.getDashboard('hoy', 'operaciones')
    expect(dash.kpis.sales).toBeNull()
    expect(dash.daily).toBeNull()
  })
})

describe('marcar como pagado', () => {
  it('el Dueño confirma un OXXO pendiente; el historial queda en orden y ya puede pasar a preparando', async () => {
    const { orders } = await api.getOrders({ filter: 'oxxo' }, 'dueno')
    const o = orders[0]
    await expect(api.advanceOrder(o.id, {}, OWNER)).rejects.toThrow('pendiente')
    const paid = await api.markOrderPaid(o.id, OWNER)
    expect(paid).toMatchObject({ paymentStatus: 'pagado', paidAt: expect.any(String) })
    expect(paid.history.map((h) => h.status)).toEqual(['por_preparar', 'pagado'])
    const times = paid.history.map((h) => new Date(h.at).getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(paid.history.at(-1)).toMatchObject({ at: paid.paidAt, by: 'Aiko M.' })
    const next = await api.advanceOrder(o.id, {}, OWNER)
    expect(next.status).toBe('preparando')
    expect(next.history.map((h) => h.status)).toEqual(['por_preparar', 'pagado', 'preparando'])
    expect((await api.getOrders({ filter: 'oxxo' }, 'dueno')).orders.some((x) => x.id === o.id)).toBe(false)
  })

  it('Operaciones recibe 403 y el pedido no cambia', async () => {
    const [o] = (await api.getOrders({ filter: 'oxxo' }, 'operaciones')).orders
    await expect(api.markOrderPaid(o.id, OPS)).rejects.toMatchObject({ status: 403 })
    expect((await api.getOrder(o.id, 'dueno')).paymentStatus).toBe('pendiente')
  })

  it('no se marca uno ya pagado ni uno cancelado', async () => {
    const { orders } = await api.getOrders({}, 'dueno')
    const paid = orders.find((x) => x.paymentStatus === 'pagado')
    await expect(api.markOrderPaid(paid.id, OWNER)).rejects.toMatchObject({ status: 409 })
    const cancelled = orders.find((x) => x.status === 'cancelado' && x.paymentStatus === 'pendiente')
    await expect(api.markOrderPaid(cancelled.id, OWNER)).rejects.toMatchObject({ status: 409 })
  })
})

describe('movimientos con folio', () => {
  it('una devolución exige un pedido existente y queda ligada a él', async () => {
    const { rows } = await api.getInventory()
    const { sku } = rows[0]
    const mv = { type: 'devolucion', qty: '1', note: 'Cambio de talla' }
    await expect(api.adjustStock(sku, { ...mv, folio: 'SKK-9999' }, OWNER)).rejects.toMatchObject({ status: 422, field: 'folio' })
    const { orders } = await api.getOrders({}, 'dueno')
    const { movement } = await api.adjustStock(sku, { ...mv, folio: orders[0].id }, OWNER)
    expect(movement).toMatchObject({ type: 'devolucion', order: orders[0].id })
  })

  it('una merma que toca pares apartados responde 409', async () => {
    const { rows } = await api.getInventory()
    const r = rows.find((x) => x.reserved > 0)
    await expect(api.adjustStock(r.sku, { type: 'merma', qty: String(r.available + 1), note: 'Mancha' }, OPS)).rejects.toMatchObject({ status: 409 })
  })
})

describe('importación y configuración', () => {
  it('un CSV con 2 filas erróneas aplica solo las válidas', async () => {
    const { rows } = await api.getInventory()
    const [a, b] = rows
    const csv = ['SKU;Pieza;Tono;Talla;Stock', `${a.sku};x;x;S;30`, `${b.sku};x;x;S;31`, 'SKK-099-AZU-M;x;x;M;10', `${a.sku};x;x;S;-2`].join('\n')
    const preview = await api.previewImport(csv)
    expect(preview.valid).toHaveLength(2)
    expect(preview.invalid).toHaveLength(2)
    const { applied } = await api.applyImport(preview.valid, OWNER)
    expect(applied).toBe(2)
    const after = (await api.getInventory({ q: a.sku })).rows[0]
    expect(after.stock).toBe(30)
    const [mv] = await api.getMovements(a.sku)
    expect(mv).toMatchObject({ type: 'inventario_inicial', note: 'Importado desde CSV', balance: 30 })
  })

  it('la configuración tiene la forma de GET /api/config (DESIGN_DB.md §3.12) más las zonas', async () => {
    const { localZones, ...config } = await api.getSettings()
    expect(config).toEqual({ freeShippingThreshold: 799, parcelShippingCost: 99, localShippingCost: 49, localFreeShipping: true, fewUnitsThreshold: 4, ivaRate: 0.16 })
    expect(localZones).toHaveLength(2)
    const saved = await api.saveSettings({ ...(await api.getSettings()), ivaRate: 0.5 })
    expect(saved.ivaRate).toBe(0.16)
  })

  it('cambiar la tarifa local a 59 se refleja en computeShipping', async () => {
    const s = await api.getSettings()
    await api.saveSettings({ ...s, localShippingCost: 59 })
    expect(await api.quoteShipping({ subtotal: 420, postalCode: '81250' })).toEqual({ method: 'local', cost: 59 })
  })

  it('valida montos, umbral y zona', async () => {
    const s = await api.getSettings()
    await expect(api.saveSettings({ ...s, localZones: [] })).rejects.toMatchObject({ errors: { localZones: expect.any(String) } })
    await expect(api.saveSettings({ ...s, freeShippingThreshold: 0, fewUnitsThreshold: 0 })).rejects.toMatchObject({
      errors: { freeShippingThreshold: expect.any(String), fewUnitsThreshold: expect.any(String) },
    })
  })
})
