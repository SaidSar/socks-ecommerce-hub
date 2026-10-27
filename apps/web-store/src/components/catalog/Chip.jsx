// Chip de filtro o sugerencia (DESIGN_CATALOG_UI.md §5: aria-pressed en todos los chips).
export const CHIP =
  'inline-flex min-h-9 shrink-0 items-center gap-1.5 border border-ink/20 px-3.5 text-[13px] whitespace-nowrap text-ink transition-colors hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-linen'

export default function Chip({ pressed, onClick, children, ...rest }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={CHIP} {...rest}>
      {children}
    </button>
  )
}
