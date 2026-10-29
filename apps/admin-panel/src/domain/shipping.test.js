import { describe, expect, it } from 'vitest'
import { computeShipping, formatZone, isLocalPostalCode, validateZone, ZONE_ERROR } from './shipping'

const settings = {
  freeShippingThreshold: 799,
  parcelShippingCost: 99,
  localShippingCost: 49,
  localFreeShipping: true,
  localZones: [{ value: '81200–81299', label: 'Los Mochis' }, { value: '81300-81399', label: 'Ejidos de Ahome' }, '81450'],
}

describe('isLocalPostalCode', () => {
  it('CP dentro de un rango es local', () => {
    expect(isLocalPostalCode('81200', settings.localZones)).toBe(true)
    expect(isLocalPostalCode('81299', settings.localZones)).toBe(true)
    expect(isLocalPostalCode('81350', settings.localZones)).toBe(true)
  })
  it('CP fuera de rango no es local', () => {
    expect(isLocalPostalCode('81199', settings.localZones)).toBe(false)
    expect(isLocalPostalCode('06700', settings.localZones)).toBe(false)
  })
  it('código suelto en la zona es local', () => {
    expect(isLocalPostalCode('81450', settings.localZones)).toBe(true)
    expect(isLocalPostalCode('81451', settings.localZones)).toBe(false)
  })
  it('acepta zonas como texto simple y rechaza CP mal formados', () => {
    expect(isLocalPostalCode('81250', ['81200-81299'])).toBe(true)
    expect(isLocalPostalCode('8125', ['81200-81299'])).toBe(false)
  })
})

describe('computeShipping', () => {
  it('umbral exacto 799 es gratis (local y paquetería)', () => {
    expect(computeShipping({ subtotal: 799, postalCode: '81250' }, settings)).toEqual({ method: 'local', cost: 0 })
    expect(computeShipping({ subtotal: 799, postalCode: '06700' }, settings)).toEqual({ method: 'paqueteria', cost: 0 })
  })
  it('798 local cuesta 49', () => {
    expect(computeShipping({ subtotal: 798, postalCode: '81250' }, settings)).toEqual({ method: 'local', cost: 49 })
  })
  it('798 paquetería cuesta 99', () => {
    expect(computeShipping({ subtotal: 798, postalCode: '44100' }, settings)).toEqual({ method: 'paqueteria', cost: 99 })
  })
  it('con localFreeShipping=false la entrega local cobra aunque pase el umbral', () => {
    const s = { ...settings, localFreeShipping: false }
    expect(computeShipping({ subtotal: 1200, postalCode: '81250' }, s)).toEqual({ method: 'local', cost: 49 })
    expect(computeShipping({ subtotal: 1200, postalCode: '44100' }, s)).toEqual({ method: 'paqueteria', cost: 0 })
  })
  it('refleja una tarifa local nueva (59)', () => {
    expect(computeShipping({ subtotal: 420, postalCode: '81250' }, { ...settings, localShippingCost: 59 }).cost).toBe(59)
  })
})

describe('validación de CP o rango', () => {
  it('acepta CP de 5 dígitos y rangos con guion corto o largo', () => {
    expect(validateZone('81280')).toBe('')
    expect(validateZone('81280-81290')).toBe('')
    expect(validateZone('81280 – 81290')).toBe('')
  })
  it('rechaza formatos inválidos y rangos invertidos', () => {
    expect(validateZone('8128')).toBe(ZONE_ERROR)
    expect(validateZone('81280-812')).toBe(ZONE_ERROR)
    expect(validateZone('81290-81280')).toBe(ZONE_ERROR)
    expect(validateZone('')).toBe(ZONE_ERROR)
  })
  it('formatea con guion largo', () => {
    expect(formatZone('81280 - 81290')).toBe('81280–81290')
  })
})
