import { useEffect, useId, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ProductGrid from '../components/catalog/ProductGrid'
import SectionHead, { EYEBROW } from '../components/catalog/SectionHead'
import Price from '../components/product/Price'
import ProductArt from '../components/product/ProductArt'
import { SeasonTag } from '../components/product/ProductCard'
import { label, LINE_LABELS, unitText } from '../config/enums'
import { useAsync } from '../hooks/useAsync'
import { useCart } from '../hooks/useCart'
import { useConfig } from '../hooks/useConfig'
import { AVAILABILITY_TEXT, availabilityOf } from '../domain/availability'
import { getProduct, listProducts } from '../services/catalogService'
import { formatPrice } from '../utils/currency'
import { formatMonthDay, formatWindow } from '../utils/dates'
import NotFound from './NotFound'

const OPEN_CART_DELAY_MS = 500

/** Aviso de temporada: fuera (ocre-ink, con descuento) o activa hasta su fin (matcha). */
function SeasonNotice({ product }) {
  const { collection, seasonWindow } = product
  if (!collection || collection.kind !== 'temporada' || !seasonWindow) return null
  if (product.offSeasonPct) {
    return (
      <p className="text-[13px] leading-snug text-ocre-ink">
        La temporada de {collection.name} ({formatWindow(seasonWindow)}) no está activa. Este producto tiene {product.offSeasonPct} % de
        descuento mientras tanto.
      </p>
    )
  }
  return (
    <p className="text-[13px] text-matcha">
      Temporada de {collection.name} activa hasta el {formatMonthDay(seasonWindow.endMonth, seasonWindow.endDay, { long: true })}.
    </p>
  )
}

function stockText(product) {
  if (!product.fewUnits) return 'Disponible'
  // "pares" solo en calcetas sueltas; paquetes y accesorios se cuentan por unidades (T-10).
  const pairs = product.type.unit === 'par' && product.unitsPerPack === 1
  const noun = pairs ? (product.stock === 1 ? 'par' : 'pares') : product.stock === 1 ? 'unidad' : 'unidades'
  return `Quedan ${product.stock} ${noun}`
}

function ProductDetail({ product }) {
  const { add, open } = useCart()
  const { fewUnitsThreshold } = useConfig()
  const [color, setColor] = useState(product.colors[0].code)
  const single = product.sizes.length === 1
  const [size, setSize] = useState(single ? product.sizes[0].code : null)
  const [error, setError] = useState(false)
  const openTimer = useRef(null)
  const errorId = useId()
  const isSokko = product.line === 'sokko'
  const swatch = product.colors.find((c) => c.code === color)
  const variant = product.variants.find((v) => v.color === color && v.size === size)
  const sku = variant?.sku
  // Sin talla elegida todavía no hay combinación: se muestra el resumen del producto.
  const availability = size ? availabilityOf(variant?.stock, fewUnitsThreshold) : null
  const soldOut = availability === 'agotado'
  const { data: related } = useAsync(() => listProducts({ line: 'accesorios' }), 'accesorios')

  useEffect(() => () => clearTimeout(openTimer.current), [])

  const addToBag = () => {
    if (!size) {
      setError(true)
      return
    }
    if (soldOut) return
    add(product, color, size)
    clearTimeout(openTimer.current)
    openTimer.current = setTimeout(open, OPEN_CART_DELAY_MS)
  }

  const eyebrowParts = [
    label(LINE_LABELS, product.line),
    product.brand.showInFilters && !product.brand.isOwnBrand ? product.brand.name : null,
    product.collection?.name,
  ].filter(Boolean)

  return (
    <main>
      <div className="gutter mx-auto max-w-7xl pt-6">
        <nav aria-label="Ruta" className="text-[12px] text-ink-soft">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link to="/" className="hover:text-ink">
                Inicio
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link to={`/linea/${product.line}`} className="hover:text-ink">
                {label(LINE_LABELS, product.line)}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="truncate text-ink">
              {product.name}
            </li>
          </ol>
        </nav>
      </div>

      <section className="gutter mx-auto grid max-w-7xl items-start gap-8 py-8 md:grid-cols-[1.1fr_1fr] md:gap-14 md:py-12">
        <div className={`relative flex aspect-[4/5] max-w-full items-center justify-center ${isSokko ? 'linen-tex bg-sand' : 'bg-shelf'}`}>
          <div className="h-[80%] w-[70%]">
            <ProductArt product={product} colorCode={color} />
          </div>
          {product.offSeasonPct ? <SeasonTag product={product} className="absolute top-4 left-4" /> : null}
          {isSokko && product.nameJp && (
            <span lang="ja" className="vertical absolute top-6 right-6 font-jp text-[20px] tracking-[.3em] text-ink-soft">
              {product.nameJp}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-7">
          <div className="flex flex-col gap-3">
            <p className={`${EYEBROW} flex flex-wrap items-center gap-2`}>
              {isSokko && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-laca" />}
              {eyebrowParts.join(' · ')}
            </p>
            <h1
              className={
                isSokko ? 'font-serif text-[44px] leading-[1.02] font-light md:text-[54px]' : 'text-[30px] leading-tight font-light md:text-[38px]'
              }
            >
              {product.name}
            </h1>
            <p className="text-[15px] text-ink-soft">{product.note}</p>
          </div>

          <div className="flex flex-col gap-2 border-y border-ink/10 py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <Price product={product} size="big" />
              <span className="text-[13px] text-ink-soft">{unitText(product.type.unit, product.unitsPerPack)} · IVA incluido</span>
            </div>
            <SeasonNotice product={product} />
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className={`${EYEBROW} mb-3`}>
              {isSokko ? 'Tono' : 'Color'} · <span className="tracking-normal text-ink normal-case">{swatch.name}</span>
            </legend>
            <div className="flex flex-wrap gap-3">
              {product.colors.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setColor(c.code)}
                  aria-pressed={color === c.code}
                  aria-label={c.name}
                  className={`h-11 w-11 rounded-full border-2 transition ${color === c.code ? 'border-ink' : 'border-transparent'}`}
                >
                  <span className="block h-full w-full rounded-full border border-ink/15" style={{ background: c.hex }} />
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className={`${EYEBROW} mb-3`}>
              Talla
              {product.type.sizeSystem === 'guante' && <span className="tracking-normal normal-case"> (guante)</span>}
            </legend>
            {single ? (
              <p className="text-[14px]">Talla única</p>
            ) : (
              <div className="grid max-w-[420px] grid-cols-3 gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => {
                      setSize(s.code)
                      setError(false)
                    }}
                    aria-pressed={size === s.code}
                    aria-describedby={error ? errorId : undefined}
                    className={`flex min-h-[56px] flex-col items-center justify-center border transition ${
                      size === s.code ? 'border-ink bg-ink text-linen' : 'border-ink/15 hover:border-ink'
                    }`}
                  >
                    <span className="text-[15px]">{s.code}</span>
                    <span className={`text-[11px] ${size === s.code ? 'text-sand-2' : 'text-ink-soft'}`}>{s.label}</span>
                  </button>
                ))}
              </div>
            )}
            {error && (
              <p id={errorId} role="alert" className="text-[13px] text-laca">
                Elige una talla para agregar a tu bolsa.
              </p>
            )}
          </fieldset>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={addToBag}
              disabled={soldOut}
              aria-describedby={error ? errorId : undefined}
              className={`inline-flex min-h-11 w-full items-center justify-center px-6 py-3 text-[13px] tracking-[.14em] text-white uppercase transition-colors ${
                soldOut ? 'cursor-not-allowed bg-ink-soft' : 'bg-laca hover:bg-laca-hover'
              }`}
            >
              {soldOut ? AVAILABILITY_TEXT.agotado : `Agregar a la bolsa · ${formatPrice(product.price)}`}
            </button>
            <p className="tnum flex flex-wrap justify-between gap-3 text-[12.5px] text-ink-soft">
              <span role="status" className={(availability ? availability !== 'disponible' : product.fewUnits) ? 'text-laca' : ''}>
                {availability ? AVAILABILITY_TEXT[availability] : stockText(product)}
              </span>
              <span>SKU {sku ?? `${product.skuPrefix}-${color}-?`}</span>
            </p>
          </div>

          {product.line === 'marcas' && (
            <p className="border-l-2 border-moss pl-3 text-[12.5px] text-ink-soft">Original {product.brand.name}, con factura del proveedor.</p>
          )}
          {product.line === 'especiales' && product.brand.showInFilters && (
            <p className="border-l-2 border-moss pl-3 text-[12.5px] text-ink-soft">
              Producto con licencia oficial {product.brand.name}. Comprado a distribuidor autorizado.
            </p>
          )}
        </div>
      </section>

      {product.line !== 'accesorios' && related?.length > 0 && (
        <section aria-labelledby="completa-tu-look" className="border-t border-ink/10">
          <div className="gutter mx-auto max-w-7xl py-14">
            <SectionHead id="completa-tu-look" eyebrow="Accesorios · todo el año" title="Completa tu look" />
            <ProductGrid products={related.slice(0, 4)} />
          </div>
        </section>
      )}
    </main>
  )
}

/** Ficha de producto (DESIGN_CATALOG_UI.md §3.7). Funciona aunque la temporada no esté activa (R-28). */
export default function ProductPage() {
  const { slug } = useParams()
  const { status, data, retry } = useAsync(() => getProduct(slug), slug)
  if (status === 'error')
    return (
      <main className="gutter mx-auto flex max-w-7xl flex-wrap items-center gap-4 py-20" role="alert">
        <p className="font-serif text-[22px]">No pudimos cargar este producto.</p>
        <button type="button" onClick={retry} className="min-h-11 border border-ink px-6 text-[12px] tracking-[.2em] uppercase">
          Reintentar
        </button>
      </main>
    )
  if (status === 'loading')
    return (
      <main className="gutter mx-auto grid max-w-7xl gap-8 py-12 md:grid-cols-[1.1fr_1fr]" aria-busy="true">
        <div className="aspect-[4/5] animate-pulse bg-sand" />
        <span className="sr-only">Cargando producto…</span>
      </main>
    )
  if (!data) return <NotFound />
  return <ProductDetail key={data.slug} product={data} />
}
