import { label, LINE_SHORT_LABELS } from '../../domain/enums'
import Icon from '../ui/Icon'

// Piezas comunes de las pantallas del catálogo (mockup admin-catalogo.html).

const PILL = {
  ok: 'bg-ok-bg text-ok-ink',
  warn: 'bg-warn-bg text-warn-ink',
  crit: 'bg-crit-bg text-laca',
  info: 'bg-info-bg text-info-ink',
  mute: 'bg-sand text-ink-soft',
}

/** Pastilla de estado: ok · warn · crit · info · mute. */
export function Pill({ tone = 'mute', children, className = '', ...rest }) {
  return (
    <span className={`inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11.5px] font-medium ${PILL[tone]} ${className}`} {...rest}>
      {children}
    </span>
  )
}

/** Línea del producto con punto: laca en SOKKO, ink-soft en las demás. */
export function LineTag({ line }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px]">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${line === 'sokko' ? 'bg-laca' : 'bg-ink-soft'}`} />
      {label(LINE_SHORT_LABELS, line)}
    </span>
  )
}

/** Muestra de color con su nombre como título. */
export function Swatch({ color }) {
  return (
    <span
      title={color.name}
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-line"
      style={{ background: color.hex ?? 'conic-gradient(#b5302b, #e3b53b, #2f5a43, #26385c, #b5302b)' }}
    />
  )
}

/** Aviso de permisos (info, con candado) o de atención (warn). */
export function Banner({ tone = 'info', children }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-md px-3 py-2.5 text-[13px] ${tone === 'info' ? 'bg-info-bg text-info-ink' : 'bg-warn-bg text-warn-ink'}`}>
      <Icon name={tone === 'info' ? 'lock' : 'alert'} className="mt-0.5 h-4 w-4" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Tabla con el estilo del panel dentro de un contenedor deslizable (sin scroll horizontal de la página a 360 px). */
export const TABLE = 'w-full border-collapse text-[13px]'
export const TH = 'whitespace-nowrap border-b border-line bg-paper px-3 py-2.5 text-left text-[11.5px] font-medium tracking-[.04em] text-ink-soft'
export const TD = 'border-b border-line px-3 py-2.5 align-middle'
