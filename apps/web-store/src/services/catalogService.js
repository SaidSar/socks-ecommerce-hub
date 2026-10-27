// Catálogo multilínea (DESIGN_CATALOG_UI.md §2, DESIGN_DB.md §3.12). Única capa que conoce las reglas de temporada:
// los componentes reciben `price`, `listPrice` y `collection.inSeason` ya calculados y nunca deciden precio ni visibilidad.
// TODO(api): sustituir la semilla por GET /api/products, /api/products/{slug} y /api/catalog/nav; la forma no cambia.
import { DEFAULT_CONFIG } from '../config/commerce'
import { label, LINE_LABELS, LINES } from '../config/enums'
import { BRANDS, COLLECTIONS, COLORS, FEATURED_SLUG, PRODUCT_TYPES, PRODUCTS, SIZES_BY_SYSTEM } from '../data/catalogSeed'
import { effectivePrice, isInSeason } from '../domain/season'
import { catalogToday } from './catalogToday'

const MOCK_LATENCY_MS = 150
const SKU_PREFIX = { sokko: 'SKK', marcas: 'MRC', especiales: 'ESP', accesorios: 'ACC' }

const byKey = (list, key) => Object.fromEntries(list.map((x) => [x[key], x]))
const brandsBySlug = byKey(BRANDS, 'slug')
const typesByCode = byKey(PRODUCT_TYPES, 'code')
const collectionsBySlug = byKey(COLLECTIONS, 'slug')
const colorsByCode = byKey(COLORS, 'code')

const latency = () => new Promise((resolve) => setTimeout(resolve, import.meta.env.MODE === 'test' ? 0 : MOCK_LATENCY_MS))
const copy = (x) => structuredClone(x)

/** Sin mayúsculas ni acentos: "Pokémon" → "pokemon". */
export const normalizeText = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** R-28: ¿el producto se lista hoy? Los de una temporada inactiva solo salen en la búsqueda y por URL. */
const isVisible = (product, today) => isInSeason(collectionsBySlug[product.collection], today)

/** ProductCard (DESIGN_CATALOG_UI.md §2.1). */
function toCard(product, today) {
  const brand = brandsBySlug[product.brand]
  const type = typesByCode[product.type]
  const collection = collectionsBySlug[product.collection]
  const pricing = effectivePrice(product.price, collection, today)
  return {
    slug: product.slug,
    line: product.line,
    name: product.name,
    nameJp: product.nameJp ?? null,
    brand: { name: brand.name, slug: brand.slug, isOwnBrand: brand.isOwnBrand, showInFilters: brand.showInFilters },
    type: { code: type.code, name: type.name, unit: type.unit, sizeSystem: type.sizeSystem },
    unitsPerPack: product.unitsPerPack ?? 1,
    collection: collection
      ? { slug: collection.slug, name: collection.name, kind: collection.kind, inSeason: isInSeason(collection, today) }
      : null,
    price: pricing.price,
    listPrice: pricing.listPrice,
    offSeasonPct: pricing.offSeason ? pricing.offSeasonPct : null,
    colors: product.colors.map((code) => {
      const c = colorsByCode[code]
      return { code: c.code, apiCode: c.apiCode, name: c.name, hex: c.hex, line: c.line }
    }),
    fewUnits: product.stock <= DEFAULT_CONFIG.fewUnitsThreshold,
    stock: product.stock,
    art: product.art,
  }
}

const skuOf = (product, colorCode, sizeCode) =>
  `${SKU_PREFIX[product.line]}-${String(product.pieceNumber).padStart(3, '0')}-${colorCode}-${sizeCode}`

/** Ficha: la tarjeta más nota, tallas del sistema del tipo, ventana de la colección y SKU por variante. */
function toDetail(product, today) {
  const card = toCard(product, today)
  const collection = collectionsBySlug[product.collection]
  const sizes = SIZES_BY_SYSTEM[card.type.sizeSystem]
  return {
    ...card,
    pieceNumber: product.pieceNumber,
    note: product.note,
    sizes: sizes.map((s) => ({ ...s })),
    seasonWindow:
      collection?.kind === 'temporada'
        ? { startMonth: collection.startMonth, startDay: collection.startDay, endMonth: collection.endMonth, endDay: collection.endDay }
        : null,
    variants: card.colors.flatMap((c) => sizes.map((s) => ({ sku: skuOf(product, c.code, s.code), color: c.code, size: s.code }))),
  }
}

const matches = (product, { line, brand, type, collection, color } = {}) =>
  (!line || product.line === line) &&
  (!brand || product.brand === brand) &&
  (!type || product.type === type) &&
  (!collection || product.collection === collection) &&
  (!color || product.colors.includes(color))

const searchText = (p) =>
  normalizeText(
    [
      p.name,
      brandsBySlug[p.brand].name,
      label(LINE_LABELS, p.line),
      typesByCode[p.type].name,
      collectionsBySlug[p.collection]?.name,
      p.note,
    ].join(' '),
  )

// ---------------------------------------------------------------- API pública (síncrona para el carrito, async para las vistas)

