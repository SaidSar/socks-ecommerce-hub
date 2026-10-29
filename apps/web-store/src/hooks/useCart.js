import { useContext } from 'react'
import { CartContext } from '../context/cart-context'

/**
 * Estado y acciones del carrito (DESIGN.md §4.4, DESIGN_CATALOG_UI.md §3.8).
 * @returns {{
 *   items: Array<{ key: string, slug: string, line: string, name: string, art: string, price: number, listPrice: number,
 *     unit: string, color: { code: string, apiCode: string, name: string, hex: string }, size: string, sizeLabel: string,
 *     qty: number, max: number }>,
 *   count: number, subtotal: number, shipping: number, total: number, ivaIncluded: number,
 *   progress: number, missing: number, isFree: boolean, giftWrap: boolean, isOpen: boolean,
 *   add: (product: object, color: string, size: string) => void, setQty: (key: string, q: number) => void,
 *   remove: (key: string) => void, toggleGift: () => void, open: () => void, close: () => void,
 * }}
 */
export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCart() debe usarse dentro de <CartProvider>. Envuelve la app con CartProvider en App.jsx.')
  }
  return ctx
}
