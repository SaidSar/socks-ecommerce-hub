import { Link, useParams, useSearchParams } from 'react-router-dom'
import Chip from '../components/catalog/Chip'
import ProductGrid from '../components/catalog/ProductGrid'
import { EYEBROW } from '../components/catalog/SectionHead'
import { label, LINE_LABELS } from '../config/enums'
import { LINE_COPY } from '../config/lines'
import { useAsync } from '../hooks/useAsync'
import { getLinePage } from '../services/catalogService'
import NotFound from './NotFound'

// Una sola faceta por línea (DESIGN_CATALOG_UI.md §3.5); el servicio da sus opciones.
const FACET_LABELS = { color: 'Tono', brand: 'Marca', collection: 'Colección', type: 'Tipo' }

function LineContent({ line }) {
  const [params, setParams] = useSearchParams()
  const { status, data, retry } = useAsync(() => getLinePage(line, Object.fromEntries(params)), `${line}?${params}`)
  const isSokko = line === 'sokko'
  const copy = LINE_COPY[line]

  const choose = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <main>
      <section className={`border-b border-ink/10 ${isSokko ? 'linen-tex' : ''}`}>
        <div className="gutter mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-6 py-10 md:py-14">
          <div className="flex min-w-0 flex-col gap-3">
            <span className={EYEBROW}>{copy.eyebrow}</span>
            <h1
              className={
                isSokko
                  ? 'flex items-baseline gap-4 font-serif text-[48px] leading-none font-light md:text-[64px]'
                  : 'text-[34px] leading-none font-light md:text-[44px]'
              }
            >
              {label(LINE_LABELS, line)}
              {copy.jp && (
                <span lang="ja" className="font-jp text-[24px] text-laca">
                  {copy.jp}
                </span>
              )}
            </h1>
            <p className="max-w-[52ch] text-[15px] text-ink-soft">{copy.blurb}</p>
          </div>
          {data && (
            <p className="tnum text-[13px] text-ink-soft" aria-live="polite">
              {data.products.length} de {data.total} productos
            </p>
          )}
        </div>
      </section>

      {data && (
        <section aria-label={`Filtrar por ${FACET_LABELS[data.facet.key].toLowerCase()}`} className="border-b border-ink/10">
          <div className="gutter mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto py-6 [scrollbar-width:none]">
            <span className={`${EYEBROW} mr-1 shrink-0`}>{FACET_LABELS[data.facet.key]}</span>
            <Chip pressed={!data.facet.active} onClick={() => choose(data.facet.key, null)}>
              Todos
            </Chip>
            {data.facet.options.map((o) => (
              <Chip
                key={o.value}
                pressed={data.facet.active === o.value}
                onClick={() => choose(data.facet.key, data.facet.active === o.value ? null : o.value)}
              >
                {o.hex && <span aria-hidden="true" className="h-3 w-3 rounded-full border border-ink/15" style={{ background: o.hex }} />}
                {o.label}
              </Chip>
            ))}
          </div>
        </section>
      )}

      <section className="gutter mx-auto flex max-w-7xl flex-col gap-10 py-10 md:py-14">
        {status === 'error' && (
          <div role="alert" className="flex flex-wrap items-center gap-4">
            <p className="font-serif text-[22px]">No pudimos cargar esta línea.</p>
            <button type="button" onClick={retry} className="min-h-11 border border-ink px-6 text-[12px] tracking-[.2em] uppercase">
              Reintentar
            </button>
          </div>
        )}
        {!data && status === 'loading' && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 lg:grid-cols-4" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse bg-sand" />
            ))}
          </div>
        )}
        {data && <ProductGrid products={data.products} />}
        {data && data.hiddenCount > 0 && (
          <p className="max-w-[70ch] border-t border-ink/10 pt-6 text-[13px] text-ink-soft">
            Hay {data.hiddenCount} {data.hiddenCount === 1 ? 'producto' : 'productos'} de temporadas que no están activas
            {` (${data.hiddenCollections.map((c) => c.name).join(', ')})`}. No aparecen aquí, pero los encuentras con el{' '}
            <Link
              to={`/buscar?q=${encodeURIComponent(data.hiddenCollections[0].name.toLowerCase())}`}
              className="text-ink underline underline-offset-4"
            >
              buscador
            </Link>
            , con descuento.
          </p>
        )}
      </section>
    </main>
  )
}

/** Listado por línea (DESIGN_CATALOG_UI.md §3.5). */
export default function LinePage() {
  const { line } = useParams()
  if (!LINE_COPY[line]) return <NotFound />
  return <LineContent key={line} line={line} />
}
