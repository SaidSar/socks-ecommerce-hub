import Button from './Button'
import Icon from './Icon'

/** Mensaje centrado para listas vacías, cargas y errores. */
export default function EmptyState({ icon, title, children, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}>
      {icon && <Icon name={icon} className="w-8 h-8 text-ink-soft" />}
      {title && <p className="text-[14px] font-medium mt-3">{title}</p>}
      {children && <div className="text-[12.5px] text-ink-soft mt-1">{children}</div>}
    </div>
  )
}

/** Marcador de carga accesible. */
export function Loading({ label = 'Cargando…', className = '' }) {
  return (
    <p role="status" className={`px-5 py-12 text-center text-[13px] text-ink-soft ${className}`}>
      {label}
    </p>
  )
}

/** Error de carga con "Reintentar": dice qué falló y deja volver a intentarlo sin recargar la página. */
export function ErrorState({ title, error, onRetry, className = '' }) {
  return (
    <div role="alert" className={`flex flex-col items-center justify-center text-center px-6 py-12 ${className}`}>
      <Icon name="alert" className="w-8 h-8 text-laca" />
      <p className="text-[14px] font-medium mt-3">{title}</p>
      {error?.message && <p className="text-[12.5px] text-ink-soft mt-1 max-w-md">{error.message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <Icon name="refresh" className="w-4 h-4" />
          Reintentar
        </Button>
      )}
    </div>
  )
}
