import { useId } from 'react'
import { TONES } from '../../data/catalog.mock'

const SILHOUETTE =
  'M84 22 H142 V118 C142 146 150 166 162 180 C178 198 172 226 146 228 H62 C40 228 30 214 33 199 C36 188 47 183 58 181 L70 177 C82 168 84 148 84 128 Z'

/**
 * Calceta tabi con textura de punto. Placeholder hasta tener fotografía (DESIGN.md §6.1):
 * cuando exista `imageUrl`, PieceCard y el hero renderizan <img> y esto queda como fallback.
 */
export default function KnitTabi({ tone = 'washi', className = '', strokeWidth = 2.2 }) {
  const t = TONES[tone] ?? TONES.washi
  // useId() puede incluir ':' o '«»', no válidos dentro de url(#…)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const knitId = `knit-${uid}`
  const clipId = `clip-${uid}`

  return (
    <svg viewBox="0 0 220 250" className={className} role="img" aria-label={`Calceta tabi en ${t.name}`}>
      <defs>
        <pattern id={knitId} width="7" height="6" patternUnits="userSpaceOnUse">
          <rect width="7" height="6" fill={t.hex} />
          <path d="M0.5 0.5 L3.5 5 L6.5 0.5" fill="none" stroke={t.line} strokeOpacity=".16" strokeWidth=".8" />
        </pattern>
        <clipPath id={clipId}>
          <path d={SILHOUETTE} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="220" height="250" fill={`url(#${knitId})`} />
        {/* Puño con canalé */}
        <rect x="80" y="18" width="70" height="24" fill="rgba(0,0,0,.07)" />
        {Array.from({ length: 5 }, (_, i) => (
          <line
            key={i}
            x1={88 + i * 12}
            y1="20"
            x2={88 + i * 12}
            y2="42"
            stroke={t.line}
            strokeOpacity=".22"
            strokeWidth="1.2"
          />
        ))}
        {/* Sombra del talón */}
        <path d="M128 196 C140 192 156 196 170 206 L170 240 L120 240 Z" fill="rgba(0,0,0,.08)" />
      </g>
      <path d={SILHOUETTE} fill="none" stroke="var(--color-ink)" strokeWidth={strokeWidth} strokeLinejoin="round" />
      <path
        d="M58 186 C66 196 66 214 56 227"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  )
}
