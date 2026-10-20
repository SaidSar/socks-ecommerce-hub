import Card from '../ui/Card'
import CardHead from '../ui/CardHead'
import Icon from '../ui/Icon'

/** Pares restantes del tiraje; en laca con menos del 20 %. */
export default function LimitedEditions({ editions }) {
  return (
    <Card className="min-w-0">
      <CardHead title="Ediciones limitadas" sub="Pares restantes del tiraje" />
      <ul className="px-5 pb-5 space-y-4">
        {editions.map((e) => (
          <li key={e.id}>
            <p className="flex justify-between gap-3 text-[13px]">
              <span>{e.name}</span>
              <span className="tnum whitespace-nowrap">
                <b className="font-semibold">{e.left}</b> de {e.edition}
              </span>
            </p>
            <span
              className="mt-1.5 block h-2 rounded-full bg-sand overflow-hidden"
              role="meter"
              aria-label={`${e.name}: pares restantes`}
              aria-valuemin={0}
              aria-valuemax={e.edition}
              aria-valuenow={e.left}
            >
              <span className={`block h-full rounded-full ${e.low ? 'bg-laca' : 'bg-ai'}`} style={{ width: `${Math.min(100, e.ratio * 100)}%` }} />
            </span>
            {e.low && (
              <p className="text-[12px] text-laca mt-1 flex items-center gap-1">
                <Icon name="alert" className="w-3.5 h-3.5" />
                Menos del 20 % del tiraje
              </p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
