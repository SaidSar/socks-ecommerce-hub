import { useState } from 'react'
import { scrollToId } from '../../utils/scroll'
import KnitTabi from '../product/KnitTabi'
import ToneSwatches from '../product/ToneSwatches'

const HERO_TONES = ['washi', 'sumi', 'laca', 'matcha']
const pieceNumber = (id) => String(id).padStart(2, '0')

/** Hero editorial (DESIGN.md §6.5). `piece` es null mientras carga el catálogo. */
export default function HeroEditorial({ piece }) {
  // Estado local, solo visual: no cambia la pieza del carrito.
  const [tone, setTone] = useState('washi')

  return (
    <section id="origen" className="gutter linen-tex relative scroll-mt-20 overflow-hidden">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[-6%] right-[-4%] font-jp text-[clamp(220px,34vw,460px)] leading-none text-ink/[.035] select-none"
      >
        水
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-14%] left-[38%] font-jp text-[clamp(160px,24vw,320px)] leading-none text-ink/[.035] select-none"
      >
        土
      </span>

      <div className="relative mx-auto grid max-w-7xl items-end gap-10 py-14 md:py-24 lg:grid-cols-12">
        <div className="hidden justify-center self-start pt-4 lg:col-span-1 lg:flex">
          <span aria-hidden="true" className="vertical font-jp text-[14px] tracking-[.7em] text-laca">
            細部への礼讃
          </span>
        </div>

        <div className="min-w-0 lg:col-span-6">
          <p className="text-[11px] tracking-[.32em] text-matcha uppercase">El elogio del detalle · Colección I</p>
          <h1 className="mt-6 font-serif text-[clamp(46px,7.4vw,104px)] leading-[.98] font-light tracking-[-.01em]">
            Confort que <em className="text-laca italic">Renace</em>
            <br />
            en Cada Paso
          </h1>
          <p className="mt-8 max-w-[34rem] text-[15.5px] leading-[1.85] text-ink-soft">
            Algodón peinado de cosecha selecta, tejido a 200 agujas y cerrado a mano en la punta dividida. Una pieza
            pensada para durar, que se suaviza con el tiempo y con la forma de su pie.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-8">
            <a
              href="#atelier"
              onClick={(e) => {
                e.preventDefault()
                scrollToId('atelier')
              }}
              className="group relative overflow-hidden border border-ink px-9 py-4 text-[12px] tracking-[.28em] uppercase"
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 translate-y-full bg-ink transition-transform duration-500 ease-out group-hover:translate-y-0"
              />
              <span className="relative transition-colors duration-500 group-hover:text-linen">Descubrir la Colección</span>
            </a>
            <a
              href="#materia"
              onClick={(e) => {
                e.preventDefault()
                scrollToId('materia')
              }}
              className="inline-flex min-h-11 items-center font-serif text-[18px] text-ink-soft italic underline decoration-ink/25 underline-offset-[6px] hover:text-ink"
            >
              La materia prima →
            </a>
          </div>
        </div>

        <figure className="min-w-0 lg:col-span-5">
          <div className="relative ml-auto aspect-[4/5] max-w-[480px] border border-ink/10 bg-sand">
            <div className="absolute inset-4 border border-ink/10" />
            {piece ? (
              <>
                <div aria-hidden="true" className="absolute top-[24%] left-[20%] aspect-square w-[30%] rounded-full bg-laca/90" />
                <KnitTabi
                  key={tone}
                  tone={tone}
                  className="animate-fade absolute inset-0 m-auto h-[78%] drop-shadow-[0_24px_24px_rgba(35,33,30,.12)]"
                />
                <span lang="ja" className="vertical absolute top-8 right-6 font-jp text-[12px] tracking-[.5em] text-ink-soft">
                  {piece.jp}
                </span>
              </>
            ) : (
              <div className="absolute inset-10 animate-pulse bg-sand-2/70" />
            )}
          </div>
          <figcaption className="mt-4 ml-auto flex max-w-[480px] flex-wrap items-end justify-between gap-4">
            {piece ? (
              <>
                <div>
                  <p className="font-serif text-[22px] leading-tight">{piece.name}</p>
                  <p className="mt-1 text-[12px] text-ink-soft">
                    Pieza n.º {pieceNumber(piece.id)} · Algodón peinado D-200
                  </p>
                </div>
                <ToneSwatches tones={HERO_TONES} value={tone} onChange={setTone} label="Tono de la pieza" />
              </>
            ) : (
              <div className="h-12 w-48 animate-pulse bg-sand" />
            )}
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
