// Reglas del catálogo en el panel (DESIGN_CATALOG_UI.md §4, DESIGN_DB.md R-28 a R-32). Funciones puras.
// La visibilidad y el precio por temporada salen de season.js, el mismo módulo que usa la tienda.
import { effectivePrice, isInSeason } from './season'

export const SKU_PREFIX = { sokko: 'SKK', marcas: 'MRC', especiales: 'ESP', accesorios: 'ACC' }
export const LOW_MARGIN = 0.3
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] // el 29 de febrero no se acepta

export const MSG = {
  name: 'Escribe el nombre del producto.',
  price: 'Escribe un precio mayor a 0.',
  collection: 'Elige una colección: es obligatoria en Especiales.',
  sokkoBrand: 'SOKKO Japón solo admite la marca propia SOKKO.',
  ownBrandElsewhere: 'La marca SOKKO es exclusiva de la línea SOKKO Japón.',
  kyotoTones: (names) => `Los tonos Kyoto (${names.join(', ')}) son exclusivos de SOKKO Japón.`,
  colors: 'Elige al menos un color.',
  cost: 'El costo no puede ser negativo.',
  barcode: (sku) => `Ese código de barras ya está en ${sku}.`,
  barcodeRepeated: 'Ese código de barras se repite en este producto.',
  brandName: 'Escribe el nombre de la marca.',
  brandTaken: (name) => `Ya existe la marca ${name}.`,
  day: 'Ese día no existe en el mes elegido (el 29 de febrero no se acepta).',
  discount: 'El descuento va de 0 a 60 %.',
  review: 'Revisa los campos marcados.',
}

export const skuPrefix = (line, pieceNumber) => `${SKU_PREFIX[line]}-${String(pieceNumber).padStart(3, '0')}`
export const skuOf = (line, pieceNumber, colorCode, sizeCode) => `${skuPrefix(line, pieceNumber)}-${colorCode}-${sizeCode}`

/** Margen bruto = (precio − costo) ÷ precio; null sin costo registrado. No se guarda (T-09). */
export const marginOf = (price, unitCost) => (unitCost == null || !price ? null : (price - unitCost) / price)

// ---------------------------------------------------------------- Temporadas

/** Día del año (1–365) de un mes y día. */
export const dayOfYear = (month, day) => DAYS_IN_MONTH.slice(0, month - 1).reduce((a, b) => a + b, 0) + day

/** Días que faltan para (month, day) desde `today`, dando la vuelta al año (año de 365 días). */
export const daysUntil = (today, month, day) => (dayOfYear(month, day) - dayOfYear(today.month, today.day) + 365) % 365

/** ¿Existe ese día en ese mes? (sin 29 de febrero). */
export const isValidDay = (month, day) => Number.isInteger(day) && day >= 1 && day <= DAYS_IN_MONTH[month - 1]

/** ¿La ventana cruza de año? (por ejemplo 1-nov → 6-ene). */
export const crossesYear = (c) => c.startMonth * 100 + c.startDay > c.endMonth * 100 + c.endDay

/**
 * Estado de una colección hoy, para la pill del panel (§4.2 y §4.5):
 * Activa · termina en N días (ok) · Fuera · inicia en N días (warn si faltan 14 días o menos; mute si más) · Siempre visible.
 */
export function seasonStatus(collection, today) {
  if (collection.kind !== 'temporada') return { tone: 'info', inSeason: true, text: 'Siempre visible' }
  const days = (n) => `${n} ${n === 1 ? 'día' : 'días'}`
  if (isInSeason(collection, today)) {
    const n = daysUntil(today, collection.endMonth, collection.endDay)
    return { tone: 'ok', inSeason: true, days: n, text: n === 0 ? 'Activa · termina hoy' : `Activa · termina en ${days(n)}` }
  }
  const n = daysUntil(today, collection.startMonth, collection.startDay)
  return { tone: n <= 14 ? 'warn' : 'mute', inSeason: false, days: n, text: `Fuera · inicia en ${days(n)}` }
}

/** Valida una colección del editor: días que existan y descuento de 0 a 60 %. */
export function validateCollection(c) {
  const errors = {}
  if (c.kind === 'temporada') {
    if (!isValidDay(c.startMonth, c.startDay) || !isValidDay(c.endMonth, c.endDay)) errors.window = MSG.day
    if (!(c.offSeasonDiscountPct >= 0 && c.offSeasonDiscountPct <= 0.6)) errors.discount = MSG.discount
  }
  return errors
}

// ---------------------------------------------------------------- Productos

/**
 * Valida el formulario de producto (§4.3). `form`: { line, name, brand, collection, colors, price, unitCost, barcodes }.
 * `ctx`: { brands, colors, barcodeOwners } donde `barcodeOwners` mapea código de barras → SKU que ya lo usa
 * (sin las variantes de este mismo producto). Devuelve `{ campo: mensaje }`; vacío si es válido.
 */
