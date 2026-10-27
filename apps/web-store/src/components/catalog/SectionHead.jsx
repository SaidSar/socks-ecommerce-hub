import { Link } from 'react-router-dom'
import { ArrowIcon } from '../brand/Icons'

export const EYEBROW = 'text-[11px] font-normal tracking-[.22em] text-ink-soft uppercase'
export const MORE_LINK =
  'inline-flex min-h-11 items-center gap-2 text-[13px] tracking-[.12em] whitespace-nowrap text-ink-soft uppercase hover:text-ink'

/** Enlace "Ver …" con flecha, al pie derecho de un encabezado de sección. */
export function MoreLink({ to, children }) {
  return (
    <Link to={to} className={`group ${MORE_LINK}`}>
      {children}
      <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </Link>
  )
}

/** Encabezado de sección: eyebrow, título (serif solo en SOKKO Japón) y acción opcional. */
export default function SectionHead({ id, eyebrow, title, action, serif = false }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <span className={EYEBROW}>{eyebrow}</span>
        <h2 id={id} className={serif ? 'font-serif text-[34px] leading-none font-light md:text-[42px]' : 'text-[24px] leading-tight font-light md:text-[28px]'}>
          {title}
        </h2>
      </div>
      {action}
    </div>
  )
}
