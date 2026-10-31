// Pedidos, inventario, importación y dashboard contra apps/api-service (/api/admin). Devuelve la misma forma que el mock de adminApi.js.
// Las validaciones de domain/ dan la respuesta inmediata en pantalla; la API es la que decide.
import { seasonStatus } from '../domain/catalog'
import { rowsToCsv } from '../domain/importCsv'
import { authFetch } from './adminAuth'
import { ApiError } from './apiError'
import { NETWORK_MESSAGE, problemToError, request } from './adminCatalogApi'

const query = (params) => {
  const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v && v !== 'todos')).toString()
  return search ? `?${search}` : ''
}
const folioPath = (folio) => `/api/admin/orders/${encodeURIComponent(folio)}`
const skuPath = (sku) => `/api/admin/inventory/${encodeURIComponent(sku)}`

// ---------------------------------------------------------------- Dashboard

export const getSummary = () => request('GET', '/api/admin/orders/summary')

/** Las temporadas llevan su estado de hoy, calculado con la misma función que Colecciones. */
export async function getDashboard(range) {
  const data = await request('GET', `/api/admin/dashboard?range=${encodeURIComponent(range)}`)
  const { catalog } = data
  return { ...data, catalog: { ...catalog, seasons: catalog.seasons.map((c) => ({ ...c, status: seasonStatus(c, catalog.today) })) } }
}

// ---------------------------------------------------------------- Pedidos

export async function getOrders({ filter, q }) {
  const { count, ...rest } = await request('GET', `/api/admin/orders${query({ status: filter, q })}`)
  return { ...rest, total: count }
}

export const getOrder = (folio) => request('GET', folioPath(folio))

/** `payload`: `{ status, carrier, tracking, courier, rowVersion }`; `status` es el paso que vio quien da clic. */
export const advanceOrder = (folio, payload) => request('POST', `${folioPath(folio)}/transitions`, payload)

export const cancelOrder = (folio, rowVersion) => request('POST', `${folioPath(folio)}/cancel`, { rowVersion })

export const markOrderPaid = (folio, rowVersion) => request('POST', `${folioPath(folio)}/payment`, { rowVersion })

export const saveOrderNote = (folio, note, rowVersion) => request('PUT', `${folioPath(folio)}/note`, { note, rowVersion })

export const getCouriers = () => request('GET', '/api/admin/orders/couriers')

export const getPackingList = (folio) => request('GET', `${folioPath(folio)}/packing-list`)

// ---------------------------------------------------------------- Inventario

export async function getInventory({ filter, q }) {
  const { count, stats, ...rest } = await request('GET', `/api/admin/inventory${query({ state: filter, q })}`)
  return { ...rest, totals: stats, total: count }
}

export const getStockRow = (sku) => request('GET', skuPath(sku))

const toMovement = (m) => ({ ...m, note: m.note ?? '—' })

export const getMovements = async (sku) => (await request('GET', `${skuPath(sku)}/movements`)).map(toMovement)

/** Un error de validación llega por campo: el formulario lo muestra junto a ese campo. */
export async function adjustStock(sku, { type, qty, note, folio, rowVersion }) {
  try {
    const { row, movement } = await request('POST', `${skuPath(sku)}/movements`, { type, qty: Number(qty), note, folio, rowVersion })
    return { row, movement: toMovement(movement) }
  } catch (err) {
    const [field] = Object.keys(err.errors ?? {})
    if (field) {
      err.message = err.errors[field]
      err.field = field
    }
    throw err
  }
}

// ---------------------------------------------------------------- Importación

export const previewImport = (csv) => request('POST', '/api/admin/inventory/import/preview', { csv })

/** El servidor valida otra vez y solo aplica las filas válidas. */
export const applyImport = (rows) => request('POST', '/api/admin/inventory/import', { csv: rowsToCsv(rows) })

export async function getTemplateCsv() {
  let response
  try {
    response = await authFetch('/api/admin/inventory/import/template', { method: 'GET' })
  } catch {
    throw new ApiError(NETWORK_MESSAGE, 0)
  }
  if (!response.ok) throw problemToError(response.status, null)
  return response.text()
}
