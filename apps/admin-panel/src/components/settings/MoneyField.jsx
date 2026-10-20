import { useId } from 'react'

/** Campo numérico entero con prefijo $ (o sufijo, p. ej. "pares") y error opcional. */
export default function MoneyField({ label, value, onChange, suffix, error }) {
  const id = useId()
  const errId = useId()
  return (
    <div>
      <label htmlFor={id} className="text-[12.5px] text-ink-soft">
        {label}
      </label>
      <div className={`mt-1 flex items-center h-10 max-lg:h-11 rounded-md border bg-paper focus-within:border-ai ${error ? 'border-laca' : 'border-line'}`}>
        {!suffix && (
          <span className="pl-3 text-ink-soft text-[13px]" aria-hidden="true">
            $
          </span>
        )}
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errId : undefined}
          className="w-full min-w-0 bg-transparent px-2 text-[14px] tnum outline-none"
        />
        {suffix && <span className="pr-3 text-ink-soft text-[13px]">{suffix}</span>}
      </div>
      {error && (
        <p id={errId} className="text-[12px] text-laca mt-1">
          {error}
        </p>
      )}
    </div>
  )
}
