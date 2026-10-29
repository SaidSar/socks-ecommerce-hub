import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Atrapa el foco dentro de `ref` mientras `active` sea true: Tab cicla, Esc llama a `onEscape`
 * y al desactivarse devuelve el foco a `returnFocus()` (o al elemento que lo tenía al abrir).
 */
export function useFocusTrap(ref, { active = true, onEscape, returnFocus, initialFocus } = {}) {
  const onEscapeRef = useRef(onEscape)
  const returnFocusRef = useRef(returnFocus)
  useEffect(() => {
    onEscapeRef.current = onEscape
    returnFocusRef.current = returnFocus
  })

  useEffect(() => {
    if (!active) return
    const node = ref.current
    if (!node) return
    const opener = document.activeElement
    const first = (initialFocus && initialFocus.current) || node.querySelector(FOCUSABLE)
    first?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onEscapeRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (!items.length) return
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === firstEl || !node.contains(document.activeElement))) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && (document.activeElement === lastEl || !node.contains(document.activeElement))) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const target = returnFocusRef.current?.() || opener
      // Síncrono: si el panel se vuelve a activar (StrictMode), su propio efecto recupera el foco después.
      if (target && typeof target.focus === 'function' && document.contains(target)) target.focus()
    }
  }, [active, ref, initialFocus])
}
