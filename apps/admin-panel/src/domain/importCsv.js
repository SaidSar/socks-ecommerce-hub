// Importación inicial de inventario (DESIGN_ADMIN.md §5.4). v1 acepta CSV (Excel → Guardar como CSV UTF-8).
// TODO(design): .xlsx en P1 con SheetJS desde cdn.sheetjs.com (no el paquete de npm, desactualizado).
import { normalize } from '../utils/format'
import { skuOf, validateProduct } from './catalog'
import { label, LINE_SHORT_LABELS, LINES } from './enums'

export const COLUMNS = ['SKU', 'Pieza', 'Tono', 'Talla', 'Stock']
// Columnas opcionales del catálogo multilínea (DESIGN_CATALOG_UI.md §4.7), después de las 5 base y en cualquier orden.
// Celda vacía = ese dato no cambia.
export const EXTRA_COLUMNS = ['line', 'brand', 'type', 'collection', 'units_per_pack', 'unit_cost', 'barcode']

export const ERR = {
  unknownSku: 'El SKU no existe en el catálogo',
  negative: 'El stock no puede ser negativo',
  notInteger: 'El stock debe ser un número entero',
  duplicate: 'SKU repetido en el archivo; se usa la primera fila',
  belowReserved: (stock, reserved, unit = 'unidad') =>
    `El stock (${stock}) es menor que ${
      unit === 'par' ? (reserved === 1 ? 'el par apartado' : `los ${reserved} pares apartados`) : reserved === 1 ? 'la unidad apartada' : `las ${reserved} unidades apartadas`
    } para pedidos`,
  empty: 'El archivo está vacío.',
  headers: 'El archivo necesita las columnas SKU, Pieza, Tono, Talla y Stock, en ese orden.',
  unknownColumn: (name) => `La columna "${name}" no se reconoce. Las opcionales son: ${EXTRA_COLUMNS.join(', ')}.`,
  unknownLine: (v) => `La línea "${v}" no existe (sokko, marcas, especiales o accesorios).`,
  line: (expected) => `La línea no coincide con el SKU (${expected}): la línea forma parte del SKU y no cambia.`,
  unknownType: (v) => `El tipo "${v}" no existe.`,
  type: (expected) => `El tipo no coincide con el producto (${expected}): cámbielo desde Productos.`,
  unknownBrand: (v) => `La marca "${v}" no existe; créela en Marcas.`,
  unknownCollection: (v) => `La colección "${v}" no existe.`,
  pack: 'Las unidades por paquete deben ser un entero de 1 a 12.',
  cost: 'El costo debe ser un número, por ejemplo 82.50.',
  conflict: (column) => `Otra fila del mismo producto trae otro valor en ${column}.`,
}

export const WARN = {
  costIgnored: 'Se ignoró unit_cost: solo el Dueño registra costos.',
}

/** Separador del archivo: el que más aparece en la línea de encabezados (fuera de comillas). */
export function detectSeparator(headerLine) {
  let commas = 0
  let semis = 0
  let quoted = false
  for (const ch of headerLine) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && ch === ',') commas++
    else if (!quoted && ch === ';') semis++
  }
  return semis > commas ? ';' : ','
}

/** Divide el texto en filas y celdas respetando comillas dobles ("a, b" y "" escapadas). */
export function parseCsv(text, sep) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

const headerKey = (h) => normalize(h)

const matches = (item, value, keys) => keys.some((k) => normalize(item[k]) === normalize(value))

/**
 * Índice del catálogo para las columnas opcionales: SKU → producto y códigos de barras en uso.
 * `catalog`: { products, brands, types, collections, colors, sizes } con productos crudos (marca, tipo y colección por slug).
 */
function catalogIndex(catalog) {
  const bySku = new Map()
  const barcodeOwners = {}
  catalog.products.forEach((p) => {
    const type = catalog.types.find((t) => t.code === p.type)
    p.colors.forEach((c) => catalog.sizes[type.sizeSystem].forEach((s) => bySku.set(skuOf(p.line, p.pieceNumber, c, s.code), p)))
    Object.entries(p.barcodes ?? {}).forEach(([sku, code]) => (barcodeOwners[code] = sku))
  })
  return { ...catalog, bySku, barcodeOwners }
}

