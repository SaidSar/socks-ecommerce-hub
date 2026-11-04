// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { FAQ } from '../content/faq'
import { click, render } from '../test/dom'
import Faq from './Faq'

let view
afterEach(() => view?.unmount())

const questions = (page) => [...page.querySelectorAll('button[aria-controls]')]
const chip = (page, text) => [...page.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent === text)

async function renderFaq() {
  view = await render(
    <MemoryRouter>
      <Faq />
    </MemoryRouter>,
  )
  return view.container
}

describe('Preguntas frecuentes', () => {
  it('tiene entre 10 y 12 preguntas y empieza con la primera abierta', async () => {
    const page = await renderFaq()
    const buttons = questions(page)

    expect(FAQ.length).toBeGreaterThanOrEqual(10)
    expect(FAQ.length).toBeLessThanOrEqual(12)
    expect(buttons).toHaveLength(FAQ.length)
    expect(buttons.map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', ...Array(FAQ.length - 1).fill('false')])
  })

  it('cada pregunta es un button con aria-expanded que controla una región etiquetada por él', async () => {
    const page = await renderFaq()

    for (const button of questions(page)) {
      expect(button.tagName).toBe('BUTTON')
      expect(button.closest('h3')).not.toBeNull()
      const panel = page.querySelector(`#${button.getAttribute('aria-controls')}`)
      expect(panel.getAttribute('role')).toBe('region')
      expect(panel.getAttribute('aria-labelledby')).toBe(button.id)
      expect(panel.hidden).toBe(button.getAttribute('aria-expanded') === 'false')
    }
  })

  it('al pulsar abre y cierra la respuesta', async () => {
    const page = await renderFaq()
    const second = questions(page)[1]
    const panel = page.querySelector(`#${second.getAttribute('aria-controls')}`)

    await click(second)
    expect(second.getAttribute('aria-expanded')).toBe('true')
    expect(panel.hidden).toBe(false)
    expect(panel.textContent.length).toBeGreaterThan(20)

    await click(second)
    expect(second.getAttribute('aria-expanded')).toBe('false')
    expect(panel.hidden).toBe(true)
  })

  it('los chips filtran por tema y marcan el activo con aria-pressed', async () => {
    const page = await renderFaq()

    await click(chip(page, 'Tallas'))
    expect(chip(page, 'Tallas').getAttribute('aria-pressed')).toBe('true')
    expect(chip(page, 'Todas').getAttribute('aria-pressed')).toBe('false')
    expect(questions(page)).toHaveLength(FAQ.filter((f) => f.topic === 'tallas').length)

    await click(chip(page, 'Todas'))
    expect(questions(page)).toHaveLength(FAQ.length)
  })

  it('las tallas salen del catálogo y el envío de la configuración', async () => {
    const page = await renderFaq()

    for (const button of questions(page)) {
      if (button.getAttribute('aria-expanded') === 'false') await click(button)
    }
    expect(page.textContent).toContain('S 22–24 cm')
    expect(page.textContent).toContain('Desde $799 el envío es de cortesía')
  })

  it('termina con un enlace a /contacto', async () => {
    const page = await renderFaq()

    expect(page.querySelector('aside a').getAttribute('href')).toBe('/contacto')
  })
})
