/** Bloque gris que late mientras carga. Decorativo: el estado lo anuncia `SkeletonRegion`. */
export function Skeleton({ className = '' }) {
  return <span aria-hidden="true" className={`block rounded bg-sand animate-pulse ${className}`} />
}

/** Contenedor de esqueletos con el texto para lectores de pantalla ("Cargando clientes…"). */
export function SkeletonRegion({ label, className = '', children }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

/** Filas de tabla en carga. */
export function SkeletonRows({ rows = 6, label = 'Cargando…' }) {
  return (
    <SkeletonRegion label={label} className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
      ))}
    </SkeletonRegion>
  )
}
