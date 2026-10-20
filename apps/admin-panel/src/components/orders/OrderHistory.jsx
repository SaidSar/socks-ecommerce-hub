import { STATUS } from '../../domain/orders'
import { formatDate, formatTime } from '../../utils/format'

/** Historial del pedido, del más reciente al más antiguo. */
export default function OrderHistory({ history }) {
  return (
    <section aria-labelledby="history-title">
      <h3 id="history-title" className="text-[12px] uppercase tracking-[.12em] text-ink-soft mb-3">
        Historial
      </h3>
      <ol className="relative border-l border-line ml-1.5 space-y-4">
        {[...history].reverse().map((h, i) => (
          <li key={`${h.status}-${h.at}-${i}`} className="pl-4 relative">
            <span
              className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-paper"
              style={{ background: STATUS[h.status].dot }}
              aria-hidden="true"
            />
            <p className="text-[13px] font-medium">{STATUS[h.status].label}</p>
            <p className="text-[12px] text-ink-soft">
              {formatDate(h.at)}, {formatTime(h.at)} · {h.by}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
