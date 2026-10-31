import { describe, expect, it } from 'vitest'
import {
  CHECKOUT_MESSAGES,
  formatReference,
  isValidExpiry,
  orderStatusLabel,
  passesLuhn,
  quoteShippingLocal,
  taxIncluded,
  validateCheckout,
} from './checkout'

const config = { freeShippingThreshold: 799, parcelShippingCost: 99, localShippingCost: 49, localFreeShipping: true }
const NOW = new Date('2026-10-30T12:00:00Z')
const contact = {
  firstName: 'Ana',
  lastName: 'López',
  email: 'ana@correo.mx',
  phone: '668 123 4567',
  street: 'Calle 1',
  neighborhood: 'Centro',
  postalCode: '81200',
  city: 'Los Mochis',
  state: 'Sinaloa',
}
const card = { number: '4242 4242 4242 4242', name: 'Ana López', expiry: '08/29', cvc: '123' }

describe('validateCheckout', () => {
  it('datos completos: sin errores', () => {
    expect(validateCheckout({ contact, card, paymentMethod: 'tarjeta' }, NOW)).toEqual({})
  })

  it('OXXO no pide tarjeta', () => {
    expect(validateCheckout({ contact, card: {}, paymentMethod: 'oxxo_pay' }, NOW)).toEqual({})
  })

  it('mensajes exactos por campo y referencias opcionales', () => {
    const errors = validateCheckout({ contact: { email: 'mal' }, card: {}, paymentMethod: 'tarjeta' }, NOW)
    expect(errors).toMatchObject({
      firstName: CHECKOUT_MESSAGES.firstName,
      email: CHECKOUT_MESSAGES.emailFormat,
      phone: CHECKOUT_MESSAGES.phone,
      postalCode: CHECKOUT_MESSAGES.postalCode,
      cardNumber: CHECKOUT_MESSAGES.cardNumber,
      cardExpiry: CHECKOUT_MESSAGES.cardExpiry,
      cardCvc: CHECKOUT_MESSAGES.cardCvc,
    })
    expect(errors.references).toBeUndefined()
  })

  it('CP y teléfono exactos', () => {
    expect(validateCheckout({ contact: { ...contact, postalCode: '8120' }, card, paymentMethod: 'tarjeta' }, NOW).postalCode).toBeTruthy()
    expect(validateCheckout({ contact: { ...contact, phone: '123' }, card, paymentMethod: 'tarjeta' }, NOW).phone).toBeTruthy()
  })
})

describe('tarjeta', () => {
  it('Luhn acepta los números de prueba y rechaza errores de captura', () => {
    expect(passesLuhn('4242424242424242')).toBe(true)
    expect(passesLuhn('4000000000000002')).toBe(true)
    expect(passesLuhn('4000000000009995')).toBe(true)
    expect(passesLuhn('4242424242424241')).toBe(false)
  })

  it('el vencimiento vale hasta el último día del mes', () => {
    expect(isValidExpiry('10/26', NOW)).toBe(true)
    expect(isValidExpiry('09/26', NOW)).toBe(false)
    expect(isValidExpiry('13/29', NOW)).toBe(false)
    expect(isValidExpiry('0829', NOW)).toBe(false)
  })
})

describe('quoteShippingLocal (R-14)', () => {
  it('local con costo y gratis', () => {
    expect(quoteShippingLocal('81250', 100, config)).toEqual({ method: 'local', cost: 49 })
    expect(quoteShippingLocal('81399', 799, config)).toEqual({ method: 'local', cost: 0 })
    expect(quoteShippingLocal('81250', 799, { ...config, localFreeShipping: false })).toEqual({ method: 'local', cost: 49 })
  })

  it('paquetería con costo y gratis', () => {
    expect(quoteShippingLocal('06700', 798.99, config)).toEqual({ method: 'paqueteria', cost: 99 })
    expect(quoteShippingLocal('06700', 799, config)).toEqual({ method: 'paqueteria', cost: 0 })
  })
})

describe('presentación', () => {
  it('IVA incluido', () => {
    expect(taxIncluded(299, 0.16)).toBe(41.24)
  })

  it('referencia en grupos de 4', () => {
    expect(formatReference('93123456789012')).toBe('9312 3456 7890 12')
  })

  it('etiqueta del estado: OXXO pendiente tiene prioridad, cancelado manda', () => {
    expect(orderStatusLabel({ status: 'por_preparar', paymentMethod: 'oxxo_pay', paymentStatus: 'pendiente' })).toBe('OXXO por pagar')
    expect(orderStatusLabel({ status: 'cancelado', paymentMethod: 'oxxo_pay', paymentStatus: 'pendiente' })).toBe('Cancelado')
    expect(orderStatusLabel({ status: 'en_ruta', paymentMethod: 'tarjeta', paymentStatus: 'pagado' })).toBe('En ruta local')
  })
})
