import { useWishlist } from '../../hooks/useWishlist'
import { HeartIcon } from '../brand/Icons'

/**
 * Corazón de favoritos (botón de alternancia, aria-pressed) con área táctil de 44 px.
 * `name` completa la etiqueta para quien usa lector de pantalla: en una cuadrícula hay un corazón por tarjeta.
 * El tamaño lo pone quien lo usa (`className`); nunca baja de 44 px.
 */
export default function FavoriteButton({ slug, name, className = '' }) {
  const { isFavorite, toggle } = useWishlist()
  const saved = isFavorite(slug)
  const label = saved ? 'Quitar de favoritos' : 'Agregar a favoritos'

  return (
    <button
      type="button"
      onClick={() => toggle(slug)}
      aria-pressed={saved}
      aria-label={name ? `${label}: ${name}` : label}
      title={label}
      className={`flex min-h-11 min-w-11 items-center justify-center transition-colors ${saved ? 'text-laca' : 'text-ink-soft hover:text-laca'} ${className}`}
    >
      <HeartIcon filled={saved} className="h-[22px] w-[22px]" />
    </button>
  )
}
