import { Link } from 'react-router-dom'
import Card from '../ui/Card'
import CardHead from '../ui/CardHead'

const ITEMS = [
  { label: 'Por preparar', key: 'por_preparar', filter: 'por_preparar', dot: 'bg-ocre' },
  { label: 'En preparación', key: 'preparando', filter: 'preparando', dot: 'bg-ai' },
  { label: 'Atrasados +48 h', key: 'late', filter: 'late', dot: 'bg-laca' },
  { label: 'En ruta local', key: 'en_ruta', filter: 'en_ruta', dot: 'bg-matcha' },
]

/** Cola de trabajo: cada número abre Pedidos con su filtro. */
export default function WorkQueue({ queue }) {
  return (
    <Card aria-labelledby="queue-title">
      <CardHead id="queue-title" title="Cola de trabajo" sub="Lo que necesita atención hoy" />
      <ul className="grid grid-cols-2 lg:grid-cols-4 border-t border-line">
        {ITEMS.map((it, i) => {
          const n = queue[it.key]
          return (
            <li key={it.key} className={`border-line ${i % 2 ? 'border-l' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}>
              <Link
                to={`/pedidos?f=${it.filter}`}
                className="group block text-left px-5 py-4 hover:bg-linen transition-colors h-full"
              >
                <span className="flex items-center gap-2 text-[12.5px] text-ink-soft">
                  <span className={`w-2 h-2 rounded-full ${it.dot}`} aria-hidden="true" />
                  {it.label}
                </span>
                <span className="flex items-end justify-between mt-1">
                  <span className={`text-[30px] font-semibold tnum leading-none ${it.key === 'late' && n ? 'text-laca' : ''}`}>
                    {n}
                    <span className="sr-only"> {n === 1 ? 'pedido' : 'pedidos'}, ver en Pedidos</span>
                  </span>
                  <span className="text-[12.5px] text-ai opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" aria-hidden="true">
                    Ver →
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