const COLUMN_OF = { brand: 'brand', collection: 'collection', unitsPerPack: 'units_per_pack', unitCost: 'unit_cost' }

/**
 * Valida las columnas opcionales de una fila con las reglas del formulario de producto (R-30, R-31, R-32 y código
 * de barras único, también dentro del archivo). Devuelve { error, warning, changes }.
 * `state` guarda entre filas los valores pedidos por producto (filas que se contradicen) y los códigos ya vistos.
 */
function checkCatalogCells(sku, extra, ctx, state, canSeeCosts) {
  const product = ctx.bySku.get(sku)
  const get = (k) => extra[k] ?? ''
  if (!product || !Object.values(extra).some((v) => v !== '')) return { error: '', warning: '', changes: {} }
  const changes = {}
  let warning = ''

  if (get('line')) {
    const line = LINES.find((l) => normalize(l) === normalize(get('line')) || normalize(label(LINE_SHORT_LABELS, l)) === normalize(get('line')))
    if (!line) return { error: ERR.unknownLine(get('line')) }
    if (line !== product.line) return { error: ERR.line(label(LINE_SHORT_LABELS, product.line)) }
  }
  if (get('type')) {
    const type = ctx.types.find((t) => matches(t, get('type'), ['code', 'name']))
    if (!type) return { error: ERR.unknownType(get('type')) }
    if (type.code !== product.type) return { error: ERR.type(ctx.types.find((t) => t.code === product.type).name) }
  }
  if (get('brand')) {
    const brand = ctx.brands.find((b) => matches(b, get('brand'), ['slug', 'name']))
    if (!brand) return { error: ERR.unknownBrand(get('brand')) }
    changes.brand = brand.slug
  }
  if (get('collection')) {
    const collection = ctx.collections.find((c) => matches(c, get('collection'), ['slug', 'name']))
    if (!collection) return { error: ERR.unknownCollection(get('collection')) }
    changes.collection = collection.slug
  }
  if (get('units_per_pack')) {
    const n = Number(get('units_per_pack'))
    if (!/^\d+$/.test(get('units_per_pack')) || n < 1 || n > 12) return { error: ERR.pack }
    changes.unitsPerPack = n
  }
  if (get('unit_cost')) {
    if (!canSeeCosts) warning = WARN.costIgnored
    else {
      const raw = get('unit_cost').replace(/[$\s]/g, '')
      if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) return { error: ERR.cost }
      changes.unitCost = Number(raw)
    }
  }
  if (get('barcode')) changes.barcode = get('barcode').replace(/\s/g, '')

  // Mismas reglas que el formulario: el producto con los cambios de la fila debe seguir siendo válido.
  const owners = Object.fromEntries(Object.entries({ ...ctx.barcodeOwners, ...state.barcodes }).filter(([, owner]) => owner !== sku))
  const errors = validateProduct(
    {
      line: product.line,
      name: product.name,
      brand: changes.brand ?? product.brand,
      collection: changes.collection ?? product.collection,
      colors: product.colors,
      price: product.price,
      unitCost: changes.unitCost,
      barcodes: changes.barcode ? { [sku]: changes.barcode } : {},
    },
    { brands: ctx.brands, colors: ctx.colors, barcodeOwners: owners },
  )
  const first = ['brand', 'collection', 'colors', 'unitCost', `barcode:${sku}`].find((k) => errors[k])
  if (first) return { error: errors[first] }

  // Las filas de un mismo producto no pueden pedir valores distintos.
  const asked = (state.products[product.slug] ??= {})
  const clash = Object.keys(COLUMN_OF).find((k) => k in changes && k in asked && asked[k] !== changes[k])
  if (clash) return { error: ERR.conflict(COLUMN_OF[clash]) }
  Object.keys(COLUMN_OF).forEach((k) => k in changes && (asked[k] = changes[k]))
  if (changes.barcode) state.barcodes[changes.barcode] = sku
  return { error: '', warning, changes }
}

/**
 * Valida el CSV contra el inventario actual (lista de { sku, piece, tone, size, stock, reserved, unit }).
 * Con `catalog` también valida las columnas opcionales (EXTRA_COLUMNS); `canSeeCosts: false` ignora unit_cost con aviso.
 * Devuelve { error, columns, rows, valid, invalid }; cada fila: { line, sku, piece, tone, size, stock, extra, changes, warning, error }.
 */
