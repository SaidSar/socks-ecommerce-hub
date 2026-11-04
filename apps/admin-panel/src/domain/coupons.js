// Cupones de descuento del panel (Promociones, solo el Dueño). Reglas puras: mismos mensajes que CouponRules y
// CouponService.Validate del servidor. Fechas como "AAAA-MM-DD" en hora de Los Mochis.

export const COUPON_TYPES = [
  { key: 'percent', label: 'Porcentaje' },
  { key: 'fixed', label: 'Monto fijo' },
  { key: 'free_shipping', label: 'Envío gratis' },
]

export const COUPON_STATUS = {
  active: { label: 'Activo', cls: 'bg-ok-bg text-ok-ink', dot: '#5A6654' },
  scheduled: { label: 'Programado', cls: 'bg-info-bg text-info-ink', dot: '#3B6E8F' },
  expired: { label: 'Vencido', cls: 'bg-sand text-ink-soft', dot: '#9A9187' },
  exhausted: { label: 'Agotado', cls: 'bg-warn-bg text-warn-ink', dot: '#B7791F' },
  inactive: { label: 'Inactivo', cls: 'bg-paper text-ink-soft border border-line', dot: '#C9C1B6' },
}

export const COUPON_FILTERS = [{ key: 'todos', label: 'Todos' }, ...Object.entries(COUPON_STATUS).map(([key, s]) => ({ key, label: s.label }))]

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const parts = (iso) => String(iso).split('-').map(Number)

/** "$500" o "$499.50". */
export const pesos = (amount) =>
  `$${Number(amount).toLocaleString('es-MX', { minimumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2, maximumFractionDigits: 2 })}`

/** "10 de noviembre" (con el año si no es el de `todayIso`). */
export function dayLabel(iso, todayIso) {
  const [y, m, d] = parts(iso)
  return `${d} de ${MONTHS[m - 1]}${todayIso && parts(todayIso)[0] !== y ? ` de ${y}` : ''}`
}

/** "10%", "$100", "Envío gratis". */
export function valueLabel(coupon) {
  if (coupon.type === 'percent') return `${Number(coupon.value)}%`
  if (coupon.type === 'fixed') return pesos(coupon.value)
  return 'Envío gratis'
}

/** "Del 10 al 30 de noviembre", "Desde el 10 de noviembre", "Hasta el 30 de noviembre", "Sin vencimiento". */
export function validityLabel({ startsOn, endsOn }, todayIso) {
  if (startsOn && endsOn) {
    const [sy, sm] = parts(startsOn)
    const [ey, em] = parts(endsOn)
    if (sy === ey && sm === em) return `Del ${parts(startsOn)[2]} al ${dayLabel(endsOn, todayIso)}`
    return `Del ${dayLabel(startsOn, sy === ey ? `${ey}` : todayIso)} al ${dayLabel(endsOn, todayIso)}`
  }
  if (startsOn) return `Desde el ${dayLabel(startsOn, todayIso)}`
  if (endsOn) return `Hasta el ${dayLabel(endsOn, todayIso)}`
  return 'Sin vencimiento'
}

/** "12 / 50" o "12" si no tiene límite. */
export const usesLabel = (coupon) => (coupon.maxRedemptions ? `${coupon.redemptions} / ${coupon.maxRedemptions}` : String(coupon.redemptions))

/** Mismo orden que CouponRules.StatusOf: inactivo, vencido, agotado, programado, activo. */
export function couponStatus(coupon, todayIso) {
  if (!coupon.isActive) return 'inactive'
  if (coupon.endsOn && todayIso > coupon.endsOn) return 'expired'
  if (coupon.maxRedemptions != null && coupon.redemptions >= coupon.maxRedemptions) return 'exhausted'
  if (coupon.startsOn && todayIso < coupon.startsOn) return 'scheduled'
  return 'active'
}

/** " bienvenida 10 " → "BIENVENIDA10". */
export const normalizeCode = (value) => String(value ?? '').replace(/\s+/g, '').toUpperCase()

// Sin letras ni números que se confunden al dictarlos o leerlos: O/0, I/1/L.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Código de 8 caracteres. `random` devuelve [0, 1). */
export function generateCode(random = Math.random) {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join('')
}

const num = (v) => (v === '' || v == null ? null : Number(v))

/**
 * Vista previa en texto: "10% de descuento en compras desde $500, válido del 10 al 30 de noviembre, una vez por cliente".
 * Devuelve '' si todavía no hay tipo o valor.
 */
