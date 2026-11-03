import { afterEach, describe, expect, it, vi } from 'vitest'
import { deleteProductImage, getSettings, normalizeErrors, problemToError, productBody, reorderProductImages, saveSettings, setProductImageAlt, uploadProductImage } from './adminCatalogApi'

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

describe('fotos de producto', () => {
  const calls = []
  const stubFetch = (status = 200, body = { images: [], rowVersion: 'v2' }) => {
    calls.length = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        calls.push({ url, ...options })
        return new Response(JSON.stringify(body), { status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } })
      }),
    )
  }

  it('sube multipart sin Content-Type propio, para que el navegador ponga el separador', async () => {
    stubFetch(201)
    const result = await uploadProductImage(12, new Blob(['x'], { type: 'image/webp' }), 'Frente')
    expect(result.rowVersion).toBe('v2')
    expect(calls[0].url).toMatch(/\/api\/admin\/products\/12\/images$/)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].headers['Content-Type']).toBeUndefined()
    expect(calls[0].body.get('altText')).toBe('Frente')
    expect(calls[0].body.get('file').name).toBe('foto.webp')
  })

  it('reordenar, texto alternativo y borrar van a sus rutas', async () => {
    stubFetch()
    await reorderProductImages(12, [3, 1])
    await setProductImageAlt(12, 3, '')
    await deleteProductImage(12, 3)
    expect(calls.map((c) => `${c.method} ${c.url.replace(/^.*\/api/, '/api')}`)).toEqual([
      'PUT /api/admin/products/12/images/order',
      'PUT /api/admin/products/12/images/3',
      'DELETE /api/admin/products/12/images/3',
    ])
    expect(JSON.parse(calls[0].body)).toEqual({ imageIds: [3, 1] })
    expect(JSON.parse(calls[1].body)).toEqual({ altText: null })
  })

  it('un 413 llega con el mensaje de la API', async () => {
    stubFetch(413, { title: 'La foto pesa más de 5 MB.', status: 413 })
    await expect(uploadProductImage(12, new Blob(['x'], { type: 'image/webp' }))).rejects.toMatchObject({ status: 413, message: 'La foto pesa más de 5 MB.' })
  })
})
