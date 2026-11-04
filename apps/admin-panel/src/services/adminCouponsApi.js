// Cupones contra apps/api-service (/api/admin/coupons). Solo el Dueño (promotions.manage).
import { request } from './adminCatalogApi'

const path = (id) => `/api/admin/coupons/${encodeURIComponent(id)}`

export const getCoupons = () => request('GET', '/api/admin/coupons')

/** Alta (sin `id`) o edición (con `id` y `rowVersion`). */
export const saveCoupon = (id, payload) => (id ? request('PUT', path(id), payload) : request('POST', '/api/admin/coupons', payload))

export const setCouponActive = (id, active) => request('POST', `${path(id)}/${active ? 'activate' : 'deactivate'}`)

export const deleteCoupon = (id) => request('DELETE', path(id))
