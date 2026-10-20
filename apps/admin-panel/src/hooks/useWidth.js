import { useLayoutEffect, useRef, useState } from 'react'

/** [ref, width]: ancho del contenedor observado con ResizeObserver (gráficas SVG responsivas). */
export function useWidth(initial = 600) {
  const ref = useRef(null)
  const [width, setWidth] = useState(initial)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(node)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}
