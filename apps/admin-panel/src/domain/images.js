// Fotos de producto en el panel: reglas puras. El navegador las redimensiona y convierte (services/resizeImage.js);
// la API vuelve a revisar tamaño, formato por firma de bytes y cantidad.

export const MAX_IMAGES = 6
export const MAX_BYTES = 5 * 1024 * 1024
export const MAX_SIDE = 1600
export const MAX_ALT = 200
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const IMAGE_MSG = {
  type: 'Solo se aceptan fotos JPG, PNG o WebP.',
  full: `Cada producto admite hasta ${MAX_IMAGES} fotos.`,
  tooBig: 'La foto pesa más de 5 MB aun después de reducirla.',
  alt: `El texto alternativo admite hasta ${MAX_ALT} caracteres.`,
  decode: 'No pudimos leer esa foto. Prueba con otro archivo.',
}

/** Medidas para que el lado largo no pase de `max`; nunca agranda. */
export function fitWithin(width, height, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Antes de redimensionar: el tipo que dice el navegador. El peso se revisa después, sobre la foto ya reducida. */
export const fileError = (file) => (ACCEPTED_TYPES.includes(file?.type) ? null : IMAGE_MSG.type)

/** Cuántos archivos de `count` caben si ya hay `current` fotos. */
export const roomFor = (current, count) => Math.max(0, Math.min(count, MAX_IMAGES - current))

/** Copia de `list` con el elemento de `from` movido a `to`. */
export function moveItem(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** "lentes_negros-frente.jpg" → "lentes negros frente": punto de partida del texto alternativo. */
export const altFromFileName = (name) =>
  String(name ?? '')
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ALT)
