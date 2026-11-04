// Bandeja de mensajes de contacto (Dueño y Operaciones). Funciones puras: pestañas, folio, respuesta por correo y fechas relativas.

export const MESSAGE_TABS = [
  { key: 'nuevos', label: 'Nuevos' },
  { key: 'leidos', label: 'Leídos' },
  { key: 'archivados', label: 'Archivados' },
]
export const MESSAGE_STATUSES = MESSAGE_TABS.map((t) => t.key)

/** Asuntos de la tienda que hablan de un pedido ("Un pedido" en el formulario de /contacto). */
export const ORDER_SUBJECTS = ['un pedido', 'mi pedido']

/** Estado de un mensaje según sus fechas, como el filtro de la API. */
export const statusOf = (m) => (m.archivedAt ? 'archivados' : m.readAt ? 'leidos' : 'nuevos')

/** Folio `SKK-####` del texto si el asunto es de un pedido; `null` si no hay. Acepta "skk 1042" o "SKK1042". */
export function findFolio(subject, text) {
  if (!ORDER_SUBJECTS.includes(String(subject ?? '').trim().toLowerCase())) return null
  const m = /\bSKK[-\s]?(\d{4,})\b/i.exec(String(text ?? ''))
  return m ? `SKK-${m[1]}` : null
}

/** Primeras palabras del mensaje en una línea. */
export function snippet(text, max = 110) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

/** `mailto:` con "Re: {asunto}" y el mensaje citado. El correo sale de la cuenta de quien responde, no del servidor. */
export function replyMailto(message, when = '') {
  const subject = /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`
  const quoted = String(message.message).split(/\r?\n/).map((l) => `> ${l}`).join('\n')
  const body = `\n\n${when ? `El ${when}, ` : ''}${message.name} escribió:\n${quoted}`
  return `mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

const UNITS = [
  { s: 60, one: 'min', many: 'min' },
  { s: 3600, one: 'h', many: 'h' },
  { s: 86400, one: 'día', many: 'días' },
]

/** "hace un momento", "hace 5 min", "hace 2 h", "hace 3 días" y, pasada una semana, la fecha. */
export function relativeTime(date, now = new Date()) {
  const seconds = Math.max(0, (new Date(now) - new Date(date)) / 1000)
  if (seconds < 60) return 'hace un momento'
  if (seconds < 3600) return `hace ${Math.floor(seconds / UNITS[0].s)} min`
  if (seconds < 86400) return `hace ${Math.floor(seconds / UNITS[1].s)} h`
  const days = Math.floor(seconds / UNITS[2].s)
  if (days < 7) return `hace ${days} ${days === 1 ? UNITS[2].one : UNITS[2].many}`
  return new Date(date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mazatlan' }).replace('.', '')
}
