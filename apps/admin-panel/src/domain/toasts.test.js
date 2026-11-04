import { describe, expect, it } from 'vitest'
import { dropToast, pushToast } from './toasts'

describe('pushToast', () => {
  it('agrega al final y conserva solo los últimos tres', () => {
    const list = [1, 2, 3].reduce((acc, id) => pushToast(acc, { id, text: `t${id}` }), [])
    expect(pushToast(list, { id: 4, text: 't4' }).map((t) => t.id)).toEqual([2, 3, 4])
  })

  it('un aviso con la misma clave reemplaza al anterior', () => {
    const list = pushToast(pushToast([], { id: 1, key: 'stock', text: 'Entrada registrada' }), { id: 2, text: 'Otro' })
    expect(pushToast(list, { id: 3, key: 'stock', text: 'Salida registrada' }).map((t) => t.id)).toEqual([2, 3])
  })
})

describe('dropToast', () => {
  it('quita solo el aviso indicado', () => {
    expect(dropToast([{ id: 1 }, { id: 2 }], 1)).toEqual([{ id: 2 }])
  })
})