export function previewText(form, todayIso) {
  const value = num(form.value)
  let head
  if (form.type === 'percent' && value > 0) head = `${value}% de descuento`
  else if (form.type === 'fixed' && value > 0) head = `${pesos(value)} de descuento`
  else if (form.type === 'free_shipping') head = 'Envío gratis'
  else return ''
  const min = num(form.minSubtotal)
  const bits = [min > 0 ? `${head} en compras desde ${pesos(min)}` : head]
  if (form.startsOn || form.endsOn) {
    const validity = validityLabel({ startsOn: form.startsOn || null, endsOn: form.endsOn || null }, todayIso)
    bits.push(`válido ${validity.charAt(0).toLowerCase()}${validity.slice(1)}`)
  }
  const max = num(form.maxRedemptions)
  if (max > 0) bits.push(`hasta ${max} ${max === 1 ? 'uso' : 'usos'}`)
  if (form.onePerCustomer) bits.push('una vez por cliente')
  return bits.join(', ')
}

const twoDecimals = (n) => Math.round(n * 100) === n * 100

/** Errores por campo, con los mismos mensajes que la API. Vacío = se puede guardar. */
export function validateCoupon(form) {
  const errors = {}
  const code = normalizeCode(form.code)
  if (!code) errors.code = 'Escriba el código.'
  else if (!/^[A-Z0-9-]{3,30}$/.test(code)) errors.code = 'El código lleva de 3 a 30 letras sin acentos, números o guiones.'

  const value = num(form.value)
  if (!form.type) errors.type = 'Elija el tipo de descuento.'
  else if (form.type === 'percent' && (value == null || !Number.isInteger(value) || value < 1 || value > 90)) errors.value = 'El porcentaje va de 1 a 90, sin decimales.'
  else if (form.type === 'fixed' && (value == null || !(value > 0) || !twoDecimals(value))) errors.value = 'Escriba un monto mayor que $0, con hasta dos decimales.'

  const min = num(form.minSubtotal)
  if (min != null && (!(min > 0) || !twoDecimals(min))) errors.minSubtotal = 'El mínimo de compra debe ser mayor que $0.'
  if (form.startsOn && form.endsOn && form.endsOn < form.startsOn) errors.endsOn = 'La fecha final es anterior a la de inicio.'
  const max = num(form.maxRedemptions)
  if (max != null && (!Number.isInteger(max) || max < 1)) errors.maxRedemptions = 'El límite de usos debe ser 1 o más.'
  return errors
}

/** Lo que viaja a la API: números y fechas nulos si están vacíos. */
export function couponPayload(form) {
  return {
    code: normalizeCode(form.code),
    description: form.description?.trim() || null,
    type: form.type,
    value: form.type === 'free_shipping' ? 0 : num(form.value),
    minSubtotal: num(form.minSubtotal),
    startsOn: form.startsOn || null,
    endsOn: form.endsOn || null,
    maxRedemptions: num(form.maxRedemptions),
    onePerCustomer: Boolean(form.onePerCustomer),
    isActive: form.isActive !== false,
    rowVersion: form.rowVersion ?? null,
  }
}

/** Formulario vacío o a partir de un cupón existente. */
export const couponForm = (coupon) =>
  coupon
    ? {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description ?? '',
        type: coupon.type,
        value: coupon.type === 'free_shipping' ? '' : String(coupon.value),
        minSubtotal: coupon.minSubtotal == null ? '' : String(coupon.minSubtotal),
        startsOn: coupon.startsOn ?? '',
        endsOn: coupon.endsOn ?? '',
        maxRedemptions: coupon.maxRedemptions == null ? '' : String(coupon.maxRedemptions),
        onePerCustomer: coupon.onePerCustomer,
        isActive: coupon.isActive,
        rowVersion: coupon.rowVersion,
        locked: coupon.redemptions > 0 || coupon.canDelete === false,
      }
    : { code: '', description: '', type: 'percent', value: '', minSubtotal: '', startsOn: '', endsOn: '', maxRedemptions: '', onePerCustomer: false, isActive: true }

/** Búsqueda por código o descripción y filtro por estado. */
export function filterCoupons(coupons, { status = 'todos', q = '' }, todayIso) {
  const term = normalizeCode(q)
  return coupons.filter(
    (c) =>
      (status === 'todos' || couponStatus(c, todayIso) === status) &&
      (!term || c.code.includes(term) || normalizeCode(c.description ?? '').includes(term)),
  )
}
