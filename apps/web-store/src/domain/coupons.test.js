import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../config/commerce'
import { checkCoupon, couponDescription, dayLabel, discountFor, MOCK_COUPONS, normalizeCouponCode, pesos, quoteWithCoupon } from './coupons'

const percent = (value) => ({ code: 'DIEZ', type: 'percent', value, isActive: true })

describe('cupones: cálculo (mismo que QuoteOrder del servidor)', () => {
  it('normaliza el código a mayúsculas y sin espacios', () => {
    expect(normalizeCouponCode(' bienvenida 10 ')).toBe('BIENVENIDA10')
  })

  it('porcentaje redondeado a centavos, mitad hacia arriba', () => {
    expect(discountFor(percent(10), 559)).toBe(55.9)
    expect(discountFor(percent(15), 333.3)).toBe(50)
  })

  it('el monto fijo nunca pasa del subtotal y el envío gratis no descuenta mercancía', () => {
    expect(discountFor({ type: 'fixed', value: 1000 }, 400)).toBe(400)
    expect(discountFor({ type: 'free_shipping', value: 0 }, 400)).toBe(0)
  })

  it('el envío de cortesía se mide después del descuento y dice cuánto falta', () => {
    const quote = quoteWithCoupon(800, '06700', percent(10), DEFAULT_CONFIG)
    expect(quote).toMatchObject({ discount: 80, shippingCost: 99, total: 819, freeShippingRemaining: 79 })
  })

  it('envío gratis en local y paquetería', () => {
    for (const cp of ['81250', '06700']) {
      expect(quoteWithCoupon(350, cp, MOCK_COUPONS[1], DEFAULT_CONFIG)).toMatchObject({ shippingCost: 0, total: 350, freeShippingRemaining: null })
    }
  })
})

describe('cupones: motivos de rechazo', () => {
  const today = '2026-11-15'

  it('mismos textos que el servidor', () => {
    expect(checkCoupon(null, {}).message).toBe('Este código no existe.')
    expect(checkCoupon({ isActive: true, startsOn: '2026-11-20' }, { subtotal: 1, todayIso: today }).message).toBe('Este código es válido a partir del 20 de noviembre.')
    expect(checkCoupon({ isActive: true, endsOn: '2026-11-14' }, { subtotal: 1, todayIso: today }).message).toBe('Este código venció el 14 de noviembre.')
    expect(checkCoupon({ isActive: true, minSubtotal: 500 }, { subtotal: 100, todayIso: today }).message).toBe('Este código aplica en compras desde $500.')
    expect(checkCoupon({ isActive: true, maxRedemptions: 1 }, { subtotal: 1, todayIso: today, redemptions: 1 }).reason).toBe('exhausted')
    expect(checkCoupon({ isActive: true, onePerCustomer: true }, { subtotal: 1, todayIso: today, usedByEmail: true }).message).toBe('Este código ya se usó con su correo.')
    expect(checkCoupon({ isActive: false }, { subtotal: 1, todayIso: today }).reason).toBe('inactive')
  })

  it('el último día todavía vale', () => {
    expect(checkCoupon({ isActive: true, endsOn: today }, { subtotal: 1, todayIso: today })).toBeNull()
  })

  it('textos de apoyo', () => {
    expect(pesos(500)).toBe('$500')
    expect(pesos(499.5)).toBe('$499.50')
    expect(dayLabel('2027-01-06', '2026-11-15')).toBe('6 de enero de 2027')
    expect(couponDescription(MOCK_COUPONS[0])).toBe('10% de descuento')
    expect(couponDescription(MOCK_COUPONS[1])).toBe('Envío gratis')
  })
})
