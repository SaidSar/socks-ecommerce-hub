import { describe, expect, it } from 'vitest'
import { BRANDS, COLORS } from '../data/catalogSeed'
import { brandMargins, crossesYear, grossMargin, isValidDay, lineStats, marginOf, MSG, seasonStatus, skuOf, validateCollection, validateProduct } from './catalog'

const ctx = { brands: BRANDS, colors: COLORS }
const valid = { line: 'especiales', name: 'Copo Navideño', brand: 'sin-marca', collection: 'navidad', colors: ['ROJ'], price: 199, unitCost: 82 }

describe('validaciones del producto (§4.3)', () => {
  it('un producto completo es válido', () => {
    expect(validateProduct(valid, ctx)).toEqual({})
  })
  it('nombre vacío', () => {
    expect(validateProduct({ ...valid, name: '  ' }, ctx).name).toBe(MSG.name)
  })
  it('R-31: colección obligatoria en Especiales', () => {
    expect(validateProduct({ ...valid, collection: null }, ctx).collection).toBe(MSG.collection)
    expect(validateProduct({ ...valid, line: 'accesorios', collection: null }, ctx).collection).toBeUndefined()
  })
  it('R-32: SOKKO solo con la marca propia, y la marca propia solo en SOKKO', () => {
    expect(validateProduct({ ...valid, line: 'sokko', brand: 'nike', colors: ['SUM'] }, ctx).brand).toBe(MSG.sokkoBrand)
    expect(validateProduct({ ...valid, brand: 'sokko' }, ctx).brand).toBe(MSG.ownBrandElsewhere)
  })
  it('R-32: los tonos Kyoto son exclusivos de SOKKO Japón', () => {
    expect(validateProduct({ ...valid, colors: ['ROJ', 'SUM', 'LAC'] }, ctx).colors).toBe(MSG.kyotoTones(['Tinta Sumi', 'Rojo Laca']))
    expect(validateProduct({ ...valid, line: 'sokko', brand: 'sokko', collection: null, colors: ['SUM'] }, ctx)).toEqual({})
  })
  it('R-30: el costo no puede ser negativo (vacío se acepta)', () => {
    expect(validateProduct({ ...valid, unitCost: -1 }, ctx).unitCost).toBe(MSG.cost)
    expect(validateProduct({ ...valid, unitCost: null }, ctx).unitCost).toBeUndefined()
  })
  it('código de barras único: de otro SKU o repetido en el mismo producto', () => {
    const owners = { '0195238001000': 'MRC-001-BLA-S' }
    const errors = validateProduct({ ...valid, barcodes: { 'ESP-001-ROJ-S': '0195238001000', 'ESP-001-ROJ-M': '777', 'ESP-001-ROJ-L': '777' } }, { ...ctx, barcodeOwners: owners })
    expect(errors['barcode:ESP-001-ROJ-S']).toBe('Ese código de barras ya está en MRC-001-BLA-S.')
    expect(errors['barcode:ESP-001-ROJ-L']).toBe(MSG.barcodeRepeated)
    expect(errors['barcode:ESP-001-ROJ-M']).toBeUndefined()
  })
})

describe('temporadas en el panel', () => {
  const navidad = { kind: 'temporada', startMonth: 11, startDay: 1, endMonth: 1, endDay: 6, offSeasonDiscountPct: 0.3 }
  const halloween = { kind: 'temporada', startMonth: 10, startDay: 1, endMonth: 11, endDay: 2, offSeasonDiscountPct: 0.3 }
  it('estado: activa con días para terminar; fuera con días para iniciar (warn ≤ 14)', () => {
    expect(seasonStatus(halloween, { month: 10, day: 18 })).toMatchObject({ tone: 'ok', text: 'Activa · termina en 15 días' })
    expect(seasonStatus(navidad, { month: 10, day: 18 })).toMatchObject({ tone: 'warn', text: 'Fuera · inicia en 14 días' })
    expect(seasonStatus(navidad, { month: 3, day: 20 })).toMatchObject({ tone: 'mute' })
    expect(seasonStatus(navidad, { month: 1, day: 6 }).text).toBe('Activa · termina hoy')
    expect(seasonStatus({ kind: 'tematica' }, { month: 3, day: 20 })).toMatchObject({ tone: 'info', text: 'Siempre visible' })
  })
  it('días válidos (sin 29 de febrero) y cruce de año', () => {
    expect(isValidDay(2, 29)).toBe(false)
    expect(isValidDay(4, 31)).toBe(false)
    expect(isValidDay(12, 31)).toBe(true)
    expect(crossesYear(navidad)).toBe(true)
    expect(crossesYear(halloween)).toBe(false)
    expect(validateCollection({ ...navidad, endMonth: 2, endDay: 29 }).window).toBe(MSG.day)
    expect(validateCollection({ ...navidad, offSeasonDiscountPct: 0.65 }).discount).toBe(MSG.discount)
  })
})

describe('margen (§4.2, §6)', () => {
  const p = (line, brand, price, unitCost, sold) => ({ line, brand: { slug: brand, name: brand }, price, unitCost, sold })
  const products = [p('sokko', 'sokko', 400, 160, 10), p('sokko', 'sokko', 360, null, 5), p('marcas', 'nike', 449, 305, 4)]

  it('marginOf: sin costo no hay margen', () => {
    expect(marginOf(400, 160)).toBeCloseTo(0.6)
    expect(marginOf(400, null)).toBeNull()
  })
  it('por línea excluye los productos sin costo y cuenta cuántos faltan', () => {
    const [sokko, marcas] = lineStats(products, ['sokko', 'marcas'])
    expect(sokko).toMatchObject({ units: 15, revenue: 5800, missingCost: 1 })
    expect(sokko.margin).toBeCloseTo(0.6) // solo el de 400 con costo
    expect(marcas.missingCost).toBe(0)
  })
  it('margen bruto total y por marca solo con costo registrado', () => {
    expect(grossMargin(products)).toBeCloseTo((4000 + 1796 - 1600 - 1220) / (4000 + 1796))
    expect(brandMargins(products).map((b) => b.slug)).toEqual(['sokko', 'nike'])
  })
  it('SKU con prefijo de línea', () => {
    expect(skuOf('marcas', 1, 'NEG', 'L')).toBe('MRC-001-NEG-L')
  })
})
