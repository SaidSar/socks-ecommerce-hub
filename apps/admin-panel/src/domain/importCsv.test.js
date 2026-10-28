import { describe, expect, it } from 'vitest'
import { createCatalog } from '../data/seed'
import { MSG } from './catalog'
import { buildTemplate, detectSeparator, ERR, previewCsv, rowsToCsv, WARN } from './importCsv'

const inventory = [
  { sku: 'SKK-007-SUM-M', piece: 'Tabi Origami Noche', tone: 'sumi', size: 'M', stock: 4, unit: 'par' },
  { sku: 'SKK-007-SUM-L', piece: 'Tabi Origami Noche', tone: 'sumi', size: 'L', stock: 2, unit: 'par' },
  { sku: 'SKK-012-MAT-S', piece: 'Lino Komorebi', tone: 'matcha', size: 'S', stock: 9, unit: 'par' },
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

  it('R-27: el stock importado no puede quedar por debajo de lo apartado', () => {
    const withReserved = inventory.map((r) => (r.sku === 'SKK-012-MAT-S' ? { ...r, reserved: 3 } : r))
    const csv = 'SKU,Pieza,Tono,Talla,Stock\nSKK-012-MAT-S,a,b,S,3\nSKK-007-SUM-M,a,b,M,0'
    expect(previewCsv(csv, withReserved).valid.map((r) => r.sku)).toEqual(['SKK-012-MAT-S', 'SKK-007-SUM-M'])
    const res = previewCsv('SKU,Pieza,Tono,Talla,Stock\nSKK-012-MAT-S,a,b,S,2', withReserved)
    expect(res.invalid[0]).toMatchObject({ line: 2, error: ERR.belowReserved(2, 3, 'par') })
    expect(res.invalid[0].error).toContain('3 pares apartados')
    // §4.7: fuera de las calcetas sin paquete se habla de unidades.
    const gorro = [{ sku: 'ACC-001-NEG-U', stock: 5, reserved: 1, unit: 'unidad' }]
    expect(previewCsv('SKU,Pieza,Tono,Talla,Stock\nACC-001-NEG-U,a,b,U,0', gorro).invalid[0].error).toBe(
      'El stock (0) es menor que la unidad apartada para pedidos',
    )
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

describe('columnas opcionales del catálogo (§4.7)', () => {
  const catalog = createCatalog()
  const inv = [
    { sku: 'MRC-001-BLA-S', stock: 4, reserved: 0, unit: 'unidad' },
    { sku: 'MRC-003-NEG-M', stock: 4, reserved: 0, unit: 'par' },
    { sku: 'ESP-001-ROJ-S', stock: 4, reserved: 0, unit: 'par' },
    { sku: 'ESP-001-ROJ-M', stock: 4, reserved: 0, unit: 'par' },
    { sku: 'SKK-007-SUM-M', stock: 4, reserved: 0, unit: 'par' },
    { sku: 'ACC-001-NEG-U', stock: 4, reserved: 0, unit: 'unidad' },
  ]
  const HEAD = 'SKU,Pieza,Tono,Talla,Stock,line,brand,type,collection,units_per_pack,unit_cost,barcode'
  const run = (lines, opts) => previewCsv([HEAD, ...lines].join('\n'), inv, catalog, opts)

  it('acepta las columnas nuevas y devuelve los cambios de cada fila', () => {
    const res = run(['MRC-003-NEG-M,a,b,M,6,marcas,Nike,Calcetas,,3,121.50,7501234500017', 'ESP-001-ROJ-S,a,b,S,5,,,,Halloween,,,'])
    expect(res.error).toBe('')
    expect(res.columns).toHaveLength(7)
    expect(res.invalid).toEqual([])
    expect(res.valid[0].changes).toEqual({ brand: 'nike', unitsPerPack: 3, unitCost: 121.5, barcode: '7501234500017' })
    expect(res.valid[1].changes).toEqual({ collection: 'halloween' })
  })

  it('las columnas pueden venir en otro orden; una desconocida es error del archivo', () => {
    const csv = 'SKU,Pieza,Tono,Talla,Stock,Barcode,Unit Cost\nMRC-003-NEG-M,a,b,M,6,7501234500017,90'
    expect(previewCsv(csv, inv, catalog).valid[0].changes).toEqual({ barcode: '7501234500017', unitCost: 90 })
    expect(previewCsv('SKU,Pieza,Tono,Talla,Stock,precio\n', inv, catalog).error).toBe(ERR.unknownColumn('precio'))
  })

  it('R-32: marca propia fuera de SOKKO y otra marca en SOKKO', () => {
    expect(run(['MRC-003-NEG-M,a,b,M,6,,sokko,,,,,']).invalid[0].error).toBe(MSG.ownBrandElsewhere)
    expect(run(['SKK-007-SUM-M,a,b,M,6,,Nike,,,,,']).invalid[0].error).toBe(MSG.sokkoBrand)
  })

  it('R-30: costo negativo o que no es número', () => {
    expect(run(['MRC-003-NEG-M,a,b,M,6,,,,,,-5,']).invalid[0].error).toBe(MSG.cost)
    expect(run(['MRC-003-NEG-M,a,b,M,6,,,,,,abc,']).invalid[0].error).toBe(ERR.cost)
  })

  it('R-31: la colección de Especiales se puede cambiar, nunca a una que no existe', () => {
    expect(run(['ESP-001-ROJ-S,a,b,S,5,,,,Pascua,,,']).invalid[0].error).toBe(ERR.unknownCollection('Pascua'))
  })

  it('código de barras único: contra otro SKU del catálogo y dentro del archivo', () => {
    // 019523800100 es el código de ejemplo de MRC-001-BLA-S.
    expect(run(['ESP-001-ROJ-S,a,b,S,5,,,,,,,019523800100']).invalid[0].error).toBe(MSG.barcode('MRC-001-BLA-S'))
    expect(run(['MRC-001-BLA-S,a,b,S,5,,,,,,,019523800100']).invalid).toEqual([]) // el suyo propio
    const twice = run(['ESP-001-ROJ-S,a,b,S,5,,,,,,,7501', 'ESP-001-ROJ-M,a,b,M,5,,,,,,,7501'])
    expect(twice.invalid[0]).toMatchObject({ line: 3, error: MSG.barcode('ESP-001-ROJ-S') })
  })

  it('línea y tipo forman parte del SKU: no cambian desde el CSV', () => {
    expect(run(['MRC-003-NEG-M,a,b,M,6,especiales,,,,,,']).invalid[0].error).toBe(ERR.line('Marcas'))
    expect(run(['MRC-003-NEG-M,a,b,M,6,,,Gorros,,,,']).invalid[0].error).toBe(ERR.type('Calcetas'))
    expect(run(['MRC-003-NEG-M,a,b,M,6,,Adidas,,,,,']).invalid[0].error).toBe(ERR.unknownBrand('Adidas'))
    expect(run(['MRC-003-NEG-M,a,b,M,6,,,,,0,,']).invalid[0].error).toBe(ERR.pack)
  })

  it('filas del mismo producto que se contradicen', () => {
    const res = run(['ESP-001-ROJ-S,a,b,S,5,,,,Navidad,,80,', 'ESP-001-ROJ-M,a,b,M,5,,,,Navidad,,85,'])
    expect(res.valid).toHaveLength(1)
    expect(res.invalid[0].error).toBe(ERR.conflict('unit_cost'))
  })

  it('si quien importa no es Dueño, unit_cost se ignora con aviso y la fila sigue válida', () => {
    const res = run(['MRC-003-NEG-M,a,b,M,6,,,,,,121.50,'], { canSeeCosts: false })
    expect(res.valid[0]).toMatchObject({ warning: WARN.costIgnored, changes: {} })
    expect(run(['MRC-003-NEG-M,a,b,M,6,,,,,,-5,'], { canSeeCosts: false }).valid[0].warning).toBe(WARN.costIgnored)
  })

  it('rowsToCsv reconstruye el archivo para que el servidor lo valide de nuevo', () => {
    const { valid } = run(['MRC-003-NEG-M,a,b,M,6,,Nike,,,,121.50,'])
    expect(previewCsv(rowsToCsv(valid), inv, catalog).valid[0].changes).toEqual({ brand: 'nike', unitCost: 121.5 })
  })
})
