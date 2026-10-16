/** Banda de filosofía wabi-sabi (DESIGN.md §6.12). */
export default function Filosofia() {
  return (
    <section id="filosofia" className="gutter scroll-mt-20 bg-ink text-linen">
      <div className="mx-auto grid max-w-7xl items-center gap-10 py-20 md:py-28 lg:grid-cols-12">
        <span aria-hidden="true" className="font-jp text-[clamp(72px,10vw,128px)] leading-none text-laca-dark-bg lg:col-span-2">
          侘寂
        </span>
        <figure className="lg:col-span-7 lg:col-start-4">
          <blockquote>
            <p className="font-serif text-[clamp(26px,3.4vw,42px)] leading-[1.25] font-light italic">
              Preferimos una calceta que envejece con usted a cien que se desechan en una temporada.
            </p>
          </blockquote>
          <figcaption className="mt-6 text-[13px] tracking-[.2em] text-linen/70 uppercase">
            Wabi-sabi · la belleza de lo imperfecto y lo duradero
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
