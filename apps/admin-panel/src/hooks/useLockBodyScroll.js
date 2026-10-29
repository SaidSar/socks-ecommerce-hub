import { useEffect } from 'react'

/** Bloquea el scroll del <body> mientras `active` sea true, sin salto por la barra de desplazamiento. */
export function useLockBodyScroll(active) {
  useEffect(() => {
    if (!active) return
    const { body, documentElement } = document
    const prevOverflow = body.style.overflow
    const prevPadding = body.style.paddingRight
    const scrollbar = window.innerWidth - documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`
    return () => {
      body.style.overflow = prevOverflow
      body.style.paddingRight = prevPadding
    }
  }, [active])
}
