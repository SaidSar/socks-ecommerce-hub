import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { unitText } from '../config/enums'
import { FEATURED_SLUG } from '../data/catalogSeed'
import { useConfig } from '../hooks/useConfig'
import { getProductSync } from '../services/catalogService'
import { CartContext } from './cart-context'

// v2: líneas del catálogo multilínea (precio efectivo, precio de lista y unidad). Las de v1 se descartan.
const STORAGE_KEY = 'sokko.cart.v2'

const lineKey = (slug, color, size) => `${slug}-${color}-${size}`
const clamp = (q, max) => Math.min(q, max)

function devPreload() {
  // Solo en desarrollo: 1 × Tabi Origami Noche (Tinta Sumi, M) para revisión visual (DESIGN.md §4.4).
  const product = getProductSync(FEATURED_SLUG)
  return product ? [toLine(product, 'SUM', 'M')] : []
}

/**
 * Línea de la bolsa a partir de la ficha (DESIGN_CATALOG_UI.md §3.8): guarda el precio efectivo que calculó el
 * servicio (`price`, con R-29 si aplica) y el de lista (`listPrice`), más la unidad de venta.
 * TODO(api): si cambia el día y una temporada se activa o termina, el checkout recalcula los precios en el servidor.
 */
function toLine(product, color, size) {
  const swatch = product.colors.find((c) => c.code === color) ?? product.colors[0]
  const sizeLabel = product.sizes.find((s) => s.code === size)?.label ?? size
  return {
    key: lineKey(product.slug, swatch.code, size),
    slug: product.slug,
    line: product.line,
    name: product.name,
    art: product.art,
    price: product.price,
    listPrice: product.listPrice,
    unit: unitText(product.type.unit, product.unitsPerPack),
    color: swatch,
    size,
    sizeLabel: product.type.sizeSystem === 'unitalla' ? sizeLabel : `Talla ${size}`,
    qty: 1,
    // TODO(api): cuando la API dé stock por variante, max = stock de la variante.
    max: product.stock,
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
      const { product, color, size } = action
      const key = lineKey(product.slug, color, size)
      const existing = state.items.find((i) => i.key === key)
      if (existing) {
        if (existing.qty >= existing.max) return state
        return {
          ...state,
          items: state.items.map((i) => (i.key === key ? { ...i, qty: clamp(i.qty + 1, i.max) } : i)),
        }
      }
      const line = toLine(product, color, size)
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

  const add = useCallback((product, color, size) => dispatch({ type: 'ADD', product, color, size }), [])
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
