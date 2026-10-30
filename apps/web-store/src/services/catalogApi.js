// Catálogo desde apps/api-service (DESIGN_DB.md §3.12). Traduce el contrato de la API a la forma que reciben los
// componentes (`services/catalogService.js`); el servidor ya aplicó R-28 y R-29 con la fecha de America/Mazatlan.
import { DEFAULT_CONFIG } from '../config/commerce'
import { TONES } from '../data/catalog.mock'
import { apiGet } from './api'
import { getConfig } from './configService'

const PAGE_SIZE = 48 // máximo de la API
const SKU_PREFIX = { sokko: 'SKK', marcas: 'MRC', especiales: 'ESP', accesorios: 'ACC' }
// Colores sin muestra propia (diseños estampados como `MUL`).
const PATTERN_HEX = '#8A8A8A'
const PATTERN_LINE = '#F4F0EB'

const ART_BY_TYPE = { gorros: 'beanie', gorras: 'cap', guantes: 'gloves', bufandas: 'scarf', lentes: 'glasses', mangas: 'sleeves' }
const ART_BY_COLLECTION = { navidad: 'xmas', halloween: 'pumpkin' }

/** Ilustración mientras no haya fotografía; la BD no guarda este dato. */
function artOf(p) {
  if (p.line === 'sokko') return 'tabi'
  if (ART_BY_TYPE[p.type.code]) return ART_BY_TYPE[p.type.code]
  if (p.unitsPerPack > 1) return 'pack'
  if (p.collection?.kind === 'tematica') return 'licensed'
  return ART_BY_COLLECTION[p.collection?.slug] ?? 'crew'
}

const toPct = (fraction) => Math.round(fraction * 100)

/** ProductCard (DESIGN_CATALOG_UI.md §2.1) a partir de un producto de la API. */
export function toCard(p, fewUnitsThreshold = DEFAULT_CONFIG.fewUnitsThreshold) {
  const stock = p.variants.reduce((sum, v) => sum + v.stock, 0)
  return {
    slug: p.slug,
    line: p.line,
    name: p.name,
    nameJp: p.nameJp,
    brand: p.brand,
    type: { code: p.type.code, name: p.type.name, unit: p.type.unitLabel, sizeSystem: p.type.sizeSystem },
    unitsPerPack: p.unitsPerPack,
    collection: p.collection
      ? { slug: p.collection.slug, name: p.collection.name, kind: p.collection.kind, inSeason: p.collection.inSeason }
      : null,
    price: p.finalPrice,
    listPrice: p.price,
    offSeasonPct: p.offSeason ? toPct(p.discountPct) : null,
    colors: p.colors.map((c) => ({
      code: c.code,
      apiCode: c.slug,
      name: c.name,
      hex: c.hex ?? PATTERN_HEX,
      line: c.lineHex ?? PATTERN_LINE,
      isSokkoTone: c.isSokkoTone,
    })),
    fewUnits: stock <= fewUnitsThreshold,
    stock,
    art: artOf(p),
  }
}

/** Ficha: la tarjeta más nota, tallas, ventana de la colección y variantes con el código de color del SKU. */
export function toDetail(p, fewUnitsThreshold) {
  const card = toCard(p, fewUnitsThreshold)
  const codeBySlug = Object.fromEntries(p.colors.map((c) => [c.slug, c.code]))
  const c = p.collection
  return {
    ...card,
    pieceNumber: p.pieceNumber,
    note: p.material,
    skuPrefix: `${SKU_PREFIX[p.line]}-${String(p.pieceNumber).padStart(3, '0')}`,
    sizes: p.sizes ?? [],
    seasonWindow:
      c?.kind === 'temporada' ? { startMonth: c.startMonth, startDay: c.startDay, endMonth: c.endMonth, endDay: c.endDay } : null,
    variants: p.variants.map((v) => ({ sku: v.sku, color: codeBySlug[v.color], size: v.size })),
  }
}

let thresholdRequest

/** Se pide una vez por carga de la app; si falla, se usa el valor de respaldo. */
function fewUnitsThreshold() {
  thresholdRequest ??= getConfig()
    .then((config) => config.fewUnitsThreshold)
    .catch(() => DEFAULT_CONFIG.fewUnitsThreshold)
  return thresholdRequest
}

