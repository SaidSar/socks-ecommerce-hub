import { describe, expect, it } from 'vitest'
import { toCard, toDetail } from './catalogApi'

// Forma de GET /api/products/{slug} (DESIGN_DB.md §3.12) para un producto de temporada inactiva.
const copo = {
  id: 201,
  slug: 'calceta-navidena-copo',
  line: 'especiales',
  pieceNumber: 1,
  brand: { slug: 'sin-marca', name: 'Sin marca', isOwnBrand: false, showInFilters: false },
  type: { code: 'calcetas', name: 'Calcetas', unitLabel: 'par', sizeSystem: 'calceta' },
  collection: { slug: 'navidad', name: 'Navidad', kind: 'temporada', inSeason: false, startMonth: 11, startDay: 1, endMonth: 1, endDay: 6 },
  name: 'Calceta navideña Copo',
  nameJp: null,
  material: 'Tejido jacquard de invierno',
  unitsPerPack: 1,
  price: 199,
  finalPrice: 139.3,
  offSeason: true,
  discountPct: 0.3,
  colors: [{ code: 'MUL', slug: 'multicolor', name: 'Multicolor', hex: null, lineHex: null, isSokkoTone: false }],
  variants: [
    { sku: 'ESP-001-MUL-S', color: 'multicolor', size: 'S', stock: 3 },
    { sku: 'ESP-001-MUL-M', color: 'multicolor', size: 'M', stock: 1 },
  ],
  sizes: [
    { code: 'S', label: '22–24 cm' },
    { code: 'M', label: '25–27 cm' },
  ],
}

describe('toCard', () => {
  it('traduce precio, unidad, stock y colores al contrato de los componentes', () => {
    expect(toCard(copo, 4)).toMatchObject({
      price: 139.3,
      listPrice: 199,
      offSeasonPct: 30,
      type: { unit: 'par', sizeSystem: 'calceta' },
      collection: { slug: 'navidad', inSeason: false },
      stock: 4,
      fewUnits: true,
      art: 'xmas',
    })
    expect(toCard(copo, 4).colors[0]).toMatchObject({ code: 'MUL', apiCode: 'multicolor' })
    expect(toCard(copo, 4).colors[0].hex).toMatch(/^#/)
  })

  it('sin temporada inactiva no hay descuento', () => {
    expect(toCard({ ...copo, offSeason: false, discountPct: 0, finalPrice: 199 }, 4)).toMatchObject({ price: 199, offSeasonPct: null })
  })
})

describe('toDetail', () => {
  it('agrega nota, ventana, tallas y variantes con el código de color del SKU', () => {
    expect(toDetail(copo, 4)).toMatchObject({
      note: 'Tejido jacquard de invierno',
      skuPrefix: 'ESP-001',
      seasonWindow: { startMonth: 11, startDay: 1, endMonth: 1, endDay: 6 },
      sizes: copo.sizes,
    })
    expect(toDetail(copo, 4).variants[0]).toEqual({ sku: 'ESP-001-MUL-S', color: 'MUL', size: 'S', stock: 3 })
  })
})
