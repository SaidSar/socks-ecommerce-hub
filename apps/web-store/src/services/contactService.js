// Mensajes de contacto (POST /api/contact). Con USE_API habla con la API; sin ella simula el envío.
import { API_URL, USE_API } from './api'

const MOCK_LATENCY_MS = 600

export class ContactError extends Error {
  /**
   * @param {'VALIDATION' | 'RATE_LIMITED' | 'NETWORK'} code
   * @param {Record<string, string>} [fieldErrors] errores por campo de la API (ValidationProblemDetails)
   */
  constructor(code, fieldErrors = {}) {
    super(code)
    this.name = 'ContactError'
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

/** `errors` de ValidationProblemDetails ({ Email: ['…'] }) → { email: '…' }. */
function toFieldErrors(errors = {}) {
  return Object.fromEntries(Object.entries(errors).map(([key, messages]) => [key.charAt(0).toLowerCase() + key.slice(1), messages[0]]))
}

/** Envía el mensaje. Resuelve si la tienda lo recibió (202); lanza ContactError si no. */
export async function sendContactMessage({ name, email, subject, message, website }) {
  const body = { name: name.trim(), email: email.trim(), subject, message: message.trim(), website }
  if (!USE_API) {
    await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS))
    return
  }

  let response
  try {
    response = await fetch(`${API_URL}/api/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new ContactError('NETWORK')
  }
  if (response.ok) return
  if (response.status === 429) throw new ContactError('RATE_LIMITED')
  if (response.status === 400) {
    const problem = await response.json().catch(() => ({}))
    throw new ContactError('VALIDATION', toFieldErrors(problem.errors))
  }
  throw new ContactError('NETWORK')
}
