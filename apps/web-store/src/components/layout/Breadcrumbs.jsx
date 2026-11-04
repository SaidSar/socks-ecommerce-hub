import { Link } from 'react-router-dom'

/**
 * Migas de pan: "Inicio / Línea / Producto". `items`: `{ label, to }`; el último es la página actual
 * (sin enlace, aria-current="page"). Las barras son decorativas.
 */
export default function Breadcrumbs({ items, className = '' }) {
  return (
    <nav aria-label="Ruta" className={`text-[12px] text-ink-soft ${className}`}>
      <ol className="flex flex-wrap items-center gap-x-2">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-x-2">
              {last ? (
                <span aria-current="page" className="truncate text-ink">
                  {item.label}
                </span>
              ) : (
                <>
                  <Link to={item.to} className="inline-flex min-h-11 items-center hover:text-ink">
                    {item.label}
                  </Link>
                  <span aria-hidden="true">/</span>
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
