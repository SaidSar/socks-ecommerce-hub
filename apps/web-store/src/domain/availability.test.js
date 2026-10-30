import { describe, expect, it } from 'vitest'
import { availabilityOf, variantStock } from './availability'

describe('availabilityOf', () => {
  it('sin stock o sin variante: agotado', () => {
    expect(availabilityOf(0, 4)).toBe('agotado')
    expect(availabilityOf(undefined, 4)).toBe('agotado')
  })

  it('pocas unidades hasta el umbral, inclusive', () => {
    expect(availabilityOf(1, 4)).toBe('pocas')
    expect(availabilityOf(4, 4)).toBe('pocas')
    expect(availabilityOf(5, 4)).toBe('disponible')
  })
})

describe('variantStock', () => {
  it('reparte parejo y el sobrante va a las primeras variantes', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => variantStock(4, 6, i))).toEqual([1, 1, 1, 1, 0, 0])
    expect([0, 1, 2].map((i) => variantStock(4, 3, i))).toEqual([2, 1, 1])
  })
})
