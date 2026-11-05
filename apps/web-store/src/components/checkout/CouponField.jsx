import { useRef, useState } from 'react'
import { normalizeCouponCode } from '../../domain/coupons'

/**
 * "¿Tiene un código de descuento?" (DESIGN_DB D-40). Despliega campo + "Aplicar"; Enter también aplica y el código se
 * pasa a mayúsculas mientras se escribe. Con un código aplicado muestra el chip y "Quitar". El motivo de un rechazo va
 * junto al campo, nunca en un aviso genérico.
 *
 * `status`: 'idle' | 'applying' | 'applied'. `error`: texto del motivo. `notice`: por qué se quitó un código que dejó de aplicar.
 */
export default function CouponField({ idPrefix, applied, description, status, error, notice, onApply, onRemove, onEdit }) {
  const [toggled, setToggled] = useState(false)
  // Si un código no aplica o deja de aplicar, el campo queda abierto para explicar por qué.
  const open = toggled || Boolean(error || notice)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)
  const inputId = `${idPrefix}-coupon`
  const messageId = `${idPrefix}-coupon-message`
  const applying = status === 'applying'

  const apply = () => {
    const code = normalizeCouponCode(draft)
    if (!code || applying) return
    onApply(code)
  }

  if (applied) {
    return (
      <div className="mt-5 border-t border-ink/10 pt-5">
        <p className="text-[12px] tracking-[.2em] text-ink-soft uppercase">Código de descuento</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex min-h-9 items-center gap-2 border border-matcha/60 bg-linen px-3 text-[13px] text-matcha">
            <span aria-hidden="true">✓</span>
            <span className="tnum font-medium tracking-[.08em]">{applied}</span>
            {description && <span className="text-ink-soft">· {description}</span>}
          </span>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Quitar el código ${applied}`}
            className="inline-flex min-h-11 items-center text-[13px] text-ink underline decoration-ink/25 underline-offset-4 hover:text-laca"
          >
            Quitar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-5 border-t border-ink/10 pt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${idPrefix}-coupon-panel`}
        onClick={() => {
          setToggled(!open)
          if (!open) setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className="inline-flex min-h-11 items-center text-[13.5px] text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink"
      >
        ¿Tiene un código de descuento?
      </button>
      {open && (
        <div id={`${idPrefix}-coupon-panel`} className="mt-2">
          {notice && (
            <p role="status" className="mb-3 border-l-2 border-laca pl-3 text-[13px] text-ink">
              {notice}
            </p>
          )}
          <label htmlFor={inputId} className="sr-only">
            Código de descuento
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id={inputId}
              value={draft}
              onChange={(e) => {
                setDraft(normalizeCouponCode(e.target.value))
                onEdit?.()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  apply()
                }
              }}
              placeholder="Escriba su código"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={30}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? messageId : undefined}
              className={`tnum h-12 min-w-0 flex-1 border bg-linen px-3 text-[15px] tracking-[.08em] uppercase placeholder:tracking-normal placeholder:normal-case placeholder:text-ink-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 ${
                error ? 'border-laca' : 'border-ink/25'
              }`}
            />
            <button
              type="button"
              onClick={apply}
              disabled={applying || !draft}
              aria-busy={applying || undefined}
              className="h-12 shrink-0 border border-ink px-5 text-[11.5px] tracking-[.2em] uppercase transition-colors hover:bg-ink hover:text-linen disabled:cursor-not-allowed disabled:border-ink/25 disabled:text-ink-soft disabled:hover:bg-transparent"
            >
              {applying ? 'Aplicando…' : 'Aplicar'}
            </button>
          </div>
          {error && (
            <p id={messageId} role="alert" className="mt-2 text-[13px] text-laca">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
