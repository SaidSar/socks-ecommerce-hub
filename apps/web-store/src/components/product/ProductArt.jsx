import { useId } from 'react'
import KnitTabi from './KnitTabi'

// Ilustraciones del mockup store-multilinea.html mientras no haya fotografía (`imageUrl`).
// Los colores vienen del producto (`colors[i].hex` y `.line`); los id de SVG salen de useId(), no de Math.random().

const CREW_D = 'M78 20 H138 V138 C138 158 146 170 160 180 C180 194 178 226 150 228 H70 C46 228 40 206 50 192 C58 182 72 176 78 160 Z'
const XMAS_SNOW = [[96, 90], [124, 112], [100, 136], [126, 158], [92, 176], [150, 206], [118, 210]]
const PUMPKINS = [[98, 96], [126, 128], [98, 160], [150, 208], [104, 208]]

const svgId = (raw) => raw.replace(/[^a-zA-Z0-9_-]/g, '')

function Knit({ id, hex, line }) {
  return (
    <pattern id={id} width="7" height="6" patternUnits="userSpaceOnUse">
      <rect width="7" height="6" fill={hex} />
      <path d="M0.5 0.5 L3.5 5 L6.5 0.5" fill="none" stroke={line} strokeOpacity=".16" strokeWidth=".8" />
    </pattern>
  )
}

function Crew({ color, stripe, dx = 0, dy = 0, motif }) {
  const uid = svgId(useId())
  return (
    <g transform={`translate(${dx} ${dy})`}>
      <defs>
        <Knit id={`k${uid}`} hex={color.hex} line={color.line} />
        <clipPath id={`c${uid}`}>
          <path d={CREW_D} />
        </clipPath>
      </defs>
      <g clipPath={`url(#c${uid})`}>
        <rect width="220" height="250" fill={`url(#k${uid})`} />
        <rect x="70" y="18" width="80" height="22" fill="rgba(0,0,0,.08)" />
        {stripe && (
          <>
            <rect x="70" y="48" width="80" height="5" fill={stripe} />
            <rect x="70" y="58" width="80" height="5" fill={stripe} />
          </>
        )}
        <path d="M140 196 C150 192 166 198 176 208 L176 240 L130 240 Z" fill="rgba(0,0,0,.09)" />
        <path d="M48 196 C56 188 70 190 80 200 L80 240 L40 240 Z" fill="rgba(0,0,0,.09)" />
        {motif}
      </g>
      <path d={CREW_D} fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />
    </g>
  )
}

const Snow = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} stroke="#F7F5F1" strokeWidth="1.6" strokeLinecap="round">
    <path d="M0 -8 V8 M-7 -4 L7 4 M-7 4 L7 -4" />
    <path d="M-2 -6 L0 -8 L2 -6 M-2 6 L0 8 L2 6" fill="none" />
  </g>
)

const Pumpkin = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <ellipse cx="0" cy="0" rx="11" ry="9" fill="#1F1D1B" opacity=".85" />
    <path d="M-4 -2 l2 -3 l2 3 z M2 -2 l2 -3 l2 3 z M-5 3 q5 4 10 0" fill="#E9A15A" />
  </g>
)

const INK = 'var(--color-ink)'

