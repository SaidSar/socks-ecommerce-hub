import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WISHLIST_MESSAGES } from '../domain/account'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import * as wishlistService from '../services/wishlistService'
import { WishlistContext } from './wishlist-context'

/** Slugs de la lista de la cuenta; si el invitado guardó favoritos en este navegador, primero se unen a ella y se borran de aquí. */
async function syncAccount(account) {
  const guest = wishlistService.readGuestSlugs()
  if (!guest.length) return (await wishlistService.listFavorites(account)).map((p) => p.slug)
  const merged = await wishlistService.mergeFavorites(account, guest)
  wishlistService.clearGuestSlugs()
  return merged.map((p) => p.slug)
}

/**
 * Favoritos (corazón de las tarjetas y la ficha). Guarda solo los slugs: la página de favoritos pide las tarjetas.
 * `version` cambia cada vez que la lista se sincroniza con su origen (al cargar, al entrar o al salir de la cuenta).
 */
export function WishlistProvider({ children }) {
  const { user } = useAuth()
  const account = user?.email ?? null
  const [slugs, setSlugs] = useState(() => (account ? [] : wishlistService.readGuestSlugs()))
  const [version, setVersion] = useState(0)
  const toast = useToast()
  const slugsRef = useRef(slugs)
  // "Deshacer" del aviso llama a la versión más reciente de toggle (la cuenta pudo cambiar entre tanto).
  const toggleRef = useRef(null)

  useEffect(() => {
    slugsRef.current = slugs
  }, [slugs])

  useEffect(() => {
    let cancelled = false
    const load = account ? syncAccount(account) : Promise.resolve(wishlistService.readGuestSlugs())
    load.then(
      (next) => {
        if (cancelled) return
        setSlugs(next)
        setVersion((v) => v + 1)
      },
      // Sin red, la lista se queda como estaba; el corazón sigue funcionando y avisa si falla.
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [account])

  /** Agrega o quita al momento y lo confirma con un aviso; si el servidor falla, la lista vuelve a como estaba. */
  const toggle = useCallback(
    async (slug) => {
      const saved = slugsRef.current.includes(slug)
      const previous = slugsRef.current
      setSlugs(saved ? previous.filter((s) => s !== slug) : [slug, ...previous])
      try {
        if (saved) await wishlistService.removeFavorite(account, slug)
        else await wishlistService.addFavorite(account, slug)
        // Una sola clave: tocar varios corazones seguidos deja a la vista solo el último aviso.
        toast.success(saved ? WISHLIST_MESSAGES.removed : WISHLIST_MESSAGES.added, {
          key: 'wishlist',
          action: saved
            ? { label: WISHLIST_MESSAGES.undo, onClick: () => toggleRef.current(slug) }
            : { label: WISHLIST_MESSAGES.view, to: '/cuenta/favoritos' },
        })
      } catch (err) {
        setSlugs((current) => (saved ? (current.includes(slug) ? current : [slug, ...current]) : current.filter((s) => s !== slug)))
        toast.error(err?.code === 'LIMIT' ? WISHLIST_MESSAGES.limit : WISHLIST_MESSAGES.network, { key: 'wishlist' })
      }
    },
    [account, toast],
  )

  useEffect(() => {
    toggleRef.current = toggle
  }, [toggle])

  const value = useMemo(
    () => ({
      slugs,
      count: slugs.length,
      version,
      isAuthenticated: Boolean(account),
      isFavorite: (slug) => slugs.includes(slug),
      toggle,
    }),
    [slugs, version, account, toggle],
  )

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  )
}
