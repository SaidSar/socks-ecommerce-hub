// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { COUPON_STORAGE_KEY } from '../domain/coupons'
import { getProductSync } from '../services/catalogService'
import { __resetMockOrders } from '../services/orderService'
import { __resetWishlistMemory } from '../services/wishlistService'
import { click, flush, render, type } from '../test/dom'

vi.setConfig({ testTimeout: 20_000 })
const MOCK_LATENCY = 1500

let view
beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  __resetWishlistMemory()
  __resetMockOrders()
})
afterEach(() => view?.unmount())

/** Bolsa con `qty` piezas (por omisión Tabi Origami Noche, $420), sin pasar por la ficha. */
function seedCart(qty, slug = 'tabi-origami-noche') {
  const product = getProductSync(slug)
  const variant = product.variants.find((v) => v.stock >= qty)
  const color = product.colors.find((c) => c.code === variant.color)
  const line = {
    key: `${product.slug}-${variant.color}-${variant.size}`,
    sku: variant.sku,
    slug: product.slug,
    line: product.line,
    name: product.name,
    art: product.art,
    price: product.price,
    listPrice: product.listPrice,
    unit: 'par',
    color,
    size: variant.size,
    sizeLabel: `Talla ${variant.size}`,
    qty,
    max: variant.stock,
  }
  window.localStorage.setItem('sokko.cart.v3', JSON.stringify({ items: [line], giftWrap: true }))
  return product.price
}

async function checkout() {
  window.history.pushState({}, '', '/checkout')
  view = await render(<App />)
  await flush(MOCK_LATENCY)
  return view.container
}

const aside = (page) => page.querySelector('aside[aria-label="Su pedido"]')
const byText = (root, selector, text) => [...root.querySelectorAll(selector)].find((el) => el.textContent.trim().startsWith(text))
const toasts = () => document.querySelector('[role="status"][aria-live="polite"].fixed')?.textContent ?? ''
const totalOf = (page) => aside(page).querySelector('dl dd.font-serif').textContent

async function applyCode(page, code) {
  const box = aside(page)
  await click(byText(box, 'button', '¿Tiene un código de descuento?'))
  await type(box.querySelector('#summary-coupon'), code)
  await click(byText(box, 'button', 'Aplicar'))
  await flush(MOCK_LATENCY)
}

describe('checkout: código de descuento', () => {
  it('aplica BIENVENIDA10: chip, línea verde, total y aviso; "Quitar" lo deshace', async () => {
    const price = seedCart(1)
    const page = await checkout()

    await applyCode(page, 'bienvenida10')

    const box = aside(page)
    expect(box.textContent).toContain('BIENVENIDA10')
    const discount = byText(box, 'dl div', 'Descuento (BIENVENIDA10)')
    expect(discount.className).toContain('text-matcha')
    expect(discount.textContent).toContain(`−$${(price * 0.1).toFixed(2)}`)
    expect(totalOf(page)).toContain(`$${(price * 0.9).toFixed(2)}`)
    expect(toasts()).toContain('Se aplicó su código: 10% de descuento')
    expect(window.sessionStorage.getItem(COUPON_STORAGE_KEY)).toBe('BIENVENIDA10')

    await click(box.querySelector('button[aria-label="Quitar el código BIENVENIDA10"]'))
    expect(byText(box, 'dl div', 'Descuento')).toBeUndefined()
    expect(window.sessionStorage.getItem(COUPON_STORAGE_KEY)).toBeNull()
  })

  it('un código que no existe muestra el motivo junto al campo', async () => {
    seedCart(1)
    const page = await checkout()

    await applyCode(page, 'NOEXISTE')

    const input = aside(page).querySelector('#summary-coupon')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(aside(page).querySelector(`#${input.getAttribute('aria-describedby')}`).textContent).toBe('Este código no existe.')
    expect(toasts()).not.toContain('no existe')
  })

  it('se recotiza al cambiar el CP: el envío y el total salen de la cotización del cupón', async () => {
    const price = seedCart(1)
    const page = await checkout()
    await applyCode(page, 'BIENVENIDA10')
    expect(aside(page).textContent).toContain('para envío de cortesía')

    await type(page.querySelector('#checkout-postalCode'), '06700')
    await flush(MOCK_LATENCY)

    const shipping = byText(aside(page), 'dl div', 'Envío')
    expect(shipping.textContent).toContain('$99.00')
    expect(totalOf(page)).toContain(`$${(price * 0.9 + 99).toFixed(2)}`)
    expect(aside(page).textContent).toContain(`Le faltan $${(799 - price * 0.9).toFixed(2)} para envío de cortesía`)
  })

  it('se conserva al recargar, y si la bolsa ya no llega al mínimo se quita y explica por qué', async () => {
    seedCart(1)
    window.sessionStorage.setItem(COUPON_STORAGE_KEY, 'ENVIOGRATIS')
    const page = await checkout()
    expect(aside(page).querySelector('button[aria-label="Quitar el código ENVIOGRATIS"]')).not.toBeNull()

    view.unmount()
    // La bolsa cambia a una pieza de menos de $300: el mínimo de ENVIOGRATIS ya no se cumple.
    expect(getProductSync('copo-navideno').price).toBeLessThan(300)
    seedCart(1, 'copo-navideno')
    const again = await checkout()

    expect(aside(again).textContent).toContain('Quitamos el código ENVIOGRATIS: Este código aplica en compras desde $300.')
    expect(toasts()).toContain('Quitamos el código ENVIOGRATIS')
    expect(window.sessionStorage.getItem(COUPON_STORAGE_KEY)).toBeNull()
  })

  it('si el servidor lo rechaza al pagar, explica el motivo, quita el código y pide confirmar el total nuevo', async () => {
    const price = seedCart(1)
    const page = await checkout()
    await applyCode(page, 'BIENVENIDA10')

    const fill = async (id, value) => type(page.querySelector(`#checkout-${id}`), value)
    await fill('firstName', 'Ana')
    await fill('lastName', 'López')
    await fill('email', 'ANA@correo.mx')
    await fill('phone', '6681234567')
    await fill('street', 'Calle 1')
    await fill('neighborhood', 'Centro')
    await fill('postalCode', '06700')
    await fill('city', 'CDMX')
    await fill('state', 'CDMX')
    await fill('cardNumber', '4242424242424242')
    await fill('cardName', 'Ana López')
    await fill('cardExpiry', '08/39')
    await fill('cardCvc', '123')
    await flush(MOCK_LATENCY)

    const pay = byText(page, 'button', 'Pagar')
    expect(pay.textContent).toContain(`$${(price * 0.9 + 99).toFixed(2)}`)
    // Mientras tanto, otra compra con el mismo correo usó BIENVENIDA10 (uno por cliente).
    window.localStorage.setItem(
      'sokko.orders.v1',
      JSON.stringify([{ folio: 'SKK-1001', email: 'ana@correo.mx', couponCode: 'BIENVENIDA10', status: 'por_preparar', paymentMethod: 'tarjeta', paymentStatus: 'pagado', items: [] }]),
    )
    await click(pay)
    await flush(MOCK_LATENCY)

    const alert = page.querySelector('[role="alert"]')
    expect(alert.textContent).toContain('Este código ya se usó con su correo.')
    expect(alert.textContent).toContain(`su total ahora es $${(price + 99).toFixed(2)}`)
    expect(byText(page, 'button', 'Pagar').textContent).toContain(`$${(price + 99).toFixed(2)}`)
    expect(aside(page).textContent).toContain('Quitamos el código BIENVENIDA10')
    expect(window.location.pathname).toBe('/checkout')
  })
})
