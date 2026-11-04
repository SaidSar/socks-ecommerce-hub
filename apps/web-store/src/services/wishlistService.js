// Favoritos. Sin sesión la lista vive en este navegador (slugs, el más reciente primero); con sesión, en /api/wishlist.
// Sin API (VITE_USE_MOCKS) la lista de cada cuenta también se guarda aquí, con su correo en la llave.
import { USE_API } from './api'
import { authFetch } from './authService'
import { toCard } from './catalogApi'
import { getProduct } from './catalogService'

const GUEST_KEY = 'sokko.wishlist.v1'
const accountKey = (account) => `${GUEST_KEY}:${account}`

/** Igual que la API: hasta 50 se unen al entrar y una cuenta guarda hasta 100. */
export const GUEST_LIMIT = 50
export const ACCOUNT_LIMIT = 100

export class WishlistError extends Error {
  /** @param {'LIMIT' | 'NOT_FOUND' | 'NETWORK'} code */
  constructor(code) {
    super(code)
    this.name = 'WishlistError'
    this.code = code
  }
}

// Copia de lo escrito, por si localStorage no acepta la escritura (modo privado, cuota llena).
let memory = {}

/** Solo para pruebas: olvida la copia en memoria. */
export function __resetWishlistMemory() {
  memory = {}
}

function readSlugs(key) {
  try {
    const raw = window.localStorage.getItem(key)
    const list = raw ? JSON.parse(raw) : null
    if (Array.isArray(list)) return list.filter((s) => typeof s === 'string')
  } catch {
    /* almacenamiento no disponible o dañado: se usa la copia en memoria */
  }
  return memory[key] ?? []
}

function writeSlugs(key, slugs) {
  memory[key] = slugs
  try {
    window.localStorage.setItem(key, JSON.stringify(slugs))
  } catch {
    /* almacenamiento no disponible: la lista dura lo que la pestaña */
  }
}

function removeSlugs(key) {
  delete memory[key]
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Favoritos del invitado en este navegador. */
export const readGuestSlugs = () => readSlugs(GUEST_KEY)

/** Tras unirlos a la cuenta, la lista local se vacía. */
export const clearGuestSlugs = () => removeSlugs(GUEST_KEY)

// --- API ---

async function call(path, options) {
  let response
  try {
    response = await authFetch(path, options)
  } catch {
    throw new WishlistError('NETWORK')
  }
  if (response.status === 409) throw new WishlistError('LIMIT')
  if (response.status === 404) throw new WishlistError('NOT_FOUND')
  if (!response.ok) throw new WishlistError('NETWORK')
  return response
}

const cardsOf = async (response) => (await response.json()).map((p) => toCard(p))

// --- Local (invitado, o cuenta sin API) ---

/** Tarjetas en el orden de la lista; un slug que ya no existe se omite. */
async function localCards(slugs) {
  const products = await Promise.all(slugs.map((slug) => getProduct(slug).catch(() => null)))
  return products.filter(Boolean)
}

function addLocal(key, slug, limit) {
  const slugs = readSlugs(key)
  if (slugs.includes(slug)) return
  if (slugs.length >= limit) throw new WishlistError('LIMIT')
  writeSlugs(key, [slug, ...slugs])
}

// --- API pública: `account` es el correo de la sesión, o null para el invitado ---

/** Tarjetas de producto guardadas, la más reciente primero. */
export async function listFavorites(account) {
  if (account && USE_API) return cardsOf(await call('/api/wishlist'))
  return localCards(readSlugs(account ? accountKey(account) : GUEST_KEY))
}

/** Idempotente. @throws {WishlistError} LIMIT si la lista está llena. */
export async function addFavorite(account, slug) {
  if (account && USE_API) {
    await call(`/api/wishlist/${encodeURIComponent(slug)}`, { method: 'PUT' })
    return
  }
  addLocal(account ? accountKey(account) : GUEST_KEY, slug, account ? ACCOUNT_LIMIT : GUEST_LIMIT)
}

/** Idempotente. */
export async function removeFavorite(account, slug) {
  if (account && USE_API) {
    await call(`/api/wishlist/${encodeURIComponent(slug)}`, { method: 'DELETE' })
    return
  }
  const key = account ? accountKey(account) : GUEST_KEY
  writeSlugs(key, readSlugs(key).filter((s) => s !== slug))
}

/** Une los favoritos del invitado a la cuenta y devuelve la lista final. Lo que pase del límite se ignora, como en la API. */
export async function mergeFavorites(account, slugs) {
  const guest = slugs.slice(0, GUEST_LIMIT)
  if (USE_API) {
    return cardsOf(await call('/api/wishlist/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slugs: guest }) }))
  }
  const key = accountKey(account)
  const saved = readSlugs(key)
  const added = [...new Set(guest)].filter((s) => !saved.includes(s)).slice(0, Math.max(ACCOUNT_LIMIT - saved.length, 0))
  writeSlugs(key, [...added, ...saved])
  return localCards(readSlugs(key))
}
