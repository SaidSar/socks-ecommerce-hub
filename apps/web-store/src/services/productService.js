import { FEATURED_PIECE_ID, PIECES, SIZES, TONES } from '../data/catalog.mock'
// import { API_URL } from './api'

const MOCK_LATENCY_MS = 250

/**
 * Datos del Home.
 * @returns {Promise<{ pieces: typeof PIECES, tones: typeof TONES, sizes: typeof SIZES, featuredId: number }>}
 */
export async function getHomePieces() {
  // TODO(api): sustituir el mock por el servicio real y mapear `variants` a `stock[tone][size]` (DESIGN.md §9).
  // const response = await fetch(`${API_URL}/api/products?section=home`)
  // if (!response.ok) throw new Error(`API respondió ${response.status}`)
  // const data = await response.json()
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
  return { pieces: PIECES, tones: TONES, sizes: SIZES, featuredId: FEATURED_PIECE_ID }
}
