// Enums con su código de API (DESIGN_DB.md §1.6) y su etiqueta. Mismos códigos que apps/admin-panel/src/domain/enums.js.
// El checkout enviará el código (`paymentMethod: 'oxxo_pay'`); la UI muestra siempre la etiqueta con label().

export const PAYMENT_METHOD_LABELS = { tarjeta: 'Tarjeta', oxxo_pay: 'OXXO Pay' }

// Catálogo multilínea (DESIGN_DB.md v0.4.2 §1.6). El orden de LINE_LABELS es el del menú: SOKKO primero.
export const LINE_LABELS = { sokko: 'SOKKO Japón', marcas: 'Marcas', especiales: 'Especiales', accesorios: 'Accesorios' }
export const LINES = Object.keys(LINE_LABELS)

export const COLLECTION_KIND_LABELS = { temporada: 'Temporada', tematica: 'Temática' }

export const SIZE_SYSTEM_LABELS = { calceta: 'Calceta', guante: 'Guante', unitalla: 'Unitalla' }

export const UNIT_LABELS = { par: 'Par', pieza: 'Pieza' }
const UNIT_PLURALS = { par: 'pares', pieza: 'piezas' }

/** Etiqueta de un código; si el código no está en el mapa se muestra tal cual. */
export const label = (labels, code) => labels[code] ?? code ?? ''

/** Unidad de venta: "Par", "Pieza" o "Paquete de 3 pares" (T-10). */
export function unitText(unit, unitsPerPack = 1) {
  if (unitsPerPack > 1) return `Paquete de ${unitsPerPack} ${UNIT_PLURALS[unit] ?? unit}`
  return label(UNIT_LABELS, unit)
}
