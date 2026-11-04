// Piezas comunes de las páginas informativas (mockup aprobado de Nosotros, Contacto, Ayuda y legales).

export const BODY = 'text-[15.5px] leading-[1.8] text-ink-soft'
export const TITLE = 'font-serif text-[clamp(40px,5.6vw,76px)] leading-[1.02] font-light tracking-[-.01em]'
export const H2 = 'font-serif text-[clamp(28px,3.2vw,40px)] leading-tight font-light'
export const BUTTON_INK =
  'inline-flex min-h-11 items-center gap-2 border border-ink px-7 text-[12px] tracking-[.24em] uppercase transition-colors hover:bg-ink hover:text-linen'
export const BUTTON_LACA =
  'inline-flex min-h-11 items-center justify-center gap-2 bg-laca px-7 text-[12px] tracking-[.24em] text-white uppercase transition-colors hover:bg-laca-hover'

/** Encabezado pequeño en versalitas matcha: "Contacto · お問い合わせ". El japonés es decorativo. */
export function Eyebrow({ children, jp }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-[11px] tracking-[.32em] text-matcha uppercase">
      {children}
      {jp && (
        <>
          <span aria-hidden="true">·</span>
          <span aria-hidden="true" lang="ja" className="font-jp tracking-[.2em]">
            {jp}
          </span>
        </>
      )}
    </p>
  )
}

/** Eyebrow + h1 + párrafo de entrada. */
export default function PageIntro({ eyebrow, jp, title, children, className = '' }) {
  return (
    <header className={`max-w-3xl ${className}`}>
      <Eyebrow jp={jp}>{eyebrow}</Eyebrow>
      <h1 className={`mt-5 ${TITLE}`}>{title}</h1>
      {children && <div className={`mt-6 max-w-[38rem] ${BODY}`}>{children}</div>}
    </header>
  )
}

/** Índice lateral con borde izquierdo; `numbered` para los documentos legales. */
export function SideIndex({ label, items, numbered = false }) {
  return (
    <nav aria-label={label} className="lg:sticky lg:top-28 lg:self-start">
      <p className="mb-3 text-[11px] tracking-[.24em] text-ink-soft uppercase">{label}</p>
      <ol className="border-l border-ink/15">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="-ml-px flex min-h-9 items-baseline gap-3 border-l border-transparent py-1.5 pl-4 text-[14px] text-ink-soft hover:border-ink hover:text-ink"
            >
              {numbered && <span className="tnum font-serif text-[15px] text-ink/60">{String(i + 1).padStart(2, '0')}</span>}
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
