import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { FEATURED_PIECE_ID, PIECES } from '../data/catalog.mock'
import { useConfig } from '../hooks/useConfig'
import { CartContext } from './cart-context'

const STORAGE_KEY = 'sokko.cart.v1'

const lineKey = (pieceId, tone, size) => `${pieceId}-${tone}-${size}`
const clamp = (q, max) => Math.min(q, max)

function devPreload() {
  // Solo en desarrollo: 1 × Tabi Origami Noche (Tinta Sumi, M) para revisión visual (DESIGN.md §4.4).
  const piece = PIECES.find((p) => p.id === FEATURED_PIECE_ID)
  if (!piece) return []
  return [toLine(piece, 'sumi', 'M')]
}

function toLine(piece, tone, size) {
  // Cuando la API dé stock por talla, max = piece.stock[tone][size].
  return {
    key: lineKey(piece.id, tone, size),
    id: piece.id,
    name: piece.name,
    price: piece.price,
    tone,
    size,
    qty: 1,
    max: piece.stock[tone] ?? 0,
  }
}

function readStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!Array.isArray(data?.items)) return null
    return { items: data.items, giftWrap: data.giftWrap !== false }
  } catch {
    return null
  }
}

function init() {
  const stored = readStorage()
  if (stored) return { ...stored, isOpen: false }
  return { items: import.meta.env.DEV ? devPreload() : [], giftWrap: true, isOpen: false }
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const { piece, tone, size } = action
      const key = lineKey(piece.id, tone, size)
      const existing = state.items.find((i) => i.key === key)
      if (existing) {
        if (existing.qty >= existing.max) return state
        return {
          ...state,
          items: state.items.map((i) => (i.key === key ? { ...i, qty: clamp(i.qty + 1, i.max) } : i)),
        }
      }
      const line = toLine(piece, tone, size)
      if (line.max <= 0) return state
      return { ...state, items: [...state.items, line] }
    }
    case 'SET_QTY': {
      const { key, qty } = action
      if (qty <= 0) return { ...state, items: state.items.filter((i) => i.key !== key) }
      return {
        ...state,
        items: state.items.map((i) => (i.key === key ? { ...i, qty: clamp(qty, i.max) } : i)),
      }
    }
    case 'REMOVE':
      return { ...state, items: state.items.filter((i) => i.key !== action.key) }
    case 'TOGGLE_GIFT':
      return { ...state, giftWrap: !state.giftWrap }
    case 'OPEN':
      return state.isOpen ? state : { ...state, isOpen: true }
    case 'CLOSE':
      return state.isOpen ? { ...state, isOpen: false } : state
    case 'HYDRATE':
      return { ...state, items: action.items, giftWrap: action.giftWrap }
    default:
      return state
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, init)
  const { items, giftWrap, isOpen } = state
  const { freeShippingThreshold, parcelShippingCost, ivaRate } = useConfig()

  // Persistencia (sin isOpen). Si localStorage falla, el carrito sigue en memoria.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, giftWrap }))
    } catch {
      /* almacenamiento no disponible */
    }
  }, [items, giftWrap])

  // Sincroniza el carrito entre pestañas.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return
      const stored = readStorage()
      if (stored) dispatch({ type: 'HYDRATE', ...stored })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const add = useCallback((piece, tone, size) => dispatch({ type: 'ADD', piece, tone, size }), [])
  const setQty = useCallback((key, qty) => dispatch({ type: 'SET_QTY', key, qty }), [])
  const remove = useCallback((key) => dispatch({ type: 'REMOVE', key }), [])
  const toggleGift = useCallback(() => dispatch({ type: 'TOGGLE_GIFT' }), [])
  const open = useCallback(() => dispatch({ type: 'OPEN' }), [])
  const close = useCallback(() => dispatch({ type: 'CLOSE' }), [])

  const value = useMemo(() => {
    const count = items.reduce((s, i) => s + i.qty, 0)
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
    const isFree = subtotal >= freeShippingThreshold
    // Sin CP todavía, la bolsa cotiza paquetería; la tarifa local la da POST /api/shipping/quote en el checkout.
    const shipping = subtotal === 0 || isFree ? 0 : parcelShippingCost
    const total = subtotal + shipping
    const ivaIncluded = Math.round((total - total / (1 + ivaRate)) * 100) / 100
    const progress = Math.min(100, (subtotal / freeShippingThreshold) * 100)
    const missing = Math.max(0, freeShippingThreshold - subtotal)
    return {
      items,
      count,
      subtotal,
      shipping,
      total,
      ivaIncluded,
      progress,
      missing,
      isFree,
      giftWrap,
      isOpen,
      add,
      setQty,
      remove,
      toggleGift,
      open,
      close,
    }
  }, [items, giftWrap, isOpen, add, setQty, remove, toggleGift, open, close, freeShippingThreshold, parcelShippingCost, ivaRate])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
