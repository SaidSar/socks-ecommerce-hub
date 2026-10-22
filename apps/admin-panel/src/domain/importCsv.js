// Importación inicial de inventario (DESIGN_ADMIN.md §5.4). v1 acepta CSV (Excel → Guardar como CSV UTF-8).
// TODO(design): .xlsx en P1 con SheetJS desde cdn.sheetjs.com (no el paquete de npm, desactualizado).
import { normalize } from '../utils/format'

export const COLUMNS = ['SKU', 'Pieza', 'Tono', 'Talla', 'Stock']

export const ERR = {
  unknownSku: 'El SKU no existe en el catálogo',
  negative: 'El stock no puede ser negativo',
  notInteger: 'El stock debe ser un número entero',
  duplicate: 'SKU repetido en el archivo; se usa la primera fila',
  belowReserved: (stock, reserved) => `El stock (${stock}) es menor que ${reserved === 1 ? 'el par apartado' : `los ${reserved} pares apartados`} para pedidos`,
  empty: 'El archivo está vacío.',
  headers: 'El archivo necesita las columnas SKU, Pieza, Tono, Talla y Stock, en ese orden.',
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

/**
 * Valida el CSV contra el inventario actual (lista de { sku, piece, tone, size, stock, reserved }).
 * Devuelve { error, rows, valid, invalid }; cada fila: { line, sku, piece, tone, size, stock, error }.
 */
export function previewCsv(text, inventory) {
  const clean = String(text ?? '').replace(/^﻿/, '')
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim()) ?? ''
  if (!firstLine) return { error: ERR.empty, rows: [], valid: [], invalid: [] }
  const sep = detectSeparator(firstLine)
  const table = parseCsv(clean, sep).filter((r) => r.some((c) => c.trim() !== ''))
  const [header, ...body] = table
  const keys = header.map(headerKey)
  const expected = COLUMNS.map(headerKey)
  if (expected.some((k, i) => keys[i] !== k)) return { error: ERR.headers, rows: [], valid: [], invalid: [] }

  const bySku = new Map(inventory.map((r) => [r.sku, r]))
  const seen = new Set()
  const rows = body.map((cells, i) => {
    const [sku = '', piece = '', tone = '', size = '', stockRaw = ''] = cells.map((c) => c.trim())
    const code = sku.toUpperCase()
    const base = { line: i + 2, sku: code, piece, tone, size, stock: stockRaw }
    if (!bySku.has(code)) return { ...base, error: ERR.unknownSku }
    if (seen.has(code)) return { ...base, error: ERR.duplicate }
    seen.add(code)
    const num = stockRaw.replace(/\s/g, '')
    if (/^-\d+(\.\d+)?$/.test(num)) return { ...base, error: ERR.negative }
    if (!/^\d+$/.test(num)) return { ...base, error: ERR.notInteger }
    const stock = Number(num)
    // R-27 (DESIGN_DB.md §3.6): la importación no puede dejar el stock por debajo de lo apartado.
    const reserved = bySku.get(code).reserved ?? 0
    if (stock < reserved) return { ...base, stock, error: ERR.belowReserved(stock, reserved) }
    return { ...base, stock, error: '' }
  })
  return { error: '', rows, valid: rows.filter((r) => !r.error), invalid: rows.filter((r) => r.error) }
}

const csvCell = (v) => {
  const s = String(v ?? '')
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Plantilla con los SKU actuales y su stock. Lleva BOM para que Excel la abra como UTF-8. */
export function buildTemplate(inventory, toneName = (t) => t) {
  const lines = [COLUMNS.join(','), ...inventory.map((r) => [r.sku, r.piece, toneName(r.tone), r.size, r.stock].map(csvCell).join(','))]
  return '﻿' + lines.join('\r\n') + '\r\n'
}
