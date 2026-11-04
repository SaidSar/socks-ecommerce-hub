import { describe, expect, it } from 'vitest'
import {
  buildSalesReport,
  daysBetween,
  formatDelta,
  periodFromParams,
  periodKeyOf,
  periodLabel,
  periodRange,
  previousPeriod,
  salesCsvName,
  taxIncluded,
  todayIso,
  validatePeriod,
} from './reports'

describe('periodos del selector', () => {
  it('este mes, últimos 30 días y este año terminan hoy', () => {
    expect(periodRange('mes', '2026-11-04')).toEqual({ from: '2026-11-01', to: '2026-11-04' })
    expect(periodRange('30d', '2026-11-04')).toEqual({ from: '2026-10-06', to: '2026-11-04' })
    expect(periodRange('anio', '2026-11-04')).toEqual({ from: '2026-01-01', to: '2026-11-04' })
  })

  it('mes anterior en enero es diciembre del año pasado', () => {
    expect(periodRange('mes_anterior', '2027-01-15')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })

  it('mes anterior respeta febrero y los bisiestos', () => {
    expect(periodRange('mes_anterior', '2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(periodRange('mes_anterior', '2028-03-01')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('reconoce el periodo de la URL o lo marca como personalizado', () => {
    expect(periodKeyOf('2026-10-01', '2026-10-31', '2026-11-04')).toBe('mes_anterior')
    expect(periodKeyOf('2026-11-01', '2026-11-04', '2026-11-04')).toBe('mes')
    expect(periodKeyOf('2026-10-03', '2026-10-09', '2026-11-04')).toBe('custom')
  })

  it('URL inválida o incompleta cae en este mes', () => {
    const today = '2026-11-04'
    expect(periodFromParams(new URLSearchParams('from=2026-10-03&to=2026-10-09'), today)).toEqual({ from: '2026-10-03', to: '2026-10-09' })
    expect(periodFromParams(new URLSearchParams('from=2026-11-09&to=2026-10-01'), today)).toEqual({ from: '2026-11-01', to: today })
    expect(periodFromParams(new URLSearchParams(''), today)).toEqual({ from: '2026-11-01', to: today })
  })

  it('mismas reglas que la API: fechas válidas, en orden y hasta 366 días', () => {
    expect(validatePeriod('', '2026-11-01')).toHaveProperty('from')
    expect(validatePeriod('2026-11-02', '2026-11-01')).toEqual({ to: 'La fecha final es anterior a la de inicio.' })
    expect(validatePeriod('2025-01-01', '2026-01-02')).toHaveProperty('to')
    expect(validatePeriod('2028-01-01', '2028-12-31')).toEqual({})
    expect(daysBetween('2028-01-01', '2028-12-31')).toBe(366)
  })

  it('el periodo anterior tiene la misma duración', () => {
    expect(previousPeriod('2026-11-01', '2026-11-30')).toEqual({ from: '2026-10-02', to: '2026-10-31' })
    expect(previousPeriod('2026-03-01', '2026-03-01')).toEqual({ from: '2026-02-28', to: '2026-02-28' })
  })

  it('hoy es la fecha de Los Mochis, no la UTC', () => {
    // 06:30 UTC del 5 = 23:30 del 4 en America/Mazatlan.
    expect(todayIso(new Date('2026-11-05T06:30:00Z'))).toBe('2026-11-04')
  })
})

describe('formato de variación', () => {
  it('flecha, signo y texto; el color dice si es bueno', () => {
    expect(formatDelta(12.345)).toEqual({ text: '+12.3 %', dir: 'up', tone: 'good', sr: 'Sube' })
    expect(formatDelta(-4)).toEqual({ text: '−4.0 %', dir: 'down', tone: 'bad', sr: 'Baja' })
  })

  it('en cancelados subir es malo', () => {
    expect(formatDelta(50, { inverse: true }).tone).toBe('bad')
    expect(formatDelta(-50, { inverse: true }).tone).toBe('good')
  })

  it('sin base o sin cambio no pinta flecha', () => {
    expect(formatDelta(null).dir).toBe('none')
    expect(formatDelta(0.01)).toMatchObject({ text: '0.0 %', dir: 'flat', tone: 'neutral' })
  })
})

describe('nombres y etiquetas', () => {
  it('CSV con el mes completo o con el rango', () => {
    expect(salesCsvName('2026-11-01', '2026-11-30')).toBe('sokko-ventas-2026-11.csv')
    expect(salesCsvName('2026-11-01', '2026-11-04')).toBe('sokko-ventas-2026-11-01_a_2026-11-04.csv')
  })

  it('etiqueta corta del periodo', () => {
    expect(periodLabel('2026-11-01', '2026-11-30')).toBe('1 – 30 nov 2026')
    expect(periodLabel('2026-10-15', '2026-11-04')).toBe('15 oct – 4 nov 2026')
  })
})

describe('reporte del mock', () => {
  const order = (created, extra = {}) => ({
    created,
    status: 'entregado',
    paymentStatus: 'pagado',
    subtotal: 400,
    shipping: 99,
    total: 499,
    pay: 'tarjeta',
    delivery: 'paqueteria',
    items: [{ pieceId: 7, name: 'Tabi', qty: 2, price: 200 }],
    ...extra,
  })

  it('venta = pagado y sin cancelar, en su día local', () => {
    const orders = [
      order('2026-11-02T06:30:00Z'), // 23:30 del 1 de noviembre en Los Mochis
      order('2026-11-02T18:00:00Z', { paymentStatus: 'pendiente', pay: 'oxxo_pay' }),
      order('2026-11-02T18:00:00Z', { status: 'cancelado', paymentStatus: 'reembolsado' }),
      order('2026-10-31T18:00:00Z'),
    ]
    const r = buildSalesReport(orders, '2026-11-01', '2026-11-02')
    expect(r.kpis.sales).toEqual({ value: 499, prev: 499, delta: 0 })
    expect(r.kpis.orders.value).toBe(1)
    expect(r.kpis.cancelled.value).toBe(1)
    expect(r.kpis.units.value).toBe(2)
    expect(r.kpis.taxIncluded.value).toBe(taxIncluded(499))
    expect(r.daily.map((d) => d.v)).toEqual([499, 0])
    expect(r.top[0]).toMatchObject({ name: 'Tabi', units: 2, revenue: 400 })
    expect(r.payments).toEqual([
      { method: 'tarjeta', orders: 1, sales: 499 },
      { method: 'oxxo_pay', orders: 0, sales: 0 },
    ])
  })

  it('KPI Descuentos; las ventas son el total cobrado, ya neto del cupón', () => {
    const withCoupon = order('2026-11-02T18:00:00Z', { couponCode: 'BIENVENIDA10', discountAmount: 40, total: 459 })
    const r = buildSalesReport([withCoupon, order('2026-11-02T19:00:00Z')], '2026-11-02', '2026-11-02')
    expect(r.kpis.discounts.value).toBe(40)
    expect(r.kpis.sales.value).toBe(459 + 499)
    expect(r.kpis.taxIncluded.value).toBe(taxIncluded(459) + taxIncluded(499))
  })
})
