// Cliente HTTP hacia apps/api-service. Única capa que conoce la URL de la API.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5080'

export async function getHealth() {
  const response = await fetch(`${API_URL}/api/health`)
  if (!response.ok) {
    throw new Error(`API respondió ${response.status}`)
  }
  return response.json()
}
