import { describe, expect, it } from 'vitest'
import { label, PAYMENT_METHOD_LABELS } from './enums'

describe('enums (DESIGN_DB.md §1.6)', () => {
  it('label() devuelve la etiqueta de cada código de método de pago', () => {
    expect(label(PAYMENT_METHOD_LABELS, 'tarjeta')).toBe('Tarjeta')
    expect(label(PAYMENT_METHOD_LABELS, 'oxxo_pay')).toBe('OXXO Pay')
  })

  it('los códigos son snake_case, sin espacios ni acentos', () => {
    Object.keys(PAYMENT_METHOD_LABELS).forEach((code) => expect(code).toMatch(/^[a-z]+(_[a-z]+)*$/))
  })

  it('un código desconocido se muestra tal cual y uno vacío como texto vacío', () => {
    expect(label(PAYMENT_METHOD_LABELS, 'paypal')).toBe('paypal')
    expect(label(PAYMENT_METHOD_LABELS, null)).toBe('')
    expect(label(PAYMENT_METHOD_LABELS, undefined)).toBe('')
  })
})
