// Cliente HTTP hacia apps/api-service. Única capa que conoce la URL de la API.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5080'

/** La API se usa si VITE_API_URL está definida; VITE_USE_MOCKS=true fuerza los datos de respaldo. */
export const USE_API = Boolean(import.meta.env.VITE_API_URL) && import.meta.env.VITE_USE_MOCKS !== 'true'

/** GET a la API. Con `nullOn404`, un 404 devuelve null en lugar de lanzar el error. */
export async function apiGet(path, { nullOn404 = false } = {}) {
  const response = await fetch(`${API_URL}${path}`)
  if (nullOn404 && response.status === 404) return null
  if (!response.ok) {
    throw new Error(`API respondió ${response.status}`)
  }
  return response.json()
}

export const getHealth = () => apiGet('/api/health')
