import { useCallback, useEffect, useRef, useState } from 'react'

const SHAKE_MS = 450

/** Sacudida breve del formulario al fallar el envío. Con prefers-reduced-motion la animación no corre (index.css). */
export function useShake() {
  const [shaking, setShaking] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const shake = useCallback(() => {
    setShaking(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setShaking(false), SHAKE_MS)
  }, [])

  return [shaking, shake]
}
