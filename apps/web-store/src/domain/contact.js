// Reglas del formulario de contacto. Mismos límites y mensajes que ContactRequestDto en apps/api-service.
import { emailError } from '../utils/authValidation'

export const CONTACT_SUBJECTS = ['Un pedido', 'Tallas y materiales', 'Cambios y devoluciones', 'Mayoreo o colaboraciones', 'Otro tema']

export const MESSAGE_MIN = 10
export const MESSAGE_MAX = 2000

export const CONTACT_MESSAGES = {
  name: 'Escriba su nombre.',
  subject: 'Elija un asunto.',
  messageEmpty: 'Escriba su mensaje.',
  messageShort: `El mensaje necesita al menos ${MESSAGE_MIN} caracteres.`,
  messageLong: `El mensaje admite hasta ${MESSAGE_MAX} caracteres.`,
  rateLimited: 'Ya recibimos varios mensajes desde su conexión. Intente de nuevo en una hora o escríbanos por correo.',
  network: 'No pudimos enviar su mensaje. Revise su conexión e intente de nuevo.',
  sent: 'Recibimos su mensaje. Le responderemos en un día hábil.',
}

export const EMPTY_CONTACT = { name: '', email: '', subject: '', message: '', website: '' }

/** Errores por campo ({} si todo está bien). `website` es el honeypot: no se valida. */
export function validateContact({ name, email, subject, message }) {
  const errors = {}
  if (!name.trim()) errors.name = CONTACT_MESSAGES.name
  const mail = emailError(email)
  if (mail) errors.email = mail
  if (!CONTACT_SUBJECTS.includes(subject)) errors.subject = CONTACT_MESSAGES.subject
  const text = message.trim()
  if (!text) errors.message = CONTACT_MESSAGES.messageEmpty
  else if (text.length < MESSAGE_MIN) errors.message = CONTACT_MESSAGES.messageShort
  else if (text.length > MESSAGE_MAX) errors.message = CONTACT_MESSAGES.messageLong
  return errors
}
