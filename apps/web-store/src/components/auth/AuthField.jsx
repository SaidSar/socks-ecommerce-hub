/**
 * Campos base del acceso (DESIGN_AUTH.md §4–5): línea inferior, etiqueta en versalitas,
 * aria-invalid y aria-describedby hacia el error o el hint.
 */
export default function AuthField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  hint,
  autoComplete,
  placeholder,
  right,
  inputRef,
}) {
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined

  return (
    <div>
      <label htmlFor={id} className="block text-[11px] tracking-[.24em] text-ink-soft uppercase">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          className={`w-full rounded-none border-0 border-b border-ink/25 bg-transparent pt-2.5 pb-[9px] text-[16px] font-normal text-ink outline-none transition-colors placeholder:font-light placeholder:text-ink-soft/75 focus:border-ink aria-invalid:border-laca ${
            right ? 'pr-11' : ''
          }`}
        />
        {right && <div className="absolute top-1/2 right-0 -translate-y-1/2">{right}</div>}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-[12px] text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="animate-fade mt-1.5 text-[12.5px] text-laca">
          {error}
        </p>
      )}
    </div>
  )
}

/** Casilla con texto a la derecha; el área clicable es toda la etiqueta. */
export function AuthCheckbox({ id, checked, onChange, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-[11px] text-[13.5px] leading-snug">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${id}-err` : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 accent-matcha"
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={`${id}-err`} className="animate-fade mt-1.5 ml-7 text-[12.5px] text-laca">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Botón de envío laca con spinner. No se deshabilita mientras carga (el foco no se pierde);
 * el formulario ignora envíos repetidos.
 */
export function AuthSubmit({ loading, loadingText, children }) {
  return (
    <button
      type="submit"
      aria-busy={loading}
      className="flex h-[52px] w-full items-center justify-center gap-3 bg-laca text-[12px] tracking-[.28em] text-linen uppercase transition-colors hover:bg-laca-hover"
    >
      {loading && (
        <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M12 3a9 9 0 019 9" />
        </svg>
      )}
      {loading ? loadingText : children}
    </button>
  )
}

/** Alerta general del formulario (credenciales, conteo de errores). */
export function AuthAlert({ children }) {
  return (
    <div role="alert" className="animate-fade border-l-2 border-laca bg-sand/70 px-4 py-3 text-[13.5px]">
      {children}
    </div>
  )
}
