import { Link } from 'react-router-dom'

/** Ruta, línea o producto inexistente. */
export default function NotFound() {
  return (
    <main className="gutter mx-auto flex max-w-7xl flex-col items-start gap-4 py-20">
      <span aria-hidden="true" lang="ja" className="font-jp text-[56px] leading-none text-ink/15">
        無
      </span>
      <h1 className="font-serif text-[32px] font-light">No encontramos esta página.</h1>
      <Link to="/" className="text-[14px] underline decoration-ink/25 underline-offset-4 hover:text-laca">
        Volver al inicio
      </Link>
    </main>
  )
}
