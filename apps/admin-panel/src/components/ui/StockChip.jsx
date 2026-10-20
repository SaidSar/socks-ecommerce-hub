import Icon from './Icon'

const MAP = {
  agotado: ['bg-crit-bg text-laca', 'Agotado', 'alert'],
  pocos: ['bg-warn-bg text-warn-ink', 'Pocos', 'alert'],
  ok: ['bg-ok-bg text-ok-ink', 'En stock', 'check'],
}

/** Estado de stock de un SKU: agotado · pocos · en stock. */
export default function StockChip({ state }) {
  const [cls, label, icon] = MAP[state] ?? MAP.ok
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap ${cls}`}>
      <Icon name={icon} className="w-3.5 h-3.5" />
      {label}
    </span>
  )
}
