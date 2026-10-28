// Reglas de temporada del catálogo: R-28 (visibilidad) y R-29 (precio fuera de temporada).
// DESIGN_DB.md §3.5c. Módulo puro, sin React ni dependencias: se copia idéntico a apps/admin-panel.

export const BUSINESS_TIME_ZONE = 'America/Mazatlan'

/** Fecha local del negocio `{ year, month, day }` para un instante (por omisión, ahora). */
export function localDate(instant = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant)
  const get = (type) => Number(parts.find((p) => p.type === type).value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

/** "AAAA-MM-DD" → `{ year, month, day }`, o null si no es una fecha válida. */
export function parseDate(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text ?? ''))
  if (!m) return null
  const [year, month, day] = m.slice(1).map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCMonth() === month - 1 && d.getUTCDate() === day ? { year, month, day } : null
}

const dayKey = (month, day) => month * 100 + day

/**
 * R-28: ¿la colección está en temporada en `date` (`{ month, day }`, fecha local)?
 * `collection`: `{ kind, startMonth, startDay, endMonth, endDay }`. Extremos inclusivos; la ventana puede cruzar de año.
 * Una temática (o un producto sin colección) siempre está en temporada.
 */
export function isInSeason(collection, date) {
  if (!collection || collection.kind !== 'temporada') return true
  const t = dayKey(date.month, date.day)
  const s = dayKey(collection.startMonth, collection.startDay)
  const e = dayKey(collection.endMonth, collection.endDay)
  return s <= e ? t >= s && t <= e : t >= s || t <= e
}

/** Redondeo a centavos, con los medios hacia arriba (`MidpointRounding.AwayFromZero` en .NET). */
export const roundMoney = (n) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * R-29: precio efectivo. Fuera de temporada = `listPrice × (1 − offSeasonDiscountPct)`, a 2 decimales.
 * Devuelve `{ price, listPrice, offSeason, offSeasonPct }` (`offSeasonPct` en %, por ejemplo 30).
 */
export function effectivePrice(listPrice, collection, date) {
  const offSeason = Boolean(collection) && collection.kind === 'temporada' && !isInSeason(collection, date)
  const pct = offSeason ? collection.offSeasonDiscountPct : 0
  return {
    price: offSeason ? roundMoney(listPrice * (1 - pct)) : listPrice,
    listPrice,
    offSeason,
    offSeasonPct: Math.round(pct * 100),
  }
}