/** Todas las páginas de GET /api/products. */
async function fetchProducts(params) {
  const items = []
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({ ...params, page, pageSize: PAGE_SIZE })
    const result = await apiGet(`/api/products?${query}`)
    items.push(...result.items)
    if (items.length >= result.total) return items
  }
}

const present = (filters) => Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
const mmdd = (month, day) => `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
const unique = (list, key) => [...new Map(list.map((x) => [x[key], x])).values()]

/** Filtros de la API más `color`, que la tienda aplica sobre los colores de cada producto. */
export async function listProducts({ color, ...filters } = {}) {
  const [items, threshold] = await Promise.all([fetchProducts(present(filters)), fewUnitsThreshold()])
  const cards = items.map((p) => toCard(p, threshold))
  return color ? cards.filter((p) => p.colors.some((c) => c.code === color)) : cards
}

export async function searchProducts(q) {
  const term = String(q ?? '').trim()
  if (!term) return []
  const [items, threshold] = await Promise.all([fetchProducts({ q: term }), fewUnitsThreshold()])
  return items.map((p) => toCard(p, threshold))
}

export async function getProduct(slug) {
  const [product, threshold] = await Promise.all([apiGet(`/api/products/${encodeURIComponent(slug)}`, { nullOn404: true }), fewUnitsThreshold()])
  return product ? toDetail(product, threshold) : null
}

export async function getNav() {
  const nav = await apiGet('/api/catalog/nav')
  return {
    lines: nav.lines.map((l) => ({
      code: l.code,
      name: l.label,
      count: l.count,
      hiddenCount: l.hiddenCount,
      hiddenCollections: l.hiddenCollections,
    })),
    brands: nav.brands,
    activeCollections: nav.collections
      .filter((c) => c.kind === 'temporada')
      .map((c) => ({
        slug: c.slug,
        name: c.name,
        start: mmdd(c.startMonth, c.startDay),
        end: mmdd(c.endMonth, c.endDay),
        offSeasonPct: toPct(c.offSeasonDiscountPct),
      })),
    featuredSlug: nav.featuredSlug,
  }
}

/** Opciones de la faceta de cada línea, con las mismas reglas que el mock. */
function facetOf(line, products) {
  if (line === 'marcas') {
    const brands = unique(products.map((p) => p.brand), 'slug').filter((b) => b.showInFilters)
    return { key: 'brand', options: brands.map((b) => ({ value: b.slug, label: b.name })) }
  }
  if (line === 'especiales') {
    const collections = unique(products.flatMap((p) => p.collection ?? []), 'slug')
    return { key: 'collection', options: collections.map((c) => ({ value: c.slug, label: c.name })) }
  }
  if (line === 'accesorios') {
    return { key: 'type', options: unique(products.map((p) => p.type), 'code').map((t) => ({ value: t.code, label: t.name })) }
  }
  const tones = unique(products.flatMap((p) => p.colors).filter((c) => c.isSokkoTone), 'code')
  const order = Object.keys(TONES)
  tones.sort((a, b) => order.indexOf(a.apiCode) - order.indexOf(b.apiCode))
  return { key: 'color', options: tones.map((c) => ({ value: c.code, label: c.name, hex: c.hex })) }
}

const hasFacetValue = (product, key, value) => {
  if (key === 'brand') return product.brand.slug === value
  if (key === 'collection') return product.collection?.slug === value
  if (key === 'type') return product.type.code === value
  return product.colors.some((c) => c.code === value)
}

export async function getLinePage(line, filters = {}) {
  const [nav, products] = await Promise.all([getNav(), listProducts({ line })])
  const navLine = nav.lines.find((l) => l.code === line)
  const facet = facetOf(line, products)
  const active = filters[facet.key] && facet.options.some((o) => o.value === filters[facet.key]) ? filters[facet.key] : null
  return {
    line,
    facet: { ...facet, active },
    products: products.filter((p) => !active || hasFacetValue(p, facet.key, active)),
    total: products.length,
    hiddenCount: navLine?.hiddenCount ?? 0,
    hiddenCollections: navLine?.hiddenCollections ?? [],
  }
}
