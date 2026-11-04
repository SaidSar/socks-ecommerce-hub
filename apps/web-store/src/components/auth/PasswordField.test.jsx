// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { click, render } from '../../test/dom'
import PasswordField from './PasswordField'

// La diagonal del ojo tachado (EyeOffIcon); el ojo abierto no la tiene.
const isCrossed = (button) => Boolean(button.querySelector('path[d="M3 3l18 18"]'))

let view
afterEach(() => view?.unmount())

describe('PasswordField', () => {
  it('oculta: ojo tachado; visible: ojo abierto, con la misma etiqueta y aria-pressed', async () => {
    view = await render(<PasswordField id="pw" label="Contraseña" value="secreta" onChange={() => {}} />)
    const input = view.container.querySelector('#pw')
    const button = view.container.querySelector('button')

    expect(input.type).toBe('password')
    expect(button.getAttribute('aria-label')).toBe('Mostrar contraseña')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(isCrossed(button)).toBe(true)

    await click(button)

    expect(input.type).toBe('text')
    expect(button.getAttribute('aria-label')).toBe('Mostrar contraseña')
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(isCrossed(button)).toBe(false)
  })
})
