import { Link } from 'react-router-dom'
import ProductGrid from '../components/catalog/ProductGrid'
import SectionHead, { MoreLink } from '../components/catalog/SectionHead'
import ShipBand from '../components/catalog/ShipBand'
import { ArrowIcon } from '../components/brand/Icons'
import HeroEditorial from '../components/home/HeroEditorial'
import ProductCard from '../components/product/ProductCard'
import { LINE_COPY } from '../config/lines'
import { useAsync } from '../hooks/useAsync'
import { getHome } from '../services/catalogService'
import { formatMonthDay, seasonKanji } from '../utils/dates'

const CHIP =
  'inline-flex min-h-9 items-center gap-1.5 border border-ink/20 px-3.5 text-[13px] whitespace-nowrap transition-colors hover:border-ink'

/** Bloques de las cuatro líneas: el de SOKKO Japón va invertido, en serif y con 日本. */
function LineBlocks({ lines }) {
  return (
    <section aria-label="Líneas de la tienda" className="gutter mx-auto max-w-7xl border-b border-ink/10 py-12 md:py-16">
      <ul className="grid grid-cols-2 border-t border-l border-ink/10 lg:grid-cols-4">
        {lines.map((l) => {
          const isSokko = l.code === 'sokko'
          const copy = LINE_COPY[l.code]
          return (
            <li key={l.code} className="border-r border-b border-ink/10">
              <Link
                to={`/linea/${l.code}`}
                className={`group flex h-full min-h-[150px] flex-col gap-3 p-5 transition-colors md:p-7 ${isSokko ? 'bg-ink text-linen' : 'hover:bg-sand'}`}
              >
                <span className="flex items-center justify-between">
                  <span className={`tnum text-[11px] tracking-[.2em] uppercase ${isSokko ? 'text-sand-2' : 'text-ink-soft'}`}>
                    {l.count} {l.count === 1 ? 'producto' : 'productos'}
                  </span>
                  {copy.jp && (
                    <span lang="ja" className="font-jp text-[18px] text-laca-dark-bg">
                      {copy.jp}
                    </span>
                  )}
                </span>
                <span className={isSokko ? 'font-serif text-[28px] leading-none' : 'text-[19px] font-normal'}>{l.name}</span>
                <span className={`text-[13px] leading-snug ${isSokko ? 'text-sand-2' : 'text-ink-soft'}`}>{copy.blurb}</span>
                <ArrowIcon className="mt-auto h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Temporada activa: intro con kanji de estación y hasta 3 productos. Solo se muestra si hay una. */
function SeasonSection({ season, today }) {
  return (
    <section aria-labelledby="temporada" className="border-y border-ink/10 bg-sand">
      <div className="gutter mx-auto max-w-7xl py-14 md:py-16">
        <SectionHead
          id="temporada"
          eyebrow={`Temporada · ${formatMonthDay(season.start)} – ${formatMonthDay(season.end)}`}
          title={`${season.name} ya está aquí`}
          action={<MoreLink to={`/linea/especiales?collection=${season.slug}`}>Todas las especiales</MoreLink>}
        />
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 lg:grid-cols-4">
          <li className="col-span-2 flex min-w-0 flex-col gap-4 border-t border-ink pt-5 lg:col-span-1">
            <span aria-hidden="true" lang="ja" className="font-jp text-[44px] leading-none text-matcha">
              {seasonKanji(today.month)}
            </span>
            <p className="max-w-[34ch] text-[15px] leading-relaxed text-ink-soft">
              Precio completo del {formatMonthDay(season.start)} al {formatMonthDay(season.end)}. Al terminar, estas piezas
              salen del menú y quedan en el buscador con {season.offSeasonPct} % de descuento.
            </p>
          </li>
          {season.products.map((p) => (
            <li key={p.slug} className="min-w-0">
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Loading() {
  return (
    <div className="gutter mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-10 py-14 md:gap-x-6 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="aspect-[4/5] animate-pulse bg-sand" />
      ))}
      <span className="sr-only">Cargando la tienda…</span>
    </div>
  )
}

/** Home multilínea (DESIGN_CATALOG_UI.md §3.3), en el orden del mockup aprobado. */
export default function Home() {
  const { status, data, retry } = useAsync(() => getHome(), 'home')
  // Marcas de la línea Marcas que se muestran en el filtro (showInFilters).
  const brandChips = data
    ? [...new Map(data.marcas.filter((p) => p.brand.showInFilters).map((p) => [p.brand.slug, p.brand])).values()]
    : []

  return (
    <main>
      <HeroEditorial piece={data?.featured ?? null} />

      {status === 'error' && (
        <div role="alert" className="gutter mx-auto flex max-w-7xl flex-wrap items-center gap-4 py-14">
          <p className="font-serif text-[22px]">No pudimos cargar la tienda.</p>
          <button type="button" onClick={retry} className="min-h-11 border border-ink px-6 text-[12px] tracking-[.2em] uppercase">
            Reintentar
          </button>
        </div>
      )}
      {status === 'loading' && !data && <Loading />}

      {data && (
        <>
          <LineBlocks lines={data.nav.lines} />

          <section aria-labelledby="sokko-japon" className="gutter mx-auto max-w-7xl py-14 md:py-20">
            <SectionHead
              id="sokko-japon"
              serif
              eyebrow="La colección de la casa"
              title="SOKKO Japón"
              action={<MoreLink to="/linea/sokko">Ver las {data.sokkoTotal} piezas</MoreLink>}
            />
            <ProductGrid products={data.sokko} />
          </section>

          {data.season && <SeasonSection season={data.season} today={data.today} />}

          <section aria-labelledby="marcas" className="gutter mx-auto max-w-7xl py-14 md:py-20">
            <SectionHead
              id="marcas"
              eyebrow="Originales con factura del proveedor"
              title="Marcas favoritas"
              action={
                <ul className="flex flex-wrap gap-2" aria-label="Marcas">
                  {brandChips.map((b) => (
                    <li key={b.slug}>
                      <Link to={`/linea/marcas?brand=${b.slug}`} className={CHIP}>
                        {b.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              }
            />
            <ProductGrid products={data.marcas} />
          </section>

          <section aria-labelledby="completa-tu-look" className="border-t border-ink/10">
            <div className="gutter mx-auto max-w-7xl py-14 md:py-20">
              <SectionHead
                id="completa-tu-look"
                eyebrow="Accesorios · todo el año"
                title="Completa tu look"
                action={<MoreLink to="/linea/accesorios">Ver accesorios</MoreLink>}
              />
              <ProductGrid products={data.accesorios} />
            </div>
          </section>

          <ShipBand />
        </>
      )}
    </main>
  )
}
