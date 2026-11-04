// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { SESSION_KEY } from '../services/authService'
import { __resetWishlistMemory } from '../services/wishlistService'
import { flush, render } from '../test/dom'

// El catálogo mock tarda; se espera con temporizadores reales.
vi.setConfig({ testTimeout: 15_000 })
const MOCK_LATENCY = 1500
const SESSION = { id: 'u-test', firstName: 'Ana', lastName: 'Prueba', email: 'ana@sokko.test', preferredSize: 'M', marketingOptIn: false, memberSince: '2026-01-01T00:00:00.000Z' }

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

const crumbs = (page) => [...page.querySelectorAll('nav[aria-label="Ruta"] li')].map((li) => li.textContent.replace(/\/$/, ''))
const currentCrumb = (page) => page.querySelector('nav[aria-label="Ruta"] [aria-current="page"]').textContent
// El encabezado repite las líneas en escritorio y en la fila deslizable del celular.
const activeLines = (page) => [...page.querySelectorAll('header nav[aria-label="Líneas"] [aria-current="page"]')].map((a) => a.getAttribute('href'))

describe('dónde está', () => {
  it('página de línea: la línea activa en el encabezado, migas y título', async () => {
    const page = await visit('/linea/sokko')

    expect(new Set(activeLines(page))).toEqual(new Set(['/linea/sokko']))
    expect(crumbs(page)).toEqual(['Inicio', currentCrumb(page)])
    expect(document.title).toBe(`${currentCrumb(page)} · SOKKO`)
  })

  it('ficha de producto: Inicio / Línea / Producto y su línea activa en el encabezado', async () => {
    const line = await visit('/linea/sokko')
    const href = line.querySelector('a[href^="/producto/"]').getAttribute('href')
    view.unmount()

    const page = await visit(href)
    const name = page.querySelector('h1').textContent

    expect(crumbs(page)).toHaveLength(3)
    expect(crumbs(page)[0]).toBe('Inicio')
    expect(page.querySelector('nav[aria-label="Ruta"] a[href="/linea/sokko"]')).not.toBeNull()
    expect(currentCrumb(page)).toBe(name)
    expect(new Set(activeLines(page))).toEqual(new Set(['/linea/sokko']))
    expect(document.title).toBe(`${name} · SOKKO`)
  })

  it('detalle de pedido: Inicio / Su cuenta / Mis pedidos / folio, con Cuenta activa y la pestaña marcada', async () => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION))

    const page = await visit('/cuenta/pedidos/SKK-1001')

    expect(crumbs(page)).toEqual(['Inicio', 'Su cuenta', 'Mis pedidos', 'SKK-1001'])
    expect(document.title).toBe('Pedido SKK-1001 · SOKKO')
    expect(page.querySelector('header button[aria-label="Cuenta de Ana"]').getAttribute('aria-current')).toBe('page')
    expect(page.querySelector('nav[aria-label="Su cuenta"] [aria-current="page"]').textContent).toBe('Mis pedidos')
  })

  it('favoritos marca Favoritos en el encabezado, no Cuenta', async () => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION))

    const page = await visit('/cuenta/favoritos')

    expect(page.querySelector('header a[href="/cuenta/favoritos"]').getAttribute('aria-current')).toBe('page')
    expect(page.querySelector('header button[aria-label="Cuenta de Ana"]').getAttribute('aria-current')).toBeNull()
  })

  it.each([
    ['/envios', 'Envíos'],
    ['/preguntas-frecuentes', 'Preguntas frecuentes'],
    ['/contacto', 'Contacto'],
    ['/rastreo', 'Rastrear pedido'],
  ])('%s lleva migas y su título', async (path, title) => {
    const page = await visit(path)

    expect(crumbs(page)).toEqual(['Inicio', title])
    expect(document.title).toBe(`${title} · SOKKO`)
  })
})
