import { useState } from 'react'
import { Link } from 'react-router-dom'
import Chip from '../components/catalog/Chip'
import PageIntro, { BUTTON_INK, H2 } from '../components/info/PageIntro'
import { FAQ, FAQ_TOPICS } from '../content/faq'
import { useConfig } from '../hooks/useConfig'
import { usePageMeta } from '../hooks/usePageMeta'
import Breadcrumbs from '../components/layout/Breadcrumbs'

/** Una pregunta: botón con aria-expanded que controla su respuesta (region etiquetada por el botón). */
function FaqItem({ item, open, onToggle, config }) {
  const buttonId = `faq-${item.id}`
  const panelId = `faq-${item.id}-r`
  return (
    <li className="border-b border-ink/15">
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-16 w-full items-center justify-between gap-6 py-5 text-left font-serif text-[21px] leading-snug hover:text-ink/80"
        >
          {item.question}
          <span aria-hidden="true" className="w-4 shrink-0 text-center font-sans text-[22px] leading-none font-light text-laca">
            {open ? '−' : '+'}
          </span>
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!open} className="animate-fade max-w-[62ch] pb-6 text-[15px] leading-[1.8] text-ink-soft">
        {item.answer(config)}
        {item.link && (
          <p className="mt-3">
            <Link to={item.link.to} className="inline-flex min-h-11 items-center font-serif text-[16px] text-ink italic underline decoration-ink/25 underline-offset-4 hover:text-laca">
              {item.link.label} →
            </Link>
          </p>
        )}
      </div>
    </li>
  )
}

/** Preguntas frecuentes: chips de tema que filtran y acordeón (varias pueden quedar abiertas). */
export default function Faq() {
  const config = useConfig()
  const [topic, setTopic] = useState(null)
  const [openIds, setOpenIds] = useState(() => new Set([FAQ[0].id]))
  usePageMeta('Preguntas frecuentes', 'Respuestas sobre tallas, materiales, envíos, OXXO Pay, cambios, cuidado y pedidos en SOKKO.')

  const items = topic ? FAQ.filter((f) => f.topic === topic) : FAQ
  const toggle = (id) =>
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <main className="gutter mx-auto max-w-7xl pt-2 pb-14 md:pt-4 md:pb-20">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Preguntas frecuentes' }]} className="mb-8 md:mb-12" />
      <PageIntro eyebrow="Ayuda" jp="よくある質問" title="Preguntas frecuentes">
        <p>Lo que más nos preguntan sobre tallas, envíos, pagos y el cuidado de sus piezas.</p>
      </PageIntro>

      <div className="mt-12 max-w-4xl">
        <div role="group" aria-label="Filtrar por tema" className="flex flex-wrap gap-2">
          <Chip pressed={topic === null} onClick={() => setTopic(null)}>
            Todas
          </Chip>
          {FAQ_TOPICS.map((t) => (
            <Chip key={t.code} pressed={topic === t.code} onClick={() => setTopic(t.code)}>
              {t.label}
            </Chip>
          ))}
        </div>

        <p className="sr-only" aria-live="polite">
          {items.length} preguntas
        </p>
        <ul className="mt-8 border-t border-ink/15">
          {items.map((item) => (
            <FaqItem key={item.id} item={item} open={openIds.has(item.id)} onToggle={() => toggle(item.id)} config={config} />
          ))}
        </ul>

        <aside className="mt-14 flex flex-wrap items-center justify-between gap-6 border border-ink/10 bg-sand p-8">
          <div>
            <h2 className={H2}>¿No encontró su respuesta?</h2>
            <p className="mt-2 text-[14.5px] text-ink-soft">Escríbanos y le respondemos en un día hábil.</p>
          </div>
          <Link to="/contacto" className={BUTTON_INK}>
            Contactar
          </Link>
        </aside>
      </div>
    </main>
  )
}
