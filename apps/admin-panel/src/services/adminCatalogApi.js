// Catálogo, configuración y usuarios contra apps/api-service (/api/admin). Devuelve la misma forma que el mock de adminApi.js.
// Las validaciones de domain/ dan la respuesta inmediata en pantalla; la API es la que decide.
import { seasonStatus } from '../domain/catalog'
import { authFetch } from './adminAuth'
import { ApiError } from './apiError'

const NETWORK_MESSAGE = 'No pudimos conectar con el servidor. Intente de nuevo en un momento.'

/** "PostalCode" → "postalCode"; la API puede mandar un mensaje o una lista de mensajes por campo. */
export function normalizeErrors(errors) {
  if (!errors) return undefined
  return Object.fromEntries(
    Object.entries(errors).map(([field, messages]) => [field[0].toLowerCase() + field.slice(1), Array.isArray(messages) ? messages[0] : messages]),
  )
}

/** `ProblemDetails` → ApiError. */
export function problemToError(status, problem) {
  const errors = normalizeErrors(problem?.errors)
  const err = new ApiError(status === 400 && errors ? 'Revisa los campos marcados.' : (problem?.title ?? NETWORK_MESSAGE), status)
  if (errors) err.errors = errors
  return err
}

async function request(method, path, body) {
  let response
  try {
    response = await authFetch(path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(NETWORK_MESSAGE, 0)
  }
  const isJson = response.headers.get('content-type')?.includes('json')
  const data = isJson ? await response.json() : null
  if (!response.ok) throw problemToError(response.status, data)
  return data
}

/** Formulario de producto → cuerpo de POST/PUT. El costo solo lo edita el Dueño: la política de la API lo garantiza. */
export function productBody(form) {
  return {
    line: form.line,
    name: form.name,
    nameJp: form.nameJp || null,
    material: form.material ?? null,
    brand: form.brand,
    type: form.type,
    collection: form.collection,
    unitsPerPack: form.unitsPerPack,
    price: form.price,
    unitCost: form.unitCost,
    colors: form.colors,
    barcodes: form.barcodes,
    rowVersion: form.rowVersion,
  }
}

// ---------------------------------------------------------------- Catálogo

export async function getCatalog() {
  const catalog = await request('GET', '/api/admin/catalog')
  return { ...catalog, collections: catalog.collections.map((c) => ({ ...c, status: seasonStatus(c, catalog.today) })) }
}

export const saveProduct = (form) =>
  form.slug ? request('PUT', `/api/admin/products/${encodeURIComponent(form.slug)}`, productBody(form)) : request('POST', '/api/admin/products', productBody(form))

export const addBrand = (name) => request('POST', '/api/admin/brands', { name: String(name ?? '').trim() })

export const setBrandVisibility = (slug, showInFilters, rowVersion) =>
  request('PUT', `/api/admin/brands/${encodeURIComponent(slug)}`, { showInFilters, rowVersion })

export const saveCollection = (form) =>
  request('PUT', `/api/admin/collections/${encodeURIComponent(form.slug)}`, {
    kind: form.kind,
    startMonth: form.startMonth,
    startDay: form.startDay,
    endMonth: form.endMonth,
    endDay: form.endDay,
    offSeasonDiscountPct: form.offSeasonDiscountPct,
    rowVersion: form.rowVersion,
  })

// ---------------------------------------------------------------- Configuración

// El formulario de Configuración no maneja la versión del registro: se recuerda la de la última lectura (R-25).
let settingsVersion = null

const rememberVersion = (settings) => {
  settingsVersion = settings.rowVersion
  return settings
}

export const getSettings = async () => rememberVersion(await request('GET', '/api/admin/settings'))

export const saveSettings = async (settings) =>
  rememberVersion(
    await request('PUT', '/api/admin/settings', {
      freeShippingThreshold: settings.freeShippingThreshold,
      parcelShippingCost: settings.parcelShippingCost,
      localShippingCost: settings.localShippingCost,
      localFreeShipping: settings.localFreeShipping,
      fewUnitsThreshold: settings.fewUnitsThreshold,
      localZones: settings.localZones,
      rowVersion: settingsVersion,
    }),
  )

// ---------------------------------------------------------------- Usuarios

export const getInternalUsers = () => request('GET', '/api/admin/users')

export const inviteUser = (invitation) => request('POST', '/api/admin/users/invitations', invitation)
