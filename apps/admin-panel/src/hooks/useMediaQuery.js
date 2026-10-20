import { useSyncExternalStore } from 'react'

/** true mientras la media query coincida (p. ej. '(min-width: 1536px)' para 2xl). */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
