// Utilidades mínimas para pruebas de componentes con jsdom, sin librerías extra: react-dom/client + act.
import { act } from 'react'
import { createRoot } from 'react-dom/client'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
// jsdom no implementa el scroll; StoreLayout y Account lo llaman al cambiar de vista.
window.scrollTo = () => {}

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

/** Deja correr temporizadores y promesas (latencias simuladas de los servicios mock). */
export const flush = (ms = 0) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))

export const click = (el) => act(async () => el.click())

/** Cambia el valor como lo haría el usuario: React escucha el evento input/change, no la asignación directa. */
export async function type(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : el instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value)
  await act(async () => el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })))
}

export async function submit(form) {
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
}
