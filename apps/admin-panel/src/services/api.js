// Cliente HTTP hacia apps/api-service. Única capa que conoce la URL de la API.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5080'

/** La API se usa si VITE_API_URL está definida; VITE_USE_MOCKS=true fuerza los datos de respaldo. */
export const USE_API = Boolean(import.meta.env.VITE_API_URL) && import.meta.env.VITE_USE_MOCKS !== 'true'
