// Descarga de archivos de la API con fetch + Blob: el token va en el encabezado Authorization, nunca en la URL.
import { authFetch } from './adminAuth'
import { ApiError } from './apiError'
import { NETWORK_MESSAGE, problemToError } from './adminCatalogApi'

/** Nombre que manda la API en Content-Disposition (si el navegador lo deja leer); si no, `fallback`. */
export function fileNameOf(response, fallback) {
  const header = response.headers.get('content-disposition') ?? ''
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star) return decodeURIComponent(star[1])
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain ? plain[1] : fallback
}

/** `{ blob, fileName }` del archivo; los errores llegan como ApiError, igual que en `request`. */
export async function downloadFile(path, fallbackName) {
  let response
  try {
    response = await authFetch(path, { method: 'GET' })
  } catch {
    throw new ApiError(NETWORK_MESSAGE, 0)
  }
  if (!response.ok) {
    const isJson = response.headers.get('content-type')?.includes('json')
    throw problemToError(response.status, isJson ? await response.json() : null)
  }
  return { blob: await response.blob(), fileName: fileNameOf(response, fallbackName) }
}
