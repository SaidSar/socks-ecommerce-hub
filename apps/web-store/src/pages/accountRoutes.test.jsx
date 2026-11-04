// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../App'
import { SESSION_KEY } from '../services/authService'
import { __resetWishlistMemory } from '../services/wishlistService'
import { flush, render } from '../test/dom'

// Sesión del modo mock (sin API basta con el usuario guardado; ver authService.getSession).
const SESSION = { id: 'u-test', firstName: 'Ana', lastName: 'Prueba', email: 'ana@sokko.test', preferredSize: 'M', marketingOptIn: false, memberSince: '2026-01-01T00:00:00.000Z' }

let view
beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  __resetWishlistMemory()
})
afterEach(() => view?.unmount())

/** La app completa en `path`, como al recargar en el navegador. */
async function visit(path) {
  window.history.pushState({}, '', path)
  view = await render(<App />)
  await flush(200)
  return view.container
}

const signedIn = () => window.localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION))
const here = () => `${window.location.pathname}${window.location.search}`

describe('rutas de cuenta sin sesión', () => {
  it.each(['/cuenta/perfil', '/cuenta/pedidos', '/cuenta/pedidos/SKK-1001'])('%s lleva a iniciar sesión y vuelve después', async (path) => {
    await visit(path)

    expect(here()).toBe(`/cuenta?redirect=${path}`)
  })

  it('favoritos no pide sesión: muestra la lista local e invita a entrar', async () => {
    const page = await visit('/cuenta/favoritos')

    expect(here()).toBe('/cuenta/favoritos')
    expect(page.querySelector('h1').textContent).toBe('Favoritos')
    expect(page.textContent).toContain('Aún no tiene favoritos')
    expect(page.querySelector('a[href="/cuenta?redirect=/cuenta/favoritos"]')).not.toBeNull()
    expect(page.querySelector('nav[aria-label="Su cuenta"]')).toBeNull()
  })

  it('rastrear pedido es público', async () => {
    const page = await visit('/rastreo')

    expect(here()).toBe('/rastreo')
    expect(page.querySelector('h1').textContent).toBe('Rastrear pedido')
    expect(document.title).toBe('Rastrear pedido · SOKKO')
  })
})

describe('rutas de cuenta con sesión', () => {
  it('Mi perfil muestra los datos, el correo de solo lectura y las pestañas', async () => {
    signedIn()

    const page = await visit('/cuenta/perfil')

    expect(here()).toBe('/cuenta/perfil')
    expect(document.title).toBe('Mi perfil · SOKKO')
    expect(page.querySelector('#profile-first').value).toBe('Ana')
    expect(page.querySelector('#profile-email').readOnly).toBe(true)
    expect(page.textContent).toContain('Para cambiar su correo, escríbanos')
    const tabs = [...page.querySelectorAll('nav[aria-label="Su cuenta"] li')].map((li) => li.textContent)
    expect(tabs).toEqual(['Mis pedidos', 'Mi perfil', 'Favoritos', 'Cerrar sesión'])
    expect(page.querySelector('nav[aria-label="Su cuenta"] [aria-current="page"]').textContent).toBe('Mi perfil')
  })

  it('el detalle de un pedido ajeno o inexistente no rompe la vista', async () => {
    signedIn()

    const page = await visit('/cuenta/pedidos/SKK-9999')

    expect(here()).toBe('/cuenta/pedidos/SKK-9999')
    expect(page.textContent).toContain('No encontramos este pedido en su cuenta.')
    expect(page.querySelector('nav[aria-label="Su cuenta"] [aria-current="page"]').textContent).toBe('Mis pedidos')
  })

  it('con sesión, iniciar sesión lleva directo al ?redirect=', async () => {
    signedIn()

    await visit('/cuenta?redirect=/cuenta/perfil')

    expect(here()).toBe('/cuenta/perfil')
  })
})
