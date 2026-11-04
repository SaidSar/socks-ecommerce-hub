import { describe, expect, it } from 'vitest'
import { findFolio, relativeTime, replyMailto, snippet, statusOf } from './messages'

describe('folio en el mensaje', () => {
  it('lo encuentra si el asunto es de un pedido', () => {
    expect(findFolio('Mi pedido', '¿Cuándo llega mi pedido SKK-1042?')).toBe('SKK-1042')
    expect(findFolio('Un pedido', 'Es el skk 1042, gracias')).toBe('SKK-1042')
    expect(findFolio('un pedido', 'Pedido SKK1042.')).toBe('SKK-1042')
  })

  it('no lo busca en otros asuntos ni inventa uno', () => {
    expect(findFolio('Tallas y materiales', 'Vi el SKK-1042')).toBeNull()
    expect(findFolio('Mi pedido', 'Todavía no me llega')).toBeNull()
    expect(findFolio('Mi pedido', 'El código SKK-12 no existe')).toBeNull()
    expect(findFolio('Mi pedido', 'XSKK-1042')).toBeNull()
  })
})

describe('bandeja', () => {
  it('estado según las fechas', () => {
    expect(statusOf({ readAt: null, archivedAt: null })).toBe('nuevos')
    expect(statusOf({ readAt: 'x', archivedAt: null })).toBe('leidos')
    expect(statusOf({ readAt: null, archivedAt: 'x' })).toBe('archivados')
  })

  it('fragmento en una línea', () => {
    expect(snippet('Hola\n\n  qué   tal')).toBe('Hola qué tal')
    expect(snippet('a'.repeat(200), 20)).toHaveLength(20)
  })

  it('fecha relativa', () => {
    const now = new Date('2026-11-04T18:00:00Z')
    expect(relativeTime('2026-11-04T17:59:30Z', now)).toBe('hace un momento')
    expect(relativeTime('2026-11-04T17:15:00Z', now)).toBe('hace 45 min')
    expect(relativeTime('2026-11-04T16:00:00Z', now)).toBe('hace 2 h')
    expect(relativeTime('2026-11-03T12:00:00Z', now)).toBe('hace 1 día')
    expect(relativeTime('2026-10-31T12:00:00Z', now)).toBe('hace 4 días')
    expect(relativeTime('2026-10-01T12:00:00Z', now)).toBe('1 oct 2026')
  })
})

describe('responder por correo', () => {
  const message = { name: 'Ana', email: 'ana+test@correo.mx', subject: 'Mi pedido', message: 'Hola\n¿y mi pedido?' }

  it('mailto con "Re:" y el texto citado', () => {
    const url = new URL(replyMailto(message))
    expect(url.protocol).toBe('mailto:')
    expect(decodeURIComponent(url.pathname)).toBe('ana+test@correo.mx')
    expect(url.searchParams.get('subject')).toBe('Re: Mi pedido')
    expect(url.searchParams.get('body')).toContain('Ana escribió:\n> Hola\n> ¿y mi pedido?')
  })

  it('no repite "Re:"', () => {
    expect(new URL(replyMailto({ ...message, subject: 'RE: Hola' })).searchParams.get('subject')).toBe('RE: Hola')
  })
})
