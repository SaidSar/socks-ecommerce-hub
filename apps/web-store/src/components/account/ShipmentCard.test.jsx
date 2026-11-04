// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { click, flush, render } from '../../test/dom'
import ShipmentCard from './ShipmentCard'

const SHIPPED = '2026-11-02T18:00:00Z'

const order = (deliveryMethod, shipment, status = 'enviado') => ({ folio: 'SKK-1050', status, deliveryMethod, shipment })

let view
afterEach(() => view?.unmount())

describe('tarjeta Envío', () => {
  it('con DHL: paquetería, guía y enlace en pestaña nueva', async () => {
    view = await render(<ShipmentCard order={order('paqueteria', { carrier: 'dhl_express', trackingNumber: '952368132413', courierName: null, shippedAt: SHIPPED, deliveredAt: null })} />)
    const card = view.container

    expect(card.textContent).toContain('DHL Express')
    expect(card.textContent).toContain('952368132413')
    const link = card.querySelector('a')
    expect(link.textContent).toContain('Rastrear en la paquetería')
    expect(link.getAttribute('href')).toBe('https://www.dhl.com/mx-es/home/rastreo.html?tracking-id=952368132413')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('el botón copia la guía y lo anuncia', async () => {
    let copied = null
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => (copied = text) } })
    view = await render(<ShipmentCard order={order('paqueteria', { carrier: 'estafeta', trackingNumber: '486243357777', courierName: null, shippedAt: SHIPPED, deliveredAt: null })} />)

    await click([...view.container.querySelectorAll('button')].find((b) => b.textContent.startsWith('Copiar')))
    await flush()

    expect(copied).toBe('486243357777')
    expect(view.container.querySelector('[role="status"]').textContent).toBe('Guía copiada.')
  })

  it('entrega local: repartidor y Los Mochis, sin enlace', async () => {
    view = await render(<ShipmentCard order={order('local', { carrier: null, trackingNumber: null, courierName: 'Daniel Ruiz', shippedAt: SHIPPED, deliveredAt: null }, 'en_ruta')} />)

    expect(view.container.textContent).toContain('Daniel Ruiz')
    expect(view.container.textContent).toContain('Entrega local en Los Mochis')
    expect(view.container.querySelector('a')).toBeNull()
  })

  it('sin envío todavía avisa que la guía llega por correo', async () => {
    view = await render(<ShipmentCard order={order('paqueteria', null, 'preparando')} />)

    expect(view.container.textContent).toContain('Le enviaremos la guía por correo cuando su pedido salga del atelier.')
  })

  it('un pedido cancelado sin envío no muestra la tarjeta', async () => {
    view = await render(<ShipmentCard order={order('paqueteria', null, 'cancelado')} />)

    expect(view.container.textContent).toBe('')
  })
})
