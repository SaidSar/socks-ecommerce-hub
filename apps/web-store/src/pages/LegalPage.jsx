import { Link } from 'react-router-dom'
import PageIntro, { BODY, SideIndex } from '../components/info/PageIntro'
import { ACADEMIC_NOTICE } from '../content/legal'
import { usePageMeta } from '../hooks/usePageMeta'
import { formatDate } from '../utils/orderDates'

/** Aviso académico de los documentos legales: recuadro ocre-ink con 注. */
export function AcademicNotice() {
  return (
    <aside role="note" className="flex items-start gap-4 border border-ocre-ink/40 bg-ocre-ink/[.06] px-5 py-4">
      <span aria-hidden="true" lang="ja" className="font-jp text-[22px] leading-none text-ocre-ink">
        注
      </span>
      <p className="text-[13.5px] leading-relaxed text-ink">{ACADEMIC_NOTICE}</p>
    </aside>
  )
}

function Block({ block }) {
  if (typeof block === 'string') return <p>{block}</p>
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-moss">
      {block.list.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

/** Privacidad, términos y devoluciones: aviso arriba, índice numerado y artículo de 720 px como máximo. */
export default function LegalPage({ doc }) {
  usePageMeta(doc.title, doc.description)

  return (
    <main className="gutter mx-auto max-w-7xl py-14 md:py-20">
      <AcademicNotice />

      <PageIntro eyebrow="Legal" jp="規約" title={doc.title} className="mt-12">
        <p>{doc.intro}</p>
      </PageIntro>

      <div className="mt-14 grid gap-12 lg:grid-cols-[220px_minmax(0,720px)] lg:gap-20">
        <SideIndex label="Contenido" items={doc.sections} numbered />

        <article className={`max-w-[720px] ${BODY}`}>
          {doc.sections.map((section, i) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-t`} className="scroll-mt-28 border-t border-ink/10 py-8 first:border-t-0 first:pt-0">
              <h2 id={`${section.id}-t`} className="flex items-baseline gap-3 font-serif text-[26px] leading-tight font-light text-ink">
                <span className="tnum text-[17px] text-ink/50">{String(i + 1).padStart(2, '0')}</span>
                {section.title}
              </h2>
              <div className="mt-4 space-y-4">
                {section.blocks.map((block, j) => (
                  <Block key={j} block={block} />
                ))}
              </div>
            </section>
          ))}

          <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-6 text-[13px]">
            <p>
              Última actualización: <time dateTime={doc.updated.slice(0, 10)}>{formatDate(doc.updated)}</time>
            </p>
            <Link to="/contacto" className="underline decoration-ink/25 underline-offset-4 hover:text-laca">
              ¿Dudas? Escríbanos
            </Link>
          </footer>
        </article>
      </div>
    </main>
  )
}
