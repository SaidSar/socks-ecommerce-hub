import { useCallback, useEffect, useState } from 'react'

/** Cuánto se queda "Guardado ✓" en el botón antes de volver a su texto. */
export const SAVED_MS = 2000

/**
 * Estado visible de un botón de guardar: 'idle' → 'saving' → 'saved' (2 s) → 'idle'.
 * `run(fn)` ignora envíos mientras guarda y devuelve lo que devuelve `fn`; si falla, vuelve a 'idle' y propaga el error.
 */
export function useSaveStatus() {
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    if (status !== 'saved') return
    const timer = setTimeout(() => setStatus('idle'), SAVED_MS)
    return () => clearTimeout(timer)
  }, [status])

  const run = useCallback(async (fn) => {
    setStatus('saving')
    try {
      const result = await fn()
      setStatus('saved')
      return result
    } catch (err) {
      setStatus('idle')
      throw err
    }
  }, [])

  return [status, run]
}
