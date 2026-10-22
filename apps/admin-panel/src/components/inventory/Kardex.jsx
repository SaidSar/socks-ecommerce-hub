import { formatDate, formatTime } from '../../utils/format'

/** Kárdex del SKU, del más reciente al más antiguo. `highlight` marca el último movimiento registrado. */
export default function Kardex({ movements, highlight = false }) {
  return (
    <section aria-labelledby="kardex-title">
      <h3 id="kardex-title" className="text-[12px] uppercase tracking-[.12em] text-ink-soft mb-2">
        Kárdex
      </h3>
      <div className="relative overflow-x-auto">
        <table className="w-full text-[12.5px] min-w-[340px]">
          <caption className="sr-only">Movimientos del SKU, del más reciente al más antiguo</caption>
          <thead className="text-ink-soft text-left">
            <tr>
              <th scope="col" className="py-1.5 font-medium">
                Fecha
              </th>
              <th scope="col" className="py-1.5 font-medium">
                Movimiento
              </th>
              <th scope="col" className="py-1.5 font-medium text-right">
                Cant.
              </th>
              <th scope="col" className="py-1.5 font-medium text-right">
                Saldo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-t border-line">
            {movements.map((m, i) => (
              <tr key={`${m.date}-${m.type}-${i}`} className={i === 0 && highlight ? 'bg-ok-bg' : ''}>
                <td className="py-2 text-ink-soft whitespace-nowrap align-top" title={formatTime(m.date)}>
                  {formatDate(m.date)}
                </td>
                <td className="py-2 pr-2">
                  <span className="block">{m.type}</span>
                  <span className="block text-[11.5px] text-ink-soft">
                    {m.note}
                    {m.order && m.type !== 'Venta' ? ` · Pedido ${m.order}` : ''} · {m.user}
                  </span>
                </td>
                <td className={`py-2 text-right tnum font-medium align-top ${m.qty > 0 ? 'text-matcha' : m.qty < 0 ? 'text-laca' : 'text-ink-soft'}`}>
                  {m.qty > 0 ? '+' : ''}
                  {m.qty}
                </td>
                <td className="py-2 text-right tnum align-top">{m.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
