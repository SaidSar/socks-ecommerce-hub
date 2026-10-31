import { beforeEach, describe, expect, it } from 'vitest'
import { TEST_CARDS, tokenizeCard } from './paymentToken'
import { __resetMockOrders, getOrder, OrderError, placeOrder, quoteShipping, simulateOxxoPayment } from './orderService'

const payload = (over = {}) => ({
  firstName: 'Ana',
  lastName: 'López',
  email: 'Ana@correo.mx',
  phone: '6681234567',
  street: 'Calle 1',
  neighborhood: 'Centro',
  city: 'Los Mochis',
  state: 'Sinaloa',
  postalCode: '06700',
  references: '',
  giftWrap: true,
  paymentMethod: 'tarjeta',
  paymentToken: 'tok_fake_approved',
  items: [{ sku: 'SKK-007-SUM-M', slug: 'tabi-origami-noche', quantity: 1 }],
  ...over,
})

const fails = async (promise) => {
  try {
    await promise
  } catch (err) {
    return err
  }
  throw new Error('Debía fallar')
}

beforeEach(() => __resetMockOrders())

describe('tokenizeCard', () => {
  it('nunca incluye el número y distingue los rechazos de prueba', () => {
    expect(tokenizeCard('4242 4242 4242 4242')).toBe('tok_fake_approved')
    expect(tokenizeCard(TEST_CARDS.declined)).toBe('tok_fake_declined')
    expect(tokenizeCard('4000 0000 0000 9995')).toBe('tok_fake_insufficient_funds')
    expect(tokenizeCard('4111111111111111')).not.toContain('4111')
  })
})

describe('placeOrder con el mock', () => {
  it('tarjeta: pagado, con totales calculados y no los del cliente', async () => {
    const order = await placeOrder(payload({ price: 1, total: 1 }), 'k1')
    expect(order).toMatchObject({
      paymentStatus: 'pagado',
      status: 'por_preparar',
      deliveryMethod: 'paqueteria',
      subtotal: 420,
      shippingCost: 99,
      total: 519,
      taxIncluded: 71.59,
      email: 'ana@correo.mx',
    })
    expect(order.items[0]).toMatchObject({ sku: 'SKK-007-SUM-M', unitPrice: 420, quantity: 1 })
    expect(order.folio).toMatch(/^SKK-\d+$/)
  })

  it('envío local con CP de Los Mochis', async () => {
    expect(await placeOrder(payload({ postalCode: '81200' }), 'k1')).toMatchObject({ deliveryMethod: 'local', shippingCost: 49 })
  })

  it('tarjeta rechazada: error, sin pedido ni apartado', async () => {
    const err = await fails(placeOrder(payload({ paymentToken: tokenizeCard(TEST_CARDS.declined) }), 'k1'))
    expect(err).toBeInstanceOf(OrderError)
    expect(err).toMatchObject({ code: 'DECLINED', declineCode: 'declined' })
    // La unidad sigue disponible.
    await expect(placeOrder(payload({ items: [{ sku: 'SKK-003-WAS-S', slug: 'kintsugi-washi', quantity: 1 }] }), 'k2')).resolves.toBeTruthy()
  })

  it('fondos insuficientes', async () => {
    expect(await fails(placeOrder(payload({ paymentToken: 'tok_fake_insufficient_funds' }), 'k1'))).toMatchObject({ declineCode: 'insufficient_funds' })
  })

  it('sin existencias por línea: la última unidad solo se vende una vez', async () => {
    const lastUnit = { sku: 'SKK-003-WAS-S', slug: 'kintsugi-washi', quantity: 1 }
    await placeOrder(payload({ items: [lastUnit] }), 'k1')
    const err = await fails(placeOrder(payload({ items: [lastUnit] }), 'k2'))
    expect(err).toMatchObject({ code: 'OUT_OF_STOCK', lines: [{ sku: lastUnit.sku, requested: 1, available: 0 }] })
    expect(await fails(placeOrder(payload({ items: [{ sku: 'SKK-003-SUM-S', slug: 'kintsugi-washi', quantity: 1 }] }), 'k3'))).toMatchObject({ code: 'OUT_OF_STOCK' })
  })

  it('total esperado distinto: no se cobra', async () => {
    expect(await fails(placeOrder(payload({ expectedTotal: 1 }), 'k1'))).toMatchObject({ code: 'PRICE_CHANGED', total: 519 })
  })

  it('el precio sale del catálogo, no de la bolsa', async () => {
    const order = await placeOrder(payload({ items: [{ sku: 'ACC-001-NEG-U', slug: 'gorro-de-punto', quantity: 2 }] }), 'k1')
    expect(order).toMatchObject({ subtotal: 498, total: 597 })
  })
})

describe('OXXO y consulta con el mock', () => {
  it('queda pendiente con referencia y vence a las 72 h', async () => {
    const order = await placeOrder(payload({ paymentMethod: 'oxxo_pay', paymentToken: null }), 'k1')
    expect(order).toMatchObject({ paymentStatus: 'pendiente', paidAt: null })
    expect(order.paymentReference).toMatch(/^93\d{12}$/)
    expect(new Date(order.oxxoExpiresAt) - new Date(order.createdAt)).toBe(72 * 3600e3)
  })

  it('el pago simulado lo marca pagado', async () => {
    const { folio } = await placeOrder(payload({ paymentMethod: 'oxxo_pay', paymentToken: null }), 'k1')
    expect(await simulateOxxoPayment(folio)).toMatchObject({ paymentStatus: 'pagado', oxxoExpiresAt: null })
    expect((await getOrder(folio)).timeline.map((t) => t.status)).toEqual(['por_preparar', 'pagado'])
  })

  it('un folio inexistente devuelve null', async () => {
    expect(await getOrder('SKK-9999')).toBeNull()
  })

  it('cotización del mock', async () => {
    expect(await quoteShipping('81250', 100)).toEqual({ method: 'local', cost: 49 })
  })
})
