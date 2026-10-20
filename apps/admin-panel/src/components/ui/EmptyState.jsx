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
