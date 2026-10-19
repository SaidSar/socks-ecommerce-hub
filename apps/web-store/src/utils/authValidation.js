// Reglas y mensajes de validación del acceso (DESIGN_AUTH.md §5.1–5.2). Copy exacto del mockup.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const MESSAGES = {
  emailEmpty: 'Escriba su correo electrónico.',
  emailFormat: 'Revise el formato del correo, por ejemplo nombre@dominio.com.',
  passwordEmpty: 'Escriba su contraseña.',
  invalidCredentials: 'El correo o la contraseña no coinciden. Revise ambos o restablezca su contraseña.',
  firstName: 'Escriba su nombre.',
  lastName: 'Escriba su apellido.',
  emailTaken: 'Este correo ya tiene una cuenta. Inicie sesión o use otro correo.',
  passwordWeak: 'La contraseña necesita 8 caracteres, mayúsculas, minúsculas y un número.',
  confirmEmpty: 'Repita la contraseña.',
  confirmMismatch: 'Las contraseñas no coinciden.',
  terms: 'Para crear la cuenta debe aceptar los términos y el aviso de privacidad.',
  // TODO(design): copy para fallos de red; el mockup no lo contempla.
  network: 'No pudimos conectar con el atelier. Intente de nuevo en un momento.',
}

export const reviewCount = (n) => `Hay ${n} campos por revisar.`

/** Mensaje de error del correo, o undefined si es válido. */
export function emailError(value) {
  const email = value.trim()
  if (!email) return MESSAGES.emailEmpty
  if (!EMAIL_RE.test(email)) return MESSAGES.emailFormat
  return undefined
}

/** Fuerza de contraseña: válida = primeras tres reglas; el símbolo solo suma puntaje. */
export function passwordStrength(pw) {
  const rules = [
    { ok: pw.length >= 8, text: '8 caracteres o más' },
    { ok: /[A-ZÁÉÍÓÚÑ]/.test(pw) && /[a-záéíóúñ]/.test(pw), text: 'Mayúsculas y minúsculas' },
    { ok: /\d/.test(pw), text: 'Al menos un número' },
    { ok: /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/.test(pw), text: 'Un símbolo (opcional, la hace más fuerte)' },
  ]
  const score = rules.filter((r) => r.ok).length
  const label = !pw ? '' : score <= 1 ? 'Débil' : score === 2 ? 'Aceptable' : score === 3 ? 'Buena' : 'Excelente'
  return { rules, score, label, valid: rules[0].ok && rules[1].ok && rules[2].ok }
}
