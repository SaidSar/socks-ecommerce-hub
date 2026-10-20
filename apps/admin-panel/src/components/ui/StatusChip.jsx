import { STATUS } from '../../domain/orders'
import Icon from './Icon'

// Colores exactamente como el mockup (STATUS), con tokens del panel.
const CLS = {
  pagado: 'bg-sand text-ink',
  por_preparar: 'bg-warn-bg text-warn-ink',
  preparando: 'bg-info-bg text-info-ink',
  enviado: 'bg-ok-bg text-ok-ink',
  en_ruta: 'bg-ok-bg text-ok-ink',
  entregado: 'bg-sand text-ink-soft',
  cancelado: 'bg-paper text-ink-soft border border-line line-through decoration-ink-soft/50',
}

/** Estado del pedido con punto de color y, si aplica, chip "Atrasado". */
export default function StatusChip({ status, late = false }) {
  const s = STATUS[status]
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap ${CLS[status]}`}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} aria-hidden="true" />
        {s.label}
      </span>
      {late && (
        <span className="inline-flex items-center gap-1 rounded-full bg-crit-bg text-laca px-2 py-0.5 text-[12px] font-medium whitespace-nowrap">
          <Icon name="clock" className="w-3.5 h-3.5" />
          Atrasado
        </span>
      )}
    </span>
  )
}
