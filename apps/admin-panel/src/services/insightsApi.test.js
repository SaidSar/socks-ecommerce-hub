import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './adminApi'

const OWNER = { name: 'Aiko Morales', role: 'dueno' }
const OPS = { name: 'Daniel Ruiz', role: 'operaciones' }

beforeEach(() => api.__resetForTests())

describe('mock: clientes', () => {
  it('lista paginada con cuentas e invitados; Operaciones recibe 403', async () => {
    const list = await api.getCustomers({}, OWNER)
    expect(list.pageSize).toBe(25)
    expect(list.counts.cuenta).toBeGreaterThan(0)
    expect(list.counts.invitados).toBeGreaterThan(0)
    expect(list.counts.todos).toBe(list.counts.cuenta + list.counts.invitados)
    await expect(api.getCustomers({}, OPS)).rejects.toMatchObject({ status: 403 })
  })

  it('detalle con pedidos y favoritos (solo cuentas)', async () => {
    const { customers } = await api.getCustomers({ type: 'cuenta', sort: 'pedidos' }, OWNER)
    const detail = await api.getCustomer({ id: customers[0].id }, OWNER)
    expect(detail.orders.length).toBe(customers[0].orders + detail.orders.filter((o) => o.status === 'cancelado').length)
    expect(detail.favorites).toEqual(expect.any(Number))
    const guest = (await api.getCustomers({ type: 'invitados' }, OWNER)).customers[0]
    expect((await api.getCustomer({ email: guest.email.toUpperCase() }, OWNER)).favorites).toBeNull()
  })

  it('exportes CSV con BOM', async () => {
    const { blob, fileName } = await api.exportCustomers({ type: 'cuenta' }, OWNER)
    expect(fileName).toMatch(/^sokko-clientes-\d{4}-\d{2}-\d{2}\.csv$/)
    const text = await blob.text()
    expect(text.startsWith('Nombre,Correo,Tipo')).toBe(true) // Blob.text() quita el BOM al decodificar
    expect(new Uint8Array(await blob.arrayBuffer()).slice(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]))
    expect(text).not.toContain('Invitado')
    expect((await api.exportMarketing(OWNER)).fileName).toMatch(/^sokko-contactos-novedades-/)
  })
})

describe('mock: reportes', () => {
  it('reporte del periodo y 403 para Operaciones', async () => {
    const report = await api.getSalesReport({ from: '2026-10-01', to: '2026-10-31' }, OWNER)
    expect(report.daily).toHaveLength(31)
    expect(report.kpis.sales.value).toBeGreaterThan(0)
    expect(report.prevFrom).toBe('2026-08-31')
    await expect(api.getSalesReport({ from: '2026-10-01', to: '2026-10-31' }, OPS)).rejects.toMatchObject({ status: 403 })
  })

  it('rango inválido como la API', async () => {
    await expect(api.getSalesReport({ from: '2026-10-31', to: '2026-10-01' }, OWNER)).rejects.toMatchObject({ status: 422, errors: { to: expect.any(String) } })
  })

  it('CSV del mes para el contador', async () => {
    const { blob, fileName } = await api.downloadSalesCsv({ from: '2026-10-01', to: '2026-10-31' }, OWNER)
    expect(fileName).toBe('sokko-ventas-2026-10.csv')
    const [header, ...rows] = (await blob.text()).trim().split('\r\n')
    expect(header).toBe('Folio,Fecha (hora de Los Mochis),Cliente,Correo,Método de pago,Estado de pago,Estado del pedido,Subtotal,Envío,IVA incluido,Total')
    expect(rows.length).toBe(34)
    expect(rows[0]).toMatch(/^SKK-\d+,2026-10-\d{2} \d{2}:\d{2},/)
  })
})

