import { useContext } from 'react'
import { WishlistContext } from '../context/wishlist-context'

/**
 * Favoritos de la sesión o, sin ella, de este navegador.
 * @returns {{
 *   slugs: string[], count: number, version: number, isAuthenticated: boolean,
 *   isFavorite: (slug: string) => boolean, toggle: (slug: string) => Promise<void>,
 * }}
 */
export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) {
    throw new Error('useWishlist() debe usarse dentro de <WishlistProvider>. Envuelve la app con WishlistProvider en App.jsx.')
  }
  return ctx
}
