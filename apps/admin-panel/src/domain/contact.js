// Correo de la tienda para el formulario de contacto. Misma regla y mensaje que SettingsService en apps/api-service.

export const CONTACT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const CONTACT_EMAIL_ERROR = 'Revise el formato del correo, por ejemplo nombre@dominio.com.'

/** "  Tienda@SOKKO.mx " → "tienda@sokko.mx"; vacío → null (los mensajes solo se guardan). */
export function normalizeContactEmail(value) {
  const email = String(value ?? '').trim().toLowerCase()
  return email === '' ? null : email
}

/** '' si está vacío o es válido; si no, el mensaje de error. */
export function validateContactEmail(value) {
  const email = normalizeContactEmail(value)
  return email === null || (email.length <= 254 && CONTACT_EMAIL_RE.test(email)) ? '' : CONTACT_EMAIL_ERROR
}
