// Bandeja de mensajes de contacto contra apps/api-service (/api/admin/messages). Dueño y Operaciones (messages.view).
import { request } from './adminCatalogApi'

export function getMessages({ status = 'nuevos', q = '', page = 1 } = {}) {
  const search = new URLSearchParams({ status })
  if (q) search.set('q', q)
  if (page > 1) search.set('page', String(page))
  return request('GET', `/api/admin/messages?${search}`)
}

export const getUnreadCount = async () => (await request('GET', '/api/admin/messages/unread-count')).count

const ACTIONS = ['read', 'unread', 'archive', 'unarchive']

/** `action`: read, unread, archive o unarchive. Idempotente en la API. */
export function updateMessage(id, action) {
  if (!ACTIONS.includes(action)) throw new Error(`Acción desconocida: ${action}`)
  return request('POST', `/api/admin/messages/${encodeURIComponent(id)}/${action}`)
}
