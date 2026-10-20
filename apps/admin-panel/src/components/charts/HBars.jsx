import { useState } from 'react'

/** Barras horizontales (serie única en Ai). rows: [{ k, v }]. */
export default function HBars({ rows, valueFmt = (v) => v, label }) {
  const max = Math.max(...rows.map((r) => r.v), 1)
  const [hover, setHover] = useState(null)
  return (
    <ul className="space-y-2.5" aria-label={label}>
      {rows.map((r, i) => (
        <li
          key={r.k}
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 items-center"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        >
          <span className="text-[13px] truncate">{r.k}</span>
          <span className="text-[13px] tnum text-right">{valueFmt(r.v)}</span>
          <span className="col-span-2 h-2 rounded-full bg-sand overflow-hidden" aria-hidden="true">
            <span
              className={`block h-full rounded-full transition-all duration-500 ${hover === i ? 'bg-ai-hover' : 'bg-ai'}`}
              style={{ width: `${(r.v / max) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  )
}
