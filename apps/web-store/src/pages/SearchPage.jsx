import { useId } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchIcon } from '../components/brand/Icons'
import Chip from '../components/catalog/Chip'
import ProductGrid from '../components/catalog/ProductGrid'
import { EYEBROW } from '../components/catalog/SectionHead'
import { useAsync } from '../hooks/useAsync'
import { normalizeText, searchProducts } from '../services/catalogService'

const SUGGESTIONS = ['navidad', 'halloween', 'nike', 'guantes', 'tabi', 'pokemon']
const TAG_OFF = 'inline-flex h-[22px] items-center bg-ocre-ink px-2 text-[10.5px] font-medium tracking-[.14em] text-white uppercase'

/**
 * Búsqueda en las cuatro líneas (DESIGN_CATALOG_UI.md §3.6). Incluye la temporada inactiva con su
 * precio rebajado: eso lo decide el servicio, la vista solo lo muestra.
 */
export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const term = q.trim()
  const inputId = useId()
  const { status, data, retry } = useAsync(() => searchProducts(term), term)
  const results = data ?? []
  const offSeason = results.filter((p) => p.offSeasonPct)

  const setQuery = (value) => setParams(value ? { q: value } : {}, { replace: true })

  return (
    <main className="gutter mx-auto flex max-w-7xl flex-col gap-8 py-10 md:py-14">
      <h1 className="sr-only">Buscar</h1>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4">
        <label htmlFor={inputId} className={EYEBROW}>
          Buscar en las cuatro líneas
        </label>
        <div className="flex max-w-[720px] items-center gap-3 border-b border-ink pb-2 focus-within:border-laca">
          <SearchIcon className="h-6 w-6 shrink-0" />
          <input
            id={inputId}
            type="search"
            value={q}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Calcetas, marcas, accesorios…"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[24px] font-light outline-none placeholder:text-ink-soft/60 md:text-[30px]"
          />
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Sugerencias">
          {SUGGESTIONS.map((s) => (
            <Chip key={s} pressed={normalizeText(q) === s} onClick={() => setQuery(s)}>
              {s}
            </Chip>
          ))}
        </div>
      </form>

      {term && (
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-ink/10 pb-4" aria-live="polite">
          <p className="tnum text-[14px] text-ink-soft">
            {status === 'ready' ? `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'} para «${term}»` : 'Buscando…'}
          </p>
          {status === 'ready' && offSeason.length > 0 && (
            <p className="flex items-center gap-2 text-[13px]">
              <span className={TAG_OFF}>−{offSeason[0].offSeasonPct} %</span>
              {offSeason.length} fuera de temporada, con descuento
            </p>
          )}
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="flex flex-wrap items-center gap-4">
          <p className="font-serif text-[22px]">No pudimos buscar en este momento.</p>
          <button type="button" onClick={retry} className="min-h-11 border border-ink px-6 text-[12px] tracking-[.2em] uppercase">
            Reintentar
          </button>
        </div>
      )}

      {/* Mientras llega la búsqueda nueva se quedan los resultados anteriores, para no parpadear al escribir. */}
      {term && results.length > 0 && <ProductGrid products={results} showLine />}

      {term && status === 'ready' && results.length === 0 && (
        <div className="flex max-w-[52ch] flex-col items-start gap-4 py-16">
          <p className="font-serif text-[28px] font-light">Sin resultados para «{term}».</p>
          <p className="text-ink-soft">Prueba con el nombre de una marca, una temporada o un tipo de prenda.</p>
        </div>
      )}
    </main>
  )
}
