import { describe, expect, it } from 'vitest'
import { CONTACT_EMAIL_ERROR, normalizeContactEmail, validateContactEmail } from './contact'

describe('correo de contacto de la tienda', () => {
  it('vacío es válido y se guarda como null', () => {
    expect(validateContactEmail('')).toBe('')
    expect(validateContactEmail('   ')).toBe('')
    expect(validateContactEmail(null)).toBe('')
    expect(normalizeContactEmail('  ')).toBeNull()
  })

  it('se guarda sin espacios y en minúsculas', () => {
    expect(normalizeContactEmail('  Hola@SOKKO.mx ')).toBe('hola@sokko.mx')
    expect(validateContactEmail('  Hola@SOKKO.mx ')).toBe('')
  })

  it.each(['hola', 'hola@sokko', 'hola @sokko.mx', `${'a'.repeat(250)}@sokko.mx`])('rechaza "%s"', (email) => {
    expect(validateContactEmail(email)).toBe(CONTACT_EMAIL_ERROR)
  })
})
