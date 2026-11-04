import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WISHLIST_MESSAGES } from '../domain/account'
import { useAuth } from '../hooks/useAuth'
import * as wishlistService from '../services/wishlistService'
import { WishlistContext } from './wishlist-context'

const NOTICE_MS = 4000

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
  const [notice, setNotice] = useState(null)
  const slugsRef = useRef(slugs)

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

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  /** Agrega o quita al momento; si el servidor falla, la lista vuelve a como estaba. */
  const toggle = useCallback(
    async (slug) => {
      const saved = slugsRef.current.includes(slug)
      const previous = slugsRef.current
      setSlugs(saved ? previous.filter((s) => s !== slug) : [slug, ...previous])
      try {
        if (saved) await wishlistService.removeFavorite(account, slug)
        else await wishlistService.addFavorite(account, slug)
        setNotice({ text: saved ? WISHLIST_MESSAGES.removed : WISHLIST_MESSAGES.added, tone: 'info' })
      } catch (err) {
        setSlugs((current) => (saved ? (current.includes(slug) ? current : [slug, ...current]) : current.filter((s) => s !== slug)))
        setNotice({ text: err?.code === 'LIMIT' ? WISHLIST_MESSAGES.limit : WISHLIST_MESSAGES.network, tone: 'error' })
      }
    },
    [account],
  )

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
      {/* Un solo aviso para toda la tienda: el éxito solo se anuncia; un error también se ve. */}
      <div
        role="status"
        aria-live="polite"
        className={
          notice?.tone === 'error'
            ? 'animate-fade fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md border-l-2 border-laca bg-linen px-4 py-3 text-[13.5px] shadow-lg'
            : 'sr-only'
        }
      >
        {notice?.text}
      </div>
    </WishlistContext.Provider>
  )
}
