// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authFetch } from './authService'
import { addFavorite, mergeFavorites } from './wishlistService'

// Con API: las llamadas van a /api/wishlist con el token de la sesión (authFetch).
vi.mock('./api', () => ({ API_URL: 'http://api.test', USE_API: true, apiGet: vi.fn() }))
vi.mock('./authService', () => ({ authFetch: vi.fn() }))

// Una tarjeta de GET /api/wishlist (misma forma que GET /api/products).
const product = {
  slug: 'tabi-origami-noche',
  line: 'sokko',
  name: 'Tabi Origami Noche',
  nameJp: '折紙',
  brand: { slug: 'sokko', name: 'SOKKO', isOwnBrand: true, showInFilters: false },
  type: { code: 'calcetas', name: 'Calcetas', unitLabel: 'par', sizeSystem: 'calceta' },
  collection: null,
  unitsPerPack: 1,
  price: 420,
  finalPrice: 420,
  offSeason: false,
  discountPct: 0,
  colors: [{ code: 'SUM', slug: 'tinta-sumi', name: 'Tinta Sumi', hex: '#2B2B2B', lineHex: '#F4F0EB', isSokkoTone: true }],
  variants: [{ sku: 'SKK-007-SUM-M', color: 'tinta-sumi', size: 'M', stock: 6 }],
  images: [],
  imageUrl: null,
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => vi.mocked(authFetch).mockReset())

describe('wishlistService con API', () => {
  it('merge manda la lista del invitado (máx. 50) y devuelve tarjetas', async () => {
    vi.mocked(authFetch).mockResolvedValue(json([product]))
    const guest = Array.from({ length: 60 }, (_, i) => `pieza-${i}`)

    const cards = await mergeFavorites('ana@sokko.test', guest)

    const [path, options] = vi.mocked(authFetch).mock.calls[0]
    expect(path).toBe('/api/wishlist/merge')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body).slugs).toHaveLength(50)
    expect(cards).toMatchObject([{ slug: 'tabi-origami-noche', price: 420, stock: 6 }])
  })

  it('agregar usa PUT con el slug codificado', async () => {
    vi.mocked(authFetch).mockResolvedValue(new Response(null, { status: 204 }))

    await addFavorite('ana@sokko.test', 'calceta/rara')

    expect(vi.mocked(authFetch)).toHaveBeenCalledWith('/api/wishlist/calceta%2Frara', { method: 'PUT' })
  })

  it('un 409 es el límite de la lista', async () => {
    vi.mocked(authFetch).mockResolvedValue(json({ status: 409 }, 409))

    await expect(addFavorite('ana@sokko.test', 'tabi-origami-noche')).rejects.toMatchObject({ name: 'WishlistError', code: 'LIMIT' })
  })
})
