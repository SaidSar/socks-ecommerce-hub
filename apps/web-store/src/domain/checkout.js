// Reglas del checkout (DESIGN_CHECKOUT.md §3). Módulo puro, sin React ni dependencias; el servidor vuelve a validar y calcular todo.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const CHECKOUT_MESSAGES = {
  firstName: 'Escriba su nombre.',
  lastName: 'Escriba su apellido.',
  emailEmpty: 'Escriba su correo electrónico.',
  emailFormat: 'Revise el formato del correo, por ejemplo nombre@dominio.com.',
  phone: 'Escriba un teléfono de 10 dígitos.',
  street: 'Escriba la calle y el número.',
  neighborhood: 'Escriba la colonia.',
  city: 'Escriba la ciudad.',
  state: 'Escriba el estado.',
  postalCode: 'El código postal debe tener 5 dígitos.',
  cardNumber: 'Revise el número de la tarjeta.',
  cardName: 'Escriba el nombre como aparece en la tarjeta.',
  cardExpiry: 'Revise el vencimiento, por ejemplo 08/29.',
  cardCvc: 'Revise el código de seguridad: son 3 dígitos al reverso.',
  cardCvcAmex: 'Revise el código de seguridad: son 4 dígitos al frente de la tarjeta.',
  declined: 'Su banco rechazó la tarjeta. Pruebe con otra o elija OXXO Pay.',
  insufficient_funds: 'La tarjeta no tiene fondos suficientes. Pruebe con otra o elija OXXO Pay.',
  sessionExpired: 'Su sesión venció. Inicie sesión de nuevo o continúe como invitado.',
  orderChanged: 'Su pedido cambió desde el último intento. Revíselo y confirme de nuevo.',
  rateLimited: 'Demasiados intentos. Espere un momento e inténtelo de nuevo.',
  network: 'No pudimos conectar con el atelier. Intente de nuevo en un momento.',
}

export const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '')

/** Suma de verificación de los números de tarjeta. */
export function passesLuhn(digits) {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

/** Marcas aceptadas: nombre accesible, grupos del formato, dígitos del número y del CVC. */
export const CARD_BRANDS = {
  visa: { name: 'Visa', groups: [4, 4, 4, 4], length: 16, cvc: 3 },
  mastercard: { name: 'Mastercard', groups: [4, 4, 4, 4], length: 16, cvc: 3 },
  amex: { name: 'American Express', groups: [4, 6, 5], length: 15, cvc: 4 },
}
// Sin marca reconocida se aceptan hasta 19 dígitos en grupos de 4 (la validación con Luhn decide).
const UNKNOWN_BRAND = { groups: [4, 4, 4, 4, 3], length: 19, cvc: 3 }

/** ¿Todo número que empiece con `prefix` cae en [from, to]? Compara los primeros dígitos, rellenando lo que falta. */
const prefixWithin = (prefix, from, to) => {
  const size = String(from).length
  const head = prefix.slice(0, size)
  return Number(head.padEnd(size, '0')) >= from && Number(head.padEnd(size, '9')) <= to
}

/**
 * Marca de la tarjeta en cuanto los primeros dígitos la definen (a más tardar con 4):
 * Visa empieza con 4; Mastercard con 51–55 o 2221–2720; American Express con 34 o 37. Si no, null.
 */
export function detectCardBrand(digits) {
  const d = digitsOnly(digits)
  if (!d) return null
  if (d[0] === '4') return 'visa'
  if (d.length >= 2 && (d.startsWith('34') || d.startsWith('37'))) return 'amex'
  if (prefixWithin(d, 51, 55) || prefixWithin(d, 2221, 2720)) return 'mastercard'
  return null
}

export const cardRules = (brand) => CARD_BRANDS[brand] ?? UNKNOWN_BRAND

/** "378282246310005" → "3782 822463 10005" (Amex 4-6-5); Visa y Mastercard 4-4-4-4. Corta lo que sobra. */
export function formatCardNumber(value) {
  const rules = cardRules(detectCardBrand(value))
  const digits = digitsOnly(value).slice(0, rules.length)
  const parts = []
  let at = 0
  for (const size of rules.groups) {
    if (at >= digits.length) break
    parts.push(digits.slice(at, at + size))
    at += size
  }
  return parts.join(' ')
}

/** Posición en `formatted` justo después del dígito número `count`: así el cursor no salta al reformatear. */
export function caretAfterDigits(formatted, count) {
  if (count <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === count) return i + 1
  }
  return formatted.length
}

