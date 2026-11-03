import { describe, expect, it } from 'vitest'
import { altFromFileName, fileError, fitWithin, IMAGE_MSG, MAX_ALT, moveItem, roomFor } from './images'

describe('fitWithin', () => {
  it('deja el lado largo en 1600 px y conserva la proporción', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 })
    expect(fitWithin(2400, 2400)).toEqual({ width: 1600, height: 1600 })
  })

  it('una foto chica no se agranda', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(1600, 900)).toEqual({ width: 1600, height: 900 })
  })

  it('una panorámica muy angosta no queda en 0 px', () => {
    expect(fitWithin(100000, 10)).toEqual({ width: 1600, height: 1 })
  })
})

describe('fileError', () => {
  it('acepta JPG, PNG y WebP', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) expect(fileError({ type })).toBeNull()
  })

  it('rechaza lo demás', () => {
    for (const type of ['image/gif', 'image/svg+xml', 'image/heic', 'application/pdf', '']) expect(fileError({ type })).toBe(IMAGE_MSG.type)
    expect(fileError(undefined)).toBe(IMAGE_MSG.type)
  })
})

describe('roomFor', () => {
  it('nunca pasa de 6 fotos', () => {
    expect(roomFor(0, 3)).toBe(3)
    expect(roomFor(4, 3)).toBe(2)
    expect(roomFor(6, 1)).toBe(0)
    expect(roomFor(7, 1)).toBe(0)
  })
})

describe('moveItem', () => {
  it('mueve sin cambiar la lista original', () => {
    const list = ['a', 'b', 'c']
    expect(moveItem(list, 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(list, 0, 1)).toEqual(['b', 'a', 'c'])
    expect(list).toEqual(['a', 'b', 'c'])
  })

  it('fuera de rango o al mismo lugar no cambia nada', () => {
    const list = ['a', 'b']
    expect(moveItem(list, 0, 0)).toBe(list)
    expect(moveItem(list, -1, 0)).toBe(list)
    expect(moveItem(list, 0, 2)).toBe(list)
  })
})

describe('altFromFileName', () => {
  it('quita la extensión y los separadores', () => {
    expect(altFromFileName('lentes_negros-frente.JPG')).toBe('lentes negros frente')
    expect(altFromFileName('IMG 0001.webp')).toBe('IMG 0001')
  })

  it('respeta el máximo', () => {
    expect(altFromFileName(`${'a'.repeat(300)}.png`)).toHaveLength(MAX_ALT)
  })
})
