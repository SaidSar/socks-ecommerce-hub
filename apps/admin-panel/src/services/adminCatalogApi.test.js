import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSettings, normalizeErrors, problemToError, productBody, saveSettings } from './adminCatalogApi'

afterEach(() => vi.unstubAllGlobals())

describe('versión de Configuración (R-25)', () => {
  it('una recarga posterior no cambia la versión con la que guarda el formulario', async () => {
    const bodies = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => {
        if (options.method === 'PUT') bodies.push(JSON.parse(options.body))
        return new Response(JSON.stringify({ rowVersion: 'ajena' }), { headers: { 'content-type': 'application/json' } })
      }),
    )
    // Invitar a alguien recarga los datos de la página: la lectura trae la versión que dejó otra persona.
    await getSettings()
    await saveSettings({ freeShippingThreshold: 799, rowVersion: 'del-formulario' })
    expect(bodies[0].rowVersion).toBe('del-formulario')
  })
})

describe('errores de la API', () => {
  it('validación: campos en camelCase, primer mensaje y aviso general', () => {
    const err = problemToError(400, { title: 'One or more validation errors occurred.', errors: { PostalCode: ['Mal'], 'barcode:ACC-001-NEG-U': ['Repetido'] } })
    expect(err.status).toBe(400)
    expect(err.message).toBe('Revisa los campos marcados.')
    expect(err.errors).toEqual({ postalCode: 'Mal', 'barcode:ACC-001-NEG-U': 'Repetido' })
  })

  it('conflicto: conserva el mensaje para el usuario y los errores por campo', () => {
    const err = problemToError(409, { title: 'Ya existe la marca Nike.', errors: { name: 'Ya existe la marca Nike.' } })
    expect(err.message).toBe('Ya existe la marca Nike.')
    expect(err.errors).toEqual({ name: 'Ya existe la marca Nike.' })
  })

  it('sin campos no agrega errors, y sin cuerpo da un mensaje útil', () => {
    expect(problemToError(409, { title: 'Otra persona modificó este registro.' }).errors).toBeUndefined()
    expect(problemToError(500, null).message).toContain('No pudimos conectar')
    expect(normalizeErrors(undefined)).toBeUndefined()
  })
})

describe('productBody', () => {
  it('solo manda lo que acepta la API y conserva la versión del registro', () => {
    const body = productBody({ slug: 'x', line: 'marcas', name: 'N', nameJp: '', material: 'M', brand: 'nike', type: 'calcetas', collection: null, unitsPerPack: 1, price: 10, unitCost: null, colors: ['NEG'], barcodes: {}, rowVersion: 'abc', extra: 1 })
    expect(body).toMatchObject({ nameJp: null, material: 'M', rowVersion: 'abc' })
    expect(body).not.toHaveProperty('slug')
    expect(body).not.toHaveProperty('extra')
  })
})
