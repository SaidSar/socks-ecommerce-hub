import Logo from '../brand/Logo'

// TODO(design): los enlaces del footer apuntan a #origen como en el mockup; definir rutas reales.
const COLUMNS = [
  { title: 'Atelier', links: ['Colección Tabi', 'Tejidos Botánicos', 'Ediciones limitadas', 'Tarjeta de regalo'] },
  { title: 'Atención', links: ['Guía de tallas en cm', 'Envíos y cortesías', 'Cambios y cuidado', 'Cita personalizada'] },
]

const SUSTAINABILITY = ['Algodón trazable', 'Tintes de bajo impacto', 'Empaque sin plástico']
const PAYMENTS = ['Visa', 'Mastercard', 'American Express', 'OXXO Pay']

export default function Footer() {
  return (
    <footer className="gutter border-t border-ink/10 bg-sand pb-[env(safe-area-inset-bottom,0px)]">
      <div className="mx-auto max-w-7xl pt-20 pb-10">
        <figure className="max-w-3xl">
          <blockquote>
            <p className="font-serif text-[clamp(24px,3vw,36px)] leading-[1.3] font-light italic">
              “Durante siglos, el tabi separó el dedo para que el pie recordara cómo apoyarse en la tierra. Nosotros
              sólo seguimos tejiendo esa memoria.”
            </p>
          </blockquote>
          <figcaption className="mt-4 text-[11px] tracking-[.3em] text-ink-soft uppercase">— Manifiesto SOKKO</figcaption>
        </figure>

        <div className="mt-16 grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
          <div>
            <Logo asLink={false} />
            <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-ink-soft">
              Calcetería artesanal con ADN japonés. Diseñada en Sinaloa, para caminar todo México.
            </p>
          </div>

          {COLUMNS.map(({ title, links }) => (
            <nav key={title} aria-label={title}>
              <h2 className="mb-4 text-[10.5px] font-normal tracking-[.3em] text-matcha uppercase">{title}</h2>
              <ul className="space-y-1">
                {links.map((l) => (
                  <li key={l}>
                    <a href="#origen" className="inline-flex min-h-8 items-center font-serif text-[17px] text-ink/80 hover:text-laca">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h2 className="mb-4 text-[10.5px] font-normal tracking-[.3em] text-matcha uppercase">Atención personalizada</h2>
            <p className="font-serif text-[18px] select-all">hola@sokko.mx</p>
            <p className="mt-1 text-[12.5px] text-ink-soft">Lunes a viernes, 9:00 a 18:00 (hora del Pacífico)</p>
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Compromisos de sostenibilidad">
              {SUSTAINABILITY.map((s) => (
                <li
                  key={s}
                  className="rounded-full border border-moss/60 px-3 py-1.5 text-[10px] tracking-[.14em] text-matcha uppercase"
                >
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col justify-between gap-4 border-t border-ink/10 pt-6 text-[12px] text-ink-soft md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10.5px] tracking-[.2em] uppercase">Pagos</span>
            {PAYMENTS.map((m) => (
              <span key={m} className="font-serif text-[15px] text-ink/80">
                {m}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <a href="#origen" className="inline-flex min-h-8 items-center hover:text-ink">
              Aviso de privacidad
            </a>
            <a href="#origen" className="inline-flex min-h-8 items-center hover:text-ink">
              Términos
            </a>
            <span>
              © 2026 SOKKO{' '}
              <span className="font-jp" lang="ja">
                ソッコ
              </span>{' '}
              · NEXUS CODE · UAdeO
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