describe('mock: mensajes', () => {
  it('pestañas con contador para los dos roles', async () => {
    const list = await api.getMessages({ status: 'nuevos' }, OPS)
    expect(list.counts).toEqual({ nuevos: 3, leidos: 2, archivados: 1 })
    expect(list.messages.map((m) => m.createdAt)).toEqual([...list.messages.map((m) => m.createdAt)].sort().reverse())
    expect(await api.getUnreadCount(OPS)).toBe(3)
    expect(list.messages[0]).not.toHaveProperty('ipAddress')
  })

  it('leer, deshacer y archivar son idempotentes y registran quién', async () => {
    const [first] = (await api.getMessages({ status: 'nuevos' }, OWNER)).messages
    const read = await api.updateMessage(first.id, 'read', OPS)
    expect(read.readAt).toBeTruthy()
    expect(read.handledBy).toBe('Daniel R.')
    const again = await api.updateMessage(first.id, 'read', OWNER)
    expect(again).toMatchObject({ readAt: read.readAt, handledBy: 'Daniel R.' })
    expect(await api.getUnreadCount(OWNER)).toBe(2)
    await api.updateMessage(first.id, 'unread', OWNER)
    expect(await api.getUnreadCount(OWNER)).toBe(3)
    const archived = await api.updateMessage(first.id, 'archive', OWNER)
    expect(archived).toMatchObject({ handledBy: 'Aiko M.' })
    expect((await api.getMessages({ status: 'archivados' }, OWNER)).counts.archivados).toBe(2)
  })

  it('búsqueda sin acentos y filtro desconocido', async () => {
    expect((await api.getMessages({ status: 'nuevos', q: 'CULIACAN' }, OWNER)).total).toBe(1)
    await expect(api.getMessages({ status: 'todos' }, OWNER)).rejects.toMatchObject({ status: 400 })
  })
})

describe('API real: rutas y descargas', () => {
  const OK = { 'content-type': 'application/json' }
  let calls

  beforeEach(() => {
    calls = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options = {}) => {
        const path = String(url).replace(/^https?:\/\/[^/]+/, '')
        calls.push({ path, method: options.method, headers: options.headers })
        if (path.includes('.csv')) {
          return new Response('﻿Folio\r\n', { status: 200, headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename=sokko-ventas-2026-11.csv' } })
        }
        if (path.endsWith('unread-count')) return new Response(JSON.stringify({ count: 4 }), { status: 200, headers: OK })
        return new Response(JSON.stringify({}), { status: 200, headers: OK })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('clientes: filtros en la query y detalle de invitado por correo', async () => {
    const customers = await import('./adminCustomersApi')
    await customers.getCustomers({ type: 'invitados', q: 'lópez', sort: 'total', page: 2 })
    await customers.getCustomers({ type: 'todos', q: '', sort: 'ultima_compra', page: 1 })
    await customers.getCustomer({ email: 'Ana@correo.mx' })
    expect(calls.map((c) => c.path)).toEqual([
      '/api/admin/customers?type=invitados&q=l%C3%B3pez&sort=total&page=2',
      '/api/admin/customers?sort=ultima_compra',
      '/api/admin/customers/guest?email=Ana%40correo.mx',
    ])
  })

  it('reportes: el CSV se baja con el token en el encabezado, nunca en la URL', async () => {
    const reports = await import('./adminReportsApi')
    const { fileName, blob } = await reports.downloadSalesCsv({ from: '2026-11-01', to: '2026-11-30' })
    expect(fileName).toBe('sokko-ventas-2026-11.csv')
    expect(blob.size).toBeGreaterThan(0)
    expect(calls[0].path).toBe('/api/admin/reports/sales.csv?from=2026-11-01&to=2026-11-30')
    expect(calls[0].path).not.toMatch(/token|bearer/i)
    expect(calls[0].headers.Authorization).toMatch(/^Bearer /)
  })

  it('mensajes: acciones por POST y contador', async () => {
    const messages = await import('./adminMessagesApi')
    await messages.updateMessage(7, 'archive')
    expect(await messages.getUnreadCount()).toBe(4)
    await messages.getMessages({ status: 'leidos', q: 'talla' })
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/admin/messages/7/archive',
      'GET /api/admin/messages/unread-count',
      'GET /api/admin/messages?status=leidos&q=talla',
    ])
    expect(() => messages.updateMessage(7, 'delete')).toThrow()
  })
})
