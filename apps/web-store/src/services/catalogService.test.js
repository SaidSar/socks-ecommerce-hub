import { describe, expect, it } from 'vitest'
import { getHome, getLinePage, getNav, getProduct, listProducts, searchProducts } from './catalogService'

// Mediodía en Los Mochis (UTC−7) para que la fecha local sea la del nombre.
const OCT_26 = new Date('2026-10-26T19:00:00Z')
const DEC_15 = new Date('2026-12-15T19:00:00Z')
const at = (now) => ({ now })
const slugs = (list) => list.map((p) => p.slug)

describe('listProducts (R-28)', () => {
  it('26-oct: excluye Navidad (fuera de temporada) e incluye Halloween', async () => {
    const especiales = slugs(await listProducts({ line: 'especiales' }, at(OCT_26)))
    expect(especiales).toContain('calabaza-nocturna')
    expect(especiales).not.toContain('copo-navideno')
    expect(especiales).toContain('pokemon-pikachu') // temática: siempre visible
  })

  it('15-dic: incluye Navidad y excluye Halloween', async () => {
    const especiales = slugs(await listProducts({ line: 'especiales' }, at(DEC_15)))
    expect(especiales).toContain('copo-navideno')
    expect(especiales).not.toContain('calabaza-nocturna')
  })

  it('el precio de un producto visible es el de lista', async () => {
    const [copo] = await listProducts({ collection: 'navidad' }, at(DEC_15))
    expect(copo).toMatchObject({ price: 199, listPrice: 199, offSeasonPct: null, collection: { inSeason: true } })
  })
})

describe('searchProducts (R-28, R-29)', () => {
  it('incluye la temporada inactiva con el precio rebajado: Navidad a $139.30 el 26-oct', async () => {
    const results = await searchProducts('navidad', at(OCT_26))
    const copo = results.find((p) => p.slug === 'copo-navideno')
    expect(copo).toMatchObject({ price: 139.3, listPrice: 199, offSeasonPct: 30, collection: { inSeason: false } })
  })

  it('15-dic: Halloween pasa a −30 %', async () => {
    const [calabaza] = await searchProducts('calabaza nocturna', at(DEC_15))
    expect(calabaza).toMatchObject({ price: 125.3, listPrice: 179, offSeasonPct: 30 })
  })

  it('sin acentos ni mayúsculas: "pokemon" encuentra "Pokémon"', async () => {
    expect(slugs(await searchProducts('pokemon', at(OCT_26)))).toEqual(['pokemon-pikachu'])
    expect(slugs(await searchProducts('  TELARAÑA ', at(OCT_26)))).toEqual(['telarana-nocturna'])
  })

  it('busca por marca, tipo y línea; vacío no devuelve nada', async () => {
    expect((await searchProducts('nike', at(OCT_26))).length).toBe(3)
    expect(slugs(await searchProducts('guantes', at(OCT_26)))).toEqual(['guantes-tactiles'])
    expect(await searchProducts('  ', at(OCT_26))).toEqual([])
  })
})

describe('getProduct', () => {
  it('funciona aunque la temporada esté inactiva, con tallas del sistema y SKU por variante', async () => {
    const copo = await getProduct('copo-navideno', at(OCT_26))
    expect(copo).toMatchObject({ price: 139.3, offSeasonPct: 30, seasonWindow: { startMonth: 11, endMonth: 1, endDay: 6 } })
    expect(copo.variants[0]).toEqual({ sku: 'ESP-001-ROJ-S', color: 'ROJ', size: 'S' })
  })

  it('SKU de SOKKO sin cambios; guantes con talla de guante; unitalla con U', async () => {
    expect((await getProduct('tabi-origami-noche', at(OCT_26))).variants.map((v) => v.sku)).toContain('SKK-007-SUM-M')
    const guantes = await getProduct('guantes-tactiles', at(OCT_26))
    expect(guantes.type).toMatchObject({ sizeSystem: 'guante', unit: 'par' })
    expect(guantes.sizes.map((s) => s.label)).toEqual(['Palma 17–19 cm', 'Palma 19–21 cm', 'Palma 21–23 cm'])
    expect((await getProduct('mangas-uv', at(OCT_26))).sizes).toEqual([{ code: 'U', label: 'Talla única' }])
  })

  it('paquete de 3 y pocas unidades', async () => {
    expect(await getProduct('nike-everyday-cushion-3', at(OCT_26))).toMatchObject({ unitsPerPack: 3, fewUnits: false })
    expect(await getProduct('kintsugi-washi', at(OCT_26))).toMatchObject({ stock: 3, fewUnits: true })
    expect(await getProduct('no-existe', at(OCT_26))).toBeNull()
  })
})

describe('getNav y getLinePage', () => {
  it('nav: cuenta solo visibles, oculta "Sin marca" y lista la temporada activa', async () => {
    const oct = await getNav(at(OCT_26))
    expect(oct.lines.map((l) => l.code)).toEqual(['sokko', 'marcas', 'especiales', 'accesorios'])
    expect(oct.lines.find((l) => l.code === 'especiales').count).toBe(5) // 3 de Halloween + 2 temáticas
    expect(oct.brands.map((b) => b.slug)).not.toContain('sin-marca')
    expect(oct.activeCollections).toEqual([{ slug: 'halloween', name: 'Halloween', start: '10-01', end: '11-02', offSeasonPct: 30 }])
    expect((await getNav(at(DEC_15))).activeCollections.map((c) => c.slug)).toEqual(['navidad'])
  })

  it('línea: faceta por línea, filtro activo y ocultos por temporada', async () => {
    const especiales = await getLinePage('especiales', {}, at(OCT_26))
    expect(especiales).toMatchObject({ total: 5, hiddenCount: 3, facet: { key: 'collection', active: null } })
    expect(especiales.facet.options.map((o) => o.value)).toEqual(['halloween', 'anime', 'superheroes'])

    const nike = await getLinePage('marcas', { brand: 'nike' }, at(OCT_26))
    expect(nike).toMatchObject({ total: 4, facet: { key: 'brand', active: 'nike' } })
    expect(slugs(nike.products)).toEqual(['nike-everyday-cushion-3', 'nike-elite-basketball'])

    const sokko = await getLinePage('sokko', { color: 'LAC' }, at(OCT_26))
    expect(sokko.facet.options.map((o) => o.value)).toEqual(['SUM', 'WAS', 'LAC', 'MAT'])
    expect(slugs(sokko.products)).toEqual(['kintsugi-washi', 'hanami-laca'])
  })

  it('home: temporada solo si hay una activa', async () => {
    const oct = await getHome(at(OCT_26))
    expect(oct.season).toMatchObject({ slug: 'halloween' })
    expect(oct.season.products).toHaveLength(3)
    expect(oct.featured.slug).toBe('tabi-origami-noche')
    expect((await getHome(at(new Date('2026-03-20T19:00:00Z')))).season).toBeNull()
  })
})
