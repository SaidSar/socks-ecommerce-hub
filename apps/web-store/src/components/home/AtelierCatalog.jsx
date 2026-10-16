import { useId, useMemo, useState } from 'react'
import PieceCard from '../product/PieceCard'

const FILTERS = [
  { label: 'Todas', tone: null },
  { label: 'Tinta Sumi', tone: 'sumi' },
  { label: 'Blanco Washi', tone: 'washi' },
  { label: 'Rojo Laca', tone: 'laca' },
  { label: 'Oliva Matcha', tone: 'matcha' },
]

// Minúsculas y sin diacríticos: "Algodón" y "algodon" coinciden (DESIGN.md §4.5).
const normalize = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Catálogo de autor (DESIGN.md §6.7). `status`: 'loading' | 'error' | 'ready'. */
export default function AtelierCatalog({ pieces, status, query, onAcquire, onRetry }) {
  const [filter, setFilter] = useState(null)
  const baseId = useId()
  const q = query.trim()

  const list = useMemo(() => {
    const needle = normalize(q)
    return pieces.filter(
      (p) =>
        (filter === null || p.tones.includes(filter)) &&
        (!needle || normalize(`${p.name} ${p.material}`).includes(needle)),
    )
  }, [pieces, filter, q])

  const tabId = (tone) => `${baseId}-tab-${tone ?? 'todas'}`

  return (
    <section id="atelier" className="gutter scroll-mt-20 py-20 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 grid items-end gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="text-[11px] tracking-[.32em] text-matcha uppercase">
              El atelier de calcetas ·{' '}
              <span lang="ja" className="font-jp tracking-[.3em]">
                工房
              </span>
            </p>
            <h2 className="mt-4 font-serif text-[clamp(34px,5vw,64px)] leading-[1.02] font-light">Catálogo de autor</h2>
          </div>
          <div
            className="flex flex-wrap gap-x-5 lg:col-span-5 lg:justify-end"
            role="tablist"
            aria-label="Filtrar por tono"
          >
            {FILTERS.map(({ label, tone }) => {
              const active = filter === tone
              return (
                <button
                  key={label}
                  id={tabId(tone)}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`${baseId}-panel`}
                  onClick={() => setFilter(tone)}
                  className={`min-h-11 font-serif text-[17px] transition-colors ${
                    active ? 'text-laca italic' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={tabId(filter)}>
          {q && status === 'ready' && (
            <p className="mb-8 font-serif text-[17px] text-ink-soft italic" aria-live="polite">
              Piezas para “{q}”: {list.length}
            </p>
          )}

          {status === 'loading' && (
            <div className="grid gap-x-10 gap-y-16 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Cargando piezas">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex flex-col gap-4">
                  <div className="aspect-[4/5] animate-pulse bg-sand" />
                  <div className="h-7 w-2/3 animate-pulse bg-sand" />
                  <div className="h-4 w-1/2 animate-pulse bg-sand" />
                </div>
              ))}
            </div>
          )}

          {status === 'error' && (
            <div className="border-y border-ink/10 py-20 text-center" role="alert">
              <p aria-hidden="true" className="font-jp text-[48px] text-ink/15">
                休
              </p>
              <p className="mt-2 font-serif text-[22px]">No pudimos abrir el atelier.</p>
              <p className="mt-2 text-[13px] text-ink-soft">Revise su conexión e inténtelo de nuevo.</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-6 border border-ink/70 px-7 py-3 text-[11.5px] tracking-[.26em] uppercase hover:bg-ink hover:text-linen"
              >
                Reintentar
              </button>
            </div>
          )}

          {status === 'ready' &&
            (list.length ? (
              <div className="grid gap-x-10 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((p) => (
                  <PieceCard key={p.id} piece={p} onAcquire={onAcquire} />
                ))}
              </div>
            ) : (
              <div className="border-y border-ink/10 py-20 text-center">
                <p aria-hidden="true" className="font-jp text-[48px] text-ink/15">
                  無
                </p>
                <p className="mt-2 font-serif text-[22px]">Aún no hay una pieza con ese nombre.</p>
                <p className="mt-2 text-[13px] text-ink-soft">Pruebe con “Tabi”, “lino” o elija otro tono.</p>
              </div>
            ))}
        </div>
      </div>
    </section>
  )
}
