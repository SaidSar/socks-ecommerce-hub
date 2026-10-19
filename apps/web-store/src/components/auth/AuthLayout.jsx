import { Link } from 'react-router-dom'
import { FREE_SHIPPING } from '../../config/commerce'
import { formatMXN } from '../../utils/currency'
import AuthEditorialPanel from './AuthEditorialPanel'

/**
 * Biombo de dos hojas (DESIGN_AUTH.md §2): panel editorial + hoja de formulario.
 * Pantalla completa, sin TopBar/Navbar/Footer del Home.
 */
export default function AuthLayout({ view, children }) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <AuthEditorialPanel view={view} />
      <main className="linen-tex relative">
        <div className="gutter flex min-h-full flex-col py-8 lg:py-12 lg:pl-16">
          <div className="flex items-center justify-between gap-4 text-[13px]">
            <Link to="/" className="inline-flex min-h-11 items-center text-ink-soft hover:text-ink">
              ← Volver a la tienda
            </Link>
            <span className="hidden text-ink-soft sm:inline">Envío de cortesía desde {formatMXN(FREE_SHIPPING)} MXN</span>
          </div>

          <div className="mx-auto my-auto w-full max-w-[460px] pt-10 pb-6 lg:mx-0">{children}</div>

          <footer className="flex flex-wrap items-center gap-x-5 pt-8 text-[12px] text-ink-soft">
            {/* TODO(design): enlazar a las rutas legales cuando existan. */}
            <a href="#privacidad" className="inline-flex min-h-11 items-center hover:text-ink">
              Aviso de privacidad
            </a>
            <a href="#terminos" className="inline-flex min-h-11 items-center hover:text-ink">
              Términos
            </a>
            <span>
              © 2026 SOKKO{' '}
              <span className="font-jp" aria-hidden="true">
                ソッコ
              </span>{' '}
              · NEXUS CODE · UAdeO
            </span>
          </footer>
        </div>
      </main>
    </div>
  )
}
