import { describe, expect, it } from 'vitest'
import { couponPayload, couponStatus, filterCoupons, generateCode, normalizeCode, previewText, usesLabel, validateCoupon, validityLabel, valueLabel } from './coupons'

const TODAY = '2026-11-04'

describe('cupones: vista previa en texto', () => {
  it('describe tipo, mínimo, vigencia, límite y uso por cliente', () => {
    expect(
      previewText({ type: 'percent', value: '10', minSubtotal: '500', startsOn: '2026-11-10', endsOn: '2026-11-30', onePerCustomer: true }, TODAY),
    ).toBe('10% de descuento en compras desde $500, válido del 10 al 30 de noviembre, una vez por cliente')
    expect(previewText({ type: 'fixed', value: '100', maxRedemptions: '50' }, TODAY)).toBe('$100 de descuento, hasta 50 usos')
    expect(previewText({ type: 'free_shipping', endsOn: '2027-01-06' }, TODAY)).toBe('Envío gratis, válido hasta el 6 de enero de 2027')
    expect(previewText({ type: 'percent', value: '' }, TODAY)).toBe('')
  })

  it('etiquetas de la tabla', () => {
    expect(valueLabel({ type: 'percent', value: 10 })).toBe('10%')
    expect(valueLabel({ type: 'fixed', value: 100 })).toBe('$100')
    expect(valueLabel({ type: 'free_shipping', value: 0 })).toBe('Envío gratis')
    expect(usesLabel({ redemptions: 12, maxRedemptions: 50 })).toBe('12 / 50')
    expect(usesLabel({ redemptions: 3, maxRedemptions: null })).toBe('3')
    expect(validityLabel({ startsOn: '2026-10-28', endsOn: '2026-11-30' }, TODAY)).toBe('Del 28 de octubre al 30 de noviembre')
    expect(validityLabel({}, TODAY)).toBe('Sin vencimiento')
  })
})

describe('cupones: estado', () => {
  const base = { isActive: true, redemptions: 0, maxRedemptions: null, startsOn: null, endsOn: null }

  it('inactivo, vencido, agotado, programado o activo (mismo orden que el servidor)', () => {
    expect(couponStatus({ ...base, isActive: false, endsOn: '2020-01-01' }, TODAY)).toBe('inactive')
    expect(couponStatus({ ...base, endsOn: '2026-11-03' }, TODAY)).toBe('expired')
    expect(couponStatus({ ...base, maxRedemptions: 5, redemptions: 5 }, TODAY)).toBe('exhausted')
    expect(couponStatus({ ...base, startsOn: '2026-11-05' }, TODAY)).toBe('scheduled')
    expect(couponStatus({ ...base, endsOn: TODAY }, TODAY)).toBe('active')
  })

  it('filtra por estado y busca por código o nota', () => {
    const list = [
      { ...base, code: 'BIENVENIDA10', description: 'Primera compra' },
      { ...base, code: 'VERANO25', description: null, endsOn: '2026-08-31' },
    ]
    expect(filterCoupons(list, { status: 'expired' }, TODAY).map((c) => c.code)).toEqual(['VERANO25'])
    expect(filterCoupons(list, { q: 'primera' }, TODAY).map((c) => c.code)).toEqual(['BIENVENIDA10'])
  })
})

describe('cupones: formulario', () => {
  it('mismos mensajes por campo que la API', () => {
    expect(validateCoupon({ code: 'x', type: 'percent', value: '95', minSubtotal: '0', maxRedemptions: '0', startsOn: '2026-11-10', endsOn: '2026-11-01' })).toEqual({
      code: 'El código lleva de 3 a 30 letras sin acentos, números o guiones.',
      value: 'El porcentaje va de 1 a 90, sin decimales.',
      minSubtotal: 'El mínimo de compra debe ser mayor que $0.',
      endsOn: 'La fecha final es anterior a la de inicio.',
      maxRedemptions: 'El límite de usos debe ser 1 o más.',
    })
    expect(validateCoupon({ code: 'envio gratis', type: 'free_shipping' })).toEqual({})
  })

  it('el código se normaliza y lo generado no tiene letras confusas', () => {
    expect(normalizeCode(' buen fin ')).toBe('BUENFIN')
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^[A-HJ-KM-NP-Z2-9]{8}$/)
  })

  it('el cuerpo para la API lleva nulos en lo opcional', () => {
    expect(couponPayload({ code: 'envio', type: 'free_shipping', value: '5', minSubtotal: '', startsOn: '', onePerCustomer: false })).toMatchObject({
      code: 'ENVIO',
      value: 0,
      minSubtotal: null,
      startsOn: null,
      maxRedemptions: null,
      isActive: true,
    })
  })
})