/** "MM/AA" vigente hasta el último día de ese mes. */
export function isValidExpiry(value, now = new Date()) {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(value ?? '').trim())
  if (!m) return false
  const month = Number(m[1])
  if (month < 1 || month > 12) return false
  return new Date(2000 + Number(m[2]), month, 1) > now
}

/** Errores por campo, en el orden del formulario. Un objeto vacío significa que se puede enviar. */
export function validateCheckout({ contact, card, paymentMethod }, now = new Date()) {
  const errors = {}
  const set = (key, ok, message) => {
    if (!ok) errors[key] = message
  }
  const text = (key) => String(contact[key] ?? '').trim()

  set('firstName', text('firstName'), CHECKOUT_MESSAGES.firstName)
  set('lastName', text('lastName'), CHECKOUT_MESSAGES.lastName)
  if (!text('email')) errors.email = CHECKOUT_MESSAGES.emailEmpty
  else set('email', EMAIL_RE.test(text('email')), CHECKOUT_MESSAGES.emailFormat)
  set('phone', digitsOnly(contact.phone).length === 10, CHECKOUT_MESSAGES.phone)
  set('street', text('street'), CHECKOUT_MESSAGES.street)
  set('neighborhood', text('neighborhood'), CHECKOUT_MESSAGES.neighborhood)
  set('postalCode', /^\d{5}$/.test(text('postalCode')), CHECKOUT_MESSAGES.postalCode)
  set('city', text('city'), CHECKOUT_MESSAGES.city)
  set('state', text('state'), CHECKOUT_MESSAGES.state)

  if (paymentMethod === 'tarjeta') {
    const number = digitsOnly(card.number)
    set('cardNumber', number.length >= 13 && number.length <= 19 && passesLuhn(number), CHECKOUT_MESSAGES.cardNumber)
    set('cardName', String(card.name ?? '').trim(), CHECKOUT_MESSAGES.cardName)
    set('cardExpiry', isValidExpiry(card.expiry, now), CHECKOUT_MESSAGES.cardExpiry)
    // 3 dígitos; 4 con American Express (van al frente de la tarjeta).
    const cvcLength = cardRules(detectCardBrand(number)).cvc
    const cvc = String(card.cvc ?? '').trim()
    set('cardCvc', /^\d+$/.test(cvc) && cvc.length === cvcLength, cvcLength === 4 ? CHECKOUT_MESSAGES.cardCvcAmex : CHECKOUT_MESSAGES.cardCvc)
  }
  return errors
}

/** IVA incluido en el total (DESIGN.md §4.4). */
export const taxIncluded = (total, rate) => Math.round((total - total / (1 + rate)) * 100) / 100

const LOCAL_ZONES = [
  ['81200', '81299'],
  ['81300', '81399'],
]

/** R-14 del mock: mismas zonas y reglas que `QuoteShipping` en el servidor. */
export function quoteShippingLocal(postalCode, subtotal, config) {
  const local = LOCAL_ZONES.some(([from, to]) => postalCode >= from && postalCode <= to)
  const reachesFree = subtotal >= config.freeShippingThreshold
  if (local) return { method: 'local', cost: reachesFree && config.localFreeShipping ? 0 : config.localShippingCost }
  return { method: 'paqueteria', cost: reachesFree ? 0 : config.parcelShippingCost }
}

/** "93123456789012" → "9312 3456 7890 12". */
export const formatReference = (reference) => String(reference ?? '').replace(/(.{4})(?=.)/g, '$1 ')

/** Etiqueta del estado en Mis pedidos: un OXXO sin pagar tiene prioridad (DESIGN_CHECKOUT.md §5). */
export function orderStatusLabel(order) {
  if (order.status === 'cancelado') return 'Cancelado'
  if (order.paymentMethod === 'oxxo_pay' && order.paymentStatus === 'pendiente') return 'OXXO por pagar'
  return { por_preparar: 'Por preparar', preparando: 'Preparando', enviado: 'Enviado', en_ruta: 'En ruta local', entregado: 'Entregado' }[order.status] ?? order.status
}

export const deliveryLabel = (method) => (method === 'local' ? 'Entrega local' : 'Paquetería')
