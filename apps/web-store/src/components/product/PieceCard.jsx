import { useEffect, useRef, useState } from 'react'
import { FEW_UNITS } from '../../config/commerce'
import { TONES } from '../../data/catalog.mock'
import { useAuth } from '../../hooks/useAuth'
import { formatMXN } from '../../utils/currency'
import KnitTabi from './KnitTabi'
import SizeSelector from './SizeSelector'
import ToneSwatches from './ToneSwatches'

const DONE_MS = 1600
const pieceNumber = (id) => String(id).padStart(2, '0')

/** Tarjeta de pieza del atelier (DESIGN.md §6.8). */
export default function PieceCard({ piece, onAcquire }) {
  const { user } = useAuth()
  const [tone, setTone] = useState(piece.tones[0])
  // Talla elegida a mano; mientras no haya, se preselecciona la del usuario o 'M' (DESIGN_AUTH.md §3).
  const [chosenSize, setSize] = useState(null)
  const size = chosenSize ?? user?.preferredSize ?? 'M'
  const [done, setDone] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const left = piece.stock[tone] ?? 0
  const few = left <= FEW_UNITS

  const acquire = () => {
    onAcquire(piece, tone, size)
    setDone(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setDone(false), DONE_MS)
  }

  return (
    <article className="flex flex-col" aria-labelledby={`pieza-${piece.id}`}>
      <div className="relative aspect-[4/5] border border-ink/10 bg-sand">
        <div className="absolute inset-3 border border-ink/[.07]" />
        <KnitTabi key={tone} tone={tone} className="animate-fade absolute inset-0 m-auto h-[74%]" strokeWidth={1.8} />
        <span className="absolute top-5 left-5 font-serif text-[14px] text-ink-soft italic">n.º {pieceNumber(piece.id)}</span>
        <span lang="ja" className="vertical absolute top-5 right-5 font-jp text-[11px] tracking-[.45em] text-ink-soft">
          {piece.jp}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-1 pt-6">
        <div className="flex items-baseline justify-between gap-4">
          <h3 id={`pieza-${piece.id}`} className="font-serif text-[25px] leading-tight">
            {piece.name}
          </h3>
          <p className="tnum shrink-0 font-serif text-[18px] text-ink-soft">{formatMXN(piece.price)}</p>
        </div>
        <p className="-mt-2 text-[12.5px] text-ink-soft">{piece.material}</p>

        <div className="-my-2 flex items-center gap-3">
          <ToneSwatches tones={piece.tones} value={tone} onChange={setTone} label={`Tono de ${piece.name}`} />
          <span className="font-serif text-[15px] text-ink-soft italic">{TONES[tone].name}</span>
        </div>

        <div className="-my-2">
          <SizeSelector value={size} onChange={setSize} label={`Talla de ${piece.name}`} />
        </div>

        <p className={`flex items-center gap-2 text-[11px] tracking-[.18em] uppercase ${few ? 'text-laca' : 'text-matcha'}`}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${few ? 'bg-laca' : 'bg-moss'}`} />
          {few ? `Pocos ejemplares en almacén · ${left}` : piece.edition || 'Disponible en atelier'}
        </p>

        <button
          type="button"
          onClick={acquire}
          className={`group relative mt-auto self-start overflow-hidden border px-7 py-3 text-[11.5px] tracking-[.26em] uppercase transition-all active:scale-[.98] ${
            done ? 'border-matcha bg-matcha text-linen' : 'border-ink/70'
          }`}
        >
          {!done && (
            <span
              aria-hidden="true"
              className="absolute inset-0 -translate-x-full bg-ink transition-transform duration-500 ease-out group-hover:translate-x-0"
            />
          )}
          <span className={`relative transition-colors duration-500 ${done ? '' : 'group-hover:text-linen'}`}>
            {done ? 'Pieza reservada ✓' : 'Adquirir Pieza'}
          </span>
        </button>
      </div>
    </article>
  )
}
