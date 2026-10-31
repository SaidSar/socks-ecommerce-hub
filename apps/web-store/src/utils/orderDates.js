const ZONE = 'America/Mazatlan'

/** "2 de noviembre de 2026" en la hora del negocio. */
export const formatDate = (iso) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: ZONE, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))

/** "2 de noviembre, 15:30" en la hora del negocio. */
export const formatDateTime = (iso) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: ZONE, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
