import { useLayoutEffect, useRef, useState } from 'react'
import { formatMXN } from '../../utils/currency'

const PATH = 'M10 22 C 120 14, 220 28, 320 20 S 520 16, 610 22'

/**
 * Pincelada de progreso hacia el envío de cortesía (DESIGN.md §6.11).
 * `value`/`max` alimentan el role="progressbar"; `progress` (0–100) dibuja el trazo.
 */
export default function BrushProgress({ progress, reached, value, max, missing }) {
  const pathRef = useRef(null)
  // Longitud real del trazo (el mockup usaba 600 fijo).
  const [length, setLength] = useState(600)

  useLayoutEffect(() => {
    const total = pathRef.current?.getTotalLength?.()
    if (total) setLength(total)
  }, [])

  return (
    <div
      className="relative"
      role="progressbar"
      aria-label="Progreso hacia el envío de cortesía"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      aria-valuetext={reached ? 'Envío de cortesía alcanzado' : `Faltan ${formatMXN(missing)} para envío de cortesía`}
    >
      <svg viewBox="0 0 620 40" className="h-8 w-full" aria-hidden="true" focusable="false">
        <path d={PATH} fill="none" stroke="var(--color-ink)" strokeOpacity=".12" strokeWidth="6" strokeLinecap="round" />
        <path
          ref={pathRef}
          d={PATH}
          fill="none"
          stroke="var(--color-laca)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={length}
          className="transition-[stroke-dashoffset] duration-[800ms] ease-out"
          style={{ strokeDashoffset: length - (progress / 100) * length }}
        />
      </svg>
      {reached && (
        <span
          aria-hidden="true"
          className="animate-stamp absolute -top-4 -right-1 flex h-12 w-12 [transform:rotate(-6deg)] items-center justify-center rounded-sm border-2 border-laca bg-linen text-center font-jp text-[13px] leading-tight text-laca"
        >
          無料
          <br />
          配送
        </span>
      )}
    </div>
  )
}
