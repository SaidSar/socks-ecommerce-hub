// Cola de avisos flotantes del panel. Módulo puro: el provider solo guarda la lista que devuelve.

/** Tiempo que un aviso queda a la vista. */
export const TOAST_MS = 4000
export const MAX_TOASTS = 3

/** Agrega `toast` al final; uno con la misma `key` reemplaza al anterior y solo quedan los últimos `max`. */
export function pushToast(list, toast, max = MAX_TOASTS) {
  return [...list.filter((t) => !toast.key || t.key !== toast.key), toast].slice(-max)
}

export const dropToast = (list, id) => list.filter((t) => t.id !== id)
