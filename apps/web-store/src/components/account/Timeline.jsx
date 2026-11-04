import { stepLabel } from '../../domain/account'
import { formatDateTime } from '../../utils/orderDates'

/** Línea de tiempo del pedido (`order.timeline`, del más antiguo al más reciente). El último hito es el actual. */
export default function Timeline({ steps }) {
  return (
    <ol className="relative ml-1.5 border-l border-ink/15" aria-label="Historial del pedido">
      {steps.map((step, i) => {
        const current = i === steps.length - 1
        return (
          <li key={`${step.status}-${step.at}`} aria-current={current ? 'step' : undefined} className="relative pb-6 pl-6 last:pb-0">
            <span
              aria-hidden="true"
              className={`absolute top-1.5 -left-[5px] h-[9px] w-[9px] rounded-full ${
                current ? (step.status === 'cancelado' ? 'bg-laca' : 'bg-matcha') : 'border border-ink/30 bg-linen'
              }`}
            />
            <p className={`text-[14.5px] ${current ? 'text-ink' : 'text-ink-soft'}`}>{stepLabel(step.status)}</p>
            <p className="tnum mt-0.5 text-[12.5px] text-ink-soft">
              <time dateTime={step.at}>{formatDateTime(step.at)}</time>
            </p>
          </li>
        )
      })}
    </ol>
  )
}
