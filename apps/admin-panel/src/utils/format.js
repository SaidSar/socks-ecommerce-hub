const toDate = (d) => (d instanceof Date ? d : new Date(d))

/** Importe en pesos mexicanos: formatMXN(420) → "$420", formatMXN(57.93, 2) → "$57.93". */
export function formatMXN(n, decimals = 0) {
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** "18 oct" */
export function formatDate(d) {
  return toDate(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '')
}

/** "09:30 a.m." según la configuración regional es-MX. */
export function formatTime(d) {
  return toDate(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

/** "Domingo 18 de octubre de 2026" */
export function formatLongDate(d) {
  const s = toDate(d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(',', '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "dom 18 oct" (tooltip de la gráfica). */
export function formatShortWeekday(d) {
  return toDate(d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').replace(',', '')
}

/** "domingo" */
export function formatWeekday(d) {
  return toDate(d).toLocaleDateString('es-MX', { weekday: 'long' })
}

/** Número con separador de miles: 1234 → "1,234". */
export function formatInt(n) {
  return Number(n).toLocaleString('es-MX')
}

/** Normaliza texto para búsquedas: minúsculas y sin acentos. */
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}
