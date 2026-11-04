import { Link } from 'react-router-dom'
import AccountLayout from '../components/account/AccountLayout'
import ProductGrid from '../components/catalog/ProductGrid'
import { BUTTON_LACA } from '../components/info/PageIntro'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../hooks/useAuth'
import { useWishlist } from '../hooks/useWishlist'
import { listFavorites } from '../services/wishlistService'

/**
 * Favoritos (/cuenta/favoritos). Funciona sin sesión con la lista de este navegador e invita a iniciar sesión.
 * Las tarjetas se piden al sincronizar la lista; un corazón quitado aquí desaparece al momento.
 */
export default function Favorites() {
  const { user, isAuthenticated } = useAuth()
  const { isFavorite, version } = useWishlist()
  const account = user?.email ?? null
  const { status, data, retry } = useAsync(() => listFavorites(account), `${account}#${version}`)
  const products = (data ?? []).filter((p) => isFavorite(p.slug))

  return (
    <AccountLayout eyebrow={isAuthenticated ? 'Su cuenta' : 'Su selección'} jp="お気に入り" title="Favoritos" description="Las piezas que guardó para después en SOKKO.">
      {!isAuthenticated && (
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-l-2 border-matcha bg-sand/60 px-5 py-4">
          <p className="text-[14px] leading-relaxed">Sus favoritos se guardan solo en este navegador. Inicie sesión para conservarlos en su cuenta.</p>
          <Link
            to="/cuenta?redirect=/cuenta/favoritos"
            className="inline-flex min-h-11 shrink-0 items-center font-serif text-[16px] italic underline decoration-ink/25 underline-offset-4 hover:text-laca"
          >
            Iniciar sesión
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div role="alert">
          <p className="font-serif text-[22px]">No pudimos cargar sus favoritos.</p>
          <button type="button" onClick={retry} className="mt-5 min-h-11 border border-ink px-6 text-[12px] tracking-[.2em] uppercase">
            Reintentar
          </button>
        </div>
      )}

      {status === 'loading' && !data && (
        <div aria-busy="true" className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[4/5] animate-pulse bg-sand" />
          ))}
          <span className="sr-only">Cargando sus favoritos…</span>
        </div>
      )}

      {status !== 'error' && data && products.length === 0 && (
        <div className="animate-fade">
          <span aria-hidden="true" lang="ja" className="font-jp text-[56px] text-ink/15">
            空
          </span>
          <p className="mt-2 font-serif text-[26px]">Aún no tiene favoritos</p>
          <p className="mt-1 text-[14px] text-ink-soft">Toque el corazón de una pieza para guardarla aquí.</p>
          <Link to="/" className={`mt-8 ${BUTTON_LACA} h-[52px] px-9`}>
            Ir a la tienda
          </Link>
        </div>
      )}

      {data && products.length > 0 && (
        <>
          <p className="mb-6 text-[13px] text-ink-soft" aria-live="polite">
            {products.length} {products.length === 1 ? 'pieza guardada' : 'piezas guardadas'}
          </p>
          <ProductGrid products={products} showLine />
        </>
      )}
    </AccountLayout>
  )
}
