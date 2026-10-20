import { describe, expect, it } from 'vitest'
import { buildTemplate, detectSeparator, ERR, previewCsv } from './importCsv'

const inventory = [
  { sku: 'SKK-007-SUM-M', piece: 'Tabi Origami Noche', tone: 'sumi', size: 'M', stock: 4 },
  { sku: 'SKK-007-SUM-L', piece: 'Tabi Origami Noche', tone: 'sumi', size: 'L', stock: 2 },
  { sku: 'SKK-012-MAT-S', piece: 'Lino Komorebi', tone: 'matcha', size: 'S', stock: 9 },
]

describe('previewCsv', () => {
  it('detecta separador ; y acepta encabezados con acentos y mayúsculas', () => {
    expect(detectSeparator('SKU;Pieza;Tono;Talla;Stock')).toBe(';')
    const csv = 'sku;PIEZA;Tóno;TALLA;Stóck\nSKK-007-SUM-M;Tabi Origami Noche;Tinta Sumi;M;12\n'
    const res = previewCsv(csv, inventory)
    expect(res.error).toBe('')
    expect(res.valid).toHaveLength(1)
    expect(res.valid[0]).toMatchObject({ sku: 'SKK-007-SUM-M', stock: 12, error: '' })
  })

  it('separador , con BOM y comillas', () => {
    const csv = '﻿SKU,Pieza,Tono,Talla,Stock\r\nSKK-012-MAT-S,"Lino Komorebi, oliva",Oliva Matcha,S,7\r\n'
    const res = previewCsv(csv, inventory)
    expect(res.valid[0]).toMatchObject({ piece: 'Lino Komorebi, oliva', stock: 7 })
  })

  it('SKU inexistente', () => {
    const res = previewCsv('SKU,Pieza,Tono,Talla,Stock\nSKK-099-AZU-M,Modelo,Azul,M,10', inventory)
    expect(res.invalid[0].error).toBe(ERR.unknownSku)
  })

  it('stock negativo', () => {
    const res = previewCsv('SKU,Pieza,Tono,Talla,Stock\nSKK-007-SUM-M,Tabi,Sumi,M,-2', inventory)
    expect(res.invalid[0].error).toBe(ERR.negative)
  })

  it('stock decimal', () => {
    const res = previewCsv('SKU;Pieza;Tono;Talla;Stock\nSKK-007-SUM-M;Tabi;Sumi;M;3.5\nSKK-007-SUM-L;Tabi;Sumi;L;2,5', inventory)
    expect(res.invalid.map((r) => r.error)).toEqual([ERR.notInteger, ERR.notInteger])
  })

  it('SKU duplicado: se usa la primera fila', () => {
    const res = previewCsv('SKU,Pieza,Tono,Talla,Stock\nSKK-007-SUM-M,Tabi,Sumi,M,5\nSKK-007-SUM-M,Tabi,Sumi,M,9', inventory)
    expect(res.valid).toHaveLength(1)
    expect(res.valid[0].stock).toBe(5)
    expect(res.invalid[0]).toMatchObject({ line: 3, error: ERR.duplicate })
  })

  it('mezcla: aplica solo las válidas', () => {
    const csv = ['SKU,Pieza,Tono,Talla,Stock', 'SKK-007-SUM-M,a,b,M,1', 'SKK-007-SUM-L,a,b,L,-1', 'SKK-012-MAT-S,a,b,S,3', 'NOPE,a,b,S,3', ''].join('\n')
    const res = previewCsv(csv, inventory)
    expect(res.valid.map((r) => r.sku)).toEqual(['SKK-007-SUM-M', 'SKK-012-MAT-S'])
    expect(res.invalid).toHaveLength(2)
  })

  it('rechaza columnas en otro orden y archivos vacíos', () => {
    expect(previewCsv('Pieza,SKU,Tono,Talla,Stock\n', inventory).error).toBe(ERR.headers)
    expect(previewCsv('', inventory).error).toBe(ERR.empty)
  })
})

describe('buildTemplate', () => {
  it('genera encabezados y una fila por SKU con su stock', () => {
    const csv = buildTemplate(inventory, (t) => ({ sumi: 'Tinta Sumi', matcha: 'Oliva Matcha' })[t])
    const lines = csv.replace('﻿', '').trim().split('\r\n')
    expect(lines[0]).toBe('SKU,Pieza,Tono,Talla,Stock')
    expect(lines[1]).toBe('SKK-007-SUM-M,Tabi Origami Noche,Tinta Sumi,M,4')
    expect(lines).toHaveLength(4)
    // La plantilla es importable tal cual.
    expect(previewCsv(csv, inventory).valid).toHaveLength(3)
  })
})
