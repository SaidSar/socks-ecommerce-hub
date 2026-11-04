import { describe, expect, it } from 'vitest'
import { CONTACT_MESSAGES, CONTACT_SUBJECTS, MESSAGE_MAX, validateContact } from './contact'

const valid = { name: 'Ana', email: 'ana@sokko.test', subject: CONTACT_SUBJECTS[0], message: '¿Cuándo llega mi pedido?', website: '' }

describe('validateContact', () => {
  it('un mensaje completo no tiene errores', () => {
    expect(validateContact(valid)).toEqual({})
  })

  it('marca cada campo vacío con su mensaje', () => {
    expect(validateContact({ name: ' ', email: '', subject: '', message: '', website: '' })).toEqual({
      name: CONTACT_MESSAGES.name,
      email: 'Escriba su correo electrónico.',
      subject: CONTACT_MESSAGES.subject,
      message: CONTACT_MESSAGES.messageEmpty,
    })
  })

  it('el asunto debe ser uno de la lista', () => {
    expect(validateContact({ ...valid, subject: 'Cualquier cosa' })).toEqual({ subject: CONTACT_MESSAGES.subject })
  })

  it('el mensaje va de 10 a 2000 caracteres, sin contar espacios a los lados', () => {
    expect(validateContact({ ...valid, message: '   corto   ' }).message).toBe(CONTACT_MESSAGES.messageShort)
    expect(validateContact({ ...valid, message: 'x'.repeat(MESSAGE_MAX + 1) }).message).toBe(CONTACT_MESSAGES.messageLong)
    expect(validateContact({ ...valid, message: 'x'.repeat(MESSAGE_MAX) })).toEqual({})
  })

  it('revisa el formato del correo', () => {
    expect(validateContact({ ...valid, email: 'ana@sokko' }).email).toMatch(/formato/)
  })
})
