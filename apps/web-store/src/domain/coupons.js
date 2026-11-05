// Cupones de descuento (DESIGN_DB D-40). Módulo puro: el servidor vuelve a validar y calcular todo; aquí viven las mismas reglas
// para el modo mock y para mostrar textos. Fórmula: total = subtotal − descuento + envío.
import { quoteShippingLocal } from './checkout'

export const COUPON_STORAGE_KEY = 'sokko.checkout.coupon.v1'

/** Cupones de ejemplo del modo mock (VITE_USE_MOCKS=true). En producción se crean desde el panel. */
export const MOCK_COUPONS = Object.freeze([
  { code: 'BIENVENIDA10', type: 'percent', value: 10, minSubtotal: null, startsOn: null, endsOn: null, maxRedemptions: null, onePerCustomer: true, isActive: true },
  { code: 'ENVIOGRATIS', type: 'free_shipping', value: 0, minSubtotal: 300, startsOn: null, endsOn: null, maxRedemptions: null, onePerCustomer: false, isActive: true },
])

/** " bienvenida 10 " → "BIENVENIDA10". Se usa mientras se escribe. */
export const normalizeCouponCode = (value) => String(value ?? '').replace(/\s+/g, '').toUpperCase()

export const isCouponCodeShape = (code) => /^[A-Z0-9-]{3,30}$/.test(code)

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

/** Descuento sobre la mercancía (con precios de oferta). Nunca la deja en negativo ni toca el envío. */
export function discountFor(coupon, subtotal) {
  if (!coupon) return 0
  // En centavos enteros: 15 % de $333.30 = 4999.5 ¢ → $50.00 (mitad hacia arriba, como AwayFromZero en el servidor).
  if (coupon.type === 'percent') return Math.min(subtotal, Math.round((Math.round(subtotal * 100) * coupon.value) / 100) / 100)
  if (coupon.type === 'fixed') return Math.min(coupon.value, subtotal)
  return 0
}

/** "$500" o "$499.50". */
export const pesos = (amount) =>
  `$${Number(amount).toLocaleString('es-MX', { minimumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2, maximumFractionDigits: 2 })}`

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "2026-11-10" → "10 de noviembre" (con el año si no es el actual). */
export function dayLabel(iso, todayIso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  const sameYear = !todayIso || Number(String(todayIso).slice(0, 4)) === y
  return `${d} de ${MONTHS[m - 1]}${sameYear ? '' : ` de ${y}`}`
}

/** "10% de descuento", "$100 de descuento", "Envío gratis". */
export function couponDescription(coupon) {
  if (coupon.type === 'percent') return `${coupon.value}% de descuento`
  if (coupon.type === 'fixed') return `${pesos(coupon.value)} de descuento`
  return 'Envío gratis'
}

/** Mismos motivos y textos que CouponRules.Check del servidor. Null si aplica. `todayIso`: fecha local "AAAA-MM-DD". */
export function checkCoupon(coupon, { subtotal, todayIso, redemptions = 0, usedByEmail = null }) {
  if (!coupon) return { reason: 'not_found', message: 'Este código no existe.' }
  if (!coupon.isActive) return { reason: 'inactive', message: 'Este código ya no está disponible.' }
  if (coupon.startsOn && todayIso < coupon.startsOn) return { reason: 'not_started', message: `Este código es válido a partir del ${dayLabel(coupon.startsOn, todayIso)}.` }
  if (coupon.endsOn && todayIso > coupon.endsOn) return { reason: 'expired', message: `Este código venció el ${dayLabel(coupon.endsOn, todayIso)}.` }
  if (coupon.maxRedemptions != null && redemptions >= coupon.maxRedemptions) return { reason: 'exhausted', message: 'Este código ya se agotó.' }
  if (coupon.onePerCustomer && usedByEmail === true) return { reason: 'already_used', message: 'Este código ya se usó con su correo.' }
  if (coupon.minSubtotal != null && subtotal < coupon.minSubtotal) return { reason: 'min_subtotal', message: `Este código aplica en compras desde ${pesos(coupon.minSubtotal)}.` }
  return null
}

/**
 * Cotización con el mismo cálculo que QuoteOrder del servidor. El envío de cortesía se evalúa con la mercancía
 * **después** del descuento. Sin CP, `shippingCost` es null (salvo envío gratis) y el total es solo la mercancía.
 */
export function quoteWithCoupon(subtotal, postalCode, coupon, config) {
  const discount = discountFor(coupon, subtotal)
  const merchandise = round2(subtotal - discount)
  const freeByCoupon = coupon?.type === 'free_shipping'
  if (!/^\d{5}$/.test(postalCode ?? '')) {
    const missing = freeByCoupon ? 0 : Math.max(0, config.freeShippingThreshold - merchandise)
    return { subtotal, discount, deliveryMethod: null, shippingCost: freeByCoupon ? 0 : null, total: merchandise, freeShippingRemaining: missing > 0 ? round2(missing) : null }
  }
  const shipping = quoteShippingLocal(postalCode, merchandise, config)
  const cost = freeByCoupon ? 0 : shipping.cost
  const thresholdApplies = shipping.method === 'paqueteria' || config.localFreeShipping
  const missing = cost > 0 && thresholdApplies ? Math.max(0, config.freeShippingThreshold - merchandise) : 0
  return {
    subtotal,
    discount,
    deliveryMethod: shipping.method,
    shippingCost: cost,
    total: round2(merchandise + cost),
    freeShippingRemaining: missing > 0 ? round2(missing) : null,
  }
}

/** Texto del aviso al aplicar: "Se aplicó su código: 10% de descuento". */
export const appliedToast = (preview) => `Se aplicó su código: ${preview.description}`

/** Código guardado en la pestaña para no perderlo al recargar. */
export function readSavedCoupon() {
  try {
    const code = window.sessionStorage.getItem(COUPON_STORAGE_KEY)
    return code && isCouponCodeShape(code) ? code : null
  } catch {
    return null
  }
}

export function saveCoupon(code) {
  try {
    if (code) window.sessionStorage.setItem(COUPON_STORAGE_KEY, code)
    else window.sessionStorage.removeItem(COUPON_STORAGE_KEY)
  } catch {
    /* sin almacenamiento: el código vive solo en memoria */
  }
}
