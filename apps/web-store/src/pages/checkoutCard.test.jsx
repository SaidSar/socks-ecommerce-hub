// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { __resetWishlistMemory } from '../services/wishlistService'
import { click, flush, render, type } from '../test/dom'

// El catálogo mock tarda; se espera con temporizadores reales.
vi.setConfig({ testTimeout: 15_000 })
const MOCK_LATENCY = 1500

let view
beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  __resetWishlistMemory()
})
afterEach(() => view?.unmount())

async function visit(path) {
  window.history.pushState({}, '', path)
  view = await render(<App />)
  await flush(MOCK_LATENCY)
  return view.container
}

const toasts = () => document.querySelector('[role="status"][aria-live="polite"].fixed')
const buttonByText = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.startsWith(text))

/** Agrega a la bolsa la primera pieza de SOKKO con la primera talla disponible. */
async function addFirstProduct() {
  const line = await visit('/linea/sokko')
  const href = line.querySelector('a[href^="/producto/"]').getAttribute('href')
  view.unmount()
  const page = await visit(href)
  const sizes = [...page.querySelectorAll('fieldset')].find((f) => f.querySelector('legend')?.textContent.startsWith('Talla'))
  const size = sizes.querySelector('button[aria-pressed="false"]')
  if (size) await click(size)
  await click(buttonByText(page, 'Agregar a la bolsa'))
  await flush(50)
  return page
}

describe('bolsa', () => {
  it('al agregar, el aviso confirma y "Ver bolsa" la abre', async () => {
    await addFirstProduct()

    expect(toasts().textContent).toContain('Se agregó a su bolsa')
    await click(buttonByText(toasts(), 'Ver bolsa'))
    await flush(50)

    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  })
})

describe('checkout: marca de la tarjeta', () => {
  async function checkout() {
    await addFirstProduct()
    view.unmount()
    return visit('/checkout')
  }

  it('vacío muestra las marcas aceptadas; con Visa, su logotipo, el aviso y 4-4-4-4', async () => {
    const page = await checkout()
    const input = page.querySelector('#checkout-cardNumber')

    expect(input.getAttribute('inputmode')).toBe('numeric')
    expect(input.getAttribute('autocomplete')).toBe('cc-number')
    const accepted = [...page.querySelectorAll('ul[aria-label="Tarjetas aceptadas"] svg')].map((svg) => svg.getAttribute('aria-label'))
    expect(accepted).toEqual(['Visa', 'Mastercard', 'American Express'])

    await type(input, '4242424242424242')

    expect(input.value).toBe('4242 4242 4242 4242')
    expect(input.parentElement.querySelector('svg[aria-label="Visa"]')).not.toBeNull()
    expect(page.querySelector('[aria-live="polite"].sr-only').textContent).toBe('Tarjeta Visa')
    expect(page.querySelector('ul[aria-label="Tarjetas aceptadas"]')).toBeNull()
    expect(page.querySelector('label[for="checkout-cardCvc"]').textContent).toBe('CVC')
  })

  it('con American Express agrupa 4-6-5 y pide el CVC de 4 dígitos al frente', async () => {
    const page = await checkout()
    const input = page.querySelector('#checkout-cardNumber')

    await type(input, '378282246310005999')

    expect(input.value).toBe('3782 822463 10005')
    expect(input.parentElement.querySelector('svg[aria-label="American Express"]')).not.toBeNull()
    expect(page.querySelector('label[for="checkout-cardCvc"]').textContent).toBe('CVC (4 dígitos al frente)')
    expect(page.querySelector('#checkout-cardCvc').getAttribute('maxlength')).toBe('4')
  })

  it('muestra los pasos y marca el de la sección con el foco', async () => {
    const page = await checkout()
    const current = () => page.querySelector('nav[aria-label="Pasos del pedido"] [aria-current="step"]').textContent

    expect([...page.querySelectorAll('nav[aria-label="Pasos del pedido"] li')].map((li) => li.textContent.replace(/^\d/, ''))).toEqual(['Datos', 'Envío', 'Pago'])
    expect(current()).toContain('Datos')

    page.querySelector('#checkout-cardNumber').focus()
    await flush(0)

    expect(current()).toContain('Pago')
  })
})
