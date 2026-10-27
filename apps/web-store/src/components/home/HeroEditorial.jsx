import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowIcon } from '../brand/Icons'
import KnitTabi from '../product/KnitTabi'
import ToneSwatches from '../product/ToneSwatches'

const pieceNumber = (n) => String(n).padStart(2, '0')

/**
 * Hero editorial del Home (DESIGN.md §6.5): SOKKO Japón es la insignia (DESIGN_CATALOG_UI.md §3.3, punto 1).
 * `piece` es la pieza destacada (Settings.FeaturedProductId) o null mientras carga.
 */
export default function HeroEditorial({ piece }) {
  // Estado local, solo visual: no cambia lo que se agrega a la bolsa.
  const [tone, setTone] = useState(null)
  const tones = piece?.colors.map((c) => c.apiCode) ?? []
  const shown = tone ?? tones[0]

  return (
    <section className="gutter linen-tex relative overflow-hidden border-b border-ink/10">
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
            足袋の工房
          </span>
        </div>

        <div className="min-w-0 lg:col-span-6">
          <p className="flex items-center gap-2 text-[11px] tracking-[.32em] text-matcha uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-laca" />
            SOKKO Japón · colección propia
          </p>
          <h1 className="mt-6 font-serif text-[clamp(44px,6.4vw,92px)] leading-[.98] font-light tracking-[-.01em]">
            Calcetas tabi tejidas en <em className="text-laca italic">lotes pequeños</em>
          </h1>
          <p className="mt-8 max-w-[34rem] text-[15.5px] leading-[1.85] text-ink-soft">
            Seis diseños propios en algodón peinado, lino y bambú, con costuras visibles y tintes naturales. Hechos en Los
            Mochis.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/linea/sokko"
              className="inline-flex min-h-11 items-center gap-2 bg-laca px-7 text-[12px] tracking-[.24em] text-white uppercase transition-colors hover:bg-laca-hover"
            >
              Ver SOKKO Japón <ArrowIcon className="h-4 w-4" />
            </Link>
            {piece && (
              <Link
                to={`/producto/${piece.slug}`}
                className="group relative inline-flex min-h-11 items-center overflow-hidden border border-ink px-7 text-[12px] tracking-[.24em] uppercase"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 translate-y-full bg-ink transition-transform duration-500 ease-out group-hover:translate-y-0"
                />
                <span className="relative transition-colors duration-500 group-hover:text-linen">{piece.name}</span>
              </Link>
            )}
          </div>
        </div>

        <figure className="min-w-0 lg:col-span-5">
          <div className="relative ml-auto aspect-[4/5] max-w-[480px] border border-ink/10 bg-sand">
            <div className="absolute inset-4 border border-ink/10" />
            {piece ? (
              <>
                <div aria-hidden="true" className="absolute top-[24%] left-[20%] aspect-square w-[30%] rounded-full bg-laca/90" />
                <KnitTabi
                  key={shown}
                  tone={shown}
                  className="animate-fade absolute inset-0 m-auto h-[78%] drop-shadow-[0_24px_24px_rgba(35,33,30,.12)]"
                />
                <span lang="ja" className="vertical absolute top-8 right-6 font-jp text-[12px] tracking-[.5em] text-ink-soft">
                  {piece.nameJp}
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
                    Pieza n.º {pieceNumber(piece.pieceNumber)} · {piece.note}
                  </p>
                </div>
                <ToneSwatches tones={tones} value={shown} onChange={setTone} label="Tono de la pieza" />
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
