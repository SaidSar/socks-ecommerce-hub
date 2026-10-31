import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../brand/Logo'

/** Biombo de dos hojas del checkout (DESIGN_CHECKOUT.md §2): formulario y resumen. En móvil, el resumen va después. */
export default function CheckoutLayout({ title, aside, children }) {
  useEffect(() => {
    const previous = document.title
    document.title = `${title} · SOKKO`
    window.scrollTo(0, 0)
    return () => {
      document.title = previous
    }
  }, [title])

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <main className="linen-tex min-w-0">
        <div className="gutter mx-auto flex w-full max-w-[720px] flex-col py-8 lg:py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link to="/" aria-label="SOKKO, volver a la tienda" className="inline-flex min-h-11 items-center">
              <Logo variant="horizontal" className="h-10" />
            </Link>
            <Link to="/" className="inline-flex min-h-11 items-center text-[13px] text-ink-soft hover:text-ink">
              ← Volver a la tienda
            </Link>
          </div>
          <div className="pt-10">{children}</div>
        </div>
      </main>
      <aside aria-label="Su pedido" className="linen-tex relative min-w-0 overflow-hidden border-t border-ink/10 bg-sand lg:border-t-0 lg:border-l">
        <span aria-hidden="true" className="pointer-events-none absolute -top-6 right-4 select-none font-jp text-[220px] leading-none text-ink/5">
          包
        </span>
        <div className="gutter relative mx-auto w-full max-w-[720px] py-10 lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto">{aside}</div>
      </aside>
    </div>
  )
}

/** Título en versalitas de una sección. */
export const EYEBROW = 'text-[11px] tracking-[.32em] text-matcha uppercase'

/** Filas de totales, iguales en el checkout y en la confirmación. */
export function TotalsRow({ label, children, muted }) {
  return (
    <div className={`flex justify-between gap-4 ${muted ? 'text-[12.5px] text-ink-soft' : ''}`}>
      <dt className="text-ink-soft">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
