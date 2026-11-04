// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminDataProvider } from '../context/AdminDataContext'
import { ToastProvider } from '../context/ToastContext'
import { __resetForTests } from '../services/adminApi'
import { byText, click, flush, render, type } from '../test/dom'
import Promotions from './Promotions'

vi.setConfig({ testTimeout: 15_000 })
const MOCK_LATENCY = 600

const OWNER = { name: 'Aiko Morales', role: 'dueno' }

let view
beforeEach(() => {
  window.localStorage.clear()
  __resetForTests()
})
afterEach(() => view?.unmount())

async function open() {
  view = await render(
    <AdminDataProvider user={OWNER}>
      <ToastProvider>
        <Promotions />
      </ToastProvider>
    </AdminDataProvider>,
  )
  await flush(MOCK_LATENCY)
  return view.container
}

const rowOf = (page, code) => page.querySelector(`tr[data-coupon="${code}"]`)
const toastText = () => document.querySelector('[role="status"]')?.textContent ?? ''

describe('Promociones (Dueño, con el mock)', () => {
  it('tabla con tipo y valor, vigencia, usos, descuento otorgado y estado', async () => {
    const page = await open()

    const welcome = rowOf(page, 'BIENVENIDA10')
    expect(welcome.textContent).toContain('10%')
    expect(welcome.textContent).toContain('Sin vencimiento')
    expect(welcome.textContent).toContain('1 por cliente')
    expect(welcome.textContent).toContain('Activo')
    expect(rowOf(page, 'ENVIOGRATIS').textContent).toContain('Envío gratis')
    expect(rowOf(page, 'BUENFIN-2026').textContent).toContain('0 / 50')
    expect(rowOf(page, 'BUENFIN-2026').textContent).toContain('Programado')
    expect(rowOf(page, 'VERANO25').textContent).toContain('Vencido')
    // Un cupón usado no ofrece "Borrar"; uno sin usos sí.
    expect(byText(welcome, 'button', 'Borrar')).toBeUndefined()
    expect(byText(rowOf(page, 'VERANO25'), 'button', 'Borrar')).not.toBeUndefined()
  })

  it('filtra por estado y busca por código', async () => {
    const page = await open()

    await click(byText(page, '[role="tab"]', 'Vencido'))
    expect([...page.querySelectorAll('tr[data-coupon]')].map((r) => r.dataset.coupon)).toEqual(['VERANO25'])

    await click(byText(page, '[role="tab"]', 'Todos'))
    await type(page.querySelector('#coupons-q'), 'envio')
    expect([...page.querySelectorAll('tr[data-coupon]')].map((r) => r.dataset.coupon)).toEqual(['ENVIOGRATIS'])
  })

  it('crea un cupón con validación en vivo y vista previa en texto', async () => {
    const page = await open()
    await click(byText(page, 'button', 'Nuevo cupón'))
    const panel = document.querySelector('[role="dialog"][aria-label="Nuevo cupón"]')

    const code = panel.querySelector('input[maxlength="30"]')
    await type(code, 'ab')
    expect(panel.textContent).toContain('El código lleva de 3 a 30 letras sin acentos, números o guiones.')

    await click(byText(panel, 'button', 'Generar código'))
    expect(code.value).toMatch(/^[A-HJ-KM-NP-Z2-9]{8}$/)
    await type(code, 'buen fin 26')
    expect(code.value).toBe('BUENFIN26')

    const inputs = [...panel.querySelectorAll('input[inputmode]')]
    await type(inputs[0], '15') // porcentaje
    await type(inputs[1], '500') // compra mínima
    await click(panel.querySelector('input[type="checkbox"]'))
    expect(panel.textContent).toContain('15% de descuento en compras desde $500, una vez por cliente')

    await click(byText(panel, 'button', 'Crear cupón'))
    await flush(MOCK_LATENCY)

    expect(toastText()).toContain('Se creó el cupón BUENFIN26')
    expect(rowOf(page, 'BUENFIN26').textContent).toContain('15%')
  })

  it('desactivar avisa con "Deshacer", que lo vuelve a activar', async () => {
    const page = await open()

    await click(byText(rowOf(page, 'ENVIOGRATIS'), 'button', 'Desactivar'))
    await flush(MOCK_LATENCY)
    expect(toastText()).toContain('ENVIOGRATIS quedó inactivo')
    expect(rowOf(page, 'ENVIOGRATIS').textContent).toContain('Inactivo')

    await click(byText(document.querySelector('[role="status"]'), 'button', 'Deshacer'))
    await flush(MOCK_LATENCY)
    expect(rowOf(page, 'ENVIOGRATIS').textContent).toContain('Activo')
  })

  it('borrar pide confirmación y solo aplica a cupones sin usos', async () => {
    const page = await open()

    await click(byText(rowOf(page, 'VERANO25'), 'button', 'Borrar'))
    const dialog = document.querySelector('[role="alertdialog"]')
    expect(dialog.textContent).toContain('¿Borrar VERANO25?')
    await click(byText(dialog, 'button', 'Borrar cupón'))
    await flush(MOCK_LATENCY)

    expect(rowOf(page, 'VERANO25')).toBeNull()
    expect(toastText()).toContain('Se borró VERANO25')
  })
})