/** Productos visibles hoy (R-28), con filtros opcionales. */
export function listProductsSync(filters = {}, { now } = {}) {
  const today = catalogToday(now)
  return PRODUCTS.filter((p) => matches(p, filters) && isVisible(p, today)).map((p) => toCard(p, today))
}

/** Ficha por slug: funciona aunque la temporada no esté activa (R-28). */
export function getProductSync(slug, { now } = {}) {
  const product = PRODUCTS.find((p) => p.slug === slug)
  return product ? toDetail(product, catalogToday(now)) : null
}

/** TODO(api): GET /api/products?line=&brand=&type=&collection= */
export async function listProducts(filters = {}, options = {}) {
  await latency()
  return copy(listProductsSync(filters, options))
}

/** Búsqueda en las 4 líneas, incluida la temporada inactiva con su precio rebajado (R-29). TODO(api): GET /api/products?q= */
export async function searchProducts(q, { now } = {}) {
  await latency()
  const term = normalizeText(q)
  if (!term) return []
  const today = catalogToday(now)
  return copy(PRODUCTS.filter((p) => searchText(p).includes(term)).map((p) => toCard(p, today)))
}

/** TODO(api): GET /api/products/{slug} */
export async function getProduct(slug, options = {}) {
  await latency()
  const product = getProductSync(slug, options)
  return product ? copy(product) : null
}

/** CatalogNav (DESIGN_CATALOG_UI.md §2.1). TODO(api): GET /api/catalog/nav */
export async function getNav({ now } = {}) {
  await latency()
  const today = catalogToday(now)
  const visible = PRODUCTS.filter((p) => isVisible(p, today))
  const brandSlugs = new Set(visible.map((p) => p.brand))
  return copy({
    lines: LINES.map((code) => ({ code, name: label(LINE_LABELS, code), count: visible.filter((p) => p.line === code).length })),
    brands: BRANDS.filter((b) => b.showInFilters && brandSlugs.has(b.slug)).map(({ slug, name }) => ({ slug, name })),
    activeCollections: COLLECTIONS.filter((c) => c.kind === 'temporada' && isInSeason(c, today)).map((c) => ({
      slug: c.slug,
      name: c.name,
      start: `${String(c.startMonth).padStart(2, '0')}-${String(c.startDay).padStart(2, '0')}`,
      end: `${String(c.endMonth).padStart(2, '0')}-${String(c.endDay).padStart(2, '0')}`,
      offSeasonPct: Math.round(c.offSeasonDiscountPct * 100),
    })),
  })
}

/**
 * Datos de una línea: productos visibles filtrados, total visible, ocultos por temporada y opciones de su faceta
 * (SOKKO → tono, Marcas → marca con showInFilters, Especiales → colección visible, Accesorios → tipo).
 */
export async function getLinePage(line, filters = {}, { now } = {}) {
  await latency()
  const today = catalogToday(now)
  const inLine = PRODUCTS.filter((p) => p.line === line)
  const visible = inLine.filter((p) => isVisible(p, today))
  const unique = (values) => [...new Set(values)]
  let facet
  if (line === 'marcas') {
    const brands = unique(visible.map((p) => p.brand)).filter((b) => brandsBySlug[b].showInFilters)
    facet = { key: 'brand', options: brands.map((b) => ({ value: b, label: brandsBySlug[b].name })) }
  } else if (line === 'especiales') {
    facet = { key: 'collection', options: unique(visible.map((p) => p.collection)).map((c) => ({ value: c, label: collectionsBySlug[c].name })) }
  } else if (line === 'accesorios') {
    facet = { key: 'type', options: unique(visible.map((p) => p.type)).map((t) => ({ value: t, label: typesByCode[t].name })) }
  } else {
    facet = { key: 'color', options: COLORS.filter((c) => c.isSokkoTone).map((c) => ({ value: c.code, label: c.name, hex: c.hex })) }
  }
  const active = filters[facet.key] && facet.options.some((o) => o.value === filters[facet.key]) ? filters[facet.key] : null
  return copy({
    line,
    facet: { ...facet, active },
    products: visible.filter((p) => !active || matches(p, { [facet.key]: active })).map((p) => toCard(p, today)),
    total: visible.length,
    hiddenCount: inLine.length - visible.length,
  })
}

/** Secciones del Home (DESIGN_CATALOG_UI.md §3.3) armadas con las mismas reglas. */
export async function getHome({ now } = {}) {
  const [nav, sokko, marcas, accesorios] = await Promise.all([
    getNav({ now }),
    listProducts({ line: 'sokko' }, { now }),
    listProducts({ line: 'marcas' }, { now }),
    listProducts({ line: 'accesorios' }, { now }),
  ])
  const season = nav.activeCollections[0] ?? null
  return {
    nav,
    today: catalogToday(now),
    featured: copy(getProductSync(FEATURED_SLUG, { now })),
    sokko: sokko.slice(0, 4),
    sokkoTotal: sokko.length,
    season: season ? { ...season, products: (await listProducts({ collection: season.slug }, { now })).slice(0, 3) } : null,
    marcas,
    accesorios: accesorios.slice(0, 4),
  }
}
