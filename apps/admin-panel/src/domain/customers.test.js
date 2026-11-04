import { describe, expect, it } from 'vitest'
import { csvCell, guardCell, toCsv } from './csv'
import { buildCustomers, customersCsv, marketingCsv, queryCustomers } from './customers'

const order = (email, extra = {}) => ({
  created: '2026-11-01T18:00:00Z',
  status: 'entregado',
  paymentStatus: 'pagado',
  total: 499,
  customer: { name: 'Ana López', email },
  ...extra,
})

describe('clientes', () => {
  const accounts = [{ id: 1, name: 'Beto Ruiz', email: 'beto@correo.mx', preferredSize: 'M', marketingOptIn: true, createdAt: '2026-01-01T18:00:00Z' }]
  const orders = [
    order('ana@correo.mx'),
    order('ANA@correo.mx ', { created: '2026-11-03T18:00:00Z' }),
    order('ana@correo.mx', { status: 'cancelado', paymentStatus: 'reembolsado' }),
    order('ana@correo.mx', { status: 'por_preparar', paymentStatus: 'pendiente' }),
    order('beto@correo.mx', { customer: { name: 'Beto Ruiz', email: 'beto@correo.mx', userId: 1 }, total: 1200 }),
  ]
  const rows = buildCustomers(orders, accounts)

  it('invitados agrupados por correo sin importar mayúsculas; totales sin cancelados', () => {
    const ana = rows.find((r) => r.kind === 'invitado')
    expect(rows).toHaveLength(2)
    expect(ana).toMatchObject({ email: 'ana@correo.mx', orders: 3, spent: 998, lastOrderAt: '2026-11-03T18:00:00Z', marketingOptIn: false })
    expect(rows.find((r) => r.kind === 'cuenta')).toMatchObject({ id: 1, orders: 1, spent: 1200, preferredSize: 'M' })
  })

  it('búsqueda sin acentos, tipo y orden', () => {
    expect(queryCustomers(rows, { q: 'LOPEZ' }).customers.map((r) => r.email)).toEqual(['ana@correo.mx'])
    expect(queryCustomers(rows, { type: 'cuenta' }).customers.map((r) => r.id)).toEqual([1])
    expect(queryCustomers(rows, { sort: 'total' }).customers[0].id).toBe(1)
    expect(queryCustomers(rows, { sort: 'pedidos' }).customers[0].kind).toBe('invitado')
    expect(queryCustomers(rows, { q: 'nadie' })).toMatchObject({ total: 0, counts: { todos: 0, cuenta: 0, invitados: 0 } })
  })

  it('exportes: lista filtrada y solo quienes aceptaron novedades', () => {
    const list = customersCsv(rows)
    expect(list.startsWith('﻿Nombre,Correo,Tipo,')).toBe(true)
    expect(list).toContain('Ana López,ana@correo.mx,Invitado,3,998.00,2026-11-03,,No,2026-11-01')
    const marketing = marketingCsv(rows)
    expect(marketing).toContain('beto@correo.mx')
    expect(marketing).not.toContain('ana@correo.mx')
  })
})

describe('CSV', () => {
  it('ninguna celda de texto se vuelve fórmula', () => {
    for (const start of ['=', '+', '-', '@', '\t', '\r']) expect(guardCell(`${start}1`)).toBe(`'${start}1`)
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"')
    expect(csvCell(-3)).toBe('-3')
    expect(csvCell(10, { money: true })).toBe('10.00')
  })

  it('BOM, coma y CRLF', () => {
    expect(toCsv(['A', 'B'], [['x, y', 2]])).toBe('﻿A,B\r\n"x, y",2\r\n')
  })
})
