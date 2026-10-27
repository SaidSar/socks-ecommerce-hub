import { describe, expect, it } from 'vitest'
import { effectivePrice, isInSeason, localDate, parseDate } from './season'

const navidad = { kind: 'temporada', startMonth: 11, startDay: 1, endMonth: 1, endDay: 6, offSeasonDiscountPct: 0.3 }
const halloween = { kind: 'temporada', startMonth: 10, startDay: 1, endMonth: 11, endDay: 2, offSeasonDiscountPct: 0.3 }
const anime = { kind: 'tematica' }
const d = (month, day) => ({ month, day })

describe('isInSeason (R-28)', () => {
  it('ventana normal: extremos inclusivos', () => {
    expect(isInSeason(halloween, d(9, 30))).toBe(false)
    expect(isInSeason(halloween, d(10, 1))).toBe(true)
    expect(isInSeason(halloween, d(10, 26))).toBe(true)
    expect(isInSeason(halloween, d(11, 2))).toBe(true)
    expect(isInSeason(halloween, d(11, 3))).toBe(false)
  })

  it('ventana que cruza de año (1-nov → 6-ene)', () => {
    expect(isInSeason(navidad, d(10, 31))).toBe(false)
    expect(isInSeason(navidad, d(11, 1))).toBe(true)
    expect(isInSeason(navidad, d(11, 30))).toBe(true)
    expect(isInSeason(navidad, d(12, 31))).toBe(true)
    expect(isInSeason(navidad, d(1, 6))).toBe(true)
    expect(isInSeason(navidad, d(1, 7))).toBe(false)
  })

  it('ventana 1-dic → 6-ene: 30-nov fuera, 31-dic y 3-ene dentro, 7-ene fuera', () => {
    const dic = { ...navidad, startMonth: 12, startDay: 1 }
    expect([d(11, 30), d(12, 31), d(1, 3), d(1, 7)].map((x) => isInSeason(dic, x))).toEqual([false, true, true, false])
  })

  it('temática o sin colección: siempre en temporada', () => {
    expect(isInSeason(anime, d(3, 20))).toBe(true)
    expect(isInSeason(null, d(3, 20))).toBe(true)
  })
})

describe('effectivePrice (R-29)', () => {
  it('fuera de temporada: 199 → 139.30', () => {
    expect(effectivePrice(199, navidad, d(10, 26))).toEqual({ price: 139.3, listPrice: 199, offSeason: true, offSeasonPct: 30 })
  })
  it('temporada activa: precio base', () => {
    expect(effectivePrice(199, navidad, d(12, 15))).toMatchObject({ price: 199, offSeason: false, offSeasonPct: 0 })
  })
  it('temática y sin colección: precio base', () => {
    expect(effectivePrice(239, anime, d(3, 20)).price).toBe(239)
    expect(effectivePrice(420, null, d(3, 20)).price).toBe(420)
  })
  it('redondea a centavos', () => {
    expect(effectivePrice(179, halloween, d(12, 15)).price).toBe(125.3)
    expect(effectivePrice(189, halloween, d(12, 15)).price).toBe(132.3)
  })
})

describe('fechas', () => {
  it('localDate usa America/Mazatlan (UTC−7)', () => {
    // 2026-12-15 05:00 UTC es todavía el 14 de diciembre en Los Mochis.
    expect(localDate(new Date('2026-12-15T05:00:00Z'))).toEqual({ year: 2026, month: 12, day: 14 })
    expect(localDate(new Date('2026-12-15T08:00:00Z'))).toEqual({ year: 2026, month: 12, day: 15 })
  })
  it('parseDate acepta AAAA-MM-DD válidas', () => {
    expect(parseDate('2026-10-26')).toEqual({ year: 2026, month: 10, day: 26 })
    expect(parseDate('2026-02-30')).toBeNull()
    expect(parseDate('26-10-2026')).toBeNull()
  })
})