function body(art, main, alt) {
  const accent = alt.hex !== main.hex ? alt.hex : '#23211E'
  switch (art) {
    case 'crew':
      return <Crew color={main} stripe={accent} />
    case 'pack':
      return (
        <g>
          <Crew color={alt} dx={-34} dy={6} stripe={main.hex} />
          <Crew color={main} dx={34} dy={6} stripe={alt.hex} />
          <Crew color={main} dy={-6} stripe={alt.hex} />
        </g>
      )
    case 'xmas':
      return (
        <Crew
          color={main}
          stripe="#F7F5F1"
          motif={
            <g>
              {XMAS_SNOW.map(([x, y], i) => (
                <Snow key={i} x={x} y={y} s={i % 2 ? 0.8 : 1} />
              ))}
              <rect x="70" y="72" width="80" height="6" fill={alt.hex} />
            </g>
          }
        />
      )
    case 'pumpkin':
      return (
        <Crew
          color={main}
          stripe="#1F1D1B"
          motif={
            <g>
              {PUMPKINS.map(([x, y], i) => (
                <Pumpkin key={i} x={x} y={y} />
              ))}
            </g>
          }
        />
      )
    case 'licensed':
      return (
        <Crew
          color={main}
          stripe={accent}
          motif={
            <g stroke={main.line} strokeOpacity=".5" strokeWidth="2">
              <circle cx="110" cy="120" r="22" fill="none" />
              <path d="M100 120 h20 M110 110 v20" />
            </g>
          }
        />
      )
    case 'beanie':
      return (
        <g>
          <path d="M52 150 C52 82 80 52 110 52 C140 52 168 82 168 150 Z" fill={main.hex} stroke={INK} strokeWidth="2" />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d={`M${66 + i * 13} 150 C${66 + i * 13} 110 ${80 + i * 8} 80 ${82 + i * 8} 66`} fill="none" stroke={main.line} strokeOpacity=".2" />
          ))}
          <rect x="46" y="146" width="128" height="38" fill={main.hex} stroke={INK} strokeWidth="2" />
          {Array.from({ length: 15 }, (_, i) => (
            <line key={i} x1={54 + i * 8} y1="150" x2={54 + i * 8} y2="180" stroke={main.line} strokeOpacity=".22" />
          ))}
          <circle cx="110" cy="44" r="14" fill={alt.hex} stroke={INK} strokeWidth="2" />
        </g>
      )
    case 'gloves':
      return (
        <g>
          {[[-30, -8], [30, 8]].map(([dx, rot], k) => (
            <g key={k} transform={`translate(${110 + dx} 130) rotate(${rot})`}>
              <path
                d="M-30 70 V-10 C-30 -22 -22 -24 -20 -14 V-40 C-20 -50 -10 -50 -10 -40 V-50 C-10 -60 0 -60 0 -50 V-44 C0 -54 10 -54 10 -44 V-30 C10 -38 20 -38 20 -28 V10 L30 -4 C36 -12 46 -6 40 4 L22 40 V70 Z"
                fill={k ? alt.hex : main.hex}
                stroke={INK}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <rect x="-30" y="56" width="52" height="14" fill="rgba(0,0,0,.12)" />
            </g>
          ))}
        </g>
      )
    case 'scarf':
      return (
        <g>
          <path d="M60 40 C90 30 130 30 160 40 L150 80 C125 72 95 72 70 80 Z" fill={main.hex} stroke={INK} strokeWidth="2" />
          <path d="M120 74 L150 80 L142 214 L112 214 Z" fill={main.hex} stroke={INK} strokeWidth="2" />
          <path d="M70 80 L100 74 L92 196 L62 196 Z" fill={alt.hex} stroke={INK} strokeWidth="2" />
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={116 + i * 8} y1="214" x2={115 + i * 8} y2="230" stroke={INK} strokeWidth="1.5" />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <line key={`b${i}`} x1={66 + i * 8} y1="196" x2={65 + i * 8} y2="212" stroke={INK} strokeWidth="1.5" />
          ))}
        </g>
      )
    case 'cap':
      return (
        <g>
          <path d="M50 150 C50 92 78 66 116 66 C152 66 176 94 176 150 Z" fill={main.hex} stroke={INK} strokeWidth="2" />
          <path d="M113 66 V150 M80 76 C92 100 96 124 96 150 M148 76 C138 100 134 124 134 150" stroke={main.line} strokeOpacity=".3" fill="none" />
          <path d="M44 150 H178 C190 150 200 162 196 172 C150 178 80 176 44 166 Z" fill={alt.hex} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <circle cx="114" cy="64" r="5" fill={main.hex} stroke={INK} strokeWidth="2" />
        </g>
      )
    case 'glasses':
      return (
        <g stroke={INK} strokeWidth="2.4" fill="none">
          <path d="M30 108 H190" />
          <path d="M40 104 C40 150 96 156 98 112 V104 Z" fill={main.hex} fillOpacity=".9" />
          <path d="M122 104 V112 C124 156 180 150 180 104 Z" fill={main.hex} fillOpacity=".9" />
          <path d="M98 108 C104 100 116 100 122 108" />
          <path d="M54 118 C60 112 68 110 76 112" stroke="#F7F5F1" strokeOpacity=".5" />
        </g>
      )
    case 'sleeves':
      return (
        <g>
          {[-26, 26].map((dx, k) => (
            <g key={k} transform={`translate(${110 + dx} 0)`}>
              <path d="M-22 40 H22 L18 210 H-18 Z" fill={k ? alt.hex : main.hex} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
              <rect x="-22" y="40" width="44" height="14" fill="rgba(0,0,0,.1)" />
              <rect x="-18" y="196" width="36" height="14" fill="rgba(0,0,0,.1)" />
            </g>
          ))}
        </g>
      )
    default:
      return null
  }
}

/**
 * Ilustración del producto en el color elegido (`colorCode`) o en el primero.
 * SOKKO Japón usa la calceta tabi con su tono Kyoto (KnitTabi).
 */
export default function ProductArt({ product, colorCode, className = 'h-full w-full' }) {
  const main = product.colors.find((c) => c.code === colorCode) ?? product.colors[0]
  const alt = product.colors.find((c) => c.code !== main.code) ?? main
  if (product.art === 'tabi') return <KnitTabi tone={main.apiCode} className={className} />
  return (
    <svg viewBox="0 0 220 250" className={className} role="img" aria-label={`${product.name} en ${main.name}`}>
      {body(product.art, main, alt)}
    </svg>
  )
}
