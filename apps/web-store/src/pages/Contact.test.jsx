// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { CONTACT_MESSAGES, CONTACT_SUBJECTS } from '../domain/contact'
import { ContactError, sendContactMessage } from '../services/contactService'
import { flush, render, submit, type } from '../test/dom'
import { ContactForm } from './Contact'

vi.mock('../services/contactService', async (importOriginal) => ({
  ...(await importOriginal()),
  sendContactMessage: vi.fn(),
}))

let view
beforeEach(() => vi.clearAllMocks())
afterEach(() => view?.unmount())

async function renderForm() {
  view = await render(
    <MemoryRouter>
      <ContactForm />
    </MemoryRouter>,
  )
  return view.container
}

const field = (page, id) => page.querySelector(`#contact-${id}`)

async function fill(page, values = {}) {
  const v = { name: 'Ana Prueba', email: 'ana@sokko.test', subject: CONTACT_SUBJECTS[0], message: '¿Cuándo llega mi pedido SKK-1001?', ...values }
  await type(field(page, 'name'), v.name)
  await type(field(page, 'email'), v.email)
  await type(field(page, 'subject'), v.subject)
  await type(field(page, 'message'), v.message)
}

describe('formulario de contacto', () => {
  it('vacío no se envía: marca los cuatro campos, avisa cuántos son y enfoca el primero', async () => {
    const page = await renderForm()

    await submit(page.querySelector('form'))
    await flush()

    expect(sendContactMessage).not.toHaveBeenCalled()
    const invalid = [...page.querySelectorAll('[aria-invalid="true"]')].map((el) => el.id)
    expect(invalid).toEqual(['contact-name', 'contact-email', 'contact-subject', 'contact-message'])
    expect(page.querySelector('[role="alert"]').textContent).toBe('Hay 4 campos por revisar.')
    expect(document.activeElement).toBe(field(page, 'name'))
    expect(page.querySelector('#contact-message-err').textContent).toBe(CONTACT_MESSAGES.messageEmpty)
  })

  it('el error de un campo se va al corregirlo', async () => {
    const page = await renderForm()
    await submit(page.querySelector('form'))

    await type(field(page, 'name'), 'Ana')

    expect(field(page, 'name').getAttribute('aria-invalid')).toBe('false')
  })

  it('con datos válidos envía y muestra el sello "Mensaje recibido"', async () => {
    vi.mocked(sendContactMessage).mockResolvedValue()
    const page = await renderForm()
    await fill(page)

    await submit(page.querySelector('form'))

    expect(sendContactMessage).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana Prueba', email: 'ana@sokko.test', website: '' }))
    expect(page.textContent).toContain('Mensaje recibido')
    expect(page.textContent).toContain('届')
    // Sin el formulario, el foco pasa al título de la confirmación.
    expect(document.activeElement.textContent).toBe('Mensaje recibido')
  })

  it('si la API limita los envíos, lo explica y conserva lo escrito', async () => {
    vi.mocked(sendContactMessage).mockImplementation(async () => {
      throw new ContactError('RATE_LIMITED')
    })
    const page = await renderForm()
    await fill(page)

    await submit(page.querySelector('form'))

    expect(page.querySelector('[role="alert"]').textContent).toBe(CONTACT_MESSAGES.rateLimited)
    expect(field(page, 'name').value).toBe('Ana Prueba')
  })

  it('un fallo de red muestra el error genérico', async () => {
    vi.mocked(sendContactMessage).mockImplementation(async () => {
      throw new ContactError('NETWORK')
    })
    const page = await renderForm()
    await fill(page)

    await submit(page.querySelector('form'))

    expect(page.querySelector('[role="alert"]').textContent).toBe(CONTACT_MESSAGES.network)
  })

  it('los errores por campo de la API (ProblemDetails) se muestran en su campo', async () => {
    vi.mocked(sendContactMessage).mockImplementation(async () => {
      throw new ContactError('VALIDATION', { email: 'Revise el formato del correo.' })
    })
    const page = await renderForm()
    await fill(page)

    await submit(page.querySelector('form'))
    await flush()

    expect(field(page, 'email').getAttribute('aria-invalid')).toBe('true')
    expect(page.querySelector('#contact-email-err').textContent).toBe('Revise el formato del correo.')
  })

  it('el honeypot está fuera de la vista y del orden de tabulación', async () => {
    const page = await renderForm()
    const honeypot = field(page, 'website')

    expect(honeypot.tabIndex).toBe(-1)
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
