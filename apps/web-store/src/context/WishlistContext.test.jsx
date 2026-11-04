// @vitest-environment jsdom
import { act, useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PRODUCTS } from '../data/catalogSeed'
import { useWishlist } from '../hooks/useWishlist'
import { __resetWishlistMemory } from '../services/wishlistService'
import { flush, render } from '../test/dom'
import { AuthContext } from './auth-context'
import { WishlistProvider } from './WishlistContext'

// Sin VITE_API_URL las pruebas usan el modo mock: la lista de cada cuenta también vive en localStorage.
const GUEST_KEY = 'sokko.wishlist.v1'
const ACCOUNT = 'ana@sokko.test'
const [A, B, C] = PRODUCTS.map((p) => p.slug)

const stored = (key) => JSON.parse(window.localStorage.getItem(key) ?? 'null')

let wishlist
let signIn
let view

function Probe() {
  const value = useWishlist()
  useEffect(() => {
    wishlist = value
  })
  return null
}

/** AuthContext mínimo: basta con `user` para el provider; `signIn` cambia la sesión como al iniciar sesión. */
function Harness() {
  const [user, setUser] = useState(null)
  useEffect(() => {
    signIn = (email) => act(async () => setUser({ email, firstName: 'Ana', lastName: 'Prueba' }))
  }, [])
  return (
    <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user) }}>
      <WishlistProvider>
        <Probe />
      </WishlistProvider>
    </AuthContext.Provider>
  )
}

async function mount() {
  view = await render(<Harness />)
  await flush()
}

beforeEach(() => {
  window.localStorage.clear()
  __resetWishlistMemory()
})
afterEach(() => view?.unmount())

describe('useWishlist sin sesión', () => {
  it('guarda los slugs en este navegador, el más reciente primero', async () => {
    await mount()

    await act(() => wishlist.toggle(A))
    await act(() => wishlist.toggle(B))

    expect(wishlist.slugs).toEqual([B, A])
    expect(wishlist.count).toBe(2)
    expect(wishlist.isFavorite(A)).toBe(true)
    expect(stored(GUEST_KEY)).toEqual([B, A])
  })

  it('el segundo toque quita el favorito', async () => {
    await mount()

    await act(() => wishlist.toggle(A))
    await act(() => wishlist.toggle(A))

    expect(wishlist.isFavorite(A)).toBe(false)
    expect(stored(GUEST_KEY)).toEqual([])
  })

  it('arranca con lo que ya estaba guardado', async () => {
    window.localStorage.setItem(GUEST_KEY, JSON.stringify([C]))

    await mount()

    expect(wishlist.slugs).toEqual([C])
  })

  it('si localStorage falla, sigue funcionando en memoria', async () => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('cuota excedida')
    }
    try {
      await mount()
      await act(() => wishlist.toggle(A))
      expect(wishlist.isFavorite(A)).toBe(true)
    } finally {
      Storage.prototype.setItem = setItem
    }
  })
})

describe('useWishlist al iniciar sesión', () => {
  it('une la lista local a la de la cuenta y limpia la local', async () => {
    window.localStorage.setItem(`${GUEST_KEY}:${ACCOUNT}`, JSON.stringify([C]))
    await mount()
    await act(() => wishlist.toggle(A))
    await act(() => wishlist.toggle(B))
    const before = wishlist.version

    await signIn(ACCOUNT)
    await flush()

    expect(wishlist.isAuthenticated).toBe(true)
    expect(wishlist.slugs).toEqual([B, A, C])
    expect(wishlist.version).toBeGreaterThan(before)
    expect(stored(`${GUEST_KEY}:${ACCOUNT}`)).toEqual([B, A, C])
    expect(window.localStorage.getItem(GUEST_KEY)).toBeNull()
  })

  it('sin favoritos locales solo carga los de la cuenta', async () => {
    window.localStorage.setItem(`${GUEST_KEY}:${ACCOUNT}`, JSON.stringify([C, A]))
    await mount()

    await signIn(ACCOUNT)
    await flush()

    expect(wishlist.slugs).toEqual([C, A])
  })

  it('con sesión, el corazón escribe en la lista de la cuenta', async () => {
    await mount()
    await signIn(ACCOUNT)
    await flush()

    await act(() => wishlist.toggle(B))

    expect(stored(`${GUEST_KEY}:${ACCOUNT}`)).toEqual([B])
    expect(window.localStorage.getItem(GUEST_KEY)).toBeNull()
  })
})
