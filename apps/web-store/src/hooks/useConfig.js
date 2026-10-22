import { useContext } from 'react'
import { ConfigContext } from '../context/config-context'

/**
 * Configuración de la tienda con la forma de GET /api/config (DESIGN_DB.md §3.12).
 * @returns {{ freeShippingThreshold: number, parcelShippingCost: number, localShippingCost: number,
 *   localFreeShipping: boolean, fewUnitsThreshold: number, ivaRate: number }}
 */
export function useConfig() {
  return useContext(ConfigContext)
}
