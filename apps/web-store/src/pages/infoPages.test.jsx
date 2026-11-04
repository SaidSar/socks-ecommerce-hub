// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import App from '../App'
import { FOOTER_COLUMNS } from '../config/footer'
import { ACADEMIC_NOTICE } from '../content/legal'
import { flush, render } from '../test/dom'

const PAGES = [
  { path: '/nosotros', h1: 'Confort que renace cada paso', title: 'Nosotros · SOKKO' },
  { path: '/contacto', h1: 'Hablemos', title: 'Contacto · SOKKO' },
  { path: '/preguntas-frecuentes', h1: 'Preguntas frecuentes', title: 'Preguntas frecuentes · SOKKO' },
  { path: '/envios', h1: 'Envíos', title: 'Envíos · SOKKO', legal: true },
  { path: '/privacidad', h1: 'Aviso de privacidad', title: 'Aviso de privacidad · SOKKO', legal: true },
  { path: '/terminos', h1: 'Términos y condiciones', title: 'Términos y condiciones · SOKKO', legal: true },
  { path: '/devoluciones', h1: 'Cambios y devoluciones', title: 'Cambios y devoluciones · SOKKO', legal: true },
]

let view
afterEach(() => view?.unmount())

/** La app completa en `path`, como al recargar en el navegador (BrowserRouter lee window.location). */
async function visit(path) {
  window.history.pushState({}, '', path)
  view = await render(<App />)
  await flush(200) // configuración y catálogo mock
  return view.container
}

describe('páginas informativas', () => {
  it.each(PAGES)('$path renderiza con su h1, <title> y meta description', async ({ path, h1, title, legal }) => {
    const page = await visit(path)

    expect(page.querySelector('h1').textContent).toBe(h1)
    expect(document.title).toBe(title)
    expect(document.querySelector('meta[name="description"]').getAttribute('content')).not.toBe('')
    expect(page.textContent.includes(ACADEMIC_NOTICE)).toBe(Boolean(legal))
    if (legal) expect(page.textContent).toMatch(/Última actualización: \d+ de noviembre de 2026/)
  })

  it('envíos muestra los montos de la configuración (mock de GET /api/config)', async () => {
    const page = await visit('/envios')
    const cards = page.querySelector('[aria-label="Tarifas de envío"]').textContent

    expect(cards).toContain('$99')
    expect(cards).toContain('Desde $799')
    expect(cards).toContain('$49')
  })
})

describe('footer', () => {
  it('no tiene enlaces href="#…" ni vacíos', async () => {
    const page = await visit('/nosotros')
    const hrefs = [...page.querySelectorAll('footer a')].map((a) => a.getAttribute('href'))

    expect(hrefs.length).toBeGreaterThan(0)
    expect(hrefs.filter((href) => !href || href.startsWith('#'))).toEqual([])
  })

  it('lleva las secciones Atelier, Ayuda y Legal', async () => {
    const page = await visit('/nosotros')
    const sections = [...page.querySelectorAll('footer nav')].map((nav) => nav.getAttribute('aria-label'))

    expect(sections).toEqual(['Atelier', 'Ayuda', 'Legal'])
  })

  it.each(FOOTER_COLUMNS.flatMap((c) => c.links))('$label lleva a una página que existe', async ({ to }) => {
    const page = await visit(to)

    expect(page.querySelector('h1')?.textContent).not.toBe('No encontramos esta página.')
  })
})
