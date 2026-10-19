import { useLayoutEffect, useRef, useState } from 'react'
import { passwordStrength } from '../../utils/authValidation'

const BRUSH = 'M5 11 C 60 6, 110 15, 160 10 S 260 7, 305 11'

/** Medidor de pincelada (DESIGN_AUTH.md §5.2): el trazo crece con el puntaje 0–4. */
export default function PasswordStrength({ password }) {
  const { rules, score, label } = passwordStrength(password)
  const pathRef = useRef(null)
  const [length, setLength] = useState(300)

  useLayoutEffect(() => {
    if (pathRef.current) setLength(pathRef.current.getTotalLength())
  }, [])

  const pct = password ? score / 4 : 0
  const color = score <= 1 ? 'var(--color-laca)' : score === 2 ? 'var(--color-ocre)' : 'var(--color-matcha)'
  // El ocre (solo trazo) como texto sobre lino queda en ~3.2:1; la etiqueta usa ink-soft para pasar AA.
  const labelColor = score === 2 ? 'var(--color-ink-soft)' : color

  return (
    <div className="mt-3">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 310 20" className="h-4 flex-1" aria-hidden="true">
          <path d={BRUSH} fill="none" stroke="var(--color-ink)" strokeOpacity=".1" strokeWidth="5" strokeLinecap="round" />
          <path
            ref={pathRef}
            d={BRUSH}
            fill="none"
            stroke={color}
            strokeOpacity={pct ? 1 : 0}
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeDasharray={length}
            strokeDashoffset={length - pct * length}
            style={{ transition: 'stroke-dashoffset .6s ease, stroke .4s' }}
          />
        </svg>
        <span className="w-[74px] text-right font-serif text-[15px] italic" style={{ color: labelColor }} aria-live="polite">
          {label && (
            <>
              <span className="sr-only">Seguridad de la contraseña: </span>
              {label}
            </>
          )}
        </span>
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {rules.map((r) => (
          <li key={r.text} className={`flex items-center gap-2 text-[12px] ${r.ok ? 'text-matcha' : 'text-ink-soft'}`}>
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${r.ok ? 'bg-matcha' : 'bg-moss/50'}`} />
            {r.text}
            <span className="sr-only">{r.ok ? ': cumplido' : ': pendiente'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
