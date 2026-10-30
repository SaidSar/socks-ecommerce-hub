import { DEFAULT_CONFIG } from '../config/commerce'
import { apiGet, USE_API } from './api'

const MOCK_LATENCY_MS = 150

/**
 * Configuración pública de la tienda (DESIGN_DB.md §3.12).
 * @returns {Promise<{ freeShippingThreshold: number, parcelShippingCost: number, localShippingCost: number,
 *   localFreeShipping: boolean, fewUnitsThreshold: number, ivaRate: number }>}
 */
export async function getConfig() {
  if (USE_API) return apiGet('/api/config')
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
  return { ...DEFAULT_CONFIG }
}
