// Utilidades mínimas para pruebas de pantallas con jsdom, sin librerías extra: react-dom/client + act.
import { act } from 'react'
import { createRoot } from 'react-dom/client'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
window.scrollTo = () => {}
// jsdom no implementa matchMedia: SidePanel y la barra lateral preguntan por el ancho.
window.matchMedia ??= (query) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} })

/** Monta `ui` en un contenedor nuevo y espera a que terminen efectos y promesas pendientes. */
export async function render(ui) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => root.render(ui))
  return {
    container,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

/** Deja correr temporizadores y promesas (latencias simuladas del mock). */
export const flush = (ms = 0) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))

export const click = (el) => act(async () => el.click())

/** Cambia el valor como lo haría el usuario: React escucha el evento input/change. */
export async function type(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : el instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value)
  await act(async () => el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })))
}

/** Primer elemento `selector` cuyo texto empieza con `text`. */
export const byText = (root, selector, text) => [...root.querySelectorAll(selector)].find((el) => el.textContent.trim().startsWith(text))
