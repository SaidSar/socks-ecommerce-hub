import { beforeEach, describe, expect, it } from 'vitest'
import * as api from './adminApi'

const OWNER = { name: 'Aiko Morales', role: 'dueno' }
const OPS = { name: 'Daniel Ruiz', role: 'operaciones' }

beforeEach(() => {
  try {
    localStorage.clear()
  } catch {
    /* node sin localStorage */
  }
  api.__resetForTests()
})

describe('mock: cupones', () => {
  it('lista con estado, usos, descuento otorgado y ventas; Operaciones recibe 403', async () => {
    const list = await api.getCoupons(OWNER)
    const byCode = Object.fromEntries(list.map((c) => [c.code, c]))
    expect(byCode.BIENVENIDA10).toMatchObject({ status: 'active', redemptions: 1, canDelete: false })
    expect(byCode.BIENVENIDA10.discountGiven).toBeGreaterThan(0)
    expect(byCode.VERANO25.status).toBe('expired')
    expect(byCode['BUENFIN-2026'].status).toBe('scheduled')
    await expect(api.getCoupons(OPS)).rejects.toMatchObject({ status: 403 })
  })

  it('crea, rechaza duplicados y errores por campo', async () => {
    const created = await api.saveCoupon({ code: ' navidad 15 ', type: 'percent', value: '15', onePerCustomer: true }, OWNER)
    expect(created).toMatchObject({ code: 'NAVIDAD15', value: 15, status: 'active', canDelete: true })
    await expect(api.saveCoupon({ code: 'NAVIDAD15', type: 'fixed', value: '10' }, OWNER)).rejects.toMatchObject({
      errors: { code: 'Ya existe un cupón con ese código.' },
    })
    await expect(api.saveCoupon({ code: 'X', type: 'percent', value: '95' }, OWNER)).rejects.toMatchObject({ errors: { value: expect.any(String) } })
  })

  it('activa y desactiva; solo se borra si nadie lo usó', async () => {
    const list = await api.getCoupons(OWNER)
    const used = list.find((c) => c.code === 'BIENVENIDA10')
    const unused = list.find((c) => c.code === 'VERANO25')

    expect((await api.setCouponActive(used.id, false, OWNER)).status).toBe('inactive')
    expect((await api.setCouponActive(used.id, true, OWNER)).status).toBe('active')
    await expect(api.deleteCoupon(used.id, OWNER)).rejects.toMatchObject({ status: 409 })
    await api.deleteCoupon(unused.id, OWNER)
    expect((await api.getCoupons(OWNER)).some((c) => c.code === 'VERANO25')).toBe(false)
  })

  it('el código de un cupón usado no cambia', async () => {
    const used = (await api.getCoupons(OWNER)).find((c) => c.code === 'BIENVENIDA10')
    await expect(api.saveCoupon({ ...used, code: 'OTRO10', value: String(used.value) }, OWNER)).rejects.toMatchObject({
      errors: { code: 'Este cupón ya se usó en pedidos: su código no se puede cambiar.' },
    })
  })
})

describe('mock: pedido con cupón (R-24)', () => {
  it('el Dueño ve código y descuento; Operaciones solo el código', async () => {
    const { orders } = await api.getOrders({}, 'dueno')
    const withCoupon = orders.find((o) => o.couponCode === 'BIENVENIDA10')
    expect(withCoupon.discountAmount).toBeGreaterThan(0)
    expect(withCoupon.total).toBeCloseTo(withCoupon.subtotal - withCoupon.discountAmount + withCoupon.shipping, 2)

    const ops = await api.getOrder(withCoupon.id, 'operaciones')
    expect(ops.couponCode).toBe('BIENVENIDA10')
    expect(ops).not.toHaveProperty('discountAmount')
    expect(ops).not.toHaveProperty('total')
  })
})
