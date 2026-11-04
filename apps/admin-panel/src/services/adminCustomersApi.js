// Clientes contra apps/api-service (/api/admin/customers). Solo el Dueño (customers.view); la API responde 403 a Operaciones.
import { request } from './adminCatalogApi'
import { downloadFile } from './download'

const query = (params) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([k, v]) => v !== undefined && v !== '' && !(k === 'type' && v === 'todos') && !(k === 'page' && v === 1)),
  ).toString()
  return search ? `?${search}` : ''
}

export const getCustomers = ({ type, q, sort, page }) => request('GET', `/api/admin/customers${query({ type, q, sort, page })}`)

/** Con cuenta por `id`; invitado por correo. */
export const getCustomer = ({ id, email }) =>
  id != null ? request('GET', `/api/admin/customers/${encodeURIComponent(id)}`) : request('GET', `/api/admin/customers/guest?email=${encodeURIComponent(email)}`)

export const exportCustomers = ({ type, q, sort }, fallbackName) => downloadFile(`/api/admin/customers/export.csv${query({ type, q, sort })}`, fallbackName)

export const exportMarketing = (fallbackName) => downloadFile('/api/admin/customers/marketing.csv', fallbackName)
