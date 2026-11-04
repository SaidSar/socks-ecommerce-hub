// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { DEMO_ACCOUNT, SESSION_KEY } from '../services/authService'
import { __resetWishlistMemory } from '../services/wishlistService'
import { click, flush, render, submit, type } from '../test/dom'

// Sesión del modo mock (sin API basta con el usuario guardado; ver authService.getSession).
const SESSION = { id: 'u-test', firstName: 'Ana', lastName: 'Prueba', email: 'ana@sokko.test', preferredSize: 'M', marketingOptIn: false, memberSince: '2026-01-01T00:00:00.000Z' }
// Las latencias simuladas del mock llegan a 1.3 s.
const MOCK_LATENCY = 1500
// Esperan latencias y el cierre de 4 s con temporizadores reales.
vi.setConfig({ testTimeout: 15_000 })

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
  await flush(200)
  return view.container
}

const signedIn = () => window.localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION))
const here = () => `${window.location.pathname}${window.location.search}`
const toasts = () => document.querySelector('[role="status"][aria-live="polite"].fixed')

async function register(email) {
  const page = await visit('/cuenta/registro')
  await type(page.querySelector('#reg-first'), 'Lucía')
  await type(page.querySelector('#reg-last'), 'Prueba')
  await type(page.querySelector('#reg-email'), email)
  await type(page.querySelector('#reg-pw'), 'Atelier2026!')
  await type(page.querySelector('#reg-pw2'), 'Atelier2026!')
  await click(page.querySelector('#terms'))
  await submit(page.querySelector('form'))
  await flush(MOCK_LATENCY)
}

async function logIn(page) {
  await type(page.querySelector('#login-email'), DEMO_ACCOUNT.email)
  await type(page.querySelector('#login-pw'), DEMO_ACCOUNT.password)
  await submit(page.querySelector('form'))
  await flush(MOCK_LATENCY)
}

describe('después de entrar', () => {
  it('iniciar sesión lleva al inicio y saluda con un aviso', async () => {
    const page = await visit('/cuenta')

    await logIn(page)

    expect(here()).toBe('/')
    expect(toasts().textContent).toMatch(/^Hola de nuevo, .+\./)
  })

  it('con ?redirect= válido respeta el destino', async () => {
    const page = await visit('/cuenta?redirect=/cuenta/perfil')

    await logIn(page)

    expect(here()).toBe('/cuenta/perfil')
    expect(toasts().textContent).toContain('Hola de nuevo')
  })

  it('un ?redirect= a otro dominio se ignora y lleva al inicio', async () => {
    const page = await visit('/cuenta?redirect=//sitio-ajeno.test')

    await logIn(page)

    expect(here()).toBe('/')
  })

  it('crear cuenta lleva al inicio con la bienvenida', async () => {
    await register('lucia@sokko.test')

    expect(here()).toBe('/')
    expect(toasts().textContent).toContain('Bienvenida a SOKKO, Lucía. Su cuenta está lista.')
  })
})

describe('Mi perfil al guardar', () => {
  it('"Guardar cambios" no hace nada sin cambios; al guardar pasa por Guardando… y Guardado ✓ y avisa', async () => {
    signedIn()
    const page = await visit('/cuenta/perfil')
    const form = page.querySelector('form[aria-labelledby="datos-t"]')
    const button = form.querySelector('button[type="submit"]')

    expect(button.getAttribute('aria-disabled')).toBe('true')

    await type(page.querySelector('#profile-first'), 'Anabel')
    expect(button.getAttribute('aria-disabled')).toBeNull()

    await submit(form)
    expect(button.textContent).toBe('Guardando…')
    expect(button.getAttribute('aria-disabled')).toBe('true')

    await flush(MOCK_LATENCY)
    expect(button.textContent).toBe('Guardado ✓')
    expect(toasts().textContent).toContain('Sus datos se guardaron.')
    // El encabezado toma el nombre nuevo.
    expect(document.querySelector('button[aria-label="Cuenta de Anabel"]')).not.toBeNull()

    await flush(2100)
    expect(button.textContent).toBe('Guardar cambios')
    expect(button.getAttribute('aria-disabled')).toBe('true')
  })

  it('cambiar la contraseña con éxito limpia los campos, quita el foco y avisa', async () => {
    // Una cuenta nueva del mock, para que la contraseña actual exista en su base.
    await register('ana.clave@sokko.test')
    view.unmount()

    const profile = await visit('/cuenta/perfil')
    const pwForm = profile.querySelector('form[aria-labelledby="clave-t"]')
    await type(profile.querySelector('#profile-pw-current'), 'Atelier2026!')
    await type(profile.querySelector('#profile-pw-new'), 'Kioto2027!x')
    await type(profile.querySelector('#profile-pw-confirm'), 'Kioto2027!x')
    profile.querySelector('#profile-pw-confirm').focus()

    await submit(pwForm)
    await flush(MOCK_LATENCY)

    expect(toasts().textContent).toContain('Su contraseña se cambió.')
    expect(['#profile-pw-current', '#profile-pw-new', '#profile-pw-confirm'].map((id) => profile.querySelector(id).value)).toEqual(['', '', ''])
    expect(pwForm.contains(document.activeElement)).toBe(false)
  })

  it('con la contraseña actual equivocada, el error queda junto al campo y recibe el foco', async () => {
    signedIn()
    const page = await visit('/cuenta/perfil')
    const pwForm = page.querySelector('form[aria-labelledby="clave-t"]')
    await type(page.querySelector('#profile-pw-current'), 'NoEsLaClave1!')
    await type(page.querySelector('#profile-pw-new'), 'Kioto2027!x')
    await type(page.querySelector('#profile-pw-confirm'), 'Kioto2027!x')

    await submit(pwForm)
    await flush(MOCK_LATENCY)

    expect(page.querySelector('#profile-pw-current-err').textContent).toBe('La contraseña actual no coincide.')
    expect(document.activeElement.id).toBe('profile-pw-current')
  })
})

describe('aviso flotante', () => {
  it('favoritos: al agregar ofrece verlos y al quitar, deshacer', async () => {
    const page = await visit('/linea/sokko')
    await flush(MOCK_LATENCY)
    const heart = page.querySelector('button[aria-pressed="false"][aria-label^="Agregar a favoritos"]')

    await click(heart)
    await flush(50)
    expect(toasts().textContent).toContain('Se agregó a favoritos')
    expect(toasts().querySelector('a[href="/cuenta/favoritos"]').textContent).toBe('Ver favoritos')

    await click(heart)
    await flush(50)
    expect(toasts().textContent).toContain('Se quitó de favoritos')
    expect(heart.getAttribute('aria-pressed')).toBe('false')

    const undo = [...toasts().querySelectorAll('button')].find((b) => b.textContent === 'Deshacer')
    await click(undo)
    await flush(50)
    expect(heart.getAttribute('aria-pressed')).toBe('true')
  })

  it('se cierra con el botón y solo, a los 4 s', async () => {
    const page = await visit('/linea/sokko')
    await flush(MOCK_LATENCY)
    const heart = page.querySelector('button[aria-label^="Agregar a favoritos"]')

    await click(heart)
    await flush(50)
    await click(toasts().querySelector('button[aria-label="Cerrar aviso"]'))
    expect(toasts().textContent).toBe('')

    await click(heart)
    await flush(4100)
    expect(toasts().textContent).toBe('')
  })
})