export function previewCsv(text, inventory, catalog = null, { canSeeCosts = true } = {}) {
  const clean = String(text ?? '').replace(/^﻿/, '')
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim()) ?? ''
  if (!firstLine) return { error: ERR.empty, rows: [], valid: [], invalid: [] }
  const sep = detectSeparator(firstLine)
  const table = parseCsv(clean, sep).filter((r) => r.some((c) => c.trim() !== ''))
  const [header, ...body] = table
  const keys = header.map(headerKey)
  const expected = COLUMNS.map(headerKey)
  if (expected.some((k, i) => keys[i] !== k)) return { error: ERR.headers, rows: [], valid: [], invalid: [] }
  const columns = header.slice(COLUMNS.length).map((h) => normalize(h).replace(/\s+/g, '_'))
  const unknown = columns.findIndex((k) => !EXTRA_COLUMNS.includes(k))
  if (unknown >= 0) return { error: ERR.unknownColumn(header[COLUMNS.length + unknown].trim()), rows: [], valid: [], invalid: [] }

  const bySku = new Map(inventory.map((r) => [r.sku, r]))
  const ctx = catalog && columns.length ? catalogIndex(catalog) : null
  const state = { products: {}, barcodes: {} }
  const seen = new Set()
  const rows = body.map((cells, i) => {
    const [sku = '', piece = '', tone = '', size = '', stockRaw = ''] = cells.map((c) => c.trim())
    const code = sku.toUpperCase()
    const extra = Object.fromEntries(columns.map((k, j) => [k, (cells[COLUMNS.length + j] ?? '').trim()]))
    const base = { line: i + 2, sku: code, piece, tone, size, stock: stockRaw, extra, changes: {}, warning: '' }
    if (!bySku.has(code)) return { ...base, error: ERR.unknownSku }
    if (seen.has(code)) return { ...base, error: ERR.duplicate }
    seen.add(code)
    const num = stockRaw.replace(/\s/g, '')
    if (/^-\d+(\.\d+)?$/.test(num)) return { ...base, error: ERR.negative }
    if (!/^\d+$/.test(num)) return { ...base, error: ERR.notInteger }
    const stock = Number(num)
    // R-27 (DESIGN_DB.md §3.6): la importación no puede dejar el stock por debajo de lo apartado.
    const reserved = bySku.get(code).reserved ?? 0
    if (stock < reserved) return { ...base, stock, error: ERR.belowReserved(stock, reserved, bySku.get(code).unit) }
    if (ctx) {
      const { error, warning = '', changes = {} } = checkCatalogCells(code, extra, ctx, state, canSeeCosts)
      return { ...base, stock, changes, warning, error }
    }
    return { ...base, stock, error: '' }
  })
  return { error: '', columns, rows, valid: rows.filter((r) => !r.error), invalid: rows.filter((r) => r.error) }
}

const csvCell = (v) => {
  const s = String(v ?? '')
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Plantilla con los SKU actuales y su stock. Lleva BOM para que Excel la abra como UTF-8.
 * `extras(row)`, si se da, devuelve los valores de EXTRA_COLUMNS de ese SKU (columnas opcionales del catálogo).
 */
export function buildTemplate(inventory, toneName = (t) => t, extras = null) {
  const header = extras ? [...COLUMNS, ...EXTRA_COLUMNS] : COLUMNS
  const lines = [header.join(','), ...inventory.map((r) => [r.sku, r.piece, toneName(r.tone), r.size, r.stock, ...(extras ? extras(r) : [])].map(csvCell).join(','))]
  return '﻿' + lines.join('\r\n') + '\r\n'
}

/** Vuelve a armar el CSV con las filas de la vista previa (el servidor las valida otra vez antes de aplicarlas). */
export function rowsToCsv(rows) {
  const columns = EXTRA_COLUMNS.filter((k) => rows.some((r) => r.extra && k in r.extra))
  const lines = [[...COLUMNS, ...columns].join(','), ...rows.map((r) => [r.sku, r.piece, r.tone, r.size, r.stock, ...columns.map((k) => r.extra?.[k] ?? '')].map(csvCell).join(','))]
  return lines.join('\n')
}
