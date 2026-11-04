import { describe, expect, it } from 'vitest'
import { carrierLabel, normalizeFolio, trackingUrl } from './tracking'

describe('URL de rastreo por paquetería', () => {
  it('Estafeta abre su buscador (no acepta la guía en la URL)', () => {
    expect(trackingUrl('estafeta', '486243357777')).toBe('https://www.estafeta.com/Herramientas/Rastreo')
  })

  it('DHL Express lleva la guía codificada en tracking-id', () => {
    expect(trackingUrl('dhl_express', '952368132413')).toBe('https://www.dhl.com/mx-es/home/rastreo.html?tracking-id=952368132413')
    expect(trackingUrl('dhl_express', '12 34&x=1')).toBe('https://www.dhl.com/mx-es/home/rastreo.html?tracking-id=12%2034%26x%3D1')
  })

  it('sin guía o sin paquetería conocida no hay enlace', () => {
    expect(trackingUrl('estafeta', null)).toBeNull()
    expect(trackingUrl(null, null)).toBeNull()
    expect(trackingUrl('fedex', '1234567890')).toBeNull()
  })

  it('nombra la paquetería con los códigos de la API', () => {
    expect(carrierLabel('estafeta')).toBe('Estafeta')
    expect(carrierLabel('dhl_express')).toBe('DHL Express')
  })
})

describe('folio del rastreo', () => {
  it.each([
    ['SKK-1050', 'SKK-1050'],
    [' skk-1050 ', 'SKK-1050'],
    ['skk1050', 'SKK-1050'],
    ['1050', 'SKK-1050'],
  ])('%j → %s', (input, folio) => {
    expect(normalizeFolio(input)).toBe(folio)
  })

  it.each(['', 'SKK-', 'ABC-1050', 'SKK-10a'])('%j no es un folio', (input) => {
    expect(normalizeFolio(input)).toBeNull()
  })
})
