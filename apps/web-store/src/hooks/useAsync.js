import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Carga asíncrona con estados `loading` | `error` | `ready` y reintento.
 * Vuelve a cargar cuando cambia `key` (por ejemplo, la línea y sus filtros). Mientras carga conserva
 * los datos anteriores, y una respuesta vieja nunca pisa a una nueva.
 */
export function useAsync(load, key = '') {
  const loadRef = useRef(load)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ request: null, status: 'loading', data: null })
  const request = `${key}#${attempt}`

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    let cancelled = false
    loadRef.current().then(
      (data) => !cancelled && setResult({ request, status: 'ready', data }),
      () => !cancelled && setResult({ request, status: 'error', data: null }),
    )
    return () => {
      cancelled = true
    }
  }, [request])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { status: result.request === request ? result.status : 'loading', data: result.data, retry }
}
