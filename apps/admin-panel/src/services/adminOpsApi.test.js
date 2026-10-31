import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const OK = { 'content-type': 'application/json' }

/** Responde según la ruta y guarda cada llamada. */
function stubFetch(routes = {}) {
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, '')
      calls.push({ path, method: options.method, body: options.body ? JSON.parse(options.body) : undefined })
      const match = Object.keys(routes).find((r) => path.startsWith(r))
      const [status, body] = routes[match] ?? [200, {}]
      return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: OK })
    }),
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('forma de las respuestas', () => {
  let ops
  beforeEach(async () => {
    ops = await import('./adminOpsApi')
  })

  it('pedidos: el filtro va en status y `count` vuelve a ser `total`', async () => {
    const calls = stubFetch({ '/api/admin/orders': [200, { orders: [], counts: {}, count: 34, now: 'x' }] })
    const list = await ops.getOrders({ filter: 'late', q: 'lópez' })
    expect(calls[0].path).toBe('/api/admin/orders?status=late&q=l%C3%B3pez')
    expect(list.total).toBe(34)
    await ops.getOrders({ filter: 'todos', q: '' })
    expect(calls[1].path).toBe('/api/admin/orders')
  })

  it('inventario: `stats` vuelve a ser `totals` y el kárdex nunca lleva nota vacía', async () => {
    const calls = stubFetch({
      '/api/admin/inventory/SKU/movements': [200, [{ type: 'entrada', note: null }]],
      '/api/admin/inventory': [200, { rows: [], counts: {}, stats: { units: 3 }, few: 4, count: 120 }],
    })
    const list = await ops.getInventory({ filter: 'alertas', q: '' })
    expect(calls[0].path).toBe('/api/admin/inventory?state=alertas')
    expect(list).toMatchObject({ totals: { units: 3 }, total: 120 })
    expect((await ops.getMovements('SKU'))[0].note).toBe('—')
  })

  it('movimiento: cantidad numérica y el error de validación llega a su campo', async () => {
    const calls = stubFetch({ '/api/admin/inventory/SKU/movements': [400, { title: 'x', errors: { Qty: ['No puede sacar más de 2 unidades.'] } }] })
    await expect(ops.adjustStock('SKU', { type: 'merma', qty: '3', note: 'Mancha', rowVersion: 'v1' })).rejects.toMatchObject({
      status: 400,
      field: 'qty',
      message: 'No puede sacar más de 2 unidades.',
    })
    expect(calls[0].body).toMatchObject({ type: 'merma', qty: 3, rowVersion: 'v1' })
  })

  it('un conflicto conserva el mensaje del servidor', async () => {
    stubFetch({ '/api/admin/orders/SKK-1/transitions': [409, { title: 'Otra persona modificó este registro.' }] })
    await expect(ops.advanceOrder('SKK-1', { status: 'preparando', rowVersion: 'v1' })).rejects.toMatchObject({ status: 409, message: 'Otra persona modificó este registro.' })
  })

  it('dashboard: cada temporada lleva su estado de hoy', async () => {
    stubFetch({
      '/api/admin/dashboard': [200, { catalog: { today: { year: 2026, month: 10, day: 30 }, seasons: [{ slug: 'navidad', kind: 'temporada', startMonth: 11, startDay: 1, endMonth: 1, endDay: 6, stock: 1 }] } }],
    })
    const { catalog } = await ops.getDashboard('hoy')
    expect(catalog.seasons[0].status).toBeDefined()
  })

  it('importación: el servidor recibe las filas válidas como CSV', async () => {
    const calls = stubFetch({ '/api/admin/inventory/import': [200, { applied: 1, skipped: 0 }] })
    await ops.applyImport([{ sku: 'A', piece: 'P', tone: 'T', size: 'M', stock: 5, extra: {} }])
    expect(calls[0].body.csv).toBe('SKU,Pieza,Tono,Talla,Stock\nA,P,T,M,5')
  })
})

describe('con la API activa', () => {
  it('ninguna función de las pantallas toca el mock', async () => {
    vi.stubEnv('VITE_API_URL', 'http://api.test')
    vi.stubEnv('VITE_USE_MOCKS', 'false')
    const calls = stubFetch({
      '/api/admin/dashboard': [200, { catalog: { today: {}, seasons: [] } }],
      '/api/admin/inventory/SKU/movements': [200, []],
      '/api/admin/inventory/NUEVO/movements': [200, { row: {}, movement: {} }],
      '/api/admin/inventory/import/template': [200, 'SKU'],
      '/api/admin/inventory': [200, { rows: [], stats: {} }],
      '/api/admin/catalog': [200, { collections: [] }],
    })
    const api = await import('./adminApi')
    const user = { name: 'Aiko Morales', role: 'dueno' }
    const screens = [
      () => api.getSummary(),
      () => api.getDashboard('hoy', 'dueno'),
      () => api.getOrders({ filter: 'todos', q: '' }, 'dueno'),
      () => api.getOrder('SKK-1', 'dueno'),
      () => api.advanceOrder('SKK-1', { status: 'preparando', rowVersion: 'v' }, user),
      () => api.cancelOrder('SKK-1', user, 'v'),
      () => api.markOrderPaid('SKK-1', user, 'v'),
      () => api.saveOrderNote('SKK-1', 'nota', user, 'v'),
      () => api.getCouriers(),
      () => api.getPackingList('SKK-1'),
      () => api.getInventory({ filter: 'todos', q: '' }),
      () => api.getStockRow('SKU'),
      () => api.getMovements('SKU'),
      () => api.adjustStock('NUEVO', { type: 'entrada', qty: '1', rowVersion: 'v' }, user),
      () => api.previewImport('SKU', 'dueno'),
      () => api.applyImport([], user),
      () => api.getTemplateCsv('dueno'),
      () => api.getCatalog('dueno'),
      () => api.getSettings(),
      () => api.getInternalUsers(),
    ]
    for (const call of screens) {
      const before = calls.length
      await call()
      expect(calls.length).toBeGreaterThan(before)
    }
  })

  it('leer el mock por error falla en vez de mostrar datos falsos', async () => {
    vi.stubEnv('VITE_API_URL', 'http://api.test')
    vi.stubEnv('VITE_USE_MOCKS', 'false')
    const api = await import('./adminApi')
    await expect(api.getCatalogSummary('dueno')).rejects.toThrow('mock')
    await expect(api.quoteShipping({ subtotal: 1, postalCode: '81250' })).rejects.toThrow('mock')
    await expect(api.resetDemoData()).rejects.toThrow('mock')
  })
})
