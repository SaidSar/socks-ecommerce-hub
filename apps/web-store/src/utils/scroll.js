// Altura del header sticky (68 px) + margen superior (12 px).
const HEADER_OFFSET = 68 + 12

/** Desplaza hasta la sección `id` sin que el header sticky tape su título. */
export function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET
  window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' })
}
