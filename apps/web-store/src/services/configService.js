import { DEFAULT_CONFIG } from '../config/commerce'
// import { API_URL } from './api'

const MOCK_LATENCY_MS = 150

/**
 * Configuración pública de la tienda (DESIGN_DB.md §3.12).
 * @returns {Promise<{ freeShippingThreshold: number, parcelShippingCost: number, localShippingCost: number,
 *   localFreeShipping: boolean, fewUnitsThreshold: number, ivaRate: number }>}
 */
export async function getConfig() {
  // TODO(api): sustituir el mock por el servicio real; la respuesta ya tiene esta misma forma.
  // const response = await fetch(`${API_URL}/api/config`)
  // if (!response.ok) throw new Error(`API respondió ${response.status}`)
  // return response.json()
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
  return { ...DEFAULT_CONFIG }
}
