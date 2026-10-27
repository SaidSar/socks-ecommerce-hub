import { localDate, parseDate } from '../domain/season'

// Fecha forzada con ?hoy=AAAA-MM-DD, solo en desarrollo. Se lee una vez al cargar la app,
// así sigue vigente al navegar entre rutas aunque la URL ya no la lleve.
let devToday

function readDevToday() {
  if (devToday !== undefined) return devToday
  devToday = null
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    devToday = parseDate(new URLSearchParams(window.location.search).get('hoy'))
  }
  return devToday
}

/**
 * Fecha local del negocio que usan las reglas de temporada.
 * `now` (Date) es inyectable para pruebas; si no se da, se usa ?hoy= (DEV) o la fecha real en America/Mazatlan.
 * TODO(api): el servidor decide la fecha; la tienda solo la recibe ya aplicada en precio y visibilidad.
 */
export function catalogToday(now) {
  if (now) return localDate(now)
  return readDevToday() ?? localDate()
}

/** Solo para pruebas: olvida la fecha leída de la URL. */
export function __resetDevToday() {
  devToday = undefined
}
