import { describe, expect, it } from 'vitest'
import { CARRIER_LABELS, label, MOVEMENT_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from './enums'
import { INITIAL, MANUAL_MOVEMENTS, SALE } from './inventory'
import { CARRIERS, PAYMENT_METHODS } from './orders'

const maps = { CARRIER_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, MOVEMENT_LABELS }

describe('enums (DESIGN_DB.md §1.6)', () => {
  it('los códigos de API son snake_case, sin espacios ni acentos', () => {
    Object.values(maps).forEach((m) => Object.keys(m).forEach((code) => expect(code).toMatch(/^[a-z]+(_[a-z]+)*$/)))
  })

  it('carrier y pago usan los códigos de la tabla', () => {
    expect(CARRIERS).toEqual(['estafeta', 'dhl_express'])
    expect(PAYMENT_METHODS).toEqual(['tarjeta', 'oxxo_pay'])
    expect(label(CARRIER_LABELS, 'dhl_express')).toBe('DHL Express')
    expect(label(PAYMENT_METHOD_LABELS, 'oxxo_pay')).toBe('OXXO Pay')
  })

  it('todos los movimientos del dominio tienen etiqueta', () => {
    ;[...MANUAL_MOVEMENTS, SALE, INITIAL].forEach((t) => expect(MOVEMENT_LABELS[t]).toBeTruthy())
    expect(label(MOVEMENT_LABELS, 'conteo_fisico')).toBe('Conteo físico')
  })

  it('un código desconocido se muestra tal cual', () => {
    expect(label(CARRIER_LABELS, 'fedex')).toBe('fedex')
    expect(label(CARRIER_LABELS, null)).toBe('')
  })
})
