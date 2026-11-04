import { Link } from 'react-router-dom'
import { ArrowIcon } from '../components/brand/Icons'
import { BODY, Eyebrow, TITLE } from '../components/info/PageIntro'
import { usePageMeta } from '../hooks/usePageMeta'

const VALUES = [
  {
    kanji: '一',
    title: 'Diseño de autor',
    text: 'Cada pieza de SOKKO Japón nace en nuestro taller: patrón tabi de punta dividida, costuras visibles y lotes pequeños numerados.',
  },
  {
    kanji: '二',
    title: 'Hecho para caminar',
    text: 'Algodón peinado de alta densidad, lino y bambú que respiran con el calor de Sinaloa y aguantan lavado tras lavado.',
  },
  {
    kanji: '三',
    title: 'Menos huella',
    text: 'Algodón trazable, tintes minerales y de té de bajo impacto, y empaque sin plástico: un furoshiki de lino que sirve después.',
  },
]

/** Nosotros: historia de la marca, valores y sostenibilidad (mockup aprobado). */
export default function About() {
  usePageMeta(
    'Nosotros',
    'SOKKO es calcetería tabi de autor con inspiración japonesa, diseñada en Sinaloa: diseño propio, materiales que respiran y menos huella.',
  )

  return (
    <main>
      <section className="gutter mx-auto grid max-w-7xl gap-10 py-14 md:py-24 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <Eyebrow jp="私たち">Nosotros</Eyebrow>
          <h1 className={`mt-5 ${TITLE}`}>
            Confort que <em className="text-laca italic">renace</em> cada paso
          </h1>
        </div>
        <div className={`lg:col-span-5 ${BODY}`}>
          <p>
            SOKKO nació en Sinaloa con una idea sencilla: traer al calor del norte de México el tabi, la calceta japonesa de dedo separado
            que durante siglos ayudó al pie a recordar cómo apoyarse en la tierra.
          </p>
          <p className="mt-4">
            Hoy tejemos seis diseños propios en lotes pequeños y reunimos, junto a ellos, marcas, ediciones especiales y accesorios que
            comparten la misma idea: menos piezas, mejor hechas.
          </p>
        </div>
      </section>

      <div className="gutter mx-auto max-w-7xl">
        {/* TODO(design): reemplazar el placeholder por la foto del taller cuando exista. */}
        <div role="img" aria-label="Espacio reservado para la fotografía del taller" className="relative aspect-[21/8] min-h-48 overflow-hidden border border-ink/10 bg-sand">
          <div className="absolute inset-4 border border-ink/10" />
          <span aria-hidden="true" lang="ja" className="absolute inset-0 flex items-center justify-center font-jp text-[clamp(96px,18vw,240px)] leading-none text-ink/[.06] select-none">
            足袋
          </span>
        </div>
      </div>

      <section aria-labelledby="valores" className="gutter mx-auto max-w-7xl py-16 md:py-24">
        <h2 id="valores" className="sr-only">
          Nuestros valores
        </h2>
        <ol className="grid gap-10 md:grid-cols-3">
          {VALUES.map((v) => (
            <li key={v.title} className="border-t border-ink pt-6">
              <span aria-hidden="true" lang="ja" className="font-jp text-[32px] leading-none text-matcha">
                {v.kanji}
              </span>
              <h3 className="mt-4 font-serif text-[28px] leading-tight font-light">{v.title}</h3>
              <p className={`mt-3 ${BODY}`}>{v.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Manifiesto" className="bg-ink text-linen">
        <div className="gutter mx-auto flex max-w-7xl flex-col items-start gap-8 py-16 md:py-24">
          <blockquote className="max-w-4xl font-serif text-[clamp(26px,3.6vw,46px)] leading-[1.25] font-light italic">
            “No vendemos calcetas para lucirlas un día: tejemos piezas para que el pie las olvide de tan cómodas, y la memoria las
            recuerde.”
          </blockquote>
          <Link
            to="/linea/sokko"
            className="inline-flex min-h-11 items-center gap-2 border border-linen px-7 text-[12px] tracking-[.24em] uppercase transition-colors hover:bg-linen hover:text-ink"
          >
            Ver la colección <ArrowIcon className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  )
}
