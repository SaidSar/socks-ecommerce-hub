// Reduce una foto en el navegador antes de subirla: lado largo de 1600 px y WebP, con canvas (sin librerías).
import { fitWithin, IMAGE_MSG, MAX_SIDE } from '../domain/images'

const QUALITY = 0.85

function toBlob(canvas, type) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality: QUALITY })
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(IMAGE_MSG.decode))), type, QUALITY))
}

function canvasOf(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

/**
 * `File` → `Blob` WebP. La orientación EXIF se aplica al decodificar (`imageOrientation: 'from-image'`).
 * Un navegador que no sabe codificar WebP devuelve PNG desde canvas: entonces se manda JPEG, que pesa menos.
 */
export async function resizeImage(file, max = MAX_SIDE) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(IMAGE_MSG.decode)
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max)
  const canvas = canvasOf(width, height)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const webp = await toBlob(canvas, 'image/webp')
  return webp.type === 'image/webp' ? webp : toBlob(canvas, 'image/jpeg')
}