export function validateProduct(form, { brands, colors, barcodeOwners = {} }) {
  const errors = {}
  const brand = brands.find((b) => b.slug === form.brand)
  if (!String(form.name ?? '').trim()) errors.name = MSG.name
  if (!(Number(form.price) > 0)) errors.price = MSG.price
  if (form.line === 'especiales' && !form.collection) errors.collection = MSG.collection // R-31
  if (form.line === 'sokko' && !brand?.isOwnBrand) errors.brand = MSG.sokkoBrand // R-32
  else if (form.line !== 'sokko' && brand?.isOwnBrand) errors.brand = MSG.ownBrandElsewhere // R-32
  const kyoto = (form.colors ?? []).map((code) => colors.find((c) => c.code === code)).filter((c) => c?.isSokkoTone)
  if (!form.colors?.length) errors.colors = MSG.colors
  else if (form.line !== 'sokko' && kyoto.length) errors.colors = MSG.kyotoTones(kyoto.map((c) => c.name)) // R-32
  if (form.unitCost != null && form.unitCost !== '' && Number(form.unitCost) < 0) errors.unitCost = MSG.cost // R-30
  const seen = new Set()
  for (const [sku, code] of Object.entries(form.barcodes ?? {})) {
    const value = String(code ?? '').trim()
    if (!value) continue
    if (seen.has(value)) errors[`barcode:${sku}`] = MSG.barcodeRepeated
    else if (barcodeOwners[value]) errors[`barcode:${sku}`] = MSG.barcode(barcodeOwners[value]) // UNIQUE filtrado (T-12)
    seen.add(value)
  }
  return errors
}

/**
 * DTO de producto por rol (§2.2): `unitCost` y `margin` solo llegan con `costs.view` (Dueño).
 * No basta con ocultarlos en la UI: Operaciones nunca los recibe.
 */
export function productDto(product, { brand, type, collection, colors, sizes, inventory, today, canSeeCosts }) {
  const pricing = effectivePrice(product.price, collection, today)
  const variants = product.colors.flatMap((code) =>
    sizes.map((s) => {
      const sku = skuOf(product.line, product.pieceNumber, code, s.code)
      const row = inventory.find((r) => r.sku === sku)
      return { sku, color: code, size: s.code, sizeLabel: s.label, barcode: product.barcodes?.[sku] ?? null, stock: row?.stock ?? 0 }
    }),
  )
  const dto = {
    slug: product.slug,
    line: product.line,
    pieceNumber: product.pieceNumber,
    name: product.name,
    brand: { slug: brand.slug, name: brand.name, isOwnBrand: brand.isOwnBrand },
    type: { code: type.code, name: type.name, unit: type.unit, sizeSystem: type.sizeSystem },
    unitsPerPack: product.unitsPerPack ?? 1,
    collection: collection ? { slug: collection.slug, name: collection.name, kind: collection.kind, inSeason: isInSeason(collection, today) } : null,
    price: product.price,
    offSeasonPrice: pricing.offSeason ? pricing.price : null,
    colors: product.colors.map((code) => colors.find((c) => c.code === code)),
    variants,
    stock: variants.reduce((a, v) => a + v.stock, 0),
    sold: product.sold ?? 0,
  }
  if (canSeeCosts) {
    dto.unitCost = product.unitCost ?? null
    dto.margin = marginOf(product.price, product.unitCost)
  }
  return dto
}

// ---------------------------------------------------------------- Dashboard por línea

/**
 * Ventas o unidades por línea (§4.2). El margen solo cuenta productos con costo; `missingCost` cuenta los que no lo tienen.
 * `products`: DTO con `sold`, `price` y (para el Dueño) `unitCost`.
 */
export function lineStats(products, lines) {
  return lines.map((line) => {
    const ps = products.filter((p) => p.line === line)
    const known = ps.filter((p) => p.unitCost != null)
    const knownRevenue = known.reduce((a, p) => a + p.sold * p.price, 0)
    const knownCost = known.reduce((a, p) => a + p.sold * p.unitCost, 0)
    return {
      line,
      units: ps.reduce((a, p) => a + p.sold, 0),
      revenue: ps.reduce((a, p) => a + p.sold * p.price, 0),
      margin: knownRevenue ? (knownRevenue - knownCost) / knownRevenue : null,
      missingCost: ps.length - known.length,
    }
  })
}

/** Margen bruto total con costo registrado (KPI del Dueño). */
export function grossMargin(products) {
  const known = products.filter((p) => p.unitCost != null)
  const revenue = known.reduce((a, p) => a + p.sold * p.price, 0)
  const cost = known.reduce((a, p) => a + p.sold * p.unitCost, 0)
  return revenue ? (revenue - cost) / revenue : null
}

/** Ingreso y margen por marca, de mayor a menor ingreso (solo marcas con ventas y costo). */
export function brandMargins(products) {
  const byBrand = new Map()
  products
    .filter((p) => p.unitCost != null && p.sold > 0)
    .forEach((p) => {
      const b = byBrand.get(p.brand.slug) ?? { slug: p.brand.slug, name: p.brand.name, revenue: 0, cost: 0 }
      b.revenue += p.sold * p.price
      b.cost += p.sold * p.unitCost
      byBrand.set(p.brand.slug, b)
    })
  return [...byBrand.values()].map((b) => ({ ...b, margin: (b.revenue - b.cost) / b.revenue })).sort((a, b) => b.revenue - a.revenue)
}
