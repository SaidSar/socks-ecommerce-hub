// Reglas de envío (DESIGN_ADMIN.md §5.2). La tienda usará las mismas con GET /api/config.

export const ZONE_RE = /^\d{5}(\s*[–-]\s*\d{5})?$/
export const ZONE_ERROR = 'Escriba un código postal de 5 dígitos o un rango, por ejemplo 81280–81290.'

const zoneValue = (z) => (typeof z === 'string' ? z : z?.value ?? '')

/** "81200 - 81299" → { from: 81200, to: 81299 }; "81250" → { from: 81250, to: 81250 }; inválido → null. */
export function parseZone(value) {
  const v = String(value ?? '').trim()
  if (!ZONE_RE.test(v)) return null
  const [a, b = a] = v.split(/\s*[–-]\s*/)
  const from = Number(a)
  const to = Number(b)
  if (from > to) return null
  return { from, to }
}

/** '' si el CP o rango es válido; si no, el mensaje de error. */
export function validateZone(value) {
  return parseZone(value) ? '' : ZONE_ERROR
}

/** Forma canónica para mostrar: "81280–81290" (guion largo) o "81250". */
export function formatZone(value) {
  const z = parseZone(value)
  if (!z) return String(value ?? '').trim()
  return z.from === z.to ? String(z.from).padStart(5, '0') : `${String(z.from).padStart(5, '0')}–${String(z.to).padStart(5, '0')}`
}

/** ¿El CP cae en algún rango o código de la zona local? */
export function isLocalPostalCode(cp, zones = []) {
  const code = String(cp ?? '').trim()
  if (!/^\d{5}$/.test(code)) return false
  const n = Number(code)
  return zones.some((z) => {
    const r = parseZone(zoneValue(z))
    return r !== null && n >= r.from && n <= r.to
  })
}

/**
 * Método y costo de envío para un subtotal y CP.
 * settings: { freeShippingThreshold, parcelShippingCost, localShippingCost, localFreeShipping, localZones }
 */
export function computeShipping({ subtotal, postalCode }, settings) {
  const method = isLocalPostalCode(postalCode, settings.localZones) ? 'local' : 'paqueteria'
  const reachesFree = subtotal >= settings.freeShippingThreshold
  if (method === 'local') {
    return { method, cost: reachesFree && settings.localFreeShipping ? 0 : settings.localShippingCost }
  }
  return { method, cost: reachesFree ? 0 : settings.parcelShippingCost }
}
